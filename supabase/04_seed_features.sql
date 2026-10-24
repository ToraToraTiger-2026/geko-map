-- 04_seed_features.sql : 特徴のマスタ（key は固定。label は後から変えてよい）
insert into public.features (key, label, sort_order) values
  ('non_alcohol_rich',  'ノンアルが充実',            10),
  ('comfortable_sober', '飲まなくても居づらくない',   20),
  ('private_room',      '個室・半個室',              30),
  ('food_rich',         '食事が充実',                40),
  ('no_one_order',      'ワンオーダー制でない',       50),
  ('no_drink_pressure', 'お酒を勧められにくい',       60),
  ('tea_coffee',        'お茶・コーヒー等が選べる',   70),
  ('solo_friendly',     '一人でも入りやすい',         80)
on conflict (key) do nothing;
