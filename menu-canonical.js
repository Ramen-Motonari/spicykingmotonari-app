/* =========================================================================
   SPICY KING MOTONARI — Canonical Menu Definition (v1.0)
   ─────────────────────────────────────────────────────────
   3アプリ（お客様注文 / キッチン&レジ / 管理画面）共通の正規データソース。
   メニュー追加・価格変更などはこのファイル1箇所のみで行う。

   読み込み方:
     <script src="./menu-canonical.js"></script>
   その後、グローバルの window.MOTONARI からアクセス可能。

   ⚠ Firestoreに書き込まれる itemId は MOTONARI.MENU_ITEMS の id と一致する必要があります。
   ========================================================================= */
(function (global) {
  'use strict';

  // ===== 席ラベル（15席 + P1〜P11 別会計/外国人グループ用） =====
  const SEAT_LABELS = [
    'T1','T2','T3','T4','T5','T6',
    'C1','C2','C3','C4',
    'M',
    'S1','S2','S3','S4',
    'P1','P2','P3','P4','P5','P6','P7','P8','P9','P10','P11',
    'TEST'
  ];

  // URL用エイリアス（旧URL/旧ラベルを新ラベルへ転送）
  const SEAT_ALIASES = {
    // 旧URLセーフ別名 → 新ラベル
    'Maru':'M', 'maru':'M', 'MARU':'M',
    'N1':'S1','n1':'S1',
    'N2':'S2','n2':'S2',
    'N3':'S3','n3':'S3',
    'N4':'S4','n4':'S4',
    'p1':'P1','p2':'P2','p3':'P3','p4':'P4','p5':'P5','p6':'P6','p7':'P7','p8':'P8',
    'p9':'P9','p10':'P10','p11':'P11',
    // 旧日本語ラベル（URLエンコード経由）→ 新ラベル
    '丸':'M',
    '中1':'S1','中2':'S2','中3':'S3','中4':'S4',
    // 全角数字版もカバー
    '中１':'S1','中２':'S2','中３':'S3','中４':'S4'
  };

  // テーブル文字列を正規化
  function normalizeTable(raw) {
    if (!raw) return '?';
    try { raw = decodeURIComponent(raw); } catch(e) {}
    raw = String(raw).trim();
    if (SEAT_ALIASES[raw]) return SEAT_ALIASES[raw];
    if (SEAT_LABELS.includes(raw)) return raw;
    const upper = raw.toUpperCase();
    if (SEAT_LABELS.includes(upper)) return upper;
    if (SEAT_ALIASES[upper]) return SEAT_ALIASES[upper];
    // 旧URL（数字のみ）対応
    const num = parseInt(raw);
    if (!isNaN(num)) {
      if (num >= 1 && num <= 6)  return `T${num}`;
      if (num >= 7 && num <= 10) return `C${num - 6}`;
      if (num === 11)             return 'M';
      if (num >= 12 && num <= 15) return `S${num - 11}`;
    }
    return '?';
  }

  // ===== カテゴリ定義 =====
  const CATEGORIES = {
    tonkotsu: { ja:'豚骨',       en:'Tonkotsu',  zh:'猪骨',     ko:'돈코츠',     icon:'🍜' },
    shouyu:   { ja:'醤油',       en:'Shouyu',    zh:'酱油',     ko:'쇼유',       icon:'🍜' },
    teishoku: { ja:'つけ麺・定食', en:'Set Meal',  zh:'套餐',     ko:'정식',       icon:'🥟' },
    topping:  { ja:'トッピング', en:'Toppings',  zh:'追加配料', ko:'토핑',       icon:'⭐' },
    side:     { ja:'サイド',     en:'Sides',     zh:'小菜',     ko:'사이드',     icon:'🥟' },
    drink:    { ja:'ドリンク',   en:'Drinks',    zh:'饮料',     ko:'음료',       icon:'🍺' },
    takeout:  { ja:'テイクアウト', en:'Takeout',  zh:'外带',     ko:'테이크아웃', icon:'🥡' }
  };

  // ===== サブカテゴリ定義（コード側の既定。管理APPの subCategories が優先）=====
  //   オーダーAPPは商品の subCat(ja) をキーに、ここ／Firestore の多言語名で見出しを表示する。
  const SUBCATEGORIES = {
    shouyu: [
      { ja:'ナガサワくん', en:'Onion & Egg', zh:'洋葱和鸡蛋', ko:'양파와 계란', order:100 }
    ]
  };

  // ===== ステータス定義 =====
  const ORDER_STATUS = {
    pending:   { ja:'受付済',   en:'Received',   color:'#e65100' },
    preparing: { ja:'調理中',   en:'Preparing',  color:'#1565c0' },
    served:    { ja:'提供済',   en:'Served',     color:'#2e7d32' },
    paid:      { ja:'会計済み', en:'Paid',       color:'#22c55e' },
    cancelled: { ja:'取消',     en:'Cancelled',  color:'#888'    }
  };

  // ===== 辛さレベル =====
  const SPICY_LEVELS = [
    {l:'1辛',p:100},{l:'2辛',p:130},{l:'3辛',p:160},{l:'4辛',p:190},{l:'5辛',p:220},
    {l:'6辛',p:270},{l:'7辛',p:320},{l:'8辛',p:370},{l:'9辛',p:420},{l:'10辛',p:470}
  ];

  // ===== メニュー本体 =====
  // schema: {id, cat, img, name:{ja,en,zh,ko}, price, spicy, night, pirikara, ghost,
  //          lunchFreeBase, subCat, discontinued, custom:{chashu, noodleSize, kata, karasaAdd, top, rice}}
  //   subCat: オーダーAPPのサブカテゴリ見出し(ja)。SUBCATEGORIES と対応。
  //   discontinued: true でオーダーAPP非表示（キッチン/管理は集計のため保持）。
  //   ※ desc:{ja,en,zh,ko}（商品説明）はコード定義には持たず、管理APP（menuOverrides.descOverride /
  //     customMenuItems.desc）から付与される任意フィールド。未設定ならオーダー画面で非表示。
  const MENU_ITEMS = [
    // ── 豚骨 ──
    {id:1, cat:'tonkotsu', img:'🍜',
     name:{ja:'SKSP スパイシーキングスペシャル', en:'SKSP Spicy King Special', zh:'SKSP 辣王特别版', ko:'SKSP 스파이시 킹 스페셜'},
     price:1450, spicy:true, night:false, custom:{chashu:1, noodleSize:1, karasaAdd:1}},
    {id:2, cat:'tonkotsu', img:'🍜',
     name:{ja:'SK スパイシーキング', en:'SK Spicy King', zh:'SK 辣王', ko:'SK 스파이시 킹'},
     price:1000, spicy:true, night:false, custom:{chashu:1, noodleSize:1, karasaAdd:1}},
    {id:3, cat:'tonkotsu', img:'🍜',
     name:{ja:'SKC スパイシーキングチーズ', en:'SKC Spicy King Cheese', zh:'SKC 辣王奶酪', ko:'SKC 스파이시 킹 치즈'},
     price:1450, spicy:true, night:true, custom:{chashu:1, noodleSize:1, karasaAdd:1}},
    {id:99, cat:'tonkotsu', img:'👻',
     name:{ja:'スパイシーキングゴースト（ライス・ドリンクセット）', en:'Spicy King Ghost (Rice & Drink Set)', zh:'辣王幽灵（米饭・饮料套餐）', ko:'스파이시 킹 고스트（라이스・드링크 세트）'},
     price:2000, spicy:true, night:false, ghost:true, custom:{chashu:1, noodleSize:1}},
    {id:16, cat:'tonkotsu', img:'🍛',
     name:{ja:'カレースペシャル', en:'Curry Special', zh:'咖喱特别版', ko:'카레 스페셜'},
     price:1750, spicy:true, night:false, custom:{top:1, chashu:1, noodleSize:1, karasaAdd:1}},
    {id:5, cat:'tonkotsu', img:'🍛',
     name:{ja:'CC チーズカレー', en:'CC Cheese Curry', zh:'CC 奶酪咖喱', ko:'CC 치즈 카레'},
     price:1650, spicy:true, night:true, custom:{top:1, noodleSize:1, karasaAdd:1}},
    {id:4, cat:'tonkotsu', img:'🍛',
     name:{ja:'C カレーラーメン', en:'C Curry Ramen', zh:'C 咖喱拉面', ko:'C 카레 라멘'},
     price:1250, spicy:true, night:false, custom:{top:1, noodleSize:1, karasaAdd:1}},
    {id:12, cat:'tonkotsu', img:'🦑',
     name:{ja:'イカスミラーメン', en:'Squid Ink Ramen', zh:'墨鱼汁拉面', ko:'오징어먹물 라멘'},
     price:1800, spicy:false, night:true, custom:{noodleSize:1}},

    // ── 醤油 ──
    {id:6, cat:'shouyu', img:'🍜',
     name:{ja:'醤油スペシャル', en:'Shouyu Special', zh:'酱油特别版', ko:'쇼유 스페셜'},
     price:1450, spicy:false, night:false, custom:{chashu:1, noodleSize:1}},
    {id:7, cat:'shouyu', img:'🍜',
     name:{ja:'醤油ラーメン', en:'Shouyu Ramen', zh:'酱油拉面', ko:'쇼유 라멘'},
     price:1000, spicy:false, night:false, custom:{chashu:1, noodleSize:1}},
    {id:8, cat:'shouyu', img:'🍜',
     name:{ja:'スパイシー醤油', en:'Spicy Shouyu', zh:'辣味酱油', ko:'스파이시 쇼유'},
     price:1150, spicy:true, night:false, custom:{chashu:1, noodleSize:1}},
    {id:9, cat:'shouyu', img:'🍜',
     name:{ja:'スパイシー醤油スペシャル', en:'Spicy Shouyu Special', zh:'辣味酱油特别版', ko:'스파이시 쇼유 스페셜'},
     price:1600, spicy:true, night:false, custom:{chashu:1, noodleSize:1}},
    // ── ネギ玉シリーズ（2026-07 販売終了 / 8月1日 完全削除予定）──
    //   discontinued:true → オーダーAPPでは非表示。7月分の集計を残すためキッチン/管理APPでは保持。
    {id:10, cat:'shouyu', img:'🍜',
     name:{ja:'ネギ玉醤油', en:'Negi-tama Shouyu', zh:'葱玉酱油', ko:'네기타마 쇼유'},
     price:1100, spicy:false, night:false, pirikara:true, discontinued:true, custom:{chashu:1, noodleSize:1}},
    {id:13, cat:'shouyu', img:'🍜',
     name:{ja:'ネギ玉ダブル（玉子2個）', en:'Negi-tama Double', zh:'葱玉双蛋', ko:'네기타마 더블'},
     price:1200, spicy:false, night:false, pirikara:true, discontinued:true, custom:{chashu:1, noodleSize:1}},
    {id:11, cat:'shouyu', img:'🍜',
     name:{ja:'ネギ玉醤油スペシャル', en:'Negi-tama Shouyu Special', zh:'葱玉酱油特别版', ko:'네기타마 쇼유 스페셜'},
     price:1550, spicy:false, night:false, pirikara:true, discontinued:true, custom:{chashu:1, noodleSize:1}},
    {id:14, cat:'shouyu', img:'🍜',
     name:{ja:'ネギ玉スパイシー醤油', en:'Negi-tama Spicy Shouyu', zh:'葱玉辣味酱油', ko:'네기타마 스파이시 쇼유'},
     price:1250, spicy:true, night:false, discontinued:true, custom:{chashu:1, noodleSize:1}},
    {id:15, cat:'shouyu', img:'🍜',
     name:{ja:'ネギ玉スパイシー醤油スペシャル', en:'Negi-tama Spicy Shouyu Special', zh:'葱玉辣味酱油特别版', ko:'네기타마 스파이시 쇼유 스페셜'},
     price:1600, spicy:true, night:false, discontinued:true, custom:{chashu:1, noodleSize:1}},

    // ── ナガサワくん（Onion & Egg）── サブカテゴリ: ナガサワくん
    {id:30, cat:'shouyu', img:'🍜', subCat:'ナガサワくん',
     name:{ja:'ナガサワくん', en:'Nagasawa-kun', zh:'长泽君', ko:'나가사와군'},
     price:1150, spicy:false, night:false, custom:{chashu:1, noodleSize:1}},
    {id:31, cat:'shouyu', img:'🍜', subCat:'ナガサワくん',
     name:{ja:'ナガサワくんスペシャル', en:'Nagasawa-kun Special', zh:'长泽君特别版', ko:'나가사와군 스페셜'},
     price:1600, spicy:false, night:false, custom:{chashu:1, noodleSize:1}},
    {id:32, cat:'shouyu', img:'🍜', subCat:'ナガサワくん',
     name:{ja:'ワイルドナガサワくん', en:'Wild Nagasawa-kun', zh:'狂野长泽君', ko:'와일드 나가사와군'},
     price:1300, spicy:true, night:false, custom:{chashu:1, noodleSize:1}},
    {id:33, cat:'shouyu', img:'🍜', subCat:'ナガサワくん',
     name:{ja:'ワイルドナガサワくんスペシャル', en:'Wild Nagasawa-kun Special', zh:'狂野长泽君特别版', ko:'와일드 나가사와군 스페셜'},
     price:1750, spicy:true, night:false, custom:{chashu:1, noodleSize:1}},

    // ── 定食 ──
    {id:70, cat:'teishoku', img:'🥟',
     name:{ja:'餃子定食', en:'Gyoza Set Meal', zh:'饺子套餐', ko:'교자 정식'},
     price:1300, spicy:false, night:false, custom:{rice:1, noodleSize:1, kata:1}},

    // ── トッピング ──
    {id:40, cat:'topping', img:'🍝',
     name:{ja:'替え玉（細麺）', en:'Extra Noodles', zh:'加面', ko:'면 추가'},
     price:150, spicy:false, night:false, custom:{kata:1}},
    {id:41, cat:'topping', img:'🍝',
     name:{ja:'半替え玉（細麺）', en:'Half Extra Noodles', zh:'半份加面', ko:'반 면 추가'},
     price:75, spicy:false, night:false, custom:{kata:1}},
    {id:43, cat:'topping', img:'🌿',
     name:{ja:'ごぼう', en:'Burdock', zh:'牛蒡', ko:'우엉'},
     price:150, spicy:false, night:false, custom:{}},
    {id:44, cat:'topping', img:'🥚',
     name:{ja:'串玉子', en:'Skewer Egg', zh:'串鸡蛋', ko:'꼬치 계란'},
     price:150, spicy:false, night:false, custom:{}},
    {id:45, cat:'topping', img:'🥚',
     name:{ja:'うずら玉子（5個）', en:'Quail Eggs ×5', zh:'鹌鹑蛋（5个）', ko:'메추리알（5개）'},
     price:150, spicy:false, night:false, custom:{}},
    {id:46, cat:'topping', img:'🥚',
     name:{ja:'ポン玉（激辛におすすめ）', en:'Pon Egg', zh:'温泉蛋', ko:'폰타마'},
     price:150, spicy:false, night:false, custom:{}},
    {id:47, cat:'topping', img:'🥗',
     name:{ja:'パパイヤしりしり', en:'Papaya Shiri-shiri', zh:'木瓜丝', ko:'파파야 시리시리'},
     price:150, spicy:false, night:false, custom:{}},
    {id:48, cat:'topping', img:'🍖',
     name:{ja:'とんかつ', en:'Tonkatsu', zh:'炸猪排', ko:'돈카츠'},
     price:300, spicy:false, night:false, custom:{}},
    {id:49, cat:'topping', img:'🍗',
     name:{ja:'チキンカツ', en:'Chicken Katsu', zh:'炸鸡排', ko:'치킨카츠'},
     price:300, spicy:false, night:false, custom:{}},
    {id:62, cat:'topping', img:'🥩',
     name:{ja:'チャーシュー3枚', en:'Chashu ×3', zh:'叉烧3片', ko:'차슈 3장'},
     price:250, spicy:false, night:false, custom:{chashu:1}},
    {id:63, cat:'topping', img:'🌿',
     name:{ja:'のり3枚', en:'Nori ×3', zh:'海苔3片', ko:'김 3장'},
     price:150, spicy:false, night:false, custom:{}},

    // ── サイド（昼夜共通） ──
    {id:89, cat:'side', img:'🍳',
     name:{ja:'ミニチャーシューエッグ丼', en:'Mini Chashu Egg Bowl', zh:'迷你叉烧鸡蛋盖饭', ko:'미니 차슈 에그 동'},
     price:550, spicy:false, night:false, custom:{}},
    {id:80, cat:'side', img:'🍳',
     name:{ja:'鉄板ミニチャーハン', en:'Mini Fried Rice', zh:'迷你铁板炒饭', ko:'미니 철판볶음밥'},
     price:400, spicy:false, night:false, custom:{}},
    {id:66, cat:'side', img:'🥟',
     name:{ja:'餃子2個＋半ライスセット', en:'Gyoza ×2 + Half Rice Set', zh:'饺子2个+半碗饭套餐', ko:'교자2개+하프라이스 세트'},
     price:300, spicy:false, night:false, custom:{}},
    {id:65, cat:'side', img:'🍚',
     name:{ja:'半ライス', en:'Half Rice', zh:'半碗米饭', ko:'하프 라이스'},
     price:120, spicy:false, night:false, custom:{}},
    {id:29, cat:'side', img:'🍚',
     name:{ja:'ライス', en:'Rice', zh:'米饭', ko:'라이스'},
     price:200, spicy:false, night:false, custom:{}},
    {id:24, cat:'side', img:'🥟',
     name:{ja:'餃子 2個', en:'Gyoza ×2', zh:'饺子2个', ko:'교자 2개'},
     price:200, spicy:false, night:false, custom:{}},
    {id:25, cat:'side', img:'🥟',
     name:{ja:'餃子 4個', en:'Gyoza ×4', zh:'饺子4个', ko:'교자 4개'},
     price:400, spicy:false, night:false, custom:{}},
    {id:26, cat:'side', img:'🥟',
     name:{ja:'餃子 8個', en:'Gyoza ×8', zh:'饺子8个', ko:'교자 8개'},
     price:750, spicy:false, night:false, custom:{}},
    {id:27, cat:'side', img:'🥟',
     name:{ja:'ヤンニョム餃子（4個）', en:'Yangnyeom Gyoza ×4', zh:'辣酱饺子4个', ko:'양념 교자 4개'},
     price:500, spicy:true, night:false, custom:{}},
    {id:28, cat:'side', img:'🥟',
     name:{ja:'メキシカン餃子（4個）', en:'Mexican Gyoza ×4', zh:'墨西哥饺子4个', ko:'멕시칸 교자 4개'},
     price:500, spicy:false, night:false, custom:{}},
    {id:67, cat:'side', img:'🥟',
     name:{ja:'3種餃子セット', en:'3 Types Gyoza Set', zh:'3种饺子套餐', ko:'3종 교자 세트'},
     price:700, spicy:false, night:false, custom:{}},
    {id:64, cat:'side', img:'🥗',
     name:{ja:'パパイヤサラダ', en:'Papaya Salad', zh:'木瓜沙拉', ko:'파파야 샐러드'},
     price:180, spicy:false, night:false, custom:{}},
    {id:22, cat:'side', img:'🫛',
     name:{ja:'枝豆', en:'Edamame', zh:'毛豆', ko:'에다마메'},
     price:300, spicy:false, night:false, custom:{}},
    {id:21, cat:'side', img:'🍗',
     name:{ja:'からあげ（3個）', en:'Karaage ×3', zh:'炸鸡（3个）', ko:'가라아게（3개）'},
     price:480, spicy:false, night:false, custom:{}},
    {id:20, cat:'side', img:'🍟',
     name:{ja:'ポテト', en:'Fries', zh:'薯条', ko:'포테이토'},
     price:400, spicy:false, night:false, custom:{}},

    // ── サイド（夜限定） ──
    // 鉄板ミニチャーハンは「通常サイドメニュー」へ移動（夜限定解除）。位置は↓のサイド先頭側に挿入済み。
    // ── 旧位置はプレースホルダなし（再掲を避ける） ──
    {id:81, cat:'side', img:'🍳',
     name:{ja:'鉄板チャーハン', en:'Fried Rice', zh:'铁板炒饭', ko:'철판볶음밥'},
     price:800, spicy:false, night:true, custom:{}},
    {id:82, cat:'side', img:'🌶️',
     name:{ja:'スパイシーミニチャーハン', en:'Spicy Mini Fried Rice', zh:'辣味迷你炒饭', ko:'스파이시 미니볶음밥'},
     price:450, spicy:true, night:true, custom:{}},
    {id:83, cat:'side', img:'🌶️',
     name:{ja:'スパイシーチャーハン', en:'Spicy Fried Rice', zh:'辣味炒饭', ko:'스파이시볶음밥'},
     price:900, spicy:true, night:true, custom:{}},
    {id:84, cat:'side', img:'🍗',
     name:{ja:'唐揚げチャーハン', en:'Karaage Fried Rice', zh:'炸鸡炒饭', ko:'가라아게 볶음밥'},
     price:1000, spicy:false, night:true, custom:{}},
    {id:85, cat:'side', img:'🌿',
     name:{ja:'ごぼうチップス', en:'Burdock Chips', zh:'牛蒡薯片', ko:'우엉 칩'},
     price:300, spicy:false, night:true, custom:{}},
    {id:86, cat:'side', img:'🥕',
     name:{ja:'きんぴら', en:'Kinpira', zh:'金平', ko:'킨피라'},
     price:300, spicy:false, night:true, custom:{}},
    {id:87, cat:'side', img:'🥟',
     name:{ja:'シューマイ2個', en:'Shumai ×2', zh:'烧卖2个', ko:'슈마이 2개'},
     price:350, spicy:false, night:true, custom:{}},
    {id:88, cat:'side', img:'🍱',
     name:{ja:'おつまみ3種盛り', en:'3 Types Snacks', zh:'3种下酒菜', ko:'안주 3종 모듬'},
     price:600, spicy:false, night:true, custom:{}},

    // ── ドリンク ──
    {id:50, cat:'drink', img:'🍺',
     name:{ja:'オリオンビール（小）', en:'Orion Beer (S)', zh:'奥里恩啤酒（小）', ko:'오리온 맥주（소）'},
     price:600, spicy:false, night:false, custom:{}},
    {id:51, cat:'drink', img:'🥃',
     name:{ja:'ハイボール', en:'Highball', zh:'威士忌苏打', ko:'하이볼'},
     price:450, spicy:false, night:false, custom:{},
     // 選択後に表示される銘柄選択（価格は変わらない・必須の単一選択）
     drinkOpt:{label:{ja:'銘柄をお選びください',en:'Choose your whisky',zh:'请选择品牌',ko:'브랜드를 선택해 주세요'},choices:[{ja:'角ハイ',en:'Kaku Highball',zh:'角Highball',ko:'카쿠 하이볼'},{ja:'ジムビーム',en:'Jim Beam',zh:'占边',ko:'짐빔'}]}},
    {id:52, cat:'drink', img:'🍶',
     name:{ja:'芋焼酎①黒霧島', en:'Imo Shochu Kurokiri', zh:'红薯烧酎①黑雾岛', ko:'고구마 소주①구로키리시마'},
     price:400, spicy:false, night:false, custom:{},
     // 選択後に表示される割り方選択（価格は変わらない・必須の単一選択）
     drinkOpt:{label:{ja:'割り方をお選びください',en:'Choose how to serve',zh:'请选择喝法',ko:'드시는 방법을 선택해 주세요'},choices:[{ja:'水割り',en:'With Water',zh:'兑水',ko:'물에 희석'},{ja:'炭酸割り',en:'With Soda',zh:'兑苏打',ko:'탄산에 희석'},{ja:'ロック',en:'On the Rocks',zh:'加冰',ko:'온더록'}]}},
    {id:53, cat:'drink', img:'🍶',
     name:{ja:'芋焼酎②三岳', en:'Imo Shochu Mitake', zh:'红薯烧酎②三岳', ko:'고구마 소주②미타케'},
     price:600, spicy:false, night:false, custom:{},
     drinkOpt:{label:{ja:'割り方をお選びください',en:'Choose how to serve',zh:'请选择喝法',ko:'드시는 방법을 선택해 주세요'},choices:[{ja:'水割り',en:'With Water',zh:'兑水',ko:'물에 희석'},{ja:'炭酸割り',en:'With Soda',zh:'兑苏打',ko:'탄산에 희석'},{ja:'ロック',en:'On the Rocks',zh:'加冰',ko:'온더록'}]}},
    {id:54, cat:'drink', img:'🍶',
     name:{ja:'麦焼酎', en:'Mugi Shochu', zh:'大麦烧酎', ko:'보리 소주'},
     price:400, spicy:false, night:false, custom:{},
     drinkOpt:{label:{ja:'割り方をお選びください',en:'Choose how to serve',zh:'请选择喝法',ko:'드시는 방법을 선택해 주세요'},choices:[{ja:'水割り',en:'With Water',zh:'兑水',ko:'물에 희석'},{ja:'炭酸割り',en:'With Soda',zh:'兑苏打',ko:'탄산에 희석'},{ja:'ロック',en:'On the Rocks',zh:'加冰',ko:'온더록'}]}},
    {id:55, cat:'drink', img:'🍵',
     name:{ja:'緑茶割り', en:'Green Tea Shochu', zh:'绿茶烧酎', ko:'녹차 소주'},
     price:500, spicy:false, night:false, custom:{},
     // 「中おかわり¥250」：このテーブルが一度でも緑茶割りを注文済み（カート or 注文履歴）の時のみ選択可。
     drinkRefill:{price:250,label:{ja:'中おかわり',en:'Refill (M)',zh:'续杯（中）',ko:'리필(중)'},baseLabel:{ja:'通常',en:'Regular',zh:'普通',ko:'일반'}}},
    {id:56, cat:'drink', img:'🍋',
     name:{ja:'レモンサワー', en:'Lemon Sour', zh:'柠檬酸甜鸡尾酒', ko:'레몬 사워'},
     price:400, spicy:false, night:false, custom:{}},
    {id:57, cat:'drink', img:'🍵',
     name:{ja:'ウーロンハイ', en:'Oolong Highball', zh:'乌龙茶烧酎', ko:'우롱 하이볼'},
     price:400, spicy:false, night:false, custom:{}},
    {id:58, cat:'drink', img:'🥃',
     name:{ja:'泡盛', en:'Awamori', zh:'泡盛', ko:'아와모리'},
     price:400, spicy:false, night:false, custom:{},
     // 選択後に表示される割り方選択（価格は変わらない・必須の単一選択）
     drinkOpt:{label:{ja:'割り方をお選びください',en:'Choose how to serve',zh:'请选择喝法',ko:'드시는 방법을 선택해 주세요'},choices:[{ja:'水割り',en:'With Water',zh:'兑水',ko:'물에 희석'},{ja:'炭酸割り',en:'With Soda',zh:'兑苏打',ko:'탄산에 희석'},{ja:'ロック',en:'On the Rocks',zh:'加冰',ko:'온더록'}]}},
    {id:59, cat:'drink', img:'🧋',
     name:{ja:'ウーロン茶', en:'Oolong Tea', zh:'乌龙茶', ko:'우롱차'},
     price:300, spicy:false, night:false, custom:{}},
    {id:60, cat:'drink', img:'🥤',
     name:{ja:'コーラ', en:'Cola', zh:'可乐', ko:'콜라'},
     price:300, spicy:false, night:false, custom:{}},
    {id:61, cat:'drink', img:'🍊',
     name:{ja:'オレンジ', en:'Orange Juice', zh:'橙汁', ko:'오렌지 주스'},
     price:300, spicy:false, night:false, custom:{}},
    {id:91, cat:'drink', img:'☕',
     name:{ja:'アイスコーヒー', en:'Iced Coffee', zh:'冰咖啡', ko:'아이스 커피'},
     price:380, spicy:false, night:false, custom:{}},
    {id:92, cat:'drink', img:'🥛',
     name:{ja:'ソイミルクコーヒー', en:'Soy Milk Coffee', zh:'豆浆咖啡', ko:'두유 커피'},
     price:450, spicy:false, night:false, custom:{}},

    // ── テイクアウト（持ち帰り餃子） ──
    {id:100, cat:'takeout', img:'🥡',
     name:{ja:'餃子 5個（テイクアウト）', en:'Gyoza ×5 (Takeout)', zh:'饺子5个（外带）', ko:'교자 5개（테이크아웃）'},
     price:500, spicy:false, night:false, custom:{}},
    {id:101, cat:'takeout', img:'🥡',
     name:{ja:'餃子 10個（テイクアウト）', en:'Gyoza ×10 (Takeout)', zh:'饺子10个（外带）', ko:'교자 10개（테이크아웃）'},
     price:950, spicy:false, night:false, custom:{}},
    {id:102, cat:'takeout', img:'🥡',
     name:{ja:'餃子 15個（テイクアウト）', en:'Gyoza ×15 (Takeout)', zh:'饺子15个（外带）', ko:'교자 15개（테이크아웃）'},
     price:1400, spicy:false, night:false, custom:{}},
    {id:103, cat:'takeout', img:'🥡',
     name:{ja:'餃子 20個（テイクアウト）', en:'Gyoza ×20 (Takeout)', zh:'饺子20个（外带）', ko:'교자 20개（테이크아웃）'},
     price:1800, spicy:false, night:false, custom:{}},
    {id:104, cat:'takeout', img:'🥡',
     name:{ja:'餃子 25個（テイクアウト）', en:'Gyoza ×25 (Takeout)', zh:'饺子25个（外带）', ko:'교자 25개（테이크아웃）'},
     price:2350, spicy:false, night:false, custom:{}},
    {id:105, cat:'takeout', img:'🥡',
     name:{ja:'餃子 30個（テイクアウト）', en:'Gyoza ×30 (Takeout)', zh:'饺子30个（外带）', ko:'교자 30개（테이크아웃）'},
     price:2800, spicy:false, night:false, custom:{}}
  ];

  // ===== ヘルパー関数 =====
  function getMenuById(id) { return MENU_ITEMS.find(m => m.id === id); }
  function getMenuByCategory(cat) { return MENU_ITEMS.filter(m => m.cat === cat); }
  function getNameJa(id) { const m = getMenuById(id); return m ? m.name.ja : '?'; }
  function getName(id, lang='ja') { const m = getMenuById(id); if (!m) return '?'; return m.name[lang] || m.name.ja; }
  function getPrice(id, opts={}) {
    const m = getMenuById(id);
    if (!m) return 0;
    if (m.lunchFreeBase && opts.lunchWeekday) return 0;
    return m.price;
  }
  function isLunchWeekday(now) {
    const d = now || new Date();
    const wd = d.getDay();
    const m = d.getHours() * 60 + d.getMinutes();
    // 平日 10:30〜14:30（替え玉・大盛り無料の判定枠／余裕を持った時間設定）
    return wd >= 1 && wd <= 5 && m >= 630 && m <= 870;
  }
  function isNightTime(now) {
    const d = now || new Date();
    const h = d.getHours();
    return h >= 17 && h < 21;
  }
  function isAvailable(item, now) {
    if (item.night && !isNightTime(now)) return false;
    return true;
  }
  function extractSpicyLevel(opts) {
    if (!Array.isArray(opts)) return '0辛';
    for (const o of opts) {
      const m = String(o).match(/(\d+)\s*辛/);
      if (m) return m[1] + '辛';
    }
    return '0辛';
  }
  function statusLabel(status, lang='ja') {
    const s = ORDER_STATUS[status];
    if (!s) return status;
    return s[lang] || s.ja;
  }
  function getLogicalCategory(item) {
    if (!item) return 'side';
    if (item.cat === 'tonkotsu' || item.cat === 'shouyu') return 'ramen';
    if (item.cat === 'teishoku') return 'teishoku';
    if (item.cat === 'drink') return 'drink';
    return 'side';
  }
  function classifyByName(name) {
    if (!name) return 'side';
    if (name.includes('定食')) return 'teishoku';
    const ramenKw = ['SKSP','SK','SKC','カレー','チーズカレー','醤油','ネギ玉','ナガサワ','スパイシー','イカスミ','ゴースト'];
    if (ramenKw.some(k => name.includes(k))) return 'ramen';
    const drinkKw = ['ビール','ハイボール','焼酎','サワー','ウーロン','コーラ','オレンジ','泡盛','緑茶','コーヒー','ジュース'];
    if (drinkKw.some(k => name.includes(k))) return 'drink';
    return 'side';
  }

  // ===== グローバル公開 =====
  global.MOTONARI = {
    VERSION: '1.0.0',
    SEAT_LABELS, SEAT_ALIASES, normalizeTable,
    CATEGORIES, SUBCATEGORIES, ORDER_STATUS, SPICY_LEVELS, MENU_ITEMS,
    getMenuById, getMenuByCategory, getNameJa, getName, getPrice,
    isLunchWeekday, isNightTime, isAvailable, extractSpicyLevel,
    statusLabel, getLogicalCategory, classifyByName
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.MOTONARI;
})(typeof window !== 'undefined' ? window : globalThis);
