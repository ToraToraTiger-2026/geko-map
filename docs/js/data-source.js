// データ取得の窓口。画面側はここだけを呼ぶ。
// 取得元（ダミー / Supabase / 書き出しJSON）を切り替えても、返す形は同じにする。
//
// 返す形: [{ id, name, address, lat, lng, place_id, region, features: { <key>: <投稿数> } }]

import { CONFIG } from "./config.js";

async function loadDummy() {
  const res = await fetch(CONFIG.DUMMY_DATA_URL);
  if (!res.ok) throw new Error(`ダミーデータの読み込みに失敗しました (${res.status})`);
  const json = await res.json();
  return json.shops;
}

export async function listShops() {
  switch (CONFIG.DATA_MODE) {
    case "dummy":
      return loadDummy();
    default:
      throw new Error(`未対応のデータ読込モードです: ${CONFIG.DATA_MODE}`);
  }
}
