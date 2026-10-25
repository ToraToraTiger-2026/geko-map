// 表示まわりの共通部品。
// 外部から来た文字列（店名・住所など）は textContent でしか画面に入れない（XSS対策）。

/** 要素を作る小さな関数。text は textContent として入る（HTMLとして解釈されない）。 */
export function el(tag, { text, className, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** URLのパラメータなど、外から来たIDがUUIDの形か確認する */
export function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Googleマップへのリンク。place_id があればそれを使い、無ければ「店名＋住所」の検索リンク。 */
export function googleMapsUrl(shop) {
  const query = encodeURIComponent(`${shop.name} ${shop.address}`);
  let url = `https://www.google.com/maps/search/?api=1&query=${query}`;
  if (shop.place_id && /^[A-Za-z0-9_-]{10,200}$/.test(shop.place_id)) {
    url += `&query_place_id=${encodeURIComponent(shop.place_id)}`;
  }
  return url;
}
