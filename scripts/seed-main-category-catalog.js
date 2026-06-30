/**
 * Add subcategories and leaf products for main roots 900002–900012
 * (900001 agriculture and existing 900004 metal powders are kept as-is).
 */
const fs = require("fs");
const path = require("path");

const seederPath = path.join(__dirname, "../src/modules/farmer/product/seederData.json");
const items = JSON.parse(fs.readFileSync(seederPath, "utf8"));
const existingIds = new Set(items.map((x) => x.id));

function category(id, parentId, name, slug, englishName, sortOrder, validUnits, groupName) {
  if (existingIds.has(id)) throw new Error(`Duplicate id ${id} (${name})`);
  return {
    id,
    name,
    slug,
    englishName,
    description: `دسته «${name}» از گروه ${groupName}؛ مناسب خرید و فروش عمده و جزئی.`,
    imageUrl: null,
    parentId,
    isActive: true,
    sortOrder,
    isFeatured: sortOrder <= 2,
    icon: null,
    validUnits,
    metaTitle: `خرید و فروش ${name}`,
    metaDescription: `انواع ${name}؛ ثبت آگهی خرید یا فروش به صورت عمده و جزئی.`,
    unit: validUnits[0],
  };
}

function product(id, parentId, name, slug, englishName, sortOrder, validUnits, parentName) {
  if (existingIds.has(id)) throw new Error(`Duplicate id ${id} (${name})`);
  return {
    id,
    name,
    slug,
    englishName,
    description: `${name} (${englishName}) از گروه ${parentName}؛ مناسب خرید و فروش عمده و جزئی.`,
    imageUrl: null,
    parentId,
    isActive: true,
    sortOrder,
    isFeatured: false,
    icon: null,
    validUnits,
    metaTitle: `خرید و فروش ${name}`,
    metaDescription: `انواع ${name}؛ ثبت آگهی خرید یا فروش به صورت عمده و جزئی.`,
    unit: validUnits[0],
  };
}

function block(rootId, rootName, baseId, sections, startSort = 1) {
  const nodes = [];
  let sort = startSort;
  for (const section of sections) {
    const catId = baseId + sort;
    nodes.push(
      category(
        catId,
        rootId,
        section.name,
        section.slug,
        section.englishName,
        sort,
        section.validUnits,
        rootName
      )
    );
    let pSort = 1;
    for (const p of section.products) {
      nodes.push(
        product(
          baseId + sort * 10 + pSort,
          catId,
          p.name,
          p.slug,
          p.englishName,
          pSort,
          p.validUnits || section.validUnits,
          section.name
        )
      );
      pSort += 1;
    }
    sort += 1;
  }
  return nodes;
}

const newNodes = [
  ...block(900002, "مواد غذایی", 200000, [
    {
      name: "روغن‌های خوراکی",
      slug: "edible-oils",
      englishName: "Edible Oils",
      validUnits: ["kg", "ton", "l"],
      products: [
        { name: "روغن آفتابگردان", slug: "sunflower-oil", englishName: "Sunflower Oil" },
        { name: "روغن سویا", slug: "soybean-oil", englishName: "Soybean Oil" },
        { name: "روغن زیتون", slug: "olive-oil", englishName: "Olive Oil" },
      ],
    },
    {
      name: "لبنیات و مشتقات",
      slug: "dairy-products",
      englishName: "Dairy Products",
      validUnits: ["kg", "ton", "pack"],
      products: [
        { name: "پنیر صنعتی", slug: "industrial-cheese", englishName: "Industrial Cheese" },
        { name: "کره گیاهی", slug: "vegetable-butter", englishName: "Vegetable Butter" },
        { name: "شیر خشک", slug: "milk-powder", englishName: "Milk Powder" },
      ],
    },
    {
      name: "کنسرو و فرآورده‌های آماده",
      slug: "canned-preserved-foods",
      englishName: "Canned & Preserved Foods",
      validUnits: ["kg", "ton", "pack", "box"],
      products: [
        { name: "رب گوجه فرنگی", slug: "tomato-paste", englishName: "Tomato Paste" },
        { name: "کنسرو ماهی تن", slug: "canned-tuna", englishName: "Canned Tuna" },
        { name: "رب انار", slug: "pomegranate-paste", englishName: "Pomegranate Paste" },
      ],
    },
    {
      name: "آرد و فرآورده‌های غلات",
      slug: "flour-milled-products",
      englishName: "Flour & Milled Products",
      validUnits: ["kg", "ton", "pack"],
      products: [
        { name: "آرد گندم", slug: "wheat-flour", englishName: "Wheat Flour" },
        { name: "برنج بسته‌بندی", slug: "packaged-rice", englishName: "Packaged Rice" },
        { name: "ماکارونی صنعتی", slug: "industrial-pasta", englishName: "Industrial Pasta" },
      ],
    },
  ]),
  ...block(900003, "شیمیایی و پتروشیمی", 200100, [
    {
      name: "پتروشیمی پایه",
      slug: "basic-petrochemicals",
      englishName: "Basic Petrochemicals",
      validUnits: ["kg", "ton", "l"],
      products: [
        { name: "اتیلن", slug: "ethylene", englishName: "Ethylene" },
        { name: "پروپیلن", slug: "propylene", englishName: "Propylene" },
        { name: "متانول", slug: "methanol", englishName: "Methanol" },
      ],
    },
    {
      name: "پلیمرها و رزین‌ها",
      slug: "polymers-resins",
      englishName: "Polymers & Resins",
      validUnits: ["kg", "ton"],
      products: [
        { name: "پلی‌اتیلن", slug: "polyethylene", englishName: "Polyethylene" },
        { name: "پلی‌پروپیلن", slug: "polypropylene", englishName: "Polypropylene" },
        { name: "PVC", slug: "pvc-resin", englishName: "PVC Resin" },
      ],
    },
    {
      name: "مواد شیمیایی صنعتی",
      slug: "industrial-chemicals",
      englishName: "Industrial Chemicals",
      validUnits: ["kg", "ton", "l", "pack"],
      products: [
        { name: "سود سوزآور", slug: "caustic-soda", englishName: "Caustic Soda" },
        { name: "اسید سولفوریک", slug: "sulfuric-acid", englishName: "Sulfuric Acid" },
        { name: "هیدروژن پراکسید", slug: "hydrogen-peroxide", englishName: "Hydrogen Peroxide" },
      ],
    },
    {
      name: "حلال‌ها و روان‌کارها",
      slug: "solvents-lubricants",
      englishName: "Solvents & Lubricants",
      validUnits: ["l", "kg", "ton"],
      products: [
        { name: "حلال صنعتی", slug: "industrial-solvent", englishName: "Industrial Solvent" },
        { name: "روغن پایه", slug: "base-oil", englishName: "Base Oil" },
      ],
    },
  ]),
  ...block(900004, "فلزات و معدن", 200200, [
    {
      name: "فلزات پایه",
      slug: "base-metals",
      englishName: "Base Metals",
      validUnits: ["kg", "ton"],
      products: [
        { name: "مس کاتد", slug: "copper-cathode", englishName: "Copper Cathode" },
        { name: "آهن اسفنجی", slug: "sponge-iron", englishName: "Sponge Iron" },
        { name: "روی شمش", slug: "zinc-ingot", englishName: "Zinc Ingot" },
      ],
    },
    {
      name: "سنگ معدن و مواد معدنی",
      slug: "ores-minerals",
      englishName: "Ores & Minerals",
      validUnits: ["kg", "ton"],
      products: [
        { name: "سنگ آهن", slug: "iron-ore", englishName: "Iron Ore" },
        { name: "بوکسیت", slug: "bauxite", englishName: "Bauxite" },
        { name: "کرومیت", slug: "chromite", englishName: "Chromite" },
      ],
    },
    {
      name: "فلزات رنگی و آلیاژها",
      slug: "nonferrous-alloys",
      englishName: "Nonferrous Metals & Alloys",
      validUnits: ["kg", "ton"],
      products: [
        { name: "شمش آلومینیوم", slug: "aluminum-ingot", englishName: "Aluminum Ingot" },
        { name: "برنز صنعتی", slug: "industrial-bronze", englishName: "Industrial Bronze" },
      ],
    },
  ], 2),
  ...block(900005, "مصالح ساختمانی", 200300, [
    {
      name: "سیمان و بتن",
      slug: "cement-concrete",
      englishName: "Cement & Concrete",
      validUnits: ["kg", "ton", "pack"],
      products: [
        { name: "سیمان پرتلند", slug: "portland-cement", englishName: "Portland Cement" },
        { name: "سیمان سفید", slug: "white-cement", englishName: "White Cement" },
        { name: "بتن آماده", slug: "ready-mix-concrete", englishName: "Ready-mix Concrete" },
      ],
    },
    {
      name: "آهن و فولاد ساختمان",
      slug: "construction-steel",
      englishName: "Construction Steel",
      validUnits: ["kg", "ton"],
      products: [
        { name: "میلگرد A3", slug: "rebar-a3", englishName: "Rebar A3" },
        { name: "تیرآهن IPE", slug: "ipe-beam", englishName: "IPE Beam" },
        { name: "ورق فولادی", slug: "steel-sheet", englishName: "Steel Sheet" },
      ],
    },
    {
      name: "سرامیک و کاشی",
      slug: "ceramics-tiles",
      englishName: "Ceramics & Tiles",
      validUnits: ["pack", "count", "kg"],
      products: [
        { name: "کاشی کف", slug: "floor-tile", englishName: "Floor Tile" },
        { name: "سرامیک بدنه", slug: "wall-ceramic", englishName: "Wall Ceramic" },
        { name: "سنگ نما", slug: "facade-stone", englishName: "Facade Stone" },
      ],
    },
    {
      name: "عایق و پوشش ساختمان",
      slug: "insulation-coatings",
      englishName: "Insulation & Coatings",
      validUnits: ["pack", "kg", "l"],
      products: [
        { name: "عایق حرارتی", slug: "thermal-insulation", englishName: "Thermal Insulation" },
        { name: "رنگ ساختمانی", slug: "building-paint", englishName: "Building Paint" },
      ],
    },
  ]),
  ...block(900006, "ماشین‌آلات", 200400, [
    {
      name: "ماشین‌آلات کشاورزی",
      slug: "agricultural-machinery",
      englishName: "Agricultural Machinery",
      validUnits: ["count"],
      products: [
        { name: "تراکتور", slug: "tractor", englishName: "Tractor" },
        { name: "کمباین", slug: "combine-harvester", englishName: "Combine Harvester" },
        { name: "سمپاش تراکتوری", slug: "tractor-sprayer", englishName: "Tractor Sprayer" },
      ],
    },
    {
      name: "ماشین‌آلات صنعتی",
      slug: "industrial-machinery",
      englishName: "Industrial Machinery",
      validUnits: ["count"],
      products: [
        { name: "کمپرسور هوا", slug: "air-compressor", englishName: "Air Compressor" },
        { name: "پمپ صنعتی", slug: "industrial-pump", englishName: "Industrial Pump" },
        { name: "موتور الکتریکی صنعتی", slug: "industrial-electric-motor", englishName: "Industrial Electric Motor" },
      ],
    },
    {
      name: "تجهیزات راهسازی",
      slug: "construction-equipment",
      englishName: "Construction Equipment",
      validUnits: ["count"],
      products: [
        { name: "لودر", slug: "wheel-loader", englishName: "Wheel Loader" },
        { name: "بیل مکانیکی", slug: "excavator", englishName: "Excavator" },
        { name: "غلطک آسفالت", slug: "asphalt-roller", englishName: "Asphalt Roller" },
      ],
    },
  ]),
  ...block(900007, "برق و الکترونیک", 200500, [
    {
      name: "تجهیزات برق صنعتی",
      slug: "industrial-electrical",
      englishName: "Industrial Electrical Equipment",
      validUnits: ["count", "pack"],
      products: [
        { name: "ترانسفورماتور", slug: "transformer", englishName: "Transformer" },
        { name: "کابل برق", slug: "power-cable", englishName: "Power Cable" },
        { name: "تابلو برق", slug: "electrical-panel", englishName: "Electrical Panel" },
      ],
    },
    {
      name: "الکترونیک و قطعات",
      slug: "electronics-components",
      englishName: "Electronics & Components",
      validUnits: ["count", "pack"],
      products: [
        { name: "برد الکترونیکی", slug: "electronic-board", englishName: "Electronic Board" },
        { name: "سنسور صنعتی", slug: "industrial-sensor", englishName: "Industrial Sensor" },
        { name: "درایو موتور", slug: "motor-drive", englishName: "Motor Drive" },
      ],
    },
    {
      name: "روشنایی و نورپردازی",
      slug: "lighting",
      englishName: "Lighting",
      validUnits: ["count", "pack"],
      products: [
        { name: "لامپ LED صنعتی", slug: "industrial-led-lamp", englishName: "Industrial LED Lamp" },
        { name: "پروژکتور", slug: "floodlight", englishName: "Floodlight" },
      ],
    },
  ]),
  ...block(900008, "خودرو و قطعات", 200600, [
    {
      name: "قطعات موتور",
      slug: "engine-parts",
      englishName: "Engine Parts",
      validUnits: ["count", "pack"],
      products: [
        { name: "پیستون", slug: "piston", englishName: "Piston" },
        { name: "شاتون", slug: "connecting-rod", englishName: "Connecting Rod" },
        { name: "سرسیلندر", slug: "cylinder-head", englishName: "Cylinder Head" },
      ],
    },
    {
      name: "لوازم یدکی مصرفی",
      slug: "consumable-auto-parts",
      englishName: "Consumable Auto Parts",
      validUnits: ["count", "pack"],
      products: [
        { name: "لنت ترمز", slug: "brake-pad", englishName: "Brake Pad" },
        { name: "فیلتر روغن", slug: "oil-filter", englishName: "Oil Filter" },
        { name: "شمع خودرو", slug: "spark-plug", englishName: "Spark Plug" },
      ],
    },
    {
      name: "لاستیک و رینگ",
      slug: "tires-wheels",
      englishName: "Tires & Wheels",
      validUnits: ["count"],
      products: [
        { name: "لاستیک سواری", slug: "passenger-tire", englishName: "Passenger Tire" },
        { name: "لاستیک کامیون", slug: "truck-tire", englishName: "Truck Tire" },
      ],
    },
  ]),
  ...block(900009, "پوشاک و منسوجات", 200700, [
    {
      name: "پارچه و منسوج",
      slug: "fabrics-textiles",
      englishName: "Fabrics & Textiles",
      validUnits: ["kg", "pack"],
      products: [
        { name: "پارچه جین", slug: "denim-fabric", englishName: "Denim Fabric" },
        { name: "پارچه پنبه‌ای", slug: "cotton-fabric", englishName: "Cotton Fabric" },
        { name: "پارچه کتان", slug: "linen-fabric", englishName: "Linen Fabric" },
      ],
    },
    {
      name: "پوشاک آماده",
      slug: "ready-made-apparel",
      englishName: "Ready-made Apparel",
      validUnits: ["count", "pack"],
      products: [
        { name: "پیراهن مردانه", slug: "mens-shirt", englishName: "Men's Shirt" },
        { name: "شلوار کار", slug: "work-pants", englishName: "Work Pants" },
        { name: "مانتو زنانه", slug: "womens-manto", englishName: "Women's Manto" },
      ],
    },
    {
      name: "نخ و الیاف",
      slug: "yarn-fibers",
      englishName: "Yarn & Fibers",
      validUnits: ["kg", "pack"],
      products: [
        { name: "نخ پنبه", slug: "cotton-yarn", englishName: "Cotton Yarn" },
        { name: "نخ پلی‌استر", slug: "polyester-yarn", englishName: "Polyester Yarn" },
      ],
    },
  ]),
  ...block(900010, "خانه و دکور", 200800, [
    {
      name: "لوازم آشپزخانه",
      slug: "kitchenware",
      englishName: "Kitchenware",
      validUnits: ["count", "pack"],
      products: [
        { name: "قابلمه استیل", slug: "stainless-pot", englishName: "Stainless Steel Pot" },
        { name: "ظروف چینی", slug: "porcelain-dinnerware", englishName: "Porcelain Dinnerware" },
        { name: "سرویس قاشق و چنگال", slug: "cutlery-set", englishName: "Cutlery Set" },
      ],
    },
    {
      name: "دکوراسیون منزل",
      slug: "home-decoration",
      englishName: "Home Decoration",
      validUnits: ["count", "pack"],
      products: [
        { name: "پرده منزل", slug: "home-curtain", englishName: "Home Curtain" },
        { name: "فرش ماشینی", slug: "machine-made-rug", englishName: "Machine-made Rug" },
        { name: "آینه دکوراتیو", slug: "decorative-mirror", englishName: "Decorative Mirror" },
      ],
    },
    {
      name: "لوازم برقی خانگی",
      slug: "home-appliances",
      englishName: "Home Appliances",
      validUnits: ["count"],
      products: [
        { name: "یخچال صنعتی", slug: "commercial-refrigerator", englishName: "Commercial Refrigerator" },
        { name: "ماشین لباسشویی", slug: "washing-machine", englishName: "Washing Machine" },
      ],
    },
  ]),
  ...block(900011, "آرایشی و بهداشتی", 200900, [
    {
      name: "مراقبت پوست",
      slug: "skincare",
      englishName: "Skincare",
      validUnits: ["count", "pack", "l"],
      products: [
        { name: "کرم مرطوب‌کننده", slug: "moisturizer-cream", englishName: "Moisturizer Cream" },
        { name: "ضدآفتاب", slug: "sunscreen", englishName: "Sunscreen" },
        { name: "لوسیون بدن", slug: "body-lotion", englishName: "Body Lotion" },
      ],
    },
    {
      name: "بهداشت شخصی",
      slug: "personal-hygiene",
      englishName: "Personal Hygiene",
      validUnits: ["count", "pack", "l"],
      products: [
        { name: "شامپو", slug: "shampoo", englishName: "Shampoo" },
        { name: "صابون مایع", slug: "liquid-soap", englishName: "Liquid Soap" },
        { name: "خمیردندان", slug: "toothpaste", englishName: "Toothpaste" },
      ],
    },
    {
      name: "لوازم آرایشی",
      slug: "cosmetics",
      englishName: "Cosmetics",
      validUnits: ["count", "pack"],
      products: [
        { name: "رژ لب", slug: "lipstick", englishName: "Lipstick" },
        { name: "کرم پودر", slug: "foundation", englishName: "Foundation" },
        { name: "ریمل", slug: "mascara", englishName: "Mascara" },
      ],
    },
  ]),
  ...block(900012, "سایر کالاها", 201000, [
    {
      name: "بسته‌بندی",
      slug: "packaging-materials",
      englishName: "Packaging Materials",
      validUnits: ["kg", "pack", "count"],
      products: [
        { name: "جعبه مقوایی", slug: "cardboard-box", englishName: "Cardboard Box" },
        { name: "نایلون بسته‌بندی", slug: "packaging-film", englishName: "Packaging Film" },
        { name: "پالت چوبی", slug: "wooden-pallet", englishName: "Wooden Pallet" },
      ],
    },
    {
      name: "کاغذ و مقوا",
      slug: "paper-cardboard",
      englishName: "Paper & Cardboard",
      validUnits: ["kg", "pack", "count"],
      products: [
        { name: "کاغذ A4", slug: "a4-paper", englishName: "A4 Paper" },
        { name: "مقوای صنعتی", slug: "industrial-cardboard", englishName: "Industrial Cardboard" },
      ],
    },
    {
      name: "لوازم اداری",
      slug: "office-supplies",
      englishName: "Office Supplies",
      validUnits: ["count", "pack"],
      products: [
        { name: "خودکار", slug: "ballpoint-pen", englishName: "Ballpoint Pen" },
        { name: "پوشه بایگانی", slug: "archive-folder", englishName: "Archive Folder" },
        { name: "کاغذ کپی", slug: "copy-paper", englishName: "Copy Paper" },
      ],
    },
  ]),
];

for (const node of newNodes) existingIds.add(node.id);

const result = [...items, ...newNodes];
fs.writeFileSync(seederPath, JSON.stringify(result, null, 2) + "\n", "utf8");

const roots = [900002, 900003, 900004, 900005, 900006, 900007, 900008, 900009, 900010, 900011, 900012];
for (const rootId of roots) {
  const subs = result.filter((x) => x.parentId === rootId);
  const products = subs.flatMap((s) => result.filter((x) => x.parentId === s.id));
  console.log(
    result.find((x) => x.id === rootId)?.name,
    "→",
    subs.length,
    "subcats,",
    products.length,
    "products"
  );
}
console.log("Added nodes:", newNodes.length, "| Total:", result.length);
