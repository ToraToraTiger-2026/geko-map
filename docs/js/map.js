// 地図とピンの表示。Leaflet は vendor/leaflet で読み込み済み（グローバルの L）。

import { CONFIG, FEATURES } from "./config.js";
import { el, googleMapsUrl } from "./util.js";

const L = window.L;
let map;
let markerLayer;

export function initMap(containerId) {
  map = L.map(containerId).setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
  // 右下の著作権表示は消さない（OSMの利用条件）。
  L.tileLayer(CONFIG.TILE.url, {
    attribution: CONFIG.TILE.attribution,
    maxZoom: CONFIG.TILE.maxZoom,
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
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

  return el("div", { className: "popup" }, [
    el("h2", { text: shop.name, className: "popup-name" }),
    el("p", { text: shop.address, className: "popup-address" }),
    rows.length
      ? el("ul", { className: "popup-features" }, rows)
      : el("p", { text: "まだ特徴の投稿がありません", className: "popup-empty" }),
    el("p", {}, [link]),
    el("p", {
      text: "情報は利用者の投稿に基づきます。正確性は保証できません。必ず公式情報もご確認ください。",
      className: "popup-note",
    }),
  ]);
}

export function showShops(shops) {
  markerLayer.clearLayers();
  for (const shop of shops) {
    L.marker([shop.lat, shop.lng]).bindPopup(buildPopup(shop), { maxWidth: 280 }).addTo(markerLayer);
  }
}
