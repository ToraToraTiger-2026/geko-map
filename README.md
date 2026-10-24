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

更新は意図したときだけ手動で行う。

## ローカルでの確認
VS Code の拡張機能「Live Server」を入れ、`docs/index.html` を右クリック →「Open with Live Server」。

## 地図タイルを変えるとき
`docs/js/config.js` の `TILE`（URLと著作権表示）と、各HTMLのCSP（`img-src`）の両方を変更する。
