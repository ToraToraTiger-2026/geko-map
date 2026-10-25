# 作業メモ（次回の続きから）

最終更新: 2026-10-25

## 現在地
- フェーズ0〜3 完了。フェーズ4（公開）はほぼ完了。
- 公開URL: https://toratoratiger-2026.github.io/geko-map/
- 公開済み: 地図、投稿、通報、削除依頼、管理画面、規約、プライバシー。
- Turnstile（ロボット判定）: サイト側・Supabase側とも有効（トークンなしの匿名サインインが拒否されることを確認済み）。
- 設計・作業計画の全文: `C:\Users\tatsu\.claude\plans\pasted-content-id-dc5a-giggly-ullman.md`（リポジトリ外）

## フェーズ4の残り（あなたの作業）
- [x] **cron-job.org の設定**（Supabase の一時停止を防ぐ）— Test run 成功（2026-10-25）。失敗通知メールの設定も推奨
  - URL: `https://tchtzuuiijaubjjuabda.supabase.co/rest/v1/public_shops?select=id&limit=1`
  - ヘッダー: `apikey` = config.js の publishable キー
  - 間隔: 1日1〜2回。Test run で HTTP 200 を確認。
- [ ] **二段階認証**: GitHub / Supabase / Cloudflare / cron-job.org のすべて。リカバリーコードは紙に控える。
- [ ] `supabase/08_require_mfa.sql` を実行済みか確認（管理画面で二段階認証が通ることを確認した後）。
- [ ] 規約・プライバシーの「制定日」を、公開日に直す（`docs/terms.html` / `docs/privacy.html`）。運営者のハンドル名が決まったら `config.js` の `OPERATOR_NAME` も直す。
- [ ] 1週間後に Supabase が停止していないか確認。

## 運用メモ
- 月1回の点検・停止時の復旧・緊急時の対応: README.md
- 公開前チェック: `sh scripts/precheck.sh`（push の前に実行）
- 現在、お店のデータは0件（テストデータ削除済み）。地図にお店を出すには、投稿を管理画面で承認する。

## 将来
- フェーズ5（任意）: 利用者が増えたら、承認済みデータを GitHub Actions で JSON に書き出して配信（計画 §8）。
- フェーズ6（任意）: 独自ドメイン・本格ホスティングへの移行（計画 §17）。
- 地図タイルの制限を受けたら、`config.js` の TILE と各HTMLのCSP（img-src）を国土地理院などに切り替える。

## 覚えておくこと
- コミットのメールは noreply（`geko-map` リポジトリ内の設定）。
- Live Server で出る「inline script violates CSP」は、Live Server 自身が差し込むスクリプトによるもので問題なし。
- 秘密情報（secret / service_role キー、DBパスワード、Turnstile のシークレット、管理者UID入りSQL）はGitに入れない。
