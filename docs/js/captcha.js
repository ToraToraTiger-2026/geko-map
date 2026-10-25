// Cloudflare Turnstile（ロボット判定）。config.js の TURNSTILE_SITE_KEY が空なら何もしない（開発中はこの状態）。
// 普段は画面に何も出ず、怪しいと判定されたときだけ確認の枠が出る（appearance: interaction-only）。
// サイトキーは公開してよい値。シークレットキーは Supabase の設定画面にだけ入れる（コードには書かない）。

import { CONFIG } from "./config.js";

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading = null;

function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_URL;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("captcha script failed"));
      document.head.append(s);
    });
  }
  return loading;
}

/** 判定に通った証明（トークン）を返す。サイトキー未設定なら undefined */
export async function getCaptchaToken() {
  if (!CONFIG.TURNSTILE_SITE_KEY) return undefined;
  await loadScript();

  // 開いているダイアログの中に置く（ダイアログの外だと、操作できなくなるため）
  const host = document.querySelector("dialog[open]") ?? document.body;
  const box = document.createElement("div");
  box.className = "captcha-box";
  host.append(box);

  try {
    return await new Promise((resolve, reject) => {
      window.turnstile.render(box, {
        sitekey: CONFIG.TURNSTILE_SITE_KEY,
        appearance: "interaction-only",
        callback: resolve,
        "error-callback": () => reject(new Error("captcha failed")),
        "timeout-callback": () => reject(new Error("captcha timeout")),
      });
    });
  } finally {
    box.remove();
  }
}
