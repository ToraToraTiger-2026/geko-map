#!/bin/sh
# 公開前チェック: 秘密情報の混入や、よくあるミスを探す。リポジトリの直下で実行する:  sh scripts/precheck.sh
# 問題が見つかったら、内容を確認して直す。何も見つからなければ「OK」と表示される。
fail=0
check() { # check "説明" "パターン" "対象..."
  desc=$1; pat=$2; shift 2
  out=$(git grep -n -I -E "$pat" -- "$@" 2>/dev/null)
  if [ -n "$out" ]; then echo "[要確認] $desc"; echo "$out" | head -20; fail=1; fi
}
echo "== 秘密情報（Gitで追跡されているファイル全体）"
check "secret キー(sb_secret_)が含まれている" 'sb_secret_[A-Za-z0-9_-]{10,}' .
check "JWT形式のキー(eyJ...)が含まれている（旧service_role/anonキーの可能性）" 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.' . ':!docs/vendor'
check "秘密鍵ファイルの内容" 'BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY' .
check "パスワードらしい代入" '(password|passwd|secret)[ ]*[:=][ ]*["'"'"'][^"'"'"']{8,}["'"'"']' docs/js docs/*.html docs/admin supabase scripts
check "service_role の実際の使用（コメント以外）" '^[^/]*service_role' docs/js docs/*.html docs/admin
echo "== 画面のコード"
check "innerHTML / outerHTML / insertAdjacentHTML / document.write / eval の使用（コメント内は除く）" '^[^/]*(innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\()' docs/js docs/admin
check "インラインのスクリプト・イベント属性・style属性" '<script>|onclick=|onerror=|onload=| style=' docs/*.html docs/admin
check "先頭スラッシュのパス（GitHub Pagesのサブフォルダで壊れる）" '(href|src)="/' docs/*.html docs/admin
echo "== 公開前の設定"
grep -q 'TURNSTILE_SITE_KEY: ""' docs/js/config.js && { echo "[要確認] TURNSTILE_SITE_KEY が空です（ロボット判定が無効）"; fail=1; }
grep -q 'SITE_URL: ""' docs/js/config.js && { echo "[要確認] SITE_URL が空です"; fail=1; }
grep -q '運営者（ハンドル名・未定）' docs/js/config.js && { echo "[要確認] OPERATOR_NAME が仮表記のままです"; fail=1; }
git ls-files --error-unmatch supabase/05_test_data.sql >/dev/null 2>&1 && echo "[注意] supabase/05_test_data.sql はテスト用です。Supabase上のテストデータは公開前に削除済みか確認してください"
[ "$fail" = 0 ] && echo "OK: 問題は見つかりませんでした" || echo "上の項目を確認してください"
exit $fail
