/**
 * تولید محتوای سئو و لندینگ برای برگ‌های کاتالوگ
 * بدون لورم — متن واقعی، متناسب با دسته و محصول، برای صفحه کاتالوگ و لندینگ.
 */

function hashStr(s) {
  let h = 2166136261;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(arr, seed) {
  if (!arr || !arr.length) return null;
  return arr[hashStr(seed) % arr.length];
}

function unitLabel(node, lang) {
  const u = node.defaultMeasurementUnit || (node.allowedMeasurementUnits && node.allowedMeasurementUnits[0]) || "kg";
  if (lang === "fa") {
    const map = {
      kg: "کیلوگرم",
      ton: "تن",
      t: "تن",
      piece: "عدد",
      pcs: "عدد",
      liter: "لیتر",
      l: "لیتر",
      box: "جعبه",
      carton: "کارتن",
      meter: "متر",
      m: "متر",
      set: "ست",
      unit: "واحد",
    };
    return map[u] || u;
  }
  return u;
}

function packagingHint(node, lang) {
  const packs = Array.isArray(node.allowedPackagingTypes) ? node.allowedPackagingTypes : [];
  if (!packs.length) return lang === "fa" ? "بسته‌بندی توافقی با فروشنده" : "packaging agreed with the seller";
  if (lang === "fa") {
    const map = {
      bag: "کیسه",
      bulk: "فله",
      carton: "کارتن",
      box: "جعبه",
      pallet: "پالت",
      drum: "بشکه",
      bottle: "بطری",
      pack: "پک",
      crate: "جعبه چوبی",
      sack: "گونی",
    };
    return packs
      .slice(0, 4)
      .map((p) => map[p] || p)
      .join("، ");
  }
  return packs.slice(0, 4).join(", ");
}

/** پروفایل‌های محتوایی بر اساس slug مسیر */
const FAMILY_PROFILES = {
  agri_food: {
    match: [
      "nuts-dried-fruits-edible-seeds",
      "fresh-fruits",
      "fresh-vegetables-melons-and-herbs",
      "spices",
      "cereals",
      "pulses",
      "dairy-products",
      "meat-seafood-eggs",
      "beverages",
      "coffee-products-beverages",
      "coffee-cocoa-raw-commodities",
      "bakery-snacks-confectionery",
      "canned-preserved-prepared-foods",
      "food-staples-ingredients-additives",
      "livestock-beekeeping-animal-feed",
      "date",
      "agricultural-chemicals",
      "seeds-saplings-live-plants",
    ],
    fa: {
      buyer: "تأمین‌کنندگان مواد غذایی، صادرکنندگان، عمده‌فروشان و کارخانه‌های فرآوری",
      qualityFocus: "درجه کیفیت، رطوبت، خلوص، سال برداشت، مبدأ و استانداردهای بهداشتی",
      tradeFocus: "MOQ، بسته‌بندی صادراتی، گواهی‌های بهداشت/فیتوسنیتری و اینکوترمز",
      useCases: "مصرف خرده‌فروشی، صنایع غذایی، صادرات و تأمین زنجیره هتل و رستوران",
    },
    en: {
      buyer: "food wholesalers, exporters, importers and processing plants",
      qualityFocus: "grade, moisture, purity, crop year, origin and food-safety standards",
      tradeFocus: "MOQ, export packaging, health/phytosanitary certificates and Incoterms",
      useCases: "retail supply, food manufacturing, export and HoReCa procurement",
    },
  },
  industrial: {
    match: [
      "industrial-chemicals-gases",
      "paints-coatings-resins",
      "industrial-raw-materials-polymers",
      "mineral-ores-industrial-minerals",
      "iron-steel-products",
      "non-ferrous-stainless-metals",
      "aluminum-products",
      "plastics-polymer-products",
      "rubber-rubber-products",
      "fuels-lubricants-energy-products",
      "adhesives-sealants-tapes",
      "scrap-recyclables-waste-materials",
      "glass-glass-products",
      "building-materials-insulation",
    ],
    fa: {
      buyer: "کارخانه‌ها، پیمانکاران، بازرگانان مواد اولیه و خریداران پروژه‌ای",
      qualityFocus: "گرید فنی، آنالیز، استاندارد ملی/بین‌المللی، خلوص و مشخصات فنی",
      tradeFocus: "حجم محموله، شرایط تحویل، اسناد آنالیز (COA) و الزامات ایمنی",
      useCases: "خط تولید، پروژه‌های عمرانی، صادرات مواد اولیه و تأمین کارخانه",
    },
    en: {
      buyer: "factories, contractors, commodity traders and project buyers",
      qualityFocus: "technical grade, analysis, national/international standards, purity and specs",
      tradeFocus: "shipment volume, delivery terms, COA documents and safety requirements",
      useCases: "production lines, construction projects, raw-material export and plant supply",
    },
  },
  machinery: {
    match: [
      "industrial-machinery-production-equipment",
      "heavy-construction-road-machinery",
      "agricultural-equipment",
      "food-industry-equipment",
      "packaging-machinery-coding-equipment",
      "cooling-and-heating-equipment",
      "water-air-industrial-cleaning-equipment",
      "printing-equipment",
      "sewing-and-textile-equipment",
      "energy-equipment",
      "industrial-tools-pumps-valves",
      "lighting-illumination-equipment",
      "electrical-equipment",
      "medical-laboratory-hospital-equipment",
      "beauty-spa-salon-equipment",
    ],
    fa: {
      buyer: "کارگاه‌ها، واحدهای صنعتی، پیمانکاران و واردکنندگان تجهیزات",
      qualityFocus: "ظرفیت، برند/مدل، وضعیت نو یا کارکرده، گارانتی و مصرف انرژی",
      tradeFocus: "نصب و راه‌اندازی، قطعات یدکی، شرایط حمل سنگین و اینکوترمز",
      useCases: "افزایش ظرفیت تولید، نوسازی خط و تجهیز کارخانه یا کارگاه",
    },
    en: {
      buyer: "workshops, industrial plants, contractors and equipment importers",
      qualityFocus: "capacity, brand/model, new vs used condition, warranty and energy use",
      tradeFocus: "installation, spare parts, heavy freight handling and Incoterms",
      useCases: "capacity expansion, line upgrades and workshop or factory equipping",
    },
  },
  consumer: {
    match: [
      "apparel",
      "shoes",
      "bags",
      "fashion-accessories",
      "furniture-interior-decor-furnishings",
      "major-home-appliances",
      "home-kitchen-pet-supplies",
      "cosmetics-personal-care-hygiene",
      "consumer-electronics-it-security",
      "stationery",
      "toys-games-party-supplies",
      "sports-equipment",
      "gifts-handicrafts-gemstones",
      "watches-jewelry-and-eyewear",
      "textiles-and-raw-materials",
      "leather-synthetic-leather-materials",
      "baby-childrens-products",
      "professional-beauty-aesthetic-products",
      "promotional-exhibition-supplies",
      "commercial-cleaning-hygiene-general-consumables",
      "musical-instruments-studio-entertainment-equipment",
      "orthopedics-and-rehabilitation",
      "paper-cardboard-stationery-office-supplies",
      "packaging-shipping-warehousing-supplies",
      "building-fixtures-sanitary-ware-systems",
    ],
    fa: {
      buyer: "عمده‌فروشان، فروشگاه‌های زنجیره‌ای، صادرکنندگان و خریداران سازمانی",
      qualityFocus: "مدل، جنس مواد، استاندارد ایمنی، بسته‌بندی خرده‌فروشی و تنوع سایز/رنگ",
      tradeFocus: "حداقل سفارش کارتنی، لیبل‌گذاری، بارکد و زمان تحویل",
      useCases: "تأمین فروشگاه، صادرات کالاهای مصرفی و سفارش سازمانی",
    },
    en: {
      buyer: "wholesalers, retail chains, exporters and institutional buyers",
      qualityFocus: "model, material, safety standards, retail packaging and size/color range",
      tradeFocus: "carton MOQ, labeling, barcoding and lead time",
      useCases: "store replenishment, consumer-goods export and institutional orders",
    },
  },
  automotive: {
    match: [
      "vehicles",
      "engine-parts",
      "brakes-and-suspension",
      "electrical-and-electronic-parts",
      "consumable-auto-parts",
      "body-and-exterior-parts",
      "powertrain-system",
      "auto-accessories",
      "tires-wheels-industrial-tyres",
    ],
    fa: {
      buyer: "نمایندگی‌ها، تعمیرگاه‌ها، واردکنندگان قطعات و ناوگان‌های سازمانی",
      qualityFocus: "سازگاری با مدل خودرو، استاندارد OEM/aftermarket، گارانتی و اصالت کالا",
      tradeFocus: "شماره فنی، بسته‌بندی، حداقل سفارش و شرایط گمرکی واردات",
      useCases: "تأمین قطعات یدکی، تجهیز تعمیرگاه و سفارش ناوگان",
    },
    en: {
      buyer: "dealerships, workshops, parts importers and fleet operators",
      qualityFocus: "vehicle compatibility, OEM/aftermarket grade, warranty and authenticity",
      tradeFocus: "part numbers, packaging, MOQ and import customs terms",
      useCases: "spare-parts supply, workshop stocking and fleet procurement",
    },
  },
};

const DEFAULT_FAMILY = {
  fa: {
    buyer: "خریداران عمده، بازرگانان و تأمین‌کنندگان سازمانی",
    qualityFocus: "مشخصات فنی، درجه کیفیت، مبدأ و استانداردهای مرتبط",
    tradeFocus: "حداقل سفارش، بسته‌بندی، اسناد تجاری و شرایط تحویل",
    useCases: "تأمین عمده، صادرات/واردات و سفارش‌های سازمانی",
  },
  en: {
    buyer: "wholesale buyers, traders and institutional purchasers",
    qualityFocus: "technical specs, quality grade, origin and related standards",
    tradeFocus: "MOQ, packaging, commercial documents and delivery terms",
    useCases: "bulk supply, export/import and institutional orders",
  },
};

/** محتوای ویژه محصولات پرتقاضای صادراتی/کشاورزی */
const PRODUCT_STAR = {
  pistachio: {
    fa: {
      hook: "پسته ایرانی از شناخته‌شده‌ترین اقلام صادراتی خشکبار جهان است و در بازار عمده با درجه‌بندی دقیق، رطوبت کنترل‌شده و بسته‌بندی صادراتی معامله می‌شود.",
      bodyExtra:
        "خریداران معمولاً به رقم (احمدآقایی، اکبری، فندقی و…)، درصد دهان‌باز، سایز اونس، سال برداشت و نوع عرضه (خام، بوداده، خلال) توجه می‌کنند. در زارعون می‌توانید پیشنهادهای عمده را با مشخصات تجاری مقایسه کنید.",
      highlights: [
        { title: "درجه و سایز صادراتی", text: "انتخاب بر اساس اونس، درصد دهان‌باز و رقم محصول." },
        { title: "رطوبت و انبارداری", text: "کنترل رطوبت برای حفظ تردی و جلوگیری از فساد در حمل طولانی." },
        { title: "بسته‌بندی عمده", text: "کیسه، کارتن و پالت متناسب با مسیر صادراتی." },
        { title: "استعلام سریع B2B", text: "مقایسه موجودی، MOQ و گفتگو مستقیم با فروشنده." },
      ],
    },
    en: {
      hook: "Iranian pistachio is among the world’s most traded specialty nuts, sold wholesale by grade, moisture control and export packaging.",
      bodyExtra:
        "Buyers typically evaluate cultivar, open-mouth percentage, ounce size, crop year and form (raw, roasted, kernels). On Zareoon you can compare wholesale offers with clear commercial specs.",
      highlights: [
        { title: "Export grade & size", text: "Select by ounce size, open-mouth share and cultivar." },
        { title: "Moisture & storage", text: "Controlled moisture for long-haul freshness." },
        { title: "Bulk packaging", text: "Bags, cartons and pallets matched to export lanes." },
        { title: "Fast B2B RFQ", text: "Compare stock, MOQ and chat with suppliers." },
      ],
    },
  },
  saffron: {
    fa: {
      hook: "زعفران ایران استاندارد طلایی بازار جهانی ادویه است؛ معامله عمده بر پایه رشته، قدرت رنگ‌دهی (کروسین)، عطر و بسته‌بندی ضدنور انجام می‌شود.",
      bodyExtra:
        "در خرید B2B معمولاً نوع نگین، پوشال یا دسته، درصد ناخالصی، آزمایشگاه و گواهی‌های کیفیت بررسی می‌شود. صفحه زعفران در زارعون برای مقایسه تأمین‌کنندگان و استعلام قیمت عمده طراحی شده است.",
      highlights: [
        { title: "قدرت رنگ و عطر", text: "تمرکز روی کروسین، سافرانال و استاندارد آزمایشگاهی." },
        { title: "انواع تجاری", text: "نگین، پوشال و دسته متناسب با بازار هدف." },
        { title: "بسته‌بندی صادراتی", text: "قوطی، پاکت و کارتن ضدرطوبت و ضدنور." },
        { title: "زنجیره اعتماد", text: "اسناد کیفیت و ارتباط مستقیم با فروشنده." },
      ],
    },
    en: {
      hook: "Iranian saffron sets the global spice benchmark; wholesale deals focus on filament type, coloring strength (crocin), aroma and light-proof packaging.",
      bodyExtra:
        "B2B buyers usually check Negin/Pushal grade, impurity level, lab reports and quality certificates. Zareoon’s saffron page helps you compare suppliers and request bulk pricing.",
      highlights: [
        { title: "Color & aroma strength", text: "Crocin, safranal and lab-verified quality." },
        { title: "Commercial grades", text: "Negin, Pushal and bunch styles for target markets." },
        { title: "Export packaging", text: "Tins, pouches and cartons that protect from light and moisture." },
        { title: "Trusted sourcing", text: "Quality documents plus direct seller messaging." },
      ],
    },
  },
  raisin: {
    fa: {
      hook: "کشمش ایرانی در بازار خشکبار صادراتی جایگاه تثبیت‌شده‌ای دارد و بر اساس رنگ، سایز، رطوبت و نوع فرآوری (سبز، طلایی، سیاه) قیمت‌گذاری می‌شود.",
      bodyExtra:
        "خریداران عمده به یکنواختی دانه، درصد دانه‌های آسیب‌دیده، شیرینی طبیعی و آمادگی برای بسته‌بندی خرده‌فروشی یا فله صادراتی توجه می‌کنند.",
    },
    en: {
      hook: "Iranian raisins hold a strong position in export dried-fruit trade, priced by color, size, moisture and process type (green, golden, black).",
      bodyExtra:
        "Wholesale buyers look for berry uniformity, defect rate, natural sweetness and readiness for retail or bulk export packing.",
    },
  },
  raisins: {
    fa: {
      hook: "کشمش ایرانی در بازار خشکبار صادراتی جایگاه تثبیت‌شده‌ای دارد و بر اساس رنگ، سایز، رطوبت و نوع فرآوری قیمت‌گذاری می‌شود.",
      bodyExtra:
        "خریداران عمده به یکنواختی دانه، درصد دانه‌های آسیب‌دیده و آمادگی بسته‌بندی صادراتی توجه می‌کنند.",
    },
    en: {
      hook: "Iranian raisins are a core export dried fruit, priced by color, size, moisture and process type.",
      bodyExtra: "Wholesale buyers look for berry uniformity, defect rate and export packing readiness.",
    },
  },
  date: {
    fa: {
      hook: "خرما از اقلام استراتژیک صادرات کشاورزی ایران است؛ معامله عمده بر پایه رقم، درجه شیرینی، رطوبت و نوع بسته‌بندی انجام می‌شود.",
      bodyExtra:
        "ارقام پرطرفدار مانند مضافتی، زاهدی، کلوته و استعمران بازارهای متفاوتی دارند. در زارعون مشخصات رقم، موجودی و شرایط تحویل را پیش از سفارش بررسی کنید.",
    },
    en: {
      hook: "Dates are a strategic Iranian agri-export; wholesale deals hinge on cultivar, sweetness, moisture and packaging format.",
      bodyExtra:
        "Popular cultivars such as Mazafati, Zahidi, Kaluteh and Estamaran serve different markets. On Zareoon review cultivar specs, stock and delivery terms before ordering.",
    },
  },
  almond: {
    fa: {
      hook: "بادام خام و مغز بادام در تجارت خشکبار با معیارهایی مثل سایز، درصد پوست، تلخی/شیرینی و یکنواختی دانه‌بندی معامله می‌شود.",
      bodyExtra: "برای سفارش عمده، نوع عرضه (با پوست یا مغز)، رطوبت و آمادگی صادراتی را در پیشنهادهای فروشنده مقایسه کنید.",
    },
    en: {
      hook: "Raw almonds and kernels trade on size, shell share, sweet/bitter profile and sizing uniformity.",
      bodyExtra: "For bulk orders compare in-shell vs kernel form, moisture and export readiness across seller offers.",
    },
  },
  walnut: {
    fa: {
      hook: "گردو و مغز گردو در بازار عمده بر پایه رنگ مغز، درصد چربی، شکستگی و کیفیت پوست ارزیابی می‌شوند.",
      bodyExtra: "خریداران صنعتی و صادراتی معمولاً به یکنواختی مغز، بو، و شرایط انبارداری خشک توجه ویژه دارند.",
    },
    en: {
      hook: "Walnuts and walnut kernels are graded by kernel color, oil content, breakage and shell quality.",
      bodyExtra: "Industrial and export buyers focus on kernel uniformity, aroma and dry storage conditions.",
    },
  },
  hazelnut: {
    fa: {
      hook: "فندق و مغز فندق در صنایع شکلات، شیرینی و خشکبار مصرف بالایی دارد و با سایز، درصد پوست و تازگی معامله می‌شود.",
      bodyExtra: "در خرید عمده به یکنواختی دانه، رطوبت و نوع بوداده یا خام توجه کنید.",
    },
    en: {
      hook: "Hazelnuts are widely used in chocolate and confectionery and traded by size, shell share and freshness.",
      bodyExtra: "In wholesale buying check sizing uniformity, moisture and roasted vs raw form.",
    },
  },
  rice: {
    fa: {
      hook: "برنج از کالاهای پایه غذایی است که در خرید عمده با رقم، درصد شکستگی، عطر و سال برداشت متمایز می‌شود.",
      bodyExtra: "در زارعون می‌توانید پیشنهادهای عمده برنج را با واحد کیلوگرم/تن، بسته‌بندی و شرایط تحویل مقایسه کنید.",
    },
    en: {
      hook: "Rice is a staple commodity differentiated wholesale by cultivar, broken percentage, aroma and crop year.",
      bodyExtra: "On Zareoon compare bulk rice offers by kg/ton unit, packaging and delivery terms.",
    },
  },
  pomegranate: {
    fa: {
      hook: "انار تازه ایران برای بازار تازه و صنایع آبمیوه طرفدار دارد؛ معیارها شامل رقم، سایز، شیرینی و رسیدگی است.",
      bodyExtra: "برای صادرات تازه، بسته‌بندی ضربه‌گیر و زمان حمل سردخانه‌ای اهمیت بالایی دارد.",
    },
    en: {
      hook: "Iranian pomegranate is valued for fresh markets and juice industries; buyers weigh cultivar, size, sweetness and maturity.",
      bodyExtra: "For fresh export, shock-resistant packing and cold-chain timing are critical.",
    },
  },
  "dried-figs": {
    fa: {
      hook: "انجیر خشک صادراتی معمولاً بر اساس سایز، رنگ، رطوبت و یکنواختی دانه‌بندی درجه‌بندی می‌شود.",
      bodyExtra: "خریداران عمده به شیرینی طبیعی، عاری بودن از آفت و بسته‌بندی ضد رطوبت توجه می‌کنند.",
    },
    en: {
      hook: "Export dried figs are graded by size, color, moisture and sizing uniformity.",
      bodyExtra: "Wholesale buyers look for natural sweetness, pest-free lots and moisture-proof packing.",
    },
  },
  "dried-barberries": {
    fa: {
      hook: "زرشک خشک ایرانی چاشنی ویژه‌ای برای بازارهای غذایی و صادراتی است و بر پایه رنگ قرمز شفاف، ترشی متعادل و خلوص ارزیابی می‌شود.",
      bodyExtra: "در خرید عمده، درصد دم‌گل، یکنواختی و شرایط خشک‌کردن را بررسی کنید.",
    },
    en: {
      hook: "Iranian dried barberries are a specialty culinary ingredient graded by bright red color, balanced acidity and purity.",
      bodyExtra: "In wholesale buying check stem share, uniformity and drying conditions.",
    },
  },
  sesame: {
    fa: {
      hook: "کنجد خوراکی و روغنی در صنایع نانوایی، حلوا و روغن‌کشی کاربرد دارد؛ معیارها شامل خلوص، رنگ و درصد روغن است.",
      bodyExtra: "پیشنهادهای عمده را از نظر بوداده/خام، پوست‌کنده و گواهی‌های غذایی مقایسه کنید.",
    },
    en: {
      hook: "Sesame serves bakery, halvah and oil milling; buyers track purity, color and oil content.",
      bodyExtra: "Compare roasted vs raw, hulled lots and food certificates across wholesale offers.",
    },
  },
  "sunflower-seeds": {
    fa: {
      hook: "تخمه آفتابگردان در بازار تنقلات و روغن‌کشی پرتقاضا است و بر پایه سایز، نمک‌سود یا خام و درصد مغز ارزیابی می‌شود.",
      bodyExtra: "برای سفارش عمده، نوع بو داده، بسته‌بندی عمده و یکنواختی دانه را مقایسه کنید.",
    },
    en: {
      hook: "Sunflower seeds are in demand for snacks and oil milling, graded by size, salted/raw form and kernel yield.",
      bodyExtra: "For bulk orders compare roasted style, wholesale packing and seed uniformity.",
    },
  },
  honey: {
    fa: {
      hook: "عسل طبیعی در بازار عمده با منشأ گیاهی، رطوبت، غلظت و آزمایش‌های اصالت سنجیده می‌شود.",
      bodyExtra: "برای سفارش B2B به نوع عسل، بسته‌بندی و گواهی آزمایشگاهی توجه کنید.",
    },
    en: {
      hook: "Natural honey is traded wholesale by botanical origin, moisture, viscosity and authenticity tests.",
      bodyExtra: "For B2B orders check honey type, packaging and laboratory certificates.",
    },
  },
  "natural-honey": {
    fa: {
      hook: "عسل طبیعی در بازار عمده با منشأ گیاهی، رطوبت، غلظت و آزمایش‌های اصالت سنجیده می‌شود.",
      bodyExtra: "برای سفارش B2B به نوع عسل، بسته‌بندی و گواهی آزمایشگاهی توجه کنید.",
    },
    en: {
      hook: "Natural honey is traded wholesale by botanical origin, moisture, viscosity and authenticity tests.",
      bodyExtra: "For B2B orders check honey type, packaging and laboratory certificates.",
    },
  },
};

function resolveFamily(pathSlugs = []) {
  const set = new Set(pathSlugs || []);
  for (const profile of Object.values(FAMILY_PROFILES)) {
    if (profile.match.some((m) => set.has(m))) return profile;
  }
  return { fa: DEFAULT_FAMILY.fa, en: DEFAULT_FAMILY.en, match: [] };
}

function starFor(slug) {
  if (!slug) return null;
  if (PRODUCT_STAR[slug]) return PRODUCT_STAR[slug];
  const s = String(slug);
  if (s.includes("date") || s.includes("khorma") || s.includes("mazafati") || s.includes("zahidi")) return PRODUCT_STAR.date;
  if (s.includes("raisin") || s.includes("keshmesh")) return PRODUCT_STAR.raisins;
  if (s.includes("saffron") || s.includes("zaferan")) return PRODUCT_STAR.saffron;
  if (s.includes("pistachio") || s.includes("peste")) return PRODUCT_STAR.pistachio;
  if (s.includes("honey") || s.includes("asal")) return PRODUCT_STAR.honey;
  return null;
}

function buildHighlightsFa(name, family, star, seed) {
  if (star?.fa?.highlights) return star.fa.highlights;
  const pools = [
    [
      { title: "مناسب خرید عمده", text: `طراحی‌شده برای ${family.fa.buyer}.` },
      { title: "شفافیت مشخصات", text: `تمرکز روی ${family.fa.qualityFocus}.` },
      { title: "آمادگی تجاری", text: `${family.fa.tradeFocus}.` },
      { title: "کاربرد واقعی بازار", text: `قابل استفاده در ${family.fa.useCases}.` },
    ],
    [
      { title: `چرا ${name} در زارعون؟`, text: "مقایسه چند پیشنهاد، موجودی واقعی و گفتگو با فروشنده در یک صفحه." },
      { title: "جزئیات فنی قابل‌اتکا", text: `بررسی ${family.fa.qualityFocus} پیش از ثبت سفارش.` },
      { title: "مسیر سفارش B2B", text: "از استعلام قیمت تا سفارش از موجودی فعال." },
      { title: "بسته‌بندی و تحویل", text: "شرایط بسته‌بندی و تحویل در پیشنهاد فروشنده مشخص است." },
    ],
  ];
  return pick(pools, `${seed}-hl`);
}

function buildHighlightsEn(name, family, star, seed) {
  if (star?.en?.highlights) return star.en.highlights;
  const pools = [
    [
      { title: "Built for wholesale", text: `Ideal for ${family.en.buyer}.` },
      { title: "Clear specifications", text: `Focus on ${family.en.qualityFocus}.` },
      { title: "Trade-ready terms", text: `${family.en.tradeFocus}.` },
      { title: "Real market use", text: `Suited to ${family.en.useCases}.` },
    ],
    [
      { title: `Why buy ${name} on Zareoon?`, text: "Compare offers, live stock and seller chat in one place." },
      { title: "Reliable tech details", text: `Review ${family.en.qualityFocus} before ordering.` },
      { title: "B2B order path", text: "From RFQ to ordering available inventory." },
      { title: "Packaging & delivery", text: "Packing and delivery terms are stated on each offer." },
    ],
  ];
  return pick(pools, `${seed}-hl-en`);
}

function buildFaqsFa(name, unit, family) {
  return [
    {
      title: `حداقل سفارش ${name} چقدر است؟`,
      text: `حداقل سفارش (MOQ) بسته به فروشنده، درجه کیفیت و نوع بسته‌بندی متفاوت است و روی هر پیشنهاد موجودی نمایش داده می‌شود. واحد پایه معمولاً ${unit} است.`,
    },
    {
      title: `برای خرید عمده ${name} به چه مشخصاتی توجه کنم؟`,
      text: `مهم‌ترین موارد عبارتند از: ${family.fa.qualityFocus}. همچنین مبدأ، سال تولید/برداشت و شرایط نگهداری را در پیشنهاد بررسی کنید.`,
    },
    {
      title: `آیا ${name} برای صادرات قابل تأمین است؟`,
      text: `بسیاری از تأمین‌کنندگان مسیر صادراتی دارند. ${family.fa.tradeFocus} را در پیشنهاد یا لندینگ حرفه‌ای محصول چک کنید.`,
    },
    {
      title: "چطور قیمت بگیرم و سفارش ثبت کنم؟",
      text: "پیشنهادهای فعال را مقایسه کنید، در صورت نیاز با فروشنده گفتگو کنید و پس از توافق از موجودی قابل‌سفارش، سفارش را ثبت نمایید.",
    },
    {
      title: "مدارک و استانداردها کجا دیده می‌شود؟",
      text: "اسناد کیفیت، گواهی‌ها و جزئیات تجاری معمولاً در پیشنهاد فروشنده یا صفحه لندینگ محصول درج می‌شود؛ در صورت نیاز از فروشنده بخواهید.",
    },
  ];
}

function buildFaqsEn(name, unit, family) {
  return [
    {
      title: `What is the MOQ for ${name}?`,
      text: `Minimum order quantity varies by seller, grade and packaging and is shown on each inventory offer. The base unit is typically ${unit}.`,
    },
    {
      title: `What should I check before buying wholesale ${name}?`,
      text: `Prioritize ${family.en.qualityFocus}. Also review origin, production/crop year and storage conditions on the offer.`,
    },
    {
      title: `Can ${name} be sourced for export?`,
      text: `Many suppliers support export lanes. Verify ${family.en.tradeFocus} on the offer or professional landing page.`,
    },
    {
      title: "How do I get pricing and place an order?",
      text: "Compare active offers, chat with the seller if needed, then order from available stock after agreement.",
    },
    {
      title: "Where are certificates and standards listed?",
      text: "Quality docs and commercial details usually appear on the seller offer or product landing; request extras from the seller when required.",
    },
  ];
}

function buildBenefitsFa(name) {
  return [
    { title: "مقایسه چند تأمین‌کننده", text: `پیشنهادهای مختلف ${name} را از نظر موجودی، قیمت و شرایط ببینید.` },
    { title: "سفارش از موجودی واقعی", text: "مقدار قابل‌سفارش و رزرو به‌صورت شفاف نمایش داده می‌شود." },
    { title: "محتوای آماده لندینگ", text: "همین توضیحات سئو در صفحه حرفه‌ای محصول نیز قابل استفاده است." },
    { title: "ارتباط مستقیم تجاری", text: "گفتگو با فروشنده و مشاهده پروفایل فروشگاه پیش از خرید." },
  ];
}

function buildBenefitsEn(name) {
  return [
    { title: "Compare multiple suppliers", text: `Review ${name} offers by stock, price and terms.` },
    { title: "Order from real inventory", text: "Available vs reserved quantities are transparent." },
    { title: "Landing-ready SEO copy", text: "The same content powers professional product landings." },
    { title: "Direct commercial contact", text: "Chat with the seller and visit their storefront first." },
  ];
}

function buildFa(node, categoryPath, pathSlugs) {
  const name = node.translations?.fa?.name || node.slug || "محصول";
  const cat = categoryPath.length ? categoryPath[categoryPath.length - 1] : "محصولات";
  const breadcrumb = categoryPath.length ? categoryPath.join(" › ") : cat;
  const unit = unitLabel(node, "fa");
  const pack = packagingHint(node, "fa");
  const family = resolveFamily(pathSlugs);
  const star = starFor(node.slug);
  const seed = `${node.slug || node.id}-${name}`;

  const metaTitle = `خرید عمده ${name} | بازار B2B زارعون`;
  const metaDescription = `خرید و فروش عمده ${name} در دسته ${cat}. مقایسه تأمین‌کنندگان، استعلام قیمت، بررسی کیفیت، سفارش عمده و مسیر صادرات در بازار بین‌المللی زارعون.`;

  const hook =
    star?.fa?.hook ||
    pick(
      [
        `${name} از اقلام پرگردش دستهٔ «${cat}» در بازار عمده‌فروشی زارعون است و برای ${family.fa.buyer} عرضه می‌شود.`,
        `اگر به‌دنبال تأمین پایدار و شفاف ${name} هستید، صفحهٔ محصول در زارعون پیشنهادهای واقعی فروشندگان را با جزئیات تجاری کنار هم قرار می‌دهد.`,
        `${name} در زنجیره تأمین B2B معمولاً بر اساس ${family.fa.qualityFocus} ارزیابی می‌شود؛ زارعون این اطلاعات را شفاف‌تر می‌کند.`,
      ],
      `${seed}-hook`
    );

  const p2 = pick(
    [
      `در این صفحه می‌توانید موجودی قابل سفارش، حداقل سفارش، واحد اندازه‌گیری (${unit}) و گزینه‌های بسته‌بندی (${pack}) را بررسی کنید و با فروشنده گفتگو نمایید.`,
      `جزئیات تجاری ${name} شامل واحد ${unit}، بسته‌بندی‌های متداول (${pack}) و شرایط تحویل در پیشنهادهای فعال نمایش داده می‌شود تا تصمیم‌گیری خرید عمده سریع‌تر شود.`,
      `برای سفارش عمده ${name}، علاوه بر قیمت به ${family.fa.tradeFocus} توجه کنید؛ این موارد معمولاً در کارت موجودی یا لندینگ حرفه‌ای محصول قابل مشاهده است.`,
    ],
    `${seed}-p2`
  );

  const p3 =
    star?.fa?.bodyExtra ||
    pick(
      [
        `کاربردهای رایج ${name} شامل ${family.fa.useCases} است. پس از مقایسه پیشنهادها می‌توانید استعلام قیمت بگیرید یا مستقیماً از موجودی سفارش ثبت کنید.`,
        `چه برای بازار داخلی و چه برای صادرات، مسیر خرید ${name} در زارعون از مشاهده پیشنهاد تا گفتگو و ثبت سفارش طراحی شده است.`,
        `اگر به صفحه لندینگ حرفه‌ای نیاز دارید، همین محتوای سئو به‌عنوان پایهٔ معرفی ${name}، ویژگی‌ها و سوالات متداول قابل استفاده است.`,
      ],
      `${seed}-p3`
    );

  const description = [hook, p2, p3].join("\n\n");

  const seoIntro = pick(
    [
      `${name} را در بازار بین‌المللی زارعون برای خرید عمده و تأمین B2B پیدا کنید. این محصول در مسیر ${breadcrumb} قرار دارد و خریداران می‌توانند مشخصات کیفی، موجودی و شرایط فروش را پیش از سفارش بررسی کنند.`,
      `راهنمای خرید عمده ${name}: مقایسه تأمین‌کنندگان در دسته ${cat}، بررسی ${family.fa.qualityFocus} و انتخاب پیشنهاد مناسب برای ${family.fa.useCases}.`,
      `صفحه ${name} در زارعون برای خریداران حرفه‌ای نوشته شده است؛ از استعلام قیمت تا سفارش عمده و آماده‌سازی محتوای لندینگ محصول.`,
    ],
    `${seed}-intro`
  );

  const seoOutro = pick(
    [
      `برای مشاهده موجودی‌های فعال ${name}، مقایسه قیمت و شروع گفتگو با فروشنده، پیشنهادهای همین صفحه را بررسی کنید. در صورت نیاز به معرفی کامل‌تر، از لندینگ حرفه‌ای محصول استفاده نمایید.`,
      `همین حالا پیشنهادهای ${name} را ببینید، شرایط تجاری را چک کنید و سفارش عمده خود را با اطمینان بیشتری ثبت کنید.`,
      `زارعون کمک می‌کند تأمین ${name} شفاف‌تر شود: موجودی واقعی، مشخصات تجاری و ارتباط مستقیم با فروشنده در یک مسیر.`,
    ],
    `${seed}-outro`
  );

  return {
    ...node.translations.fa,
    name,
    metaTitle,
    metaDescription,
    description,
    highlights: buildHighlightsFa(name, family, star, seed),
    faqs: buildFaqsFa(name, unit, family),
    benefits: buildBenefitsFa(name),
    seoIntro,
    seoOutro,
    categoryPath: breadcrumb,
  };
}

function buildEn(node, categoryPathEn, pathSlugs) {
  const name = node.translations?.en?.name || node.translations?.fa?.name || node.slug || "Product";
  const cat = categoryPathEn.length ? categoryPathEn[categoryPathEn.length - 1] : "Products";
  const breadcrumb = categoryPathEn.length ? categoryPathEn.join(" › ") : cat;
  const unit = unitLabel(node, "en");
  const pack = packagingHint(node, "en");
  const family = resolveFamily(pathSlugs);
  const star = starFor(node.slug);
  const seed = `${node.slug || node.id}-${name}-en`;

  const metaTitle = `Buy Wholesale ${name} | Zareoon B2B Marketplace`;
  const metaDescription = `Wholesale ${name} in ${cat}. Compare suppliers, request pricing, review quality specs, place bulk orders and explore export-ready offers on Zareoon.`;

  const hook =
    star?.en?.hook ||
    pick(
      [
        `${name} is an actively traded wholesale item in the “${cat}” category on Zareoon, serving ${family.en.buyer}.`,
        `Looking for reliable wholesale supply of ${name}? Zareoon lists live seller offers with commercial details side by side.`,
        `In B2B trade, ${name} is typically evaluated by ${family.en.qualityFocus}; this page makes those signals easier to compare.`,
      ],
      `${seed}-hook`
    );

  const p2 = pick(
    [
      `Review available stock, MOQ, measurement unit (${unit}) and common packaging options (${pack}), then message the seller directly.`,
      `Commercial details for ${name} — unit ${unit}, packaging (${pack}) and delivery terms — appear on active offers so bulk decisions are faster.`,
      `When buying wholesale ${name}, weigh price together with ${family.en.tradeFocus}; these are usually visible on the inventory card or landing page.`,
    ],
    `${seed}-p2`
  );

  const p3 =
    star?.en?.bodyExtra ||
    pick(
      [
        `Typical uses include ${family.en.useCases}. After comparing offers you can request pricing or order from available inventory.`,
        `Whether you source for domestic distribution or export, the ${name} buying path on Zareoon goes from offer review to chat and checkout.`,
        `Need a professional landing page? This SEO copy is ready to seed hero, features and FAQ sections for ${name}.`,
      ],
      `${seed}-p3`
    );

  const description = [hook, p2, p3].join("\n\n");

  const seoIntro = pick(
    [
      `Find wholesale ${name} on Zareoon’s international B2B marketplace. This product sits under ${breadcrumb}, where buyers can review quality specs, stock and seller terms before ordering.`,
      `Wholesale buying guide for ${name}: compare suppliers in ${cat}, check ${family.en.qualityFocus}, and choose the right offer for ${family.en.useCases}.`,
      `This ${name} page is written for professional buyers — from RFQ to bulk order and landing-page ready product copy.`,
    ],
    `${seed}-intro`
  );

  const seoOutro = pick(
    [
      `Browse active ${name} lots on this page to compare pricing and start a seller conversation. For a fuller product story, open the professional landing page.`,
      `Review ${name} offers now, confirm commercial terms, and place your wholesale order with clearer context.`,
      `Zareoon makes sourcing ${name} more transparent: real inventory, commercial specs and direct seller contact in one flow.`,
    ],
    `${seed}-outro`
  );

  return {
    ...node.translations.en,
    name,
    metaTitle,
    metaDescription,
    description,
    highlights: buildHighlightsEn(name, family, star, seed),
    faqs: buildFaqsEn(name, unit, family),
    benefits: buildBenefitsEn(name),
    seoIntro,
    seoOutro,
    categoryPath: breadcrumb,
  };
}

function enrichNode(node, byId) {
  if (!node.isLeaf) return node;
  const tr = { ...(node.translations || {}) };
  const pathFaNames = [];
  const pathEnNames = [];

  let cur = node;
  const seen = new Set();
  const stack = [];
  while (cur?.parentId != null && !seen.has(cur.id)) {
    seen.add(cur.id);
    const p = byId.get(cur.parentId);
    if (!p) break;
    stack.unshift(p);
    cur = p;
  }
  for (const p of stack) {
    if (p.translations?.fa?.name) pathFaNames.push(p.translations.fa.name);
    if (p.translations?.en?.name) pathEnNames.push(p.translations.en.name);
  }

  const slugs = Array.isArray(node.path?.slugs) && node.path.slugs.length ? node.path.slugs : stack.map((p) => p.slug).filter(Boolean);

  tr.fa = buildFa({ ...node, translations: { ...tr, fa: tr.fa || {} } }, pathFaNames, slugs);
  if (tr.en) {
    tr.en = buildEn({ ...node, translations: { ...tr, en: tr.en || {} } }, pathEnNames, slugs);
  }

  for (const lang of ["ar", "ru", "tr", "fi", "ur"]) {
    if (!tr[lang]) continue;
    const n = tr[lang].name || tr.en?.name || tr.fa?.name;
    tr[lang] = {
      ...tr[lang],
      metaTitle: tr[lang].metaTitle || tr.en?.metaTitle || `${n} | Zareoon`,
      metaDescription:
        tr[lang].metaDescription ||
        tr.en?.metaDescription ||
        `${n} — wholesale B2B offers on Zareoon.`,
      description:
        tr[lang].description ||
        tr.en?.description ||
        tr[lang].metaDescription ||
        `${n} — Zareoon B2B wholesale marketplace.`,
    };
  }

  return {
    ...node,
    translations: tr,
    seo: {
      ...(node.seo || {}),
      indexable: node.seo?.indexable !== false,
      contentVersion: 2,
    },
  };
}

function enrichTree(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const byId = new Map(list.map((n) => [n.id, n]));
  return list.map((n) => enrichNode(n, byId));
}

module.exports = {
  enrichTree,
  enrichNode,
  buildFa,
  buildEn,
  resolveFamily,
  PRODUCT_STAR,
};
