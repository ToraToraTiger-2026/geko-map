# 作業メモ（次回の続きから）

最終更新: 2026-10-25

## 現在地
- フェーズ0〜4 完了（公開済み）。以降は運用。
- 公開URL: https://toratoratiger-2026.github.io/geko-map/
- 公開済み: 地図、投稿、通報、削除依頼、管理画面、規約、プライバシー。
- Turnstile（ロボット判定）: サイト側・Supabase側とも有効（トークンなしの匿名サインインが拒否されることを確認済み）。
- 設計・作業計画の全文: `C:\Users\tatsu\.claude\plans\pasted-content-id-dc5a-giggly-ullman.md`（リポジトリ外）

## フェーズ4（完了）
- [x] **cron-job.org の設定**（Supabase の一時停止を防ぐ）— Test run 成功（2026-10-25）。失敗通知メールの設定も推奨
  - URL: `https://tchtzuuiijaubjjuabda.supabase.co/rest/v1/public_shops?select=id&limit=1`
  - ヘッダー: `apikey` = config.js の publishable キー
  - 間隔: 1日1〜2回。Test run で HTTP 200 を確認。
- [x] GitHub の二段階認証 完了（Cloudflare も GitHub でログインしているため同時に保護される）
- [x] Supabase は GitHub でログイン（GitHub の二段階認証で保護）
- [x] cron-job.org の二段階認証（MFA）登録済み
- [x] cron-job.org の失敗通知メール 設定済み
- [x] `supabase/08_require_mfa.sql` 実行済み。二段階認証つきのログインで管理画面が使えることを確認（2026-10-25）
- [x] 制定日 2026年10月25日、運営者「下戸マップ運営事務局」に設定済み
- [ ] 1週間後に Supabase が停止していないか確認。

## 場所検索・現在地（実装済み・未公開）
- トップに検索欄と地図上の📍現在地ボタン、投稿画面に店名／住所検索を追加。詳細と Nominatim の利用条件（1秒1回・自動検索禁止）は README.md。
- 公開前に `sh scripts/precheck.sh` と、プライバシーポリシー（§4）の追記を確認。

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

## 動作確認のメモ
- 初回の流れ（登録→承認→地図表示、評価、通報、削除依頼）は確認済み（2026-10-25）。
- 管理者のブラウザから送る投稿にも、一般の利用者と同じルール（上限・1店1件）が適用される（`06_write_rules.sql` を修正済み、動作確認済み）。
- 動作確認は、管理画面にログインしていないシークレットウィンドウで行うと、一般の利用者と同じ条件で試せる。
