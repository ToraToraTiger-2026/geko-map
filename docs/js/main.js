import { CONFIG } from "./config.js";
import { listShops } from "./data-source.js";
import { renderFilterPanel, filterShops } from "./filters.js";
import { initMap, showShops, openShop, flyToLocation, showCurrentLocation, addLocateControl, showSearchResult, refreshMapSize } from "./map.js";
import { bindSearch } from "./search-ui.js";
import { openReviewDialog, openReportDialog } from "./dialogs.js";
import { isUuid } from "./util.js";

// サイト名・運営者名は config.js の値を差し込む（HTMLに直接書かない）
document.title = CONFIG.SITE_NAME;
for (const node of document.querySelectorAll("[data-site-name]")) node.textContent = CONFIG.SITE_NAME;

const status = document.getElementById("status");

// スマホでは絞り込みを閉じた状態で始め、地図を広く使えるようにする（タップで開ける）
if (window.matchMedia("(max-width: 600px)").matches) {
  document.querySelector(".filter-box")?.removeAttribute("open");
}

const searchStatus = document.getElementById("search-status");
const searchResults = document.getElementById("search-results");

/** 場所の検索（ボタン押下・Enterのときだけ）と、地図上の現在地ボタン */
function setupLocationTools() {
  const goTo = (r) => {
    showSearchResult(r);
    flyToLocation(r.lat, r.lng, 16);
    searchStatus.textContent = `${r.name}へ移動しました。`;
  };
  bindSearch({
    form: document.getElementById("search-form"),
    input: document.getElementById("search-q"),
    button: document.getElementById("search-button"),
    status: searchStatus,
    list: searchResults,
    onResults: (results) => goTo(results[0]),
    onPick: goTo,
    onListChange: refreshMapSize,
  });

  addLocateControl((button) => {
    if (!navigator.geolocation) {
      searchStatus.textContent = "このブラウザでは現在地を取得できません。";
      return;
    }
    button.disabled = true;
    searchStatus.textContent = "現在地を取得中…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        showCurrentLocation(latitude, longitude, accuracy);
        flyToLocation(latitude, longitude, 16);
        searchStatus.textContent = "現在地へ移動しました。";
        button.disabled = false;
      },
      (err) => {
        searchStatus.textContent =
          err.code === err.PERMISSION_DENIED
            ? "現在地の利用が許可されていません。ブラウザの設定で許可すると使えます。"
            : err.code === err.TIMEOUT
              ? "現在地の取得に時間がかかりすぎました。もう一度お試しください。"
              : "現在地を取得できませんでした。";
        button.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

async function start() {
  initMap("map", { onReview: openReviewDialog, onReport: openReportDialog });
  setupLocationTools();

  let shops = [];
  try {
    shops = await listShops();
  } catch (e) {
    console.error(e);
    status.textContent = "お店のデータを読み込めませんでした。時間をおいて再度お試しください。";
    return;
  }

  const update = (selectedKeys) => {
    const visible = filterShops(shops, selectedKeys);
    showShops(visible);
    status.textContent = `${visible.length}件のお店を表示中`;
  };

  renderFilterPanel(document.getElementById("filters"), update);
  update([]);

  // ?shop=<id> で開かれたら、そのお店のポップアップを開く（お店の登録画面からのリンク用）
  const target = new URLSearchParams(location.search).get("shop");
  if (isUuid(target)) openShop(target);
}

start();
