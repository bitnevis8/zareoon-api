/**
 * نرمال‌سازی و مهاجرت محتوای لندینگ به معماری Blocks (v2)
 * Template فقط Recipe است؛ Theme فقط ظاهر.
 */

function uid(prefix = "blk") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function pickLang(obj = {}) {
  return {
    title: String(obj.title || "").trim().slice(0, 200),
    subtitle: String(obj.subtitle || "").trim().slice(0, 300),
    body: String(obj.body || "").trim().slice(0, 8000),
    ctaLabel: String(obj.ctaLabel || "").trim().slice(0, 80),
    ctaSecondaryLabel: String(obj.ctaSecondaryLabel || "").trim().slice(0, 80),
    items: Array.isArray(obj.items)
      ? obj.items
          .map((it) => {
            if (typeof it === "string") return { title: String(it).trim().slice(0, 200) };
            return {
              title: String(it?.title || "").trim().slice(0, 200),
              text: String(it?.text || "").trim().slice(0, 1000),
              icon: String(it?.icon || "").trim().slice(0, 40),
              value: String(it?.value || "").trim().slice(0, 80),
              imageUrl: it?.imageUrl ? String(it.imageUrl).slice(0, 500) : null,
            };
          })
          .filter((it) => it.title || it.text || it.value)
          .slice(0, 24)
      : [],
  };
}

function normalizeResponsive(raw = {}) {
  const pick = (bp) => {
    const o = raw[bp] || {};
    return {
      hidden: Boolean(o.hidden),
      paddingY: o.paddingY != null ? String(o.paddingY).slice(0, 20) : undefined,
      align: ["start", "center", "end"].includes(o.align) ? o.align : undefined,
    };
  };
  return {
    desktop: pick("desktop"),
    tablet: pick("tablet"),
    mobile: pick("mobile"),
  };
}

function normalizeBlock(raw = {}, depth = 0) {
  const type = String(raw.type || "hero").slice(0, 40);
  const variant = String(raw.variant || "default").slice(0, 40);
  const props = raw.props && typeof raw.props === "object" ? raw.props : {};

  let columns = [];
  if (type === "columnLayout" && depth < 2) {
    const rawCols = Array.isArray(props.columns)
      ? props.columns
      : Array.isArray(raw.columns)
        ? raw.columns
        : [];
    const count =
      variant === "three" ? 3 : variant === "two" || variant === "aside" || variant === "aside-start" ? 2 : Math.min(3, Math.max(2, rawCols.length || 2));
    for (let i = 0; i < count; i++) {
      const col = rawCols[i] || {};
      const nested = Array.isArray(col.blocks) ? col.blocks : [];
      columns.push({
        id: String(col.id || uid("col")).slice(0, 64),
        blocks: nested
          .filter((b) => b && b.type !== "columnLayout")
          .map((b) => normalizeBlock(b, depth + 1))
          .slice(0, 12),
      });
    }
  }

  return {
    id: String(raw.id || uid()).slice(0, 64),
    type,
    variant,
    hidden: Boolean(raw.hidden),
    props: {
      fa: pickLang(props.fa || {}),
      en: pickLang(props.en || {}),
      ar: pickLang(props.ar || {}),
      imageUrl: props.imageUrl ? String(props.imageUrl).slice(0, 500) : null,
      videoUrl: props.videoUrl ? String(props.videoUrl).slice(0, 500) : null,
      galleryUrls: Array.isArray(props.galleryUrls)
        ? props.galleryUrls.map((u) => String(u).slice(0, 500)).filter(Boolean).slice(0, 24)
        : [],
      contactPhone: props.contactPhone ? String(props.contactPhone).slice(0, 40) : null,
      contactWhatsapp: props.contactWhatsapp ? String(props.contactWhatsapp).slice(0, 40) : null,
      contactEmail: props.contactEmail ? String(props.contactEmail).slice(0, 120) : null,
      contactTelegram: props.contactTelegram ? String(props.contactTelegram).slice(0, 80) : null,
      contacts: Array.isArray(props.contacts)
        ? props.contacts
            .map((c) => ({
              id: String(c?.id || uid("c")).slice(0, 40),
              label: String(c?.label || "").trim().slice(0, 80),
              phone: String(c?.phone || "").trim().slice(0, 40),
              channels:
                c?.channels && typeof c.channels === "object"
                  ? Object.fromEntries(
                      Object.entries(c.channels)
                        .filter(([, v]) => v != null && String(v).trim())
                        .map(([k, v]) => [String(k).slice(0, 40), String(v).trim().slice(0, 200)])
                    )
                  : {},
            }))
            .slice(0, 8)
        : [],
      mapEmbedUrl: props.mapEmbedUrl ? String(props.mapEmbedUrl).slice(0, 800) : null,
      mapAddress: props.mapAddress ? String(props.mapAddress).slice(0, 300) : null,
      mapPlaceName: props.mapPlaceName ? String(props.mapPlaceName).slice(0, 120) : null,
      mapLat:
        props.mapLat != null && props.mapLat !== "" && Number.isFinite(Number(props.mapLat))
          ? Number(props.mapLat)
          : null,
      mapLng:
        props.mapLng != null && props.mapLng !== "" && Number.isFinite(Number(props.mapLng))
          ? Number(props.mapLng)
          : null,
      buttonHref: props.buttonHref ? String(props.buttonHref).slice(0, 500) : null,
      buttonSecondaryHref: props.buttonSecondaryHref ? String(props.buttonSecondaryHref).slice(0, 500) : null,
      bgImageUrl: props.bgImageUrl ? String(props.bgImageUrl).slice(0, 500) : null,
      specRows: Array.isArray(props.specRows)
        ? props.specRows
            .map((r) => ({
              key: String(r?.key || "").trim().slice(0, 80),
              value: String(r?.value || "").trim().slice(0, 200),
            }))
            .filter((r) => r.key || r.value)
            .slice(0, 40)
        : [],
      extra: props.extra && typeof props.extra === "object" ? props.extra : {},
      fontFa: ["vazirmatn", "iransans", "bnazanin"].includes(String(props.fontFa || ""))
        ? String(props.fontFa)
        : null,
      fontEn: ["inter", "geist", "jakarta"].includes(String(props.fontEn || ""))
        ? String(props.fontEn)
        : null,
      ...(type === "columnLayout"
        ? {
            stackOnMobile: props.stackOnMobile !== false,
            columnGap: ["sm", "md", "lg"].includes(String(props.columnGap || "")) ? String(props.columnGap) : "md",
            columns,
          }
        : {}),
    },
    responsive: normalizeResponsive(raw.responsive || {}),
  };
}

/** مهاجرت محتوای تخت v1 به بلوک‌ها */
function migrateV1ToBlocks(legacy = {}) {
  const fa = legacy.fa || {};
  const en = legacy.en || {};
  const ar = legacy.ar || {};
  const highlights = Array.isArray(fa.highlights) ? fa.highlights : [];
  const blocks = [
    {
      id: uid(),
      type: "hero",
      variant: "fullscreen",
      hidden: false,
      props: {
        fa: { title: fa.title || "", subtitle: fa.subtitle || "", body: "", ctaLabel: fa.ctaLabel || "تماس", items: [] },
        en: { title: en.title || "", subtitle: en.subtitle || "", body: "", ctaLabel: en.ctaLabel || "Contact", items: [] },
        ar: { title: ar.title || "", subtitle: ar.subtitle || "", body: "", ctaLabel: ar.ctaLabel || "تواصل", items: [] },
        imageUrl: legacy.heroImageUrl || null,
        bgImageUrl: legacy.heroImageUrl || null,
      },
    },
  ];
  if (highlights.length || fa.body) {
    blocks.push({
      id: uid(),
      type: "features",
      variant: "cards",
      hidden: false,
      props: {
        fa: {
          title: "ویژگی‌ها",
          body: fa.body || "",
          items: highlights.map((h) => ({ title: h })),
        },
        en: { title: "Features", body: en.body || "", items: [] },
        ar: { title: "الميزات", body: ar.body || "", items: [] },
      },
    });
  }
  if (Array.isArray(legacy.galleryUrls) && legacy.galleryUrls.length) {
    blocks.push({
      id: uid(),
      type: "gallery",
      variant: "grid",
      hidden: false,
      props: {
        fa: { title: "گالری" },
        en: { title: "Gallery" },
        ar: { title: "معرض" },
        galleryUrls: legacy.galleryUrls,
      },
    });
  }
  if (legacy.videoUrl) {
    blocks.push({
      id: uid(),
      type: "video",
      variant: "local",
      hidden: false,
      props: {
        fa: { title: "ویدیو" },
        en: { title: "Video" },
        ar: { title: "فيديو" },
        videoUrl: legacy.videoUrl,
      },
    });
  }
  blocks.push({
    id: uid(),
    type: "contact",
    variant: "quick",
    hidden: false,
    props: {
      fa: { title: "تماس", ctaLabel: fa.ctaLabel || "تماس با فروشنده" },
      en: { title: "Contact", ctaLabel: en.ctaLabel || "Contact seller" },
      ar: { title: "تواصل", ctaLabel: ar.ctaLabel || "تواصل" },
      contactPhone: legacy.contactPhone || null,
      contactWhatsapp: legacy.contactWhatsapp || null,
    },
  });
  blocks.push({
    id: uid(),
    type: "footer",
    variant: "simple",
    hidden: false,
    props: {
      fa: { title: "Zareoon" },
      en: { title: "Zareoon" },
      ar: { title: "Zareoon" },
    },
  });
  return blocks;
}

function normalizeMeta(raw = {}) {
  const meta = raw && typeof raw === "object" ? { ...raw } : {};
  const paletteIds = [
    "forest",
    "ink",
    "ocean",
    "slate-night",
    "sand",
    "berry",
    "citrus",
    "graphite",
    "olive",
    "royal",
  ];
  const patternIds = ["none", "dots", "grid", "mesh", "diagonal", "waves", "noise", "hex"];
  if (meta.paletteId != null) {
    const p = String(meta.paletteId).slice(0, 40);
    meta.paletteId = paletteIds.includes(p) ? p : "forest";
  }
  if (meta.patternId != null) {
    const p = String(meta.patternId).slice(0, 40);
    meta.patternId = patternIds.includes(p) ? p : "none";
  }
  if (meta.daisyTheme != null) meta.daisyTheme = String(meta.daisyTheme).slice(0, 40);
  const faFonts = ["vazirmatn", "iransans", "bnazanin"];
  const enFonts = ["inter", "geist", "jakarta"];
  if (meta.fontFa != null) {
    const f = String(meta.fontFa);
    meta.fontFa = faFonts.includes(f) ? f : "vazirmatn";
  }
  if (meta.fontEn != null) {
    const f = String(meta.fontEn);
    meta.fontEn = enFonts.includes(f) ? f : "inter";
  }
  const modes = ["catalog", "landing", "catalog_only"];
  if (meta.productDisplayMode != null) {
    const m = String(meta.productDisplayMode);
    meta.productDisplayMode = modes.includes(m) ? m : "catalog";
  }
  return meta;
}

function normalizeContent(raw = {}, { themeId = "atelier", templateId = null } = {}) {
  if (raw && raw.version === 2 && Array.isArray(raw.blocks)) {
    return {
      version: 2,
      templateId: raw.templateId || templateId || null,
      themeId: raw.themeId || themeId,
      blocks: raw.blocks.map(normalizeBlock).slice(0, 80),
      meta: normalizeMeta(raw.meta),
    };
  }

  // v1 flat → v2
  const blocks = migrateV1ToBlocks(raw || {});
  return {
    version: 2,
    templateId: templateId || null,
    themeId,
    blocks: blocks.map(normalizeBlock),
    meta: {},
  };
}

function recipeToBlocks(recipeBlocks = []) {
  return (Array.isArray(recipeBlocks) ? recipeBlocks : []).map((b) =>
    normalizeBlock({ ...b, id: uid() })
  );
}

module.exports = {
  uid,
  normalizeBlock,
  normalizeContent,
  migrateV1ToBlocks,
  recipeToBlocks,
  pickLang,
};
