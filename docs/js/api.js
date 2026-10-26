// 書き込みの窓口。画面側は Supabase を直接呼ばず、ここの関数だけを使う。
// 上限や権限のチェックはDB側（supabase/06_write_rules.sql）が行う。ここは送るだけ。

import { getClient } from "./supabase-client.js";

/** 新しいお店を、最初の評価つきで登録する。戻り値はお店のID */
export async function submitShop({ name, address, lat, lng, placeId, featureKeys }) {
  const { data, error } = await getClient().rpc("submit_shop", {
    p_name: name,
    p_address: address,
    p_lat: lat,
    p_lng: lng,
    p_place_id: placeId || null,
    p_feature_keys: featureKeys,
  });
  if (error) throw error;
  return data;
}

/** 既存のお店への評価（特徴のチェックのみ） */
export async function submitReview(shopId, featureKeys) {
  const { error } = await getClient().rpc("submit_review", {
    p_shop_id: shopId,
    p_feature_keys: featureKeys,
  });
  if (error) throw error;
}

export async function submitReport(shopId, reason, detail) {
  const { error } = await getClient()
    .from("reports")
    .insert({ target_type: "shop", target_id: shopId, reason, detail: detail || "" });
  if (error) throw error;
}

export async function submitDeletionRequest({ targetText, shopId, requesterType, message, email }) {
  const { error } = await getClient()
    .from("deletion_requests")
    .insert({
      target_url: targetText || null,
      shop_id: shopId || null,
      requester_type: requesterType,
      message,
      contact_email: email || null,
    });
  if (error) throw error;
}

/** 近くの承認済みのお店（重複確認用） */
export async function nearbyShops(lat, lng, radiusM) {
  const { data, error } = await getClient().rpc("nearby_shops", {
    p_lat: lat,
    p_lng: lng,
    p_radius_m: radiusM,
  });
  if (error) throw error;
  return data;
}

/** 削除依頼フォームで、対象のお店の名前を表示するために使う */
export async function getPublicShop(shopId) {
  const { data, error } = await getClient()
    .from("public_shops")
    .select("id, name, address")
    .eq("id", shopId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const MESSAGES = {
  posting_disabled: "現在、投稿の受け付けを一時停止しています。",
  queue_full: "混み合っているため、いまは受け付けできません。時間をおいてお試しください。",
  rate_limit: "投稿回数の上限に達しました。24時間ほどあけてお試しください。",
  out_of_area: "現在は日本国内のお店だけ登録できます。",
  invalid_features: "特徴の選択が正しくありません。",
  invalid_target: "対象のお店が見つかりませんでした。",
  invalid_shop: "対象のお店が見つかりませんでした。",
};

/** エラーを利用者向けの文言にする（サーバーの生のメッセージは画面に出さない） */
export function describeError(err) {
  console.error(err);
  const text = err?.message ?? "";
  for (const [key, message] of Object.entries(MESSAGES)) {
    if (text.includes(key)) return message;
  }
  if (err?.code === "23505") return "このお店には、すでにこの端末から評価を送信しています。";
  if (err?.code === "23514") return "使えない文字（< > や http など）が含まれているか、長すぎる項目があります。";
  if (/anonymous|captcha/i.test(text)) return "投稿の準備に失敗しました。時間をおいて、もう一度お試しください。";
  return "送信できませんでした。時間をおいて、もう一度お試しください。";
}
