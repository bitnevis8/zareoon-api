/**
 * استخراج محتوای بازاریابی/سئو از translations محصول
 * برای کاتالوگ و تزریق به بلوک‌های لندینگ
 */

function pickLangBlock(translations, lang) {
  if (!translations || typeof translations !== "object") return null;
  const preferred = [lang, "fa", "en"].filter(Boolean);
  for (const code of preferred) {
    const block = translations[code];
    if (block && typeof block === "object") return { lang: code, block };
  }
  const first = Object.keys(translations)[0];
  if (first) return { lang: first, block: translations[first] };
  return null;
}

function asItems(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((it) => {
      if (!it || typeof it !== "object") return null;
      const title = String(it.title || it.key || "").trim();
      const text = String(it.text || it.value || it.body || "").trim();
      if (!title && !text) return null;
      return { title: title || text.slice(0, 40), text };
    })
    .filter(Boolean);
}

function pickProductMarketing(product, lang = "fa") {
  if (!product) {
    return {
      name: "",
      metaTitle: "",
      metaDescription: "",
      description: "",
      highlights: [],
      benefits: [],
      faqs: [],
      seoIntro: "",
      seoOutro: "",
      categoryPath: "",
      imageUrl: null,
    };
  }

  const picked = pickLangBlock(product.translations, lang);
  const tr = picked?.block || {};
  const name =
    tr.name ||
    product.name ||
    product.englishName ||
    "";
  const description =
    (typeof tr.description === "string" && tr.description.trim()) ||
    (typeof product.description === "string" && product.description.trim()) ||
    (typeof tr.metaDescription === "string" && tr.metaDescription.trim()) ||
    (typeof product.metaDescription === "string" && product.metaDescription.trim()) ||
    "";

  return {
    name,
    metaTitle: tr.metaTitle || product.metaTitle || name,
    metaDescription: tr.metaDescription || product.metaDescription || "",
    description,
    highlights: asItems(tr.highlights),
    benefits: asItems(tr.benefits),
    faqs: asItems(tr.faqs),
    seoIntro: typeof tr.seoIntro === "string" ? tr.seoIntro.trim() : "",
    seoOutro: typeof tr.seoOutro === "string" ? tr.seoOutro.trim() : "",
    categoryPath: typeof tr.categoryPath === "string" ? tr.categoryPath : "",
    imageUrl: product.imageUrl || null,
    unit: product.defaultMeasurementUnit || product.unit || null,
  };
}

module.exports = { pickProductMarketing, asItems, pickLangBlock };
