-- 07_cleanup.sql : 定期的な整理（匿名ユーザーの削除、メールアドレスの消去）
-- 前提: 06 を実行済み。SQL Editor で Run。
--
-- 1) まず下の関数を作る（このファイルの前半。これだけでも手動で実行できる）
-- 2) 自動実行したい場合は、Supabase の Database → Extensions で pg_cron を有効にしてから、
--    ファイル末尾のコメントになっている cron.schedule の行を実行する。
--    使わない場合は、月1回 SQL Editor で `select public.cleanup_old_data();` を実行する。

create or replace function public.cleanup_old_data()
returns table (deleted_anonymous_users bigint, cleared_emails bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_users  bigint;
  v_emails bigint;
begin
  -- 作成から30日経った匿名ユーザーのうち、未対応（承認待ち・未対応）の投稿が無いものを削除する。
  -- 投稿の created_by は外部キーではないので、承認済みの投稿は残る。
  with del as (
    delete from auth.users u
    where u.is_anonymous
      and u.created_at < now() - interval '30 days'
      and not exists (select 1 from public.shops s             where s.created_by = u.id and s.status = 'pending')
      and not exists (select 1 from public.reviews r           where r.created_by = u.id and r.status = 'pending')
      and not exists (select 1 from public.reports p           where p.created_by = u.id and p.status = 'open')
      and not exists (select 1 from public.deletion_requests d where d.created_by = u.id and d.status = 'open')
    returning 1
  )
  select count(*) into v_users from del;

  -- 対応完了から6か月経った削除依頼のメールアドレスを消す
  with upd as (
    update public.deletion_requests
       set contact_email = null
     where contact_email is not null
       and resolved_at is not null
       and resolved_at < now() - interval '6 months'
    returning 1
  )
  select count(*) into v_emails from upd;

  return query select v_users, v_emails;
end;
$$;
revoke all on function public.cleanup_old_data() from public, anon, authenticated;

-- ↓ pg_cron を有効にした後に実行する（毎週日曜 18:00 UTC = 月曜 3:00 JST）
-- select cron.schedule('geko-cleanup', '0 18 * * 0', $$ select public.cleanup_old_data(); $$);
