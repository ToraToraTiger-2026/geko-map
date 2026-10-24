# 作業メモ（次回の続きから）

最終更新: 2026-10-24

## 現在地
- フェーズ0・1・2 完了（コミット済み）。
- 地図は Supabase の `public_shops` / `public_shop_feature_counts` から読み込み中（`docs/js/config.js` の `DATA_MODE: "supabase"`）。
- Supabase に 01〜05 の SQL を実行済み。RLS の動作（直接読み込みは拒否、公開ビューは承認済みのみ）は確認済み。
- 設計・作業計画の全文: `C:\Users\tatsu\.claude\plans\pasted-content-id-dc5a-giggly-ullman.md`（リポジトリ外）

## 次回: フェーズ3（匿名投稿・管理者ログイン・承認・通報／削除依頼）

### 先にあなたがやること（計画の §12-C）
1. Supabase → Authentication → Sign In / Providers → **Anonymous sign-ins** をオン。
2. Authentication → Users → Add user で自分のメール・パスワードを作成（Auto Confirm）。パスワードは管理ツールに保存。
3. 表示された **User UID** で、SQL Editor に `insert into public.admins (user_id) values ('UID');` を実行（このSQLはGitに入れない）。
4. Authentication → Rate Limits で匿名サインインの上限を確認。

### Claude の作業（この順で進める）
1. DB: トリガー（`created_by` / `status` の強制、24時間あたりの上限、受付停止スイッチ、承認待ち総量の安全弁）、一般利用者向けの INSERT 権限とポリシー、`pg_cron` の整理SQL（`supabase/06_*.sql` 以降）。
2. 画面: `anon-auth.js`、`api.js`、`post-shop.html`（ピン配置・近隣一覧）、評価パネル、通報、`delete-request.html`。
3. 管理画面 `docs/admin/`: ログイン、TOTP、承認・却下・非表示、似た店の並列表示、通報／削除依頼の一覧。
4. 確認項目は計画 §10-2「セキュリティの確認手順」の6項目。

### フェーズ3で実機確認すること
- 「新規登録を許可しない」設定と匿名サインインが両立するか。
- 匿名ユーザーが MAU に数えられるか。

## 公開前に必ずやること（フェーズ4）
- テストデータの削除: `delete from public.shops where name like '%（テスト）%';`
- Turnstile（CAPTCHA）の有効化、cron-job.org の設定、規約・プライバシー本文の作成、GitHub Pages の設定。

## 覚えておくこと
- コミットのメールは noreply（`geko-map` リポジトリ内の設定）。
- Live Server で出る「inline script violates CSP」は、Live Server 自身が差し込むスクリプトによるもので問題なし。
- 秘密情報（secret / service_role キー、DBパスワード、管理者UID入りSQL）はGitに入れない。
