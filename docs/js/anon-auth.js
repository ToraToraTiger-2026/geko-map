// 匿名サインイン（利用者には見えない仮IDを、この端末に自動発行する）。
// 投稿するときに初めて呼ぶ。閲覧だけの人には仮IDを作らない。

import { getClient } from "./supabase-client.js";

let inFlight = null;

/** 仮IDでサインイン済みにする。すでに済んでいれば何もしない。captchaToken は公開時のTurnstile用。 */
export function ensureSignedIn(captchaToken) {
  if (!inFlight) {
    inFlight = (async () => {
      const db = getClient();
      const { data: current } = await db.auth.getSession();
      if (current.session) return current.session.user;

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
