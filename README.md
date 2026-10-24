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
