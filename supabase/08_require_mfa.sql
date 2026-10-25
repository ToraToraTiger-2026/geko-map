-- 08_require_mfa.sql : 管理者の操作に「二段階認証を済ませたログイン」を必須にする
-- 実行のタイミング: 管理画面で二段階認証（TOTP）の登録とログインができることを確認した「後」に実行する。
--   （先に実行すると、二段階認証を済ませるまで管理画面の操作が一切できなくなる）
-- 効果: パスワードが漏れても、認証アプリが無ければ DB 側で管理者の操作が拒否される。
-- 元に戻す: 02_rls.sql の is_admin() の定義を、もう一度実行する。
--   （認証アプリを失くして入れなくなったときも、SQL Editor からこの方法で戻せる）

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;
