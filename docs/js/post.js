// お店の登録画面。ピンの位置は、地図をタップするか、検索の候補を選んで決める。

import { CONFIG, FEATURES } from "./config.js";
import { createMap, SEARCH_AREA_RADIUS_M } from "./map.js";
import { bindSearch } from "./search-ui.js";
import { el, isUuid } from "./util.js";
import { ensureSignedIn } from "./anon-auth.js";
import { submitShop, nearbyShops, describeError } from "./api.js";

const L = window.L;
const $ = (id) => document.getElementById(id);

const map = createMap("pick-map");
let marker = null;
let position = null; // { lat, lng }
let searchArea = null; // 住所検索の範囲円
let lookupToken = 0;
let nearbyCount = 0;

// 特徴のチェックボックス
const featureInputs = FEATURES.map((f) => {
  const input = el("input", { attrs: { type: "checkbox", value: f.key } });
  $("features").append(el("label", { className: "filter-item" }, [input, el("span", { text: f.label })]));
  return input;
});

function inArea({ lat, lng }) {
  const b = CONFIG.AREA_BOUNDS;
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}

async function updateNearby() {
  const token = ++lookupToken;
  const list = $("nearby-list");
  list.replaceChildren();
  nearbyCount = 0;
  $("nearby").hidden = true;
  $("confirm-row").hidden = true;
  $("f-confirm").checked = false;

  let shops;
  try {
    shops = await nearbyShops(position.lat, position.lng, CONFIG.NEARBY_RADIUS_M);
  } catch (err) {
    console.error(err);
    return; // 近隣の確認に失敗しても、登録自体は続けられるようにする
  }
  if (token !== lookupToken || shops.length === 0) return;

  nearbyCount = shops.length;
  for (const s of shops) {
    const item = el("li", {}, [
      el("strong", { text: s.name }),
      el("span", { text: `（約${s.distance_m}m）　${s.address}` }),
    ]);
    if (isUuid(s.id)) {
      item.append(
        document.createTextNode(" "),
        el("a", { text: "このお店を評価する", attrs: { href: `index.html?shop=${encodeURIComponent(s.id)}` } })
      );
    }
    list.append(item);
  }
  $("nearby").hidden = false;
  $("confirm-row").hidden = false;
}

function setPosition(latlng) {
  position = { lat: latlng.lat, lng: latlng.lng };
  $("pin-text").textContent = inArea(position)
    ? `ピンの位置：緯度 ${position.lat.toFixed(5)}、経度 ${position.lng.toFixed(5)}`
    : "ピンが対象地域（東京周辺）の外にあります。";
  if (inArea(position)) updateNearby();
}

/** ピンを置く（すでにあれば動かす）。位置の確定は setPosition() を通す */
function placeMarker(latlng) {
  if (!marker) {
    marker = L.marker(latlng, { draggable: true }).addTo(map);
    marker.on("dragend", () => setPosition(marker.getLatLng()));
  } else {
    marker.setLatLng(latlng);
  }
  setPosition(latlng);
}

map.on("click", (e) => placeMarker(e.latlng));

// 検索で見つけた候補を選んだとき：ピンを立てて寄り、空欄の店名・住所だけ自動入力する（入力済みは上書きしない）
function pickResult(r) {
  // 住所の検索結果は位置が町名レベルなので、範囲円を添える（ピンは動かせるので、円の中で正確な位置に直す）
  if (searchArea) searchArea.remove();
  searchArea = null;
  if (r.kind === "address") {
    searchArea = L.circle([r.lat, r.lng], { radius: SEARCH_AREA_RADIUS_M, weight: 2, fillOpacity: 0.15, interactive: false }).addTo(map);
  }
  placeMarker({ lat: r.lat, lng: r.lng });
  map.setView([r.lat, r.lng], 17);
  if (!$("f-name").value.trim()) $("f-name").value = r.name.slice(0, 60);
  if (!$("f-address").value.trim()) $("f-address").value = r.address.slice(0, 120);
  $("search-status").textContent = `${r.name}の位置にピンを置きました。名前と住所は必要に応じて直してください。`;
  $("search-results").replaceChildren();
}

bindSearch({
  form: $("search-form"),
  input: $("search-q"),
  button: $("search-button"),
  status: $("search-status"),
  list: $("search-results"),
  onPick: pickResult,
  listSingle: true,
  emptyHint: "地図をタップしてピンを置いてください。",
});

/** 入力を確認して、問題があれば利用者向けの文を返す（最終的な検査はDB側でも行われる） */
function validate(values) {
  if (!position) return "地図をタップして、お店の場所にピンを置いてください。";
  if (!inArea(position)) return "現在は東京周辺のお店だけ登録できます。";
  if (!values.name) return "お店の名前を入力してください。";
  if (!values.address) return "住所を入力してください。";
  if (/[<>]/.test(values.name + values.address) || /https?:/i.test(values.name + values.address)) {
    return "お店の名前と住所に、< > や http は使えません。";
  }
  if (values.placeId && !/^[A-Za-z0-9_-]{10,200}$/.test(values.placeId)) {
    return "GoogleマップのIDの形式が正しくありません。わからなければ空欄にしてください。";
  }
  if (values.featureKeys.length === 0) return "当てはまる特徴を1つ以上選んでください。";
  if (nearbyCount > 0 && !$("f-confirm").checked) return "近くの一覧に同じお店がないか確認し、チェックを入れてください。";
  return null;
}

$("shop-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = $("form-message");
  const submit = $("submit");

  const values = {
    name: $("f-name").value.trim(),
    address: $("f-address").value.trim(),
    placeId: $("f-place").value.trim(),
    featureKeys: featureInputs.filter((i) => i.checked).map((i) => i.value),
  };
  const problem = validate(values);
  if (problem) {
    message.textContent = problem;
    return;
  }

  submit.disabled = true;
  message.textContent = "送信中…";
  try {
    await ensureSignedIn();
    await submitShop({ ...values, lat: position.lat, lng: position.lng });
    message.textContent = "送信しました。ご協力ありがとうございます。管理者の承認後に地図へ表示されます。";
    $("shop-form").reset();
    if (marker) map.removeLayer(marker);
    marker = null;
    if (searchArea) searchArea.remove();
    searchArea = null;
    position = null;
    nearbyCount = 0;
    $("nearby").hidden = true;
    $("confirm-row").hidden = true;
    $("pin-text").textContent = "まだピンを置いていません。";
  } catch (err) {
    message.textContent = describeError(err);
  } finally {
    submit.disabled = false;
  }
});
