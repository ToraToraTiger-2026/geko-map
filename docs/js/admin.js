// 管理画面。誰が開いても何も見えない作りにする（データの権限はDBのRLSが決める。この画面は操作の窓口にすぎない）。
// 外から来た文字列（店名・理由・メールなど）は textContent でしか表示しない。

import { FEATURES, REQUESTER_TYPES } from "./config.js";
import { getClient } from "./supabase-client.js";
import { el, googleMapsUrl } from "./util.js";
import { getCaptchaToken } from "./captcha.js";

// 他のサイトの枠（iframe）の中では表示しない（クリックジャッキング対策）
if (window.top !== window.self) {
  document.body.replaceChildren();
  throw new Error("framed");
}

const db = getClient();
const $ = (id) => document.getElementById(id);
const featureLabel = Object.fromEntries(FEATURES.map((f) => [f.key, f.label]));
const requesterLabel = Object.fromEntries(REQUESTER_TYPES.map((t) => [t.value, t.label]));
const statusLabel = { pending: "承認待ち", approved: "承認済み", rejected: "却下", hidden: "非表示" };
const fmt = (iso) => new Date(iso).toLocaleString("ja-JP");

const TABS = [
  { id: "shops-pending", label: "承認待ちの店", render: renderPendingShops },
  { id: "reviews-pending", label: "承認待ちの評価", render: renderPendingReviews },
  { id: "reports", label: "通報", render: renderReports },
  { id: "deletions", label: "削除依頼", render: renderDeletions },
  { id: "shops-all", label: "お店の管理", render: renderAllShops },
  { id: "settings", label: "設定", render: renderSettings },
];
let currentTab = TABS[0];

// ---------------------------------------------------------------- 表示の部品

function show(...ids) {
  for (const id of ["login-form", "mfa-enroll", "mfa-form", "dashboard"]) $(id).hidden = !ids.includes(id);
}
function setStatus(text) {
  $("admin-status").textContent = text;
}
function card(title, lines, buttons = []) {
  return el("article", { className: "card" }, [
    el("h3", { text: title }),
    ...lines.map((l) => (typeof l === "string" ? el("p", { text: l }) : l)),
    buttons.length ? el("div", { className: "button-row start" }, buttons) : el("span"),
  ]);
}
function button(label, onClick, { danger = false } = {}) {
  const b = el("button", { text: label, className: `button small${danger ? " danger" : ""}`, attrs: { type: "button" } });
  b.addEventListener("click", async () => {
    b.disabled = true;
    try {
      await onClick();
    } finally {
      b.disabled = false;
    }
  });
  return b;
}
/** DBの更新を実行し、成功したら今のタブを描き直す。失敗したら理由を出す */
async function run(query) {
  const { error } = await query;
  if (error) {
    console.error(error);
    alert(`操作に失敗しました: ${error.message}`);
    return false;
  }
  await showTab(currentTab);
  return true;
}
function featuresLine(reviews) {
  const keys = new Set();
  for (const r of reviews ?? []) for (const f of r.review_features ?? []) keys.add(f.feature_key);
  return `特徴：${[...keys].map((k) => featureLabel[k] ?? k).join("、") || "（なし）"}`;
}
function emptyNote(root, text) {
  root.replaceChildren(el("p", { text, className: "form-help" }));
}
function failNote(root, error) {
  console.error(error);
  root.replaceChildren(el("p", { text: `読み込みに失敗しました: ${error.message}`, className: "form-message" }));
}

// ---------------------------------------------------------------- 各タブ

async function renderPendingShops(root) {
  const { data: shops, error } = await db
    .from("shops")
    .select("id, name, address, lat, lng, google_place_id, created_at, reviews(status, review_features(feature_key))")
    .eq("status", "pending")
    .order("created_at");
  if (error) return failNote(root, error);
  if (shops.length === 0) return emptyNote(root, "承認待ちのお店はありません。");

  const cards = await Promise.all(
    shops.map(async (s) => {
      const { data: similar } = await db.rpc("admin_similar_shops", { p_shop_id: s.id });
      const near = (similar ?? []).map((x) =>
        el("li", { text: `${x.name}（${statusLabel[x.status] ?? x.status}・約${x.distance_m}m）${x.address}` })
      );
      const map = el("a", {
        text: "Googleマップで確認",
        attrs: { href: googleMapsUrl({ ...s, place_id: s.google_place_id }), target: "_blank", rel: "noopener noreferrer" },
      });
      const nearBox = near.length
        ? el("div", { className: "nearby" }, [el("strong", { text: "近くに似たお店があります（重複の確認）" }), el("ul", {}, near)])
        : el("p", { text: "近く（200m以内）に他のお店はありません。", className: "form-help" });

      return card(
        s.name,
        [
          s.address,
          `位置：${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}　投稿：${fmt(s.created_at)}`,
          s.google_place_id ? `GoogleマップID：${s.google_place_id}` : "GoogleマップID：なし",
          featuresLine(s.reviews),
          el("p", {}, [map]),
          nearBox,
        ],
        [
          button("承認", () => {
            if (near.length && !confirm("近くに似たお店があります。重複ではないことを確認しましたか？")) return;
            return run(db.from("shops").update({ status: "approved" }).eq("id", s.id));
          }),
          button("却下", () => confirm("このお店を却下しますか？") && run(db.from("shops").update({ status: "rejected" }).eq("id", s.id)), { danger: true }),
        ]
      );
    })
  );
  root.replaceChildren(...cards);
}

async function renderPendingReviews(root) {
  const { data, error } = await db
    .from("reviews")
    .select("id, created_at, shop:shops(name, address, status), review_features(feature_key)")
    .eq("status", "pending")
    .order("created_at");
  if (error) return failNote(root, error);
  // 登録時の評価は「承認待ちの店」タブで一緒に処理するので、ここには承認済みのお店への評価だけ出す
  const rows = data.filter((r) => r.shop?.status === "approved");
  if (rows.length === 0) return emptyNote(root, "承認待ちの評価はありません。");

  root.replaceChildren(
    ...rows.map((r) =>
      card(r.shop.name, [r.shop.address, featuresLine([r]), `投稿：${fmt(r.created_at)}`], [
        button("承認", () => run(db.from("reviews").update({ status: "approved" }).eq("id", r.id))),
        button("却下", () => confirm("この評価を却下しますか？") && run(db.from("reviews").update({ status: "rejected" }).eq("id", r.id)), { danger: true }),
      ])
    )
  );
}

async function shopsById(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data } = await db.from("shops").select("id, name, address, status").in("id", unique);
  return new Map((data ?? []).map((s) => [s.id, s]));
}

async function renderReports(root) {
  const { data, error } = await db.from("reports").select("*").eq("status", "open").order("created_at");
  if (error) return failNote(root, error);
  if (data.length === 0) return emptyNote(root, "未対応の通報はありません。");
  const shops = await shopsById(data.map((r) => r.target_id));

  root.replaceChildren(
    ...data.map((r) => {
      const shop = shops.get(r.target_id);
      const buttons = [
        button("対応済み", () => run(db.from("reports").update({ status: "resolved" }).eq("id", r.id))),
        button("却下", () => run(db.from("reports").update({ status: "dismissed" }).eq("id", r.id))),
      ];
      if (shop && shop.status === "approved") {
        buttons.push(
          button("お店を非表示にして対応済み", async () => {
            if (!confirm("このお店を地図から非表示にします。よろしいですか？")) return;
            await db.from("shops").update({ status: "hidden" }).eq("id", shop.id);
            return run(db.from("reports").update({ status: "resolved" }).eq("id", r.id));
          }, { danger: true })
        );
      }
      return card(
        shop ? `${shop.name}（${statusLabel[shop.status] ?? shop.status}）` : "（お店が見つかりません）",
        [`理由：${r.reason}`, r.detail ? `補足：${r.detail}` : "補足：なし", `受付：${fmt(r.created_at)}`],
        buttons
      );
    })
  );
}

async function renderDeletions(root) {
  const { data, error } = await db.from("deletion_requests").select("*").eq("status", "open").order("created_at");
  if (error) return failNote(root, error);
  if (data.length === 0) return emptyNote(root, "未対応の削除依頼はありません。");
  const shops = await shopsById(data.map((r) => r.shop_id));

  root.replaceChildren(
    ...data.map((r) => {
      const shop = shops.get(r.shop_id);
      const lines = [
        `立場：${requesterLabel[r.requester_type] ?? r.requester_type}`,
        `対象：${r.target_url || "（記載なし）"}`,
        `内容：${r.message}`,
        r.contact_email ? `メール：${r.contact_email}` : "メール：なし",
        `受付：${fmt(r.created_at)}`,
      ];
      const buttons = [];
      if (shop && shop.status !== "hidden") {
        buttons.push(button("お店を非表示にする", () => run(db.from("shops").update({ status: "hidden" }).eq("id", shop.id))));
      }
      if (shop) {
        buttons.push(
          button("お店を削除する", () => confirm("お店と、その評価を完全に削除します。元に戻せません。よろしいですか？") && run(db.from("shops").delete().eq("id", shop.id)), { danger: true })
        );
      }
      buttons.push(
        button("対応済み", () => run(db.from("deletion_requests").update({ status: "resolved" }).eq("id", r.id))),
        button("却下", () => run(db.from("deletion_requests").update({ status: "dismissed" }).eq("id", r.id)))
      );
      return card(shop ? `${shop.name}（${statusLabel[shop.status] ?? shop.status}）` : "削除依頼", lines, buttons);
    })
  );
}

async function renderAllShops(root) {
  const { data, error } = await db
    .from("shops")
    .select("id, name, address, status")
    .in("status", ["approved", "hidden"])
    .order("name");
  if (error) return failNote(root, error);
  if (data.length === 0) return emptyNote(root, "承認済み・非表示のお店はありません。");

  root.replaceChildren(
    ...data.map((s) => {
      const buttons =
        s.status === "approved"
          ? [button("非表示にする", () => run(db.from("shops").update({ status: "hidden" }).eq("id", s.id)))]
          : [button("承認に戻す", () => run(db.from("shops").update({ status: "approved" }).eq("id", s.id)))];
      buttons.push(
        button("削除", () => confirm(`「${s.name}」と、その評価を完全に削除します。元に戻せません。よろしいですか？`) && run(db.from("shops").delete().eq("id", s.id)), { danger: true })
      );
      return card(`${s.name}（${statusLabel[s.status]}）`, [s.address], buttons);
    })
  );
}

async function renderSettings(root) {
  const { data, error } = await db.from("settings").select("value").eq("key", "posting_enabled").maybeSingle();
  if (error) return failNote(root, error);
  const enabled = (data?.value ?? "true") === "true";
  root.replaceChildren(
    card("投稿の受付", [enabled ? "現在：受付中" : "現在：停止中（通報と削除依頼は受け付けます）"], [
      button(
        enabled ? "投稿の受付を停止する" : "投稿の受付を再開する",
        () => run(db.from("settings").update({ value: enabled ? "false" : "true" }).eq("key", "posting_enabled")),
        { danger: enabled }
      ),
    ])
  );
}

// ---------------------------------------------------------------- タブの切り替え

async function showTab(tab) {
  currentTab = tab;
  for (const b of $("tabs").children) b.classList.toggle("active", b.dataset.tab === tab.id);
  const panel = $("panel");
  panel.replaceChildren(el("p", { text: "読み込み中…", className: "form-help" }));
  await tab.render(panel);
}

function buildTabs() {
  $("tabs").replaceChildren(
    ...TABS.map((t) => {
      const b = el("button", { text: t.label, className: "tab", attrs: { type: "button", "data-tab": t.id } });
      b.addEventListener("click", () => showTab(t));
      return b;
    })
  );
}

// ---------------------------------------------------------------- ログインと二段階認証

async function enterDashboard() {
  const { data: isAdmin, error } = await db.rpc("is_admin");
  if (error || !isAdmin) {
    show();
    setStatus("このアカウントには管理者の権限がありません。");
    $("login-form").hidden = false;
    await db.auth.signOut();
    return;
  }
  setStatus("");
  show("dashboard");
  buildTabs();
  await showTab(currentTab);
}

async function afterPasswordLogin() {
  const { data: aal } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal.currentLevel === "aal2") return enterDashboard();

  const { data: factors } = await db.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f) => f.status === "verified");
  if (verified) {
    setStatus("認証アプリの6桁の数字を入力してください。");
    show("mfa-form");
    mfaFactorId = verified.id;
    return;
  }

  // 未登録なら、その場で登録する。
  // 途中で止まった未完了の登録（確認前の状態）が残っていると名前が重複するので、先に片付ける。
  // （totp には確認済みのものしか入らない。未完了のものは all に入っている）
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status !== "verified") {
      await db.auth.mfa.unenroll({ factorId: f.id });
    }
  }
  const { data, error } = await db.auth.mfa.enroll({ factorType: "totp", friendlyName: "geko-map-admin" });
  if (error) {
    console.error(error);
    setStatus(`二段階認証の登録を始められませんでした: ${error.message}`);
    return;
  }
  mfaFactorId = data.id;
  $("mfa-qr").src = data.totp.qr_code;
  $("mfa-secret").textContent = data.totp.secret;
  setStatus("");
  show("mfa-enroll", "mfa-form");
}

let mfaFactorId = null;

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("ログイン中…");
  let captchaToken;
  try {
    captchaToken = await getCaptchaToken(); // 公開時だけ有効（開発中は undefined）
  } catch (err) {
    console.error(err);
    setStatus("ロボット判定に失敗しました。ページを再読み込みしてやり直してください。");
    return;
  }
  const { error } = await db.auth.signInWithPassword({
    email: $("login-email").value.trim(),
    password: $("login-password").value,
    options: captchaToken ? { captchaToken } : undefined,
  });
  $("login-password").value = "";
  if (error) {
    console.error(error);
    setStatus("ログインできませんでした。メールアドレスとパスワードを確認してください。"); // 理由は詳しく言わない
    return;
  }
  await afterPasswordLogin();
});

$("mfa-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("確認中…");
  const { error } = await db.auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code: $("mfa-code").value.trim() });
  $("mfa-code").value = "";
  if (error) {
    console.error(error);
    setStatus("数字が正しくありません。もう一度入力してください。");
    return;
  }
  await enterDashboard();
});

$("signout").addEventListener("click", async () => {
  await db.auth.signOut();
  location.reload();
});

async function start() {
  const { data } = await db.auth.getSession();
  const user = data.session?.user;
  // 匿名ID（一般の投稿者）のままなら、管理者としてはログインしていない扱い
  if (!user || user.is_anonymous) {
    setStatus("");
    show("login-form");
    return;
  }
  await afterPasswordLogin();
}

start();
