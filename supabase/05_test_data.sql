-- 05_test_data.sql : 動作確認用のテストデータ（公開前に必ず削除する）
-- 店名に「（テスト）」が付く。削除:  delete from public.shops where name like '%（テスト）%';
-- （評価・特徴は shops を消すと連動して消える）
-- 5件 approved（地図に出る）、1件 pending（出ない）、1件 hidden（出ない）。
-- created_by は null（実在の仮IDと無関係）。

do $$
declare
  s record;
  f record;
  i int;
  v_shop uuid;
  v_review uuid;
begin
  for s in
    select * from (values
      ('ダミー茶房 東京駅前（テスト）',      '東京都千代田区丸の内（ダミー）',     35.6815, 139.7640, 'approved', '{"non_alcohol_rich":8,"comfortable_sober":5,"food_rich":6,"tea_coffee":7,"solo_friendly":4}'),
      ('ダミー食堂 渋谷（テスト）',          '東京都渋谷区道玄坂（ダミー）',       35.6591, 139.6985, 'approved', '{"food_rich":9,"no_one_order":6,"private_room":3,"comfortable_sober":4}'),
      ('ダミー個室ダイニング 新宿（テスト）', '東京都新宿区西新宿（ダミー）',       35.6896, 139.6917, 'approved', '{"private_room":10,"non_alcohol_rich":5,"no_drink_pressure":4,"no_one_order":3}'),
      ('ダミーカフェバー 池袋（テスト）',    '東京都豊島区南池袋（ダミー）',       35.7295, 139.7109, 'approved', '{"non_alcohol_rich":12,"tea_coffee":8,"solo_friendly":7,"comfortable_sober":9}'),
      ('ダミー定食屋 上野（テスト）',        '東京都台東区上野（ダミー）',         35.7141, 139.7774, 'approved', '{"food_rich":11,"solo_friendly":10,"no_one_order":8,"no_drink_pressure":6}'),
      ('ダミー居酒屋 品川（テスト）',        '東京都港区高輪（ダミー）',           35.6284, 139.7387, 'pending',  '{"non_alcohol_rich":6,"food_rich":7}'),
      ('ダミー喫茶 吉祥寺（テスト）',        '東京都武蔵野市吉祥寺本町（ダミー）', 35.7030, 139.5797, 'hidden',   '{"tea_coffee":9,"comfortable_sober":7}')
    ) as t(name, address, lat, lng, status, feats)
  loop
    insert into public.shops (name, address, lat, lng, status, reviewed_at)
    values (s.name, s.address, s.lat, s.lng, s.status, case when s.status = 'pending' then null else now() end)
    returning id into v_shop;

    -- 特徴ごとの件数ぶん、評価（1件につき特徴1つ）を作る。評価は全て approved
    for f in select key, value::int as n from jsonb_each_text(s.feats::jsonb) loop
      for i in 1..f.n loop
        insert into public.reviews (shop_id, status) values (v_shop, 'approved') returning id into v_review;
        insert into public.review_features (review_id, feature_key) values (v_review, f.key);
      end loop;
    end loop;
  end loop;
end $$;
