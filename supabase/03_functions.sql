-- 03_functions.sql : 公開用ビューと検索関数

-- 公開用ビュー: 承認済みだけ、公開してよい列だけ。
-- ビューは作成者の権限で動く（RLSを通らない）ため、列と where 条件の書き間違いが情報漏えいに直結する。
-- created_by（仮ID）は絶対に含めない。
create or replace view public.public_shops as
  select id, name, address, lat, lng, region, google_place_id
  from public.shops
  where status = 'approved';

-- 特徴ごとの投稿数（承認済みの評価 × 承認済みのお店）
create or replace view public.public_shop_feature_counts as
  select r.shop_id, rf.feature_key, count(*)::int as mention_count
  from public.reviews r
  join public.review_features rf on rf.review_id = r.id
  join public.shops s on s.id = r.shop_id
  where r.status = 'approved' and s.status = 'approved'
  group by r.shop_id, rf.feature_key;

grant select on public.public_shops, public.public_shop_feature_counts to anon, authenticated;

-- 近くの承認済みのお店（投稿時の重複確認用）。半径は最大2000m、最大20件
create or replace function public.nearby_shops(
  p_lat double precision, p_lng double precision, p_radius_m integer default 200
)
returns table (id uuid, name text, address text, lat double precision, lng double precision, distance_m integer)
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select least(greatest(coalesce(p_radius_m, 200), 1), 2000)::double precision as r
  ), cand as (
    select s.id, s.name, s.address, s.lat, s.lng,
           2 * 6371000 * asin(sqrt(
             power(sin(radians(s.lat - p_lat) / 2), 2) +
             cos(radians(p_lat)) * cos(radians(s.lat)) * power(sin(radians(s.lng - p_lng) / 2), 2)
           )) as d
    from public.shops s, params
    where s.status = 'approved'
      and s.lat between p_lat - params.r / 111320.0 and p_lat + params.r / 111320.0
      and s.lng between p_lng - params.r / (111320.0 * greatest(cos(radians(p_lat)), 0.01))
                    and p_lng + params.r / (111320.0 * greatest(cos(radians(p_lat)), 0.01))
  )
  select cand.id, cand.name, cand.address, cand.lat, cand.lng, cand.d::integer
  from cand, params
  where cand.d <= params.r
  order by cand.d
  limit 20
$$;
revoke all on function public.nearby_shops(double precision, double precision, integer) from public;
grant execute on function public.nearby_shops(double precision, double precision, integer) to anon, authenticated;

-- 管理画面用: あるお店の近く（200m）にある似たお店（承認済み・承認待ちの両方）
create or replace function public.admin_similar_shops(p_shop_id uuid)
returns table (id uuid, name text, address text, status text, distance_m integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lat double precision;
  v_lng double precision;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select s.lat, s.lng into v_lat, v_lng from public.shops s where s.id = p_shop_id;
  if not found then
    return;
  end if;

  return query
    select t.id, t.name, t.address, t.status, t.distance_m
    from (
      select s.id, s.name, s.address, s.status,
             (2 * 6371000 * asin(sqrt(
               power(sin(radians(s.lat - v_lat) / 2), 2) +
               cos(radians(v_lat)) * cos(radians(s.lat)) * power(sin(radians(s.lng - v_lng) / 2), 2)
             )))::integer as distance_m
      from public.shops s
      where s.id <> p_shop_id and s.status in ('approved', 'pending')
        and s.lat between v_lat - 0.003 and v_lat + 0.003
        and s.lng between v_lng - 0.004 and v_lng + 0.004
    ) t
    where t.distance_m <= 200
    order by t.distance_m
    limit 20;
end;
$$;
revoke all on function public.admin_similar_shops(uuid) from public;
grant execute on function public.admin_similar_shops(uuid) to authenticated;
