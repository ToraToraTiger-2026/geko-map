// 検索フォームの共通処理。検索はボタン押下かEnter（フォームの送信）のときだけ行い、入力中には行わない。

import { search } from "./geocode.js";
import { el } from "./util.js";

/**
 * form 内の input と ボタンで検索し、結果を list に候補として並べる。
 * onResults(results) は候補が見つかるたびに呼ばれる。onPick(result) は候補を選んだときに呼ばれる。
 * 候補が1件のときは、listSingle が true のときだけ一覧にする（false なら onResults だけで済ませる）。
 * 候補は、選ぶか「候補を閉じる」を押すと閉じる。一覧の出し入れのたびに onListChange() が呼ばれる。
 * 検索が空・失敗のときのメッセージは emptyHint を後ろに足して status に出す。
 */
export function bindSearch({ form, input, button, status, list, onResults, onPick, onListChange, listSingle = false, emptyHint = "" }) {
  // 一覧を閉じる（地図の大きさが変わるので、onListChange で知らせる）
  const closeList = () => {
    list.replaceChildren();
    onListChange?.();
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (button.disabled) return; // 実行中の二重送信を防ぐ
    closeList();
    button.disabled = true;
    status.textContent = "検索中…";
    try {
      const { results, message } = await search(input.value);
      if (results.length === 0) {
        status.textContent = emptyHint && input.value.trim() ? `${message}${emptyHint}` : message;
        return;
      }
      const showList = results.length > 1 || listSingle;
      status.textContent = showList ? `${results.length}件見つかりました。選んでください。` : "";
      if (showList) {
        const close = el("button", { text: "候補を閉じる", className: "link-button", attrs: { type: "button" } });
        close.addEventListener("click", closeList);
        list.append(el("li", {}, [close]));
        for (const r of results) {
          const choice = el("button", {
            text: r.name === r.address ? r.name : `${r.name}（${r.address}）`,
            className: "search-choice",
            attrs: { type: "button" },
          });
          choice.addEventListener("click", () => {
            closeList(); // 選んだら一覧は閉じる
            onPick(r);
          });
          list.append(el("li", {}, [choice]));
        }
        onListChange?.();
      }
      onResults?.(results);
    } finally {
      button.disabled = false;
    }
  });
}
