-- 02_rls.sql : 権限の初期化と Row Level Security（RLS）
-- 方針: まず anon / authenticated から全ての権限を取り上げ、必要な分だけ付け直す。
-- 一般の利用者による書き込み用の権限・ポリシーはフェーズ3で追加する。

-- 今後作るテーブル・関数にも自動で権限が付かないようにする
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- すでにあるテーブルの権限を全て取り上げる
revoke all on all tables in schema public from anon, authenticated;

-- 管理者の判定: admins 表にいて、かつ匿名ユーザーではないこと
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- すべてのテーブルで RLS を有効化
alter table public.features          enable row level security;
alter table public.shops             enable row level security;
alter table public.reviews           enable row level security;
alter table public.review_features   enable row level security;
alter table public.reports           enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.admins            enable row level security;  -- ポリシー無し = API からは誰も触れない
alter table public.settings          enable row level security;

-- features: 誰でも読める
grant select on public.features to anon, authenticated;
create policy features_read on public.features for select to anon, authenticated using (true);

-- 管理者: 各テーブルを全操作できる（RLS が is_admin() を確認する）
grant select, insert, update, delete on
  public.features, public.shops, public.reviews, public.review_features,
  public.reports, public.deletion_requests, public.settings
  to authenticated;

create policy features_admin_write on public.features for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy shops_admin_all on public.shops for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy reviews_admin_all on public.reviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy review_features_admin_all on public.review_features for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy reports_admin_all on public.reports for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy deletion_requests_admin_all on public.deletion_requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy settings_admin_all on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- GraphQL は使わないので無効化（スキーマ構造の覗き見を防ぐ）
drop extension if exists pg_graphql;
