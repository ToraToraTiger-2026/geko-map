import { CONFIG } from "./config.js";
import { listShops } from "./data-source.js";
import { renderFilterPanel, filterShops } from "./filters.js";
import { initMap, showShops } from "./map.js";

// サイト名・運営者名は config.js の値を差し込む（HTMLに直接書かない）
document.title = CONFIG.SITE_NAME;
for (const node of document.querySelectorAll("[data-site-name]")) node.textContent = CONFIG.SITE_NAME;

const status = document.getElementById("status");

async function start() {
  initMap("map");

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
}

start();
