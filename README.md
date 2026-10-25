# geko-map（下戸マップ）

お酒を飲まない人でも入りやすいお店を、匿名の投稿でマップにするサイト。
設計・作業計画は別途管理。公開フォルダは `docs/`。

## 構成
- `docs/` 公開するサイト本体（ビルド不要）
- `supabase/` SQLの記録（Supabaseの SQL Editor で手動実行）
- `scripts/` `deploy/` 書き出しスクリプト・ホスティング設定の雛形（将来用）

## 注意
- 秘密情報（service_role / secret キー、パスワード等）は絶対にコミットしない。
- 公開してよいのは Supabase の URL と publishable キーのみ。

## 外部ライブラリ（`docs/vendor/`、CDNは使わない）
| 名前 | バージョン | 入手元 |
|---|---|---|
| Leaflet | 1.9.4 | https://unpkg.com/leaflet@1.9.4/dist/ （ライセンスは `docs/vendor/leaflet/LICENSE`） |
| supabase-js | 2.117.3 | https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js （`docs/vendor/supabase-js/`） |

更新は意図したときだけ手動で行う。

## ローカルでの確認
VS Code の拡張機能「Live Server」を入れ、`docs/index.html` を右クリック →「Open with Live Server」。

## 地図タイルを変えるとき
`docs/js/config.js` の `TILE`（URLと著作権表示）と、各HTMLのCSP（`img-src`）の両方を変更する。


## Supabase 依存箇所一覧（将来の移行用）
1. Auth（匿名サインイン・管理者ログイン）
2. PostgREST（自動生成API。`supabase-js` の `.from()` / `.rpc()`）
3. `auth.uid()` / `auth.jwt()` と `anon` / `authenticated` ロール（RLS で使用）
4. `pg_cron`（フェーズ3以降）

## SQL の実行順（Supabase の SQL Editor）
`supabase/01_schema.sql` → `02_rls.sql` → `03_functions.sql` → `04_seed_features.sql` → `05_test_data.sql`（テスト用。公開前に削除）

## 公開前チェック
リポジトリの直下で `sh scripts/precheck.sh` を実行する。秘密情報の混入、`innerHTML` の使用、先頭スラッシュのパスなどを調べ、
Turnstile のサイトキー・公開URL・運営者名が未設定なら知らせてくれる。`git log -p` で履歴に `sb_secret` `service_role` `password` が無いことも確認する。

## 月1回の点検
- Supabase の Usage（使用量）と Logs（異常なアクセスが無いか）を見る。
- Table Editor から `shops` / `reviews` / `reports` / `deletion_requests` を CSV でエクスポートして手元に保存（無料プランは自動バックアップが無い）。
- `select public.cleanup_old_data();` は pg_cron で毎週自動実行している。動いているか `select * from cron.job_run_details order by start_time desc limit 5;` で確認。
- Leaflet / supabase-js に重大な脆弱性の報告が無いか確認する（更新は意図したときだけ手動）。

## Supabase が一時停止したときの復旧
無料プランは、低アクティビティが7日続くと一時停止される。cron-job.org が毎日アクセスして防いでいるが、止まった場合は次の手順。
1. https://supabase.com にログインし、該当プロジェクトを開く。
2. 「Restore project」を押し、数分待つ（停止から90日以内なら復元できる）。
3. サイトを再読み込みして、地図にお店が出ることを確認する。
4. cron-job.org のジョブが失敗し続けていないか確認する。

## 緊急時（荒らし・漏えいの疑い）
- 荒らし：管理画面の「設定」で投稿の受付を停止 → 問題の投稿を「非表示」にして調査。
- 匿名サインインを止める：Supabase の Authentication で Anonymous sign-ins をオフ。
- キー漏えいの疑い：Supabase の API Keys で publishable キーを再発行 → `docs/js/config.js` を更新して再公開。管理者のパスワードを変更。
- 管理者の認証アプリを失くした：SQL Editor で `02_rls.sql` の `is_admin()` を再実行して二段階認証の必須を外し、管理画面で登録し直してから `08_require_mfa.sql` を再実行。
