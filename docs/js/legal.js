// 規約ページ用: サイト名・運営者名を config.js の値で差し込む（HTMLに直接書かない）。

import { CONFIG } from "./config.js";

for (const node of document.querySelectorAll("[data-site-name]")) node.textContent = CONFIG.SITE_NAME;
for (const node of document.querySelectorAll("[data-operator]")) node.textContent = CONFIG.OPERATOR_NAME;
