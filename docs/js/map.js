// 地図とピンの表示。Leaflet は vendor/leaflet で読み込み済み（グローバルの L）。

import { CONFIG, FEATURES } from "./config.js";
import { el, googleMapsUrl } from "./util.js";

const L = window.L;
let map;
let markerLayer;
let handlers = {};
const markersById = new Map();

/** 地図を作る。タイルの配信元は config.js の TILE（右下の著作権表示は消さない） */
export function createMap(containerId) {
  const m = L.map(containerId).setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
  L.tileLayer(CONFIG.TILE.url, {
    attribution: CONFIG.TILE.attribution,
    maxZoom: CONFIG.TILE.maxZoom,
  }).addTo(m);
  return m;
}

/** onReview(shop) / onReport(shop) は、ポップアップのボタンを押したときに呼ばれる */
export function initMap(containerId, popupHandlers = {}) {
  map = createMap(containerId);
  markerLayer = L.layerGroup().addTo(map);
  handlers = popupHandlers;
}

function actionButton(label, onClick) {
  const b = el("button", { text: label, className: "button small", attrs: { type: "button" } });
  b.addEventListener("click", onClick);
  return b;
}

/** ポップアップの中身。DOM要素として組み立てる（innerHTMLは使わない）。 */
function buildPopup(shop) {
  const rows = FEATURES.filter((f) => (shop.features?.[f.key] ?? 0) > 0).map((f) =>
    el("li", { text: `${f.label}：${shop.features[f.key]}件の投稿で言及` })
  );

  const link = el("a", {
    text: "Googleマップで見る",
    attrs: { href: googleMapsUrl(shop), target: "_blank", rel: "noopener noreferrer" },
  });

  const deleteLink = el("a", {
    text: "削除を依頼する",
    attrs: { href: `delete-request.html?shop=${encodeURIComponent(shop.id)}` },
  });

  const actions = [];
  if (handlers.onReview) actions.push(actionButton("評価する", () => handlers.onReview(shop)));
  if (handlers.onReport) actions.push(actionButton("通報", () => handlers.onReport(shop)));

  return el("div", { className: "popup" }, [
    el("h2", { text: shop.name, className: "popup-name" }),
    el("p", { text: shop.address, className: "popup-address" }),
    rows.length
      ? el("ul", { className: "popup-features" }, rows)
      : el("p", { text: "まだ特徴の投稿がありません", className: "popup-empty" }),
    el("p", {}, [link]),
    actions.length ? el("div", { className: "button-row start" }, actions) : el("span"),
    el("p", { className: "popup-note" }, [deleteLink]),
    el("p", {
      text: "情報は利用者の投稿に基づきます。正確性は保証できません。必ず公式情報もご確認ください。",
      className: "popup-note",
    }),
  ]);
}

export function showShops(shops) {
  markerLayer.clearLayers();
  markersById.clear();
  for (const shop of shops) {
    const marker = L.marker([shop.lat, shop.lng]).bindPopup(buildPopup(shop), { maxWidth: 280 });
    marker.addTo(markerLayer);
    markersById.set(shop.id, marker);
  }
}

/** 指定した位置へ地図を動かす */
export function flyToLocation(lat, lng, zoom = 16) {
  map.flyTo([lat, lng], zoom);
}

let locationLayer = null;

/** 現在地の目印（円マーカー）を表示する。画像は使わない。位置は保存も送信もしない */
export function showCurrentLocation(lat, lng, accuracy) {
  if (locationLayer) locationLayer.remove();
  locationLayer = L.layerGroup().addTo(map);
  if (Number.isFinite(accuracy) && accuracy > 0) {
    L.circle([lat, lng], { radius: accuracy, interactive: false, weight: 1, fillOpacity: 0.1 }).addTo(locationLayer);
  }
  L.circleMarker([lat, lng], { radius: 8, weight: 3, fillOpacity: 0.9, interactive: false }).addTo(locationLayer);
}

/** 地図の左上（ズームボタンの下）に「現在地」ボタンを置く。押すと onClick(button) が呼ばれる */
export function addLocateControl(onClick) {
  const Locate = L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const box = el("div", { className: "leaflet-bar locate-control" });
      const button = el("button", {
        text: "📍",
        attrs: { type: "button", title: "現在地へ移動", "aria-label": "現在地へ移動" },
      });
      button.addEventListener("click", () => onClick(button));
      box.append(button);
      L.DomEvent.disableClickPropagation(box);
      return box;
    },
  });
  new Locate().addTo(map);
}

/** 指定したお店の位置へ移動して、ポップアップを開く（見つからなければ false） */
export function openShop(id) {
  const marker = markersById.get(id);
  if (!marker) return false;
  map.setView(marker.getLatLng(), Math.max(map.getZoom(), 16));
  marker.openPopup();
  return true;
}
