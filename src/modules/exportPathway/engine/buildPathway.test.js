const { buildPathway } = require("./buildPathway");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function run() {
  const dates = buildPathway({
    product: { name: "خرما مجول", englishName: "Medjool dates", slug: "dates" },
    rootCategoryId: 10000,
    tradeCompliance: {
      possibleDocuments: ["Phytosanitary Certificate", "Certificate of Origin"],
      hsCodeRequired: true,
    },
    originCountry: "IR",
    destinationCountry: "RU",
    quantity: 20,
    unit: "ton",
    transportMode: "sea",
    incoterm: "CIF",
  });
  assert(dates.exportFamily === "agro-raw", `expected agro-raw got ${dates.exportFamily}`);
  assert(dates.steps.some((s) => s.code === "phytosanitary"), "phytosanitary missing");
  assert(dates.steps.some((s) => s.code === "container-selection"), "sea container missing");
  assert(dates.steps.find((s) => s.code === "cargo-insurance")?.required === true, "CIF should require insurance");
  assert(dates.steps.find((s) => s.code === "product-readiness")?.status === "ready", "first step ready");
  assert(dates.steps.find((s) => s.code === "hs-code")?.status === "locked", "hs should start locked");

  const sulfur = buildPathway({
    product: { name: "گوگرد گرانول", englishName: "Sulphur", slug: "sulfur" },
    rootCategoryId: 10175,
    tradeCompliance: { dangerousGoodsReviewRequired: true },
    destinationCountry: "IN",
    transportMode: "sea",
    incoterm: "FOB",
  });
  assert(sulfur.exportFamily === "chemical-dangerous-goods", `got ${sulfur.exportFamily}`);
  assert(sulfur.steps.some((s) => s.code === "dangerous-goods"), "DG step missing");

  const ddp = buildPathway({
    product: { name: "قطعه صنعتی" },
    rootCategoryId: 10353,
    destinationCountry: "DE",
    transportMode: "air",
    incoterm: "DDP",
  });
  assert(ddp.steps.some((s) => s.code === "destination-clearance"), "DDP clearance missing");
  assert(ddp.steps.some((s) => s.code === "air-volumetric"), "air volumetric missing");

  console.log("exportPathway engine tests OK");
}

run();
