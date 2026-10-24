// データ取得の窓口。画面側はここだけを呼ぶ。
// 取得元（ダミー / Supabase / 書き出しJSON）を切り替えても、返す形は同じにする。
//
// 返す形: [{ id, name, address, lat, lng, place_id, region, features: { <key>: <投稿数> } }]

import { CONFIG } from "./config.js";
import { getClient } from "./supabase-client.js";

async function loadDummy() {
  const res = await fetch(CONFIG.DUMMY_DATA_URL);
  if (!res.ok) throw new Error(`ダミーデータの読み込みに失敗しました (${res.status})`);
  const json = await res.json();
  return json.shops;
}

async function loadFromSupabase() {
  const db = getClient();
  const [shopsRes, countsRes] = await Promise.all([
    db.from("public_shops").select("id, name, address, lat, lng, region, google_place_id"),
    db.from("public_shop_feature_counts").select("shop_id, feature_key, mention_count"),
  ]);
  if (shopsRes.error) throw new Error(`お店の読み込みに失敗しました: ${shopsRes.error.message}`);
  if (countsRes.error) throw new Error(`投稿数の読み込みに失敗しました: ${countsRes.error.message}`);

  const featuresByShop = new Map();
  for (const c of countsRes.data) {
    if (!featuresByShop.has(c.shop_id)) featuresByShop.set(c.shop_id, {});
    featuresByShop.get(c.shop_id)[c.feature_key] = c.mention_count;
  }

  return shopsRes.data.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    place_id: s.google_place_id,
    region: s.region,
    features: featuresByShop.get(s.id) ?? {},
  }));
}

export async function listShops() {
  switch (CONFIG.DATA_MODE) {
    case "dummy":
      return loadDummy();
    case "supabase":
      return loadFromSupabase();
    default:
      throw new Error(`未対応のデータ読込モードです: ${CONFIG.DATA_MODE}`);
  }
}
