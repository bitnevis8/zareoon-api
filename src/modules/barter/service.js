const InventoryLot = require("../farmer/inventoryLot/model");
const {
  findSellerUserIdsForProductCategory,
  findProviderUserIdsForServiceCategory,
} = require("../applicantRequest/service");
const { BarterNotification } = require("./model");

/**
 * اطلاع به فروشندگان / ارائه‌دهندگان دستهٔ موردنظر برای معاوضه
 */
async function notifyBarterRecipients(lot, ownerUserId) {
  if (!lot.acceptBarter || lot.barterAnnounceMode !== "announce") {
    return 0;
  }

  const kind = lot.barterDesiredKind === "service" ? "service" : "product";
  let recipientUserIds = [];

  if (kind === "service") {
    const serviceCategoryId = lot.barterDesiredServiceCategoryId
      ? String(lot.barterDesiredServiceCategoryId).trim()
      : "";
    if (!serviceCategoryId) return 0;
    const subcategoryId = lot.barterDesiredServiceSubcategoryId
      ? String(lot.barterDesiredServiceSubcategoryId).trim()
      : null;
    recipientUserIds = await findProviderUserIdsForServiceCategory(serviceCategoryId, subcategoryId);
  } else {
    const categoryId = Number(lot.barterDesiredCategoryId);
    if (!Number.isFinite(categoryId)) return 0;
    recipientUserIds = await findSellerUserIdsForProductCategory(categoryId);
  }

  recipientUserIds = recipientUserIds.filter((id) => id && id !== ownerUserId);
  if (!recipientUserIds.length) return 0;

  const rows = recipientUserIds.map((recipientUserId) => ({
    inventoryLotId: lot.id,
    recipientUserId,
    readAt: null,
  }));

  await BarterNotification.bulkCreate(rows, { ignoreDuplicates: true });
  await InventoryLot.update({ barterAnnouncedAt: new Date() }, { where: { id: lot.id } });
  return recipientUserIds.length;
}

/**
 * نرمال‌سازی فیلدهای معاوضه قبل از ذخیره در موجودی
 */
function normalizeBarterFields(body = {}) {
  const acceptBarter =
    body.acceptBarter === true || body.acceptBarter === 1 || body.acceptBarter === "true" || body.acceptBarter === "1";
  const acceptCashRaw = body.acceptCash;
  const acceptCash =
    acceptCashRaw === undefined
      ? true
      : acceptCashRaw === true || acceptCashRaw === 1 || acceptCashRaw === "true" || acceptCashRaw === "1";

  let kind = String(body.barterDesiredKind || "product").toLowerCase();
  if (kind !== "service") kind = "product";

  let announceMode = String(body.barterAnnounceMode || "silent").toLowerCase();
  if (announceMode !== "announce") announceMode = "silent";

  const categoryId =
    body.barterDesiredCategoryId != null && body.barterDesiredCategoryId !== ""
      ? Number(body.barterDesiredCategoryId)
      : null;

  const serviceCategoryId = body.barterDesiredServiceCategoryId
    ? String(body.barterDesiredServiceCategoryId).trim().slice(0, 64)
    : "";
  const serviceSubcategoryId = body.barterDesiredServiceSubcategoryId
    ? String(body.barterDesiredServiceSubcategoryId).trim().slice(0, 64)
    : "";

  // اعلام فقط وقتی هدف دسته مشخص است
  if (announceMode === "announce") {
    if (kind === "product" && !Number.isFinite(categoryId)) announceMode = "silent";
    if (kind === "service" && !serviceCategoryId) announceMode = "silent";
  }

  const qty =
    body.barterDesiredQuantity != null && body.barterDesiredQuantity !== ""
      ? Number(body.barterDesiredQuantity)
      : null;

  if (!acceptBarter) {
    return {
      acceptCash: Boolean(acceptCash),
      acceptBarter: false,
      barterDesiredKind: "product",
      barterDesiredCategoryId: null,
      barterDesiredCategoryLabel: null,
      barterDesiredServiceCategoryId: null,
      barterDesiredServiceSubcategoryId: null,
      barterDesiredName: null,
      barterDesiredQuantity: null,
      barterDesiredUnit: null,
      barterAnnounceMode: "silent",
      barterNotes: null,
    };
  }

  return {
    acceptCash: Boolean(acceptCash),
    acceptBarter: true,
    barterDesiredKind: kind,
    barterDesiredCategoryId: kind === "product" && Number.isFinite(categoryId) ? categoryId : null,
    barterDesiredCategoryLabel: body.barterDesiredCategoryLabel
      ? String(body.barterDesiredCategoryLabel).trim().slice(0, 255)
      : null,
    barterDesiredServiceCategoryId: kind === "service" && serviceCategoryId ? serviceCategoryId : null,
    barterDesiredServiceSubcategoryId:
      kind === "service" && serviceSubcategoryId ? serviceSubcategoryId : null,
    barterDesiredName: body.barterDesiredName ? String(body.barterDesiredName).trim().slice(0, 255) : null,
    barterDesiredQuantity:
      kind === "product" && Number.isFinite(qty) && qty > 0 ? qty : null,
    barterDesiredUnit:
      kind === "product" && body.barterDesiredUnit
        ? String(body.barterDesiredUnit).trim().slice(0, 50)
        : null,
    barterAnnounceMode: announceMode,
    barterNotes: body.barterNotes ? String(body.barterNotes).trim().slice(0, 2000) : null,
  };
}

async function shouldReannounce(existing, nextFields) {
  if (!nextFields.acceptBarter || nextFields.barterAnnounceMode !== "announce") return false;
  const kind = nextFields.barterDesiredKind === "service" ? "service" : "product";
  if (kind === "product" && !nextFields.barterDesiredCategoryId) return false;
  if (kind === "service" && !nextFields.barterDesiredServiceCategoryId) return false;
  if (!existing?.barterAnnouncedAt) return true;
  if ((existing.barterDesiredKind || "product") !== kind) return true;
  if (kind === "product") {
    if (Number(existing.barterDesiredCategoryId) !== Number(nextFields.barterDesiredCategoryId)) return true;
  } else {
    if (String(existing.barterDesiredServiceCategoryId || "") !== String(nextFields.barterDesiredServiceCategoryId || "")) {
      return true;
    }
    if (
      String(existing.barterDesiredServiceSubcategoryId || "") !==
      String(nextFields.barterDesiredServiceSubcategoryId || "")
    ) {
      return true;
    }
  }
  if (existing.barterAnnounceMode !== "announce") return true;
  return false;
}

module.exports = {
  notifyBarterRecipients,
  normalizeBarterFields,
  shouldReannounce,
};
