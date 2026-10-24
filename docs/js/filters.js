// 絞り込み: 選んだ特徴を「すべて」満たすお店だけを残す（AND）。

import { CONFIG, FEATURES } from "./config.js";
import { el } from "./util.js";

/** チェックボックスを container に描画し、変更時に onChange(選択中のkey配列) を呼ぶ。 */
export function renderFilterPanel(container, onChange) {
  const selected = new Set();

  for (const f of FEATURES) {
    const input = el("input", { attrs: { type: "checkbox", value: f.key } });
    input.addEventListener("change", () => {
      if (input.checked) selected.add(f.key);
      else selected.delete(f.key);
      onChange([...selected]);
    });
    container.append(el("label", { className: "filter-item" }, [input, el("span", { text: f.label })]));
  }

  const clear = el("button", { text: "絞り込みを解除", className: "link-button", attrs: { type: "button" } });
  clear.addEventListener("click", () => {
    selected.clear();
    for (const cb of container.querySelectorAll("input[type=checkbox]")) cb.checked = false;
    onChange([]);
  });
  container.append(clear);
}

export function filterShops(shops, selectedKeys) {
  if (selectedKeys.length === 0) return shops;
  return shops.filter((s) =>
    selectedKeys.every((k) => (s.features?.[k] ?? 0) >= CONFIG.MIN_MENTIONS)
  );
}
