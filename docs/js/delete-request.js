// 削除依頼フォーム。?shop=<id> で開かれたら、そのお店の名前を最初から入れる。

import { REQUESTER_TYPES } from "./config.js";
import { el, isUuid } from "./util.js";
import { ensureSignedIn } from "./anon-auth.js";
import { submitDeletionRequest, getPublicShop, describeError } from "./api.js";

const $ = (id) => document.getElementById(id);

for (const t of REQUESTER_TYPES) {
  $("f-type").append(el("option", { text: t.label, attrs: { value: t.value } }));
}

let shopId = null;
const param = new URLSearchParams(location.search).get("shop");
if (isUuid(param)) {
  getPublicShop(param)
    .then((shop) => {
      if (!shop) return;
      shopId = shop.id;
      $("f-target").value = `${shop.name}（${shop.address}）`.slice(0, 300);
    })
    .catch((err) => console.error(err)); // 取れなくても、手入力で依頼できる
}

$("request-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = $("form-message");
  const submit = $("submit");

  const text = $("f-message").value.trim();
  const email = $("f-email").value.trim();
  if (!text) {
    message.textContent = "依頼の内容を入力してください。";
    return;
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    message.textContent = "メールアドレスの形式が正しくありません。返信が不要なら空欄にしてください。";
    return;
  }

  submit.disabled = true;
  message.textContent = "送信中…";
  try {
    await ensureSignedIn();
    await submitDeletionRequest({
      targetText: $("f-target").value.trim(),
      shopId,
      requesterType: $("f-type").value,
      message: text,
      email,
    });
    message.textContent = "送信しました。管理者が内容を確認します。";
    $("request-form").reset();
  } catch (err) {
    message.textContent = describeError(err);
  } finally {
    submit.disabled = false;
  }
});
