# 作業メモ（次回の続きから）

最終更新: 2026-10-25

## 現在地
- フェーズ0・1・2・3 の実装は完了（コミット済み）。
- フェーズ3で作ったもの: 投稿用のDBルール（`supabase/06`）、整理用の関数（`07`）、二段階認証の必須化（`08`）、
  投稿・評価・通報・削除依頼の画面、管理画面 `docs/admin/`。
- 設計・作業計画の全文: `C:\Users\tatsu\.claude\plans\pasted-content-id-dc5a-giggly-ullman.md`（リポジトリ外）

## フェーズ3の残り（小さな確認）
- [ ] `supabase/08_require_mfa.sql` を実行したか（管理画面で二段階認証を済ませた後に実行）。
- [ ] Supabase の「新規ユーザー登録を許可」をオフにしても、匿名サインインが動くか実測。
      （オフにして、地図から評価を送って成功すれば両立。失敗したらオンに戻す。管理者の安全性は `admins` 表が守るので、オフは必須ではない）
- [ ] テストデータの整理: `delete from public.shops where name like '%（テスト）%';`（公開前に必ず）
- [ ] 匿名ユーザーの掃除: pg_cron を有効にして `07_cleanup.sql` 末尾の cron.schedule を実行、
      または月1回 `select public.cleanup_old_data();` を手動実行。
- [ ] 匿名ユーザーが MAU に数えられるか（Supabase の Usage 画面で確認）。

## 次: フェーズ4（GitHub Pages で公開）
### あなたの作業（計画 §12-D）
1. GitHub で Public リポジトリ `geko-map` を作成 → `git remote add` と `git push -u origin main`。
2. Settings → Pages → Deploy from a branch → `main` / `/docs`。
3. Supabase → Authentication → URL Configuration → Site URL に公開URLを設定。
4. Cloudflare Turnstile を作成（ドメイン=`ユーザー名.github.io`）→ サイトキーを `config.js`、シークレットキーを Supabase（Authentication → Attack Protection → CAPTCHA）に入力。
5. cron-job.org でジョブ作成（`public_shops` への GET、ヘッダー `apikey`、1日1〜2回）。
6. GitHub / Supabase / Cloudflare / cron-job.org の全てで二段階認証を有効化。

### Claude の作業
- Turnstile の組み込み（`anon-auth.js` の captchaToken）と CSP の更新（`challenges.cloudflare.com`）。
- `config.js` の `SUPABASE_PROD`、`SITE_URL` の設定。タイルCSP、相対パスの確認。
- 利用規約・プライバシーポリシー本文（運営者はハンドル名、連絡窓口は削除依頼フォームのみ、メールは対応完了後6か月で削除）。
- 公開前チェックリスト（キー漏れ検査、`git log -p` の検索、noindex）、README、OGP。
- 復旧手順書（Supabase の一時停止からの復元）。

## 公開前に必ずやること
- テストデータの削除（上記）。
- Turnstile の有効化。
- 規約・プライバシーの本文作成。
- セキュリティ確認手順（計画 §10-2）の6項目を、公開URLで再実施。

## 覚えておくこと
- コミットのメールは noreply（`geko-map` リポジトリ内の設定）。
- Live Server で出る「inline script violates CSP」は、Live Server 自身が差し込むスクリプトによるもので問題なし。
- 秘密情報（secret / service_role キー、DBパスワード、管理者UID入りSQL）はGitに入れない。
- 登録画面の近隣一覧は、承認済みの店だけが対象（半径200m）。テストで出ないときは `status` を確認。
