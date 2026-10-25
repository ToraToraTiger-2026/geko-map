// 地図画面の「評価する」「通報」ダイアログ。表示する文字はすべて textContent で入れる。

import { FEATURES, REPORT_REASONS } from "./config.js";
import { el } from "./util.js";
import { ensureSignedIn } from "./anon-auth.js";
import { submitReview, submitReport, describeError } from "./api.js";

const dialog = document.getElementById("dialog");
const body = document.getElementById("dialog-body");

function close() {
  dialog.close();
}

function open(title, nodes) {
  body.replaceChildren(el("h2", { text: title, className: "dialog-title" }), ...nodes);
  if (!dialog.open) dialog.showModal();
}

// ダイアログの外側（暗い部分）をクリックしたら閉じる
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) close();
});

function closeButton(label = "閉じる") {
  const b = el("button", { text: label, className: "button", attrs: { type: "button" } });
  b.addEventListener("click", close);
  return b;
}

function showDone(title, message) {
  open(title, [
    el("p", { text: message }),
    el("div", { className: "button-row" }, [closeButton()]),
  ]);
}

/** 共通の送信処理: 入力を確認し、二重送信を防ぎ、失敗したら理由を表示する */
function wireSubmit(form, submitButton, messageBox, validate, work, onDone) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      messageBox.textContent = problem;
      return;
    }
    submitButton.disabled = true;
    messageBox.textContent = "送信中…";
    try {
      await ensureSignedIn();
      await work();
      onDone();
    } catch (err) {
      messageBox.textContent = describeError(err);
      submitButton.disabled = false;
    }
  });
}

export function openReviewDialog(shop) {
  const checks = FEATURES.map((f) => {
    const input = el("input", { attrs: { type: "checkbox", value: f.key } });
    return { input, node: el("label", { className: "filter-item" }, [input, el("span", { text: f.label })]) };
  });
  const message = el("p", { className: "form-message", attrs: { role: "status" } });
  const submit = el("button", { text: "送信する", className: "button primary", attrs: { type: "submit" } });

  const form = el("form", {}, [
    el("p", { text: shop.name, className: "dialog-shop" }),
    el("p", {
      text: "当てはまる特徴にチェックしてください（複数可）。投稿は管理者の承認後に反映されます。送信後は編集できません。1つのお店につき1回までです。",
      className: "form-help",
    }),
    ...checks.map((c) => c.node),
    message,
    el("div", { className: "button-row" }, [closeButton("キャンセル"), submit]),
  ]);

  const selectedKeys = () => checks.filter((c) => c.input.checked).map((c) => c.input.value);

  wireSubmit(
    form,
    submit,
    message,
    () => (selectedKeys().length === 0 ? "当てはまる特徴を1つ以上選んでください。" : null),
    () => submitReview(shop.id, selectedKeys()),
    () => showDone("送信しました", "ご協力ありがとうございます。管理者の承認後に反映されます。")
  );

  open("このお店を評価する", [form]);
}

export function openReportDialog(shop) {
  const select = el("select", { attrs: { id: "report-reason", required: "" } },
    REPORT_REASONS.map((r) => el("option", { text: r, attrs: { value: r } })));
  const detail = el("textarea", { attrs: { id: "report-detail", maxlength: "200", rows: "3" } });
  const message = el("p", { className: "form-message", attrs: { role: "status" } });
  const submit = el("button", { text: "通報する", className: "button primary", attrs: { type: "submit" } });

  const form = el("form", {}, [
    el("p", { text: shop.name, className: "dialog-shop" }),
    el("p", {
      text: "管理者が内容を確認します。ご連絡先は不要です（個別の返信はできません）。返信が必要な場合は、削除依頼フォームをご利用ください。",
      className: "form-help",
    }),
    el("label", { className: "field" }, [el("span", { text: "理由" }), select]),
    el("label", { className: "field" }, [el("span", { text: "補足（200字まで・任意）" }), detail]),
    message,
    el("div", { className: "button-row" }, [closeButton("キャンセル"), submit]),
  ]);

  wireSubmit(
    form,
    submit,
    message,
    () => null,
    () => submitReport(shop.id, select.value, detail.value.trim()),
    () => showDone("通報を受け付けました", "ご連絡ありがとうございます。管理者が確認します。")
  );

  open("このお店の情報を通報する", [form]);
}
