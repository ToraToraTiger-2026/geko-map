// 場所の検索。住所は国土地理院、店名などは OpenStreetMap の Nominatim に問い合わせる。
// Nominatim の利用ポリシー：1秒に1リクエストまで／入力中の自動検索は禁止（呼ぶのはボタン押下かEnterのときだけ）。
// 結果は { name, address, lat, lng, kind }。kind は "address"（住所：範囲として扱う）か "place"（店名など：ピン）。
// 失敗は例外にせず、利用者向けの日本語メッセージで返す。

import { CONFIG } from "./config.js";

const GSI_URL = "https://msearch.gsi.go.jp/address-search/AddressSearch";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const TIMEOUT_MS = 8000;
const MAX_RESULTS = 5;

const MESSAGES = {
  empty: "検索する言葉を入力してください。",
  notFound: "見つかりませんでした。",
  failed: "検索に失敗しました。通信状況を確認して、時間をおいて再度お試しください。",
};

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** 国土地理院の住所検索。座標は [経度, 緯度] の順で返ってくるので、[緯度, 経度] に直す */
export async function searchAddress(q) {
  const data = await fetchJson(`${GSI_URL}?q=${encodeURIComponent(q)}`);
  if (!Array.isArray(data)) return [];
  return data
    .map((f) => {
      const [lng, lat] = f.geometry?.coordinates ?? [];
      const title = f.properties?.title ?? "";
      return { name: title, address: title, lat: Number(lat), lng: Number(lng), kind: "address" };
    })
    .filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .slice(0, MAX_RESULTS);
}

let lastNominatimAt = 0;
let nominatimQueue = Promise.resolve();

/** Nominatim への問い合わせを、前回から最小間隔をあけて1件ずつ行う */
function throttledNominatim(url) {
  const run = async () => {
    const wait = lastNominatimAt + NOMINATIM_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastNominatimAt = Date.now();
    return fetchJson(url);
  };
  const result = nominatimQueue.then(run, run);
  nominatimQueue = result.catch(() => {});
  return result;
}

/** OpenStreetMap Nominatim の場所検索。東京周辺（AREA_BOUNDS）を優先する（範囲外も除外はしない） */
export async function searchPlace(q) {
  const b = CONFIG.AREA_BOUNDS;
  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    countrycodes: "jp",
    "accept-language": "ja",
    limit: String(MAX_RESULTS),
    viewbox: `${b.west},${b.north},${b.east},${b.south}`,
  });
  const data = await throttledNominatim(`${NOMINATIM_URL}?${params}`);
  if (!Array.isArray(data)) return [];
  return data
    .map((p) => {
      const address = String(p.display_name ?? "");
      return {
        name: String(p.name || address.split(",")[0] || "").trim(),
        address,
        lat: Number(p.lat),
        lng: Number(p.lon),
        kind: AREA_CATEGORIES.has(p.category) ? "address" : "place",
      };
    })
    .filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

const PREFECTURE = /(都|道|府|県)/;
const MUNICIPALITY = /(市|区|町|村|郡)/;
const WARD_OR_CITY = /[^\s市区郡][市区郡]/; // 「新宿区」「渋谷区」など。「町田駅」のような駅名は含めない
const ADDRESS_WORDS = /(丁目|番地|番|号|[0-9０-９]+\s*[-－ー−]\s*[0-9０-９]+)/;

/** 入力が住所らしいか（数字、丁目・番地、都道府県・市区町村の語を含むか） */
export function looksLikeAddress(q) {
  if (/[0-9０-９]/.test(q) || ADDRESS_WORDS.test(q) || WARD_OR_CITY.test(q)) return true;
  return PREFECTURE.test(q) && MUNICIPALITY.test(q);
}

// Nominatim が町名・道路・行政区域などを返したときは、ピンではなく範囲として扱う
const AREA_CATEGORIES = new Set(["boundary", "place", "highway", "landuse"]);

/**
 * 住所らしければ国土地理院、そうでなければ Nominatim。0件なら、もう一方も試す。
 * 戻り値は { results: {name, address, lat, lng}[], message }。results が空のとき message に理由が入る。
 */
export async function search(query) {
  const q = String(query ?? "").trim();
  if (!q) return { results: [], message: MESSAGES.empty };

  const order = looksLikeAddress(q) ? [searchAddress, searchPlace] : [searchPlace, searchAddress];
  let failedCount = 0;
  for (const fn of order) {
    try {
      const results = await fn(q);
      if (results.length > 0) return { results, message: "" };
    } catch (err) {
      console.error(err);
      failedCount++;
    }
  }
  return { results: [], message: failedCount === order.length ? MESSAGES.failed : MESSAGES.notFound };
}
