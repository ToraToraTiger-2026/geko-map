-- 01_schema.sql : テーブルの作成
-- 実行場所: Supabase の SQL Editor（左メニュー）。全文を貼って Run。
-- 注意: 再実行すると「already exists」エラーになる。作り直すときは新しいプロジェクトで実行するのが安全。

-- 特徴のマスタ（key は固定、label は後から変えてよい）
create table public.features (
  key        text primary key check (key ~ '^[a-z0-9_]{1,40}$'),
  label      text not null check (char_length(label) between 1 and 40),
  sort_order int  not null default 0,
  active     boolean not null default true
);

-- お店
-- created_by は投稿者の仮ID。auth.users への外部キーにしない（仮IDを整理しても投稿を残すため）
create table public.shops (
  id              uuid primary key default gen_random_uuid(),
  name            text not null
                    check (char_length(name) between 1 and 60 and name !~ '[<>]' and name !~* 'https?:'),
  address         text not null
                    check (char_length(address) between 1 and 120 and address !~ '[<>]' and address !~* 'https?:'),
  lat             double precision not null check (lat between -90 and 90),
  lng             double precision not null check (lng between -180 and 180),
  region          text not null default 'tokyo' check (region ~ '^[a-z0-9_-]{1,30}$'),
  google_place_id text check (google_place_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected', 'hidden')),
  created_by      uuid,
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz
);
create index shops_region_lat_lng_idx on public.shops (region, lat, lng);
create index shops_status_idx on public.shops (status);

-- 評価（特徴のチェックだけ。comment は将来のコメント機能用の予約列で、今は入力できない）
create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  status     text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected', 'hidden')),
  created_by uuid,
  created_at timestamptz not null default now(),
  comment    text check (comment is null)
);
-- 同じ仮IDは同じお店に1件だけ（却下されたものは数えない）
create unique index reviews_one_per_device_idx
  on public.reviews (shop_id, created_by)
  where status <> 'rejected' and created_by is not null;
create index reviews_shop_idx on public.reviews (shop_id);

-- 評価ごとの特徴（複数）
create table public.review_features (
  review_id   uuid not null references public.reviews (id) on delete cascade,
  feature_key text not null references public.features (key),
  primary key (review_id, feature_key)
);

-- 通報（メールは持たない）
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('shop', 'review')),
  target_id   uuid not null,
  reason      text not null check (char_length(reason) between 1 and 50),
  detail      text not null default '' check (char_length(detail) <= 200),
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_by  uuid,
  created_at  timestamptz not null default now()
);

-- 削除依頼（contact_email は任意。管理者だけが読める）
create table public.deletion_requests (
  id             uuid primary key default gen_random_uuid(),
  target_url     text check (char_length(target_url) <= 300),
  shop_id        uuid,
  requester_type text not null check (requester_type in ('shop_owner', 'poster', 'other')),
  message        text not null check (char_length(message) between 1 and 1000),
  contact_email  text check (char_length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status         text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_at    timestamptz,
  created_by     uuid,
  created_at     timestamptz not null default now()
);

-- 管理者名簿（API からは誰も読めない。登録は SQL Editor で手動）
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- 設定（投稿受付停止スイッチなど）
create table public.settings (
  key   text primary key,
  value text not null
);
insert into public.settings (key, value) values ('posting_enabled', 'true');
