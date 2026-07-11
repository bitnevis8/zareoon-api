const { Op } = require("sequelize");
const Product = require("../farmer/product/model");
const InventoryLot = require("../farmer/inventoryLot/model");
const TradeServiceProvider = require("../tradeServiceProvider/model");
const { ApplicantRequestNotification } = require("./model");

const ACTIVE_LOT_STATUSES = ["on_field", "harvested", "reserved"];

function collectDescendantProductIds(allProducts, rootId) {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const product of allProducts) {
      if (product.parentId && ids.has(product.parentId) && !ids.has(product.id)) {
        ids.add(product.id);
        changed = true;
      }
    }
  }
  return [...ids];
}

async function findSellerUserIdsForProductCategory(categoryProductId) {
  const allProducts = await Product.findAll({
    attributes: ["id", "parentId"],
    raw: true,
  });
  const productIds = collectDescendantProductIds(allProducts, categoryProductId);
  if (!productIds.length) return [];

  const lots = await InventoryLot.findAll({
    where: {
      productId: { [Op.in]: productIds },
      status: { [Op.in]: ACTIVE_LOT_STATUSES },
    },
    attributes: ["farmerId"],
    raw: true,
  });

  return [...new Set(lots.map((lot) => lot.farmerId).filter(Boolean))];
}

async function findProviderUserIdsForServiceCategory(serviceCategoryId, serviceSubcategoryId) {
  const providers = await TradeServiceProvider.findAll({
    where: {
      status: "approved",
      userId: { [Op.ne]: null },
    },
    attributes: ["userId", "categoryId", "subcategoryIds", "selectedServices"],
    raw: true,
  });

  const recipientIds = new Set();

  for (const provider of providers) {
    if (provider.categoryId !== serviceCategoryId) continue;

    if (serviceSubcategoryId) {
      const subs = Array.isArray(provider.subcategoryIds) ? provider.subcategoryIds : [];
      const selected = Array.isArray(provider.selectedServices) ? provider.selectedServices : [];
      const matchesSub =
        subs.includes(serviceSubcategoryId) || selected.includes(serviceSubcategoryId);
      if (!matchesSub && subs.length + selected.length > 0) continue;
    }

    recipientIds.add(provider.userId);
  }

  return [...recipientIds];
}

async function notifyRecipientsForRequest(request, applicantUserId) {
  let recipientUserIds = [];

  if (request.requestType === "product" && request.productCategoryId) {
    recipientUserIds = await findSellerUserIdsForProductCategory(request.productCategoryId);
  } else if (request.requestType === "service" && request.serviceCategoryId) {
    recipientUserIds = await findProviderUserIdsForServiceCategory(
      request.serviceCategoryId,
      request.serviceSubcategoryId
    );
  }

  recipientUserIds = recipientUserIds.filter((id) => id !== applicantUserId);
  if (!recipientUserIds.length) return 0;

  const rows = recipientUserIds.map((recipientUserId) => ({
    requestId: request.id,
    recipientUserId,
    readAt: null,
  }));

  await ApplicantRequestNotification.bulkCreate(rows, { ignoreDuplicates: true });
  return recipientUserIds.length;
}

module.exports = {
  collectDescendantProductIds,
  findSellerUserIdsForProductCategory,
  findProviderUserIdsForServiceCategory,
  notifyRecipientsForRequest,
};
