// 匿名サインイン（利用者には見えない仮IDを、この端末に自動発行する）。
// 投稿するときに初めて呼ぶ。閲覧だけの人には仮IDを作らない。

import { getClient } from "./supabase-client.js";
import { getCaptchaToken } from "./captcha.js";

let inFlight = null;

/** 仮IDでサインイン済みにする。すでに済んでいれば何もしない。 */
export function ensureSignedIn() {
  if (!inFlight) {
    inFlight = (async () => {
      const db = getClient();
      const { data: current } = await db.auth.getSession();
      if (current.session) return current.session.user;

      const captchaToken = await getCaptchaToken(); // 公開時だけ有効（開発中は undefined）
      const { data, error } = await db.auth.signInAnonymously(
        captchaToken ? { options: { captchaToken } } : undefined
      );
      if (error) throw error;
      return data.user;
    })().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
