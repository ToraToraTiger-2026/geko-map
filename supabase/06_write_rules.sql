-- 06_write_rules.sql : 一般の利用者（匿名ID）が投稿するためのルール
-- 前提: 01〜05 を実行済み。SQL Editor で全文を貼って Run。
--
-- 方針（クライアントを信用しない）:
--   * created_by（仮ID）と status は、トリガーがサーバー側で強制的に上書きする。
--   * 上限（24時間あたり）、受付停止スイッチ、承認待ち総量の安全弁もトリガーで強制する。
--   * 新しいお店・評価は専用の関数（submit_shop / submit_review）経由で、一度に登録する。
--   * 一般の利用者に UPDATE / DELETE は一切与えない（送信後は編集不可）。
--   * auth.uid() が null（SQL Editor から実行）のときだけ、トリガーは何もしない。
--     管理者としてログインしたブラウザから送る投稿にも、一般の利用者と同じルール（上限・1店1件）をかける。
--
-- 上限の値（変えるときはこのファイルの数字を直して再実行）:
--   お店 3件/24h、評価 10件/24h、通報 10件/24h、削除依頼 3件/24h、
--   承認待ち 300件、未対応の通報・削除依頼 各1000件

-- ---------------------------------------------------------------------------
-- 共通の部品
-- ---------------------------------------------------------------------------

-- 投稿受付スイッチ（settings.posting_enabled が 'false' なら受付停止）
create or replace function public.posting_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value from public.settings where key = 'posting_enabled'), 'true') = 'true'
$$;
revoke all on function public.posting_enabled() from public, anon, authenticated;

-- 特徴キーの検査: 重複を除き、1〜8個、すべて有効な特徴であること
create or replace function public.validate_feature_keys(p_keys text[])
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_keys text[];
begin
  v_keys := array(select distinct k from unnest(coalesce(p_keys, '{}')) as k);
  if cardinality(v_keys) < 1 or cardinality(v_keys) > 8 then
    raise exception 'invalid_features';
  end if;
  if (select count(*) from public.features f where f.key = any (v_keys) and f.active) <> cardinality(v_keys) then
    raise exception 'invalid_features';
  end if;
  return v_keys;
end;
$$;
revoke all on function public.validate_feature_keys(text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- shops
-- ---------------------------------------------------------------------------
create or replace function public.tg_shops_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if not public.posting_enabled() then
    raise exception 'posting_disabled';
  end if;
  if (select count(*) from public.shops where status = 'pending')
     + (select count(*) from public.reviews r join public.shops s on s.id = r.shop_id
        where r.status = 'pending' and s.status = 'approved') >= 300 then
    raise exception 'queue_full';
  end if;
  if (select count(*) from public.shops
      where created_by = auth.uid() and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'rate_limit';
  end if;
  -- 日本全域を含む長方形（docs/js/config.js の AREA_BOUNDS と同じ値にすること）
  if new.lat not between 20.4 and 45.6 or new.lng not between 122.9 and 154.1 then
    raise exception 'out_of_area';
  end if;

  new.created_by  := auth.uid();
  new.status      := 'pending';
  new.region      := 'jp';
  new.created_at  := now();
  new.reviewed_at := null;
  return new;
end;
$$;
drop trigger if exists shops_before_insert on public.shops;
create trigger shops_before_insert before insert on public.shops
  for each row execute function public.tg_shops_before_insert();

-- 状態が変わったら reviewed_at を記録
create or replace function public.tg_shops_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists shops_before_update on public.shops;
create trigger shops_before_update before update on public.shops
  for each row execute function public.tg_shops_before_update();

-- 承認待ちのお店を承認／却下したら、そのお店の承認待ちの評価（登録時の評価）も同じ結果にする
create or replace function public.tg_shops_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    update public.reviews set status = new.status
    where shop_id = new.id and status = 'pending';
  end if;
  return null;
end;
$$;
drop trigger if exists shops_after_update on public.shops;
create trigger shops_after_update after update on public.shops
  for each row execute function public.tg_shops_after_update();

drop policy if exists shops_insert_user on public.shops;
create policy shops_insert_user on public.shops for insert to authenticated
  with check (created_by = auth.uid() and status = 'pending');

-- ---------------------------------------------------------------------------
-- reviews（直接の INSERT は許可しない。submit_shop / submit_review 経由のみ）
-- ---------------------------------------------------------------------------
create or replace function public.tg_reviews_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if not public.posting_enabled() then
    raise exception 'posting_disabled';
  end if;
  -- 評価できるのは承認済みのお店、または自分が登録した承認待ちのお店（登録時の評価）
  if not exists (
    select 1 from public.shops s
    where s.id = new.shop_id
      and (s.status = 'approved' or (s.status = 'pending' and s.created_by = auth.uid()))
  ) then
    raise exception 'invalid_shop';
  end if;
  if (select count(*) from public.shops where status = 'pending')
     + (select count(*) from public.reviews r join public.shops s on s.id = r.shop_id
        where r.status = 'pending' and s.status = 'approved') >= 300 then
    raise exception 'queue_full';
  end if;
  if (select count(*) from public.reviews
      where created_by = auth.uid() and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limit';
  end if;

  new.created_by := auth.uid();
  new.status     := 'pending';
  new.created_at := now();
  new.comment    := null;
  return new;
end;
$$;
drop trigger if exists reviews_before_insert on public.reviews;
create trigger reviews_before_insert before insert on public.reviews
  for each row execute function public.tg_reviews_before_insert();

-- 新しいお店を、最初の評価つきで登録する。戻り値はお店のID
create or replace function public.submit_shop(
  p_name text, p_address text, p_lat double precision, p_lng double precision,
  p_place_id text, p_feature_keys text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keys   text[];
  v_shop   uuid;
  v_review uuid;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_keys := public.validate_feature_keys(p_feature_keys);

  insert into public.shops (name, address, lat, lng, google_place_id)
  values (btrim(p_name), btrim(p_address), p_lat, p_lng, nullif(btrim(coalesce(p_place_id, '')), ''))
  returning id into v_shop;

  insert into public.reviews (shop_id) values (v_shop) returning id into v_review;
  insert into public.review_features (review_id, feature_key)
    select v_review, k from unnest(v_keys) as k;
  return v_shop;
end;
$$;
revoke all on function public.submit_shop(text, text, double precision, double precision, text, text[]) from public, anon;
grant execute on function public.submit_shop(text, text, double precision, double precision, text, text[]) to authenticated;

-- 既存の（承認済みの）お店への評価。同じ仮IDは同じお店に1件だけ（一意制約）
create or replace function public.submit_review(p_shop_id uuid, p_feature_keys text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keys   text[];
  v_review uuid;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_keys := public.validate_feature_keys(p_feature_keys);

  insert into public.reviews (shop_id) values (p_shop_id) returning id into v_review;
  insert into public.review_features (review_id, feature_key)
    select v_review, k from unnest(v_keys) as k;
  return v_review;
end;
$$;
revoke all on function public.submit_review(uuid, text[]) from public, anon;
grant execute on function public.submit_review(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- reports（通報。今は「お店」だけが対象）
-- ---------------------------------------------------------------------------
create or replace function public.tg_reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.target_type <> 'shop'
     or not exists (select 1 from public.shops where id = new.target_id and status = 'approved') then
    raise exception 'invalid_target';
  end if;
  if (select count(*) from public.reports where status = 'open') >= 1000 then
    raise exception 'queue_full';
  end if;
  if (select count(*) from public.reports
      where created_by = auth.uid() and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limit';
  end if;

  new.created_by := auth.uid();
  new.status     := 'open';
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists reports_before_insert on public.reports;
create trigger reports_before_insert before insert on public.reports
  for each row execute function public.tg_reports_before_insert();

drop policy if exists reports_insert_user on public.reports;
create policy reports_insert_user on public.reports for insert to authenticated
  with check (created_by = auth.uid() and status = 'open');

-- ---------------------------------------------------------------------------
-- deletion_requests（削除依頼。メールは管理者だけが読める）
-- ---------------------------------------------------------------------------
create or replace function public.tg_deletion_requests_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if (select count(*) from public.deletion_requests where status = 'open') >= 1000 then
    raise exception 'queue_full';
  end if;
  if (select count(*) from public.deletion_requests
      where created_by = auth.uid() and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'rate_limit';
  end if;

  new.created_by  := auth.uid();
  new.status      := 'open';
  new.resolved_at := null;
  new.created_at  := now();
  return new;
end;
$$;
drop trigger if exists deletion_requests_before_insert on public.deletion_requests;
create trigger deletion_requests_before_insert before insert on public.deletion_requests
  for each row execute function public.tg_deletion_requests_before_insert();

-- 対応済みにしたら resolved_at を記録（6か月後のメール消去の基準）
create or replace function public.tg_deletion_requests_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'open' and new.status in ('resolved', 'dismissed') then
    new.resolved_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists deletion_requests_before_update on public.deletion_requests;
create trigger deletion_requests_before_update before update on public.deletion_requests
  for each row execute function public.tg_deletion_requests_before_update();

drop policy if exists deletion_requests_insert_user on public.deletion_requests;
create policy deletion_requests_insert_user on public.deletion_requests for insert to authenticated
  with check (created_by = auth.uid() and status = 'open');
