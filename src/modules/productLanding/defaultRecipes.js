/**
 * قالب‌های سیستمی لندینگ — فقط «قالب عمومی زارعون»
 * ساختار بلوک‌ها معادل اطلاعات صفحه کاتالوگ + بلوک‌های سئو
 */

const { LOREM_FA, LOREM_EN } = require("../farmer/product/seoContentGenerator");

function lang(title, subtitle = "", body = "", ctaLabel = "") {
  return { title, subtitle, body, ctaLabel, items: [] };
}

function block(type, variant, props = {}) {
  return { type, variant, hidden: false, props, responsive: { desktop: {}, tablet: {}, mobile: {} } };
}

const B2B_SPECS = [
  { key: "MOQ", value: "—" },
  { key: "ظرفیت ماهانه", value: "—" },
  { key: "کشور مبدأ", value: "ایران" },
  { key: "واحد اندازه‌گیری", value: "—" },
  { key: "بسته‌بندی", value: "—" },
  { key: "زمان تحویل", value: "—" },
  { key: "شرایط پرداخت", value: "TT / LC" },
  { key: "Incoterms", value: "FOB / CIF / EXW" },
  { key: "HS Code", value: "—" },
];

const HIGHLIGHT_ITEMS = [
  { title: "عرضه عمده و B2B", text: "مناسب خریداران عمده، صادرکنندگان و واردکنندگان." },
  { title: "شفافیت موجودی و قیمت", text: "مشاهده موجودی قابل سفارش و شرایط فروشنده." },
  { title: "مسیر صادراتی", text: "بسته‌بندی، HS Code و اینکوترمز در یک نگاه." },
  { title: "اعتماد و گفتگو", text: "ارتباط مستقیم با فروشنده از طریق چت و فروشگاه." },
];

const BENEFIT_ITEMS = [
  { title: "مقایسه پیشنهادها", text: "چند فروشنده و درجه کیفیت را سریع ببینید." },
  { title: "سفارش از موجودی واقعی", text: "موجودی رزرو و قابل‌سفارش شفاف است." },
  { title: "محتوای حرفه‌ای", text: "متن سئو‌شده برای کاتالوگ و لندینگ." },
];

const FAQ_ITEMS = [
  { title: "حداقل سفارش چقدر است؟", text: "حداقل سفارش (MOQ) بسته به فروشنده و درجه کیفیت متفاوت است." },
  { title: "آیا برای صادرات موجود است؟", text: "بسیاری از تأمین‌کنندگان امکان عرضه صادراتی دارند؛ جزئیات را در مشخصات ببینید." },
  { title: "چطور با فروشنده هماهنگ کنم؟", text: "از دکمه گفتگو یا صفحه فروشنده استفاده کنید." },
  { title: "قیمت چگونه تعیین می‌شود؟", text: "قیمت ممکن است ثابت، پله‌ای یا توافقی باشد." },
];

function zareoonGeneralBlocks() {
  return [
    block("banner", "notice", {
      fa: { title: "بازار عمده B2B زارعون — مقایسه تأمین‌کنندگان و سفارش مستقیم", items: [] },
      en: { title: "Zareoon wholesale B2B — compare suppliers and order directly", items: [] },
    }),
    block("hero", "fullscreen", {
      fa: lang(
        "نام محصول",
        "خرید عمده با مشخصات شفاف و موجودی واقعی",
        LOREM_FA,
        "درخواست قیمت / سفارش"
      ),
      en: lang(
        "Product name",
        "Wholesale buying with clear specs and live stock",
        LOREM_EN,
        "Request quote / Order"
      ),
    }),
    block("buy", "card", {
      fa: lang("سفارش و خرید", "قیمت و موجودی واقعی از انبار متصل", "", "افزودن به سبد خرید"),
      en: lang("Order & buy", "Live price and stock from linked inventory", "", "Add to cart"),
    }),
    block("productStock", "overview", {
      fa: lang("موجودی انبار", "کل / رزرو / قابل سفارش"),
      en: lang("Warehouse stock", "Total / reserved / available"),
    }),
    block("sellerActions", "bar", {
      fa: lang("ارتباط با فروشنده", "", "گفتگو یا مشاهده صفحه فروشگاه", "گفتگو با فروشنده"),
      en: lang("Contact seller", "", "Chat or visit storefront", "Chat with seller"),
    }),
    block("company", "about", {
      fa: {
        ...lang("درباره این محصول", "راهنمای خرید عمده"),
        body: `${LOREM_FA}\n\n${LOREM_FA}`,
      },
      en: {
        ...lang("About this product", "Wholesale buying guide"),
        body: `${LOREM_EN}\n\n${LOREM_EN}`,
      },
    }),
    block("features", "cards", {
      fa: { title: "نکات کلیدی", subtitle: "چرا این محصول در زارعون", body: "", items: HIGHLIGHT_ITEMS },
      en: {
        title: "Key highlights",
        subtitle: "Why this product on Zareoon",
        body: "",
        items: [
          { title: "Wholesale & B2B ready", text: "For bulk buyers, exporters and importers." },
          { title: "Clear stock & pricing", text: "See available quantity and seller terms." },
          { title: "Export pathway", text: "Packaging, HS code and Incoterms at a glance." },
          { title: "Trusted messaging", text: "Chat with the seller or visit their store." },
        ],
      },
    }),
    block("specifications", "table", {
      fa: { title: "مشخصات فنی و تجاری", subtitle: "اطلاعات لازم برای تصمیم خرید عمده", items: [] },
      en: { title: "Technical & commercial specs", subtitle: "What buyers need for wholesale decisions", items: [] },
      specRows: B2B_SPECS,
    }),
    block("gallery", "grid", {
      fa: { title: "گالری محصول", subtitle: "تصاویر واقعی کیفیت و بسته‌بندی", items: [] },
      en: { title: "Product gallery", subtitle: "Real photos of quality and packaging", items: [] },
    }),
    block("features", "cards", {
      fa: { title: "مزایای خرید از زارعون", body: LOREM_FA, items: BENEFIT_ITEMS },
      en: {
        title: "Benefits of buying on Zareoon",
        body: LOREM_EN,
        items: [
          { title: "Compare offers quickly", text: "Multiple sellers and grades in one view." },
          { title: "Order from real inventory", text: "Reserved vs available quantities are clear." },
          { title: "SEO-ready copy", text: "The same content powers catalog and landings." },
        ],
      },
    }),
    block("logistics", "cards", {
      fa: {
        title: "حمل و شرایط تجاری",
        subtitle: "اینکوترمز، زمان تحویل و بسته‌بندی",
        items: [
          { title: "Incoterms", text: "FOB / CIF / EXW" },
          { title: "Lead time", text: "توافقی — معمولاً ۷ تا ۱۴ روز" },
          { title: "بسته‌بندی", text: "کیسه، کارتن، پالت یا توافقی" },
        ],
      },
      en: {
        title: "Logistics & trade terms",
        subtitle: "Incoterms, lead time and packaging",
        items: [
          { title: "Incoterms", text: "FOB / CIF / EXW" },
          { title: "Lead time", text: "Negotiable — typically 7–14 days" },
          { title: "Packaging", text: "Bag, carton, pallet or custom" },
        ],
      },
    }),
    block("certificates", "grid", {
      fa: {
        title: "گواهی‌ها و استانداردها",
        items: [{ title: "ISO" }, { title: "سلامت / بهداشت" }, { title: "حلال" }, { title: "صادراتی" }],
      },
      en: {
        title: "Certificates & standards",
        items: [{ title: "ISO" }, { title: "Health" }, { title: "Halal" }, { title: "Export-ready" }],
      },
    }),
    block("timeline", "steps", {
      fa: {
        title: "فرآیند سفارش در زارعون",
        items: [
          { title: "مشاهده موجودی", text: "پیشنهادها و درجه کیفیت" },
          { title: "گفتگو / استعلام", text: "هماهنگی با فروشنده" },
          { title: "افزودن به سبد", text: "ثبت مقدار سفارش" },
          { title: "تحویل", text: "هماهنگی حمل و اینکوترمز" },
        ],
      },
      en: {
        title: "Order process on Zareoon",
        items: [
          { title: "Review stock", text: "Offers and quality grades" },
          { title: "Chat / RFQ", text: "Align with the seller" },
          { title: "Add to cart", text: "Confirm order quantity" },
          { title: "Delivery", text: "Coordinate logistics & Incoterms" },
        ],
      },
    }),
    block("payment", "methods", {
      fa: {
        title: "روش‌های پرداخت",
        items: [{ title: "TT" }, { title: "LC" }, { title: "توافقی" }],
      },
      en: {
        title: "Payment methods",
        items: [{ title: "TT" }, { title: "LC" }, { title: "Negotiable" }],
      },
    }),
    block("map", "location", {
      fa: lang("موقعیت بارگیری / انبار", "آدرس و نقشه", "", "مسیریابی"),
      en: lang("Loading / warehouse location", "Address and map", "", "Get directions"),
      mapPlaceName: "دفتر / انبار",
    }),
    block("qrCode", "card", {
      fa: lang("QR کد این صفحه", "اسکن کنید تا همین لندینگ باز شود"),
      en: lang("Page QR code", "Scan to open this landing"),
    }),
    block("cta", "banner", {
      fa: lang("آماده همکاری هستید؟", "استعلام قیمت یا سفارش عمده", "", "تماس با فروشنده"),
      en: lang("Ready to work together?", "Request pricing or place a bulk order", "", "Contact seller"),
    }),
    block("contact", "quick", {
      fa: lang("تماس سریع", "", "", "تماس"),
      en: lang("Quick contact", "", "", "Call"),
    }),
    block("faq", "accordion", {
      fa: { title: "سوالات متداول خریداران", items: FAQ_ITEMS },
      en: {
        title: "Buyer FAQs",
        items: [
          { title: "What is the MOQ?", text: "Minimum order depends on seller and grade." },
          { title: "Is export available?", text: "Many suppliers support export — check specs." },
          { title: "How do I contact the seller?", text: "Use chat or the seller storefront page." },
          { title: "How is pricing set?", text: "Fixed, tiered, or negotiable by volume." },
        ],
      },
    }),
    block("company", "about", {
      fa: {
        ...lang("جمع‌بندی و راهنمای خرید", "محتوای سئو برای خریداران عمده"),
        body: LOREM_FA,
      },
      en: {
        ...lang("Summary & buying guide", "SEO content for wholesale buyers"),
        body: LOREM_EN,
      },
    }),
    block("footer", "columns", {
      fa: lang("زارعون", "بازار بین‌المللی B2B"),
      en: lang("Zareoon", "International B2B marketplace"),
    }),
  ];
}

const DEFAULT_RECIPES = [
  {
    slug: "zareoon-general",
    nameFa: "قالب عمومی زارعون",
    nameEn: "Zareoon general template",
    category: "general",
    themeIdDefault: "atelier",
    sortOrder: 1,
    metaDefaults: {
      paletteId: "forest",
      patternId: "mesh",
      fontFa: "vazirmatn",
      fontEn: "inter",
      productDisplayMode: "catalog",
    },
    recipe: {
      blocks: zareoonGeneralBlocks(),
    },
  },
];

module.exports = { DEFAULT_RECIPES, LOREM_FA, LOREM_EN };
