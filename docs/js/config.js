// 設定はこのファイル1か所にまとめる。
// ここに書いてよいのは「公開して問題ないもの」だけ（パスワード・secret/service_role キーは絶対に書かない）。

export const CONFIG = {
  SITE_NAME: "下戸マップ", // 仮の名前。ここを変えれば全ページに反映される
  OPERATOR_NAME: "運営者（ハンドル名・未定）", // 仮の表記

  // データの読み込み方: "dummy"（ダミーJSON） | "supabase" | "json"（書き出し済みJSON）
  DATA_MODE: "dummy",
  DUMMY_DATA_URL: "data/dummy-shops.json",

  // Supabase の接続先。ここに書いてよいのは Project URL と publishable キー（sb_publishable_...）だけ。
  // secret キー（sb_secret_...）や service_role キーは絶対に書かない。
  // 開発用（localhost で開いたとき）と本番用を分けられる。本番用が空のうちは開発用と同じものを使う。
  SUPABASE_DEV: { url: "", key: "" },
  SUPABASE_PROD: { url: "", key: "" },

  // 地図の初期表示（東京駅付近）
  MAP_CENTER: [35.6812, 139.7671],
  MAP_ZOOM: 12,

  // 地図画像（タイル）の配信元。URLと著作権表示は必ずセットで差し替える。
  // 例）国土地理院: url "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
  //     attribution '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'
  TILE: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },

  // 絞り込み: その特徴の投稿がこの件数以上あるお店だけを「満たす」とみなす
  MIN_MENTIONS: 1,
};

// 下戸向けの特徴。key は固定（変更不可）、label は後から変えてよい。
export const FEATURES = [
  { key: "non_alcohol_rich", label: "ノンアルが充実" },
  { key: "comfortable_sober", label: "飲まなくても居づらくない" },
  { key: "private_room", label: "個室・半個室" },
  { key: "food_rich", label: "食事が充実" },
  { key: "no_one_order", label: "ワンオーダー制でない" },
  { key: "no_drink_pressure", label: "お酒を勧められにくい" },
  { key: "tea_coffee", label: "お茶・コーヒー等が選べる" },
  { key: "solo_friendly", label: "一人でも入りやすい" },
];
