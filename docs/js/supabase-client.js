// Supabase への接続。supabase-js は vendor/supabase-js/supabase.js で読み込み済み（グローバルの supabase）。
// フェーズ2は閲覧のみなので、ログイン状態は保存しない（匿名サインインはフェーズ3で追加）。

import { CONFIG } from "./config.js";

let client;

function pickEnv() {
  const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
  const env = isLocal ? CONFIG.SUPABASE_DEV : CONFIG.SUPABASE_PROD.url ? CONFIG.SUPABASE_PROD : CONFIG.SUPABASE_DEV;
  if (!env.url || !env.key) {
    throw new Error("Supabase の接続先が config.js に設定されていません");
  }
  if (!env.key.startsWith("sb_publishable_")) {
    throw new Error("config.js のキーが publishable キー（sb_publishable_...）ではありません");
  }
  return env;
}

export function getClient() {
  if (!client) {
    const env = pickEnv();
    client = window.supabase.createClient(env.url, env.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
