/**
 * Data-driven rules. Each rule:
 * - when: predicate object evaluated against pathway context
 * - addSteps / removeSteps / requireSteps / markOptional / appendDocuments / appendWarnings
 */
const RULES = [
  {
    id: "food-safety",
    priority: 10,
    when: { anyFlag: ["isFood", "isProcessedFood"] },
    addSteps: ["health-food-safety", "destination-labeling"],
    requireSteps: ["health-food-safety"],
    appendDocuments: {
      certifications: ["Health Certificate"],
      "export-packaging": ["Food-grade packaging proof"],
    },
  },
  {
    id: "agro-phytosanitary",
    priority: 20,
    when: { anyFlag: ["isAgroRaw"] },
    addSteps: ["phytosanitary"],
    requireSteps: ["phytosanitary"],
    appendDocuments: {
      certifications: ["Phytosanitary Certificate"],
    },
  },
  {
    id: "lab-from-compliance",
    priority: 30,
    when: {
      or: [{ anyFlag: ["labSuggested"] }, { tradeCompliance: { requiresDocumentReview: true } }],
    },
    addSteps: ["laboratory-testing"],
  },
  {
    id: "dangerous-goods",
    priority: 40,
    when: {
      or: [
        { anyFlag: ["dangerousGoods"] },
        { tradeCompliance: { dangerousGoodsReviewRequired: true } },
      ],
    },
    addSteps: ["dangerous-goods"],
    requireSteps: ["dangerous-goods", "cargo-insurance"],
    appendWarnings: {
      "freight-selection": ["حمل تخصصی کالای خطرناک الزامی است."],
      "export-packaging": ["بسته‌بندی باید مطابق مقررات DG باشد."],
    },
  },
  {
    id: "cold-chain",
    priority: 50,
    when: { anyFlag: ["coldChainRequired", "perishable"] },
    addSteps: ["cold-chain"],
    requireSteps: ["cold-chain"],
    appendWarnings: {
      "freight-selection": ["فقط کریر دارای زنجیره سرد انتخاب شود."],
    },
  },
  {
    id: "labeling-required",
    priority: 60,
    when: { anyFlag: ["labelingRequired", "isProcessedFood"] },
    addSteps: ["destination-labeling"],
    requireSteps: ["destination-labeling"],
  },
  {
    id: "incoterm-ddp",
    priority: 70,
    when: { fieldEquals: { path: "incoterm", value: "DDP" } },
    addSteps: ["destination-clearance"],
    requireSteps: ["destination-clearance"],
    appendWarnings: {
      pricing: ["در DDP عوارض و ترخیص مقصد را در قیمت ببینید."],
      "destination-clearance": ["مسئولیت ترخیص مقصد با فروشنده است."],
    },
  },
  {
    id: "incoterm-cif-cip-insurance",
    priority: 75,
    when: { fieldIn: { path: "incoterm", values: ["CIF", "CIP"] } },
    requireSteps: ["cargo-insurance"],
  },
  {
    id: "sea-container",
    priority: 80,
    when: { fieldEquals: { path: "transportMode", value: "sea" } },
    addSteps: ["container-selection"],
  },
  {
    id: "air-volumetric",
    priority: 90,
    when: { fieldEquals: { path: "transportMode", value: "air" } },
    addSteps: ["air-volumetric"],
  },
  {
    id: "sanctions-screening",
    priority: 100,
    when: { tradeCompliance: { sanctionsScreeningRequired: true } },
    appendDocuments: {
      "buyer-verification": ["Sanctions screening record"],
      "export-restrictions": ["Sanctions clearance note"],
    },
    appendWarnings: {
      "buyer-verification": ["غربالگری تحریم برای این کالا/مقصد پیشنهاد شده است."],
    },
  },
  {
    id: "merge-trade-compliance-docs",
    priority: 200,
    when: { always: true },
    mergeTradeComplianceDocuments: true,
  },
];

module.exports = { RULES };
