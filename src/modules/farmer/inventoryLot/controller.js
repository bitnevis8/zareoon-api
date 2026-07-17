const { Op } = require("sequelize");
const InventoryLot = require("./model");
const Product = require("../product/model");
const File = require("../../fileUpload/model");
const User = require("../../user/user/model");
const Account = require("../../account/model");
const TransactionHistory = require("../transactionHistory/model");
const CustomAttributeValue = require("../customAttributeValue/model");
const CustomAttributeDefinition = require("../customAttributeDefinition/model");
const { getInventoryPricing } = require("../../../utils/inventoryPricingUtils");
const { parseHashtagsInput, formatHashtags, countRawHashtags, MAX_HASHTAGS } = require("../../../utils/hashtags");
const {
  applyDisplayContentToPayload,
  attachDisplayContentToLot,
} = require("../../../utils/inventoryDisplayContent");

const BLOCKED_LISTING = new Set(["category-navigation-only"]);
const RESTRICTED_LISTING = new Set(["pre-approval-required", "manual-review-only"]);

function normalizeFilterValues(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    out[k] = s;
  }
  return Object.keys(out).length ? out : null;
}

async function assertProductListable(productId, { isAdmin = false } = {}) {
  const product = await Product.findByPk(productId);
  if (!product) {
    const err = new Error("محصول یافت نشد");
    err.status = 404;
    throw err;
  }
  const policy = product.listingPolicy || (product.isOrderable ? "conditional" : "category-navigation-only");
  if (!product.isOrderable || BLOCKED_LISTING.has(policy)) {
    const err = new Error("این دسته فقط برای ناوبری است و قابل ثبت موجودی نیست");
    err.status = 400;
    throw err;
  }
  if (RESTRICTED_LISTING.has(policy) && !isAdmin) {
    const err = new Error("ثبت موجودی برای این محصول نیاز به تأیید ادمین دارد");
    err.status = 403;
    throw err;
  }

  const allowedUnits = Array.isArray(product.allowedMeasurementUnits)
    ? product.allowedMeasurementUnits
    : Array.isArray(product.validUnits)
      ? product.validUnits
      : [];
  const allowedPackaging = Array.isArray(product.allowedPackagingTypes)
    ? product.allowedPackagingTypes
    : [];

  return { product, allowedUnits, allowedPackaging, policy };
}

function validateUnitAndPackaging(payload, { allowedUnits, allowedPackaging }) {
  if (payload.unit && allowedUnits.length && !allowedUnits.includes(payload.unit)) {
    const err = new Error(`واحد اندازه‌گیری مجاز نیست. واحدهای مجاز: ${allowedUnits.join(", ")}`);
    err.status = 400;
    throw err;
  }
  if (payload.packagingType && allowedPackaging.length && !allowedPackaging.includes(payload.packagingType)) {
    const err = new Error(`نوع بسته‌بندی مجاز نیست. گزینه‌ها: ${allowedPackaging.join(", ")}`);
    err.status = 400;
    throw err;
  }
}
const supplierInclude = {
  model: User,
  as: "supplier",
  attributes: ["id", "firstName", "lastName", "username", "mobile"],
  include: [{ model: Account, as: "account", attributes: ["profileSlug"], required: false }],
};

async function attachLotCoverImages(lots) {
  const arr = Array.isArray(lots) ? lots : [lots];
  const plain = arr.map((l) => (l.toJSON ? l.toJSON() : { ...l }));
  const ids = plain.map((l) => l.id).filter(Boolean);
  if (!ids.length) return plain;

  const files = await File.findAll({
    where: {
      module: "inventory",
      entityId: ids,
      mimeType: { [Op.like]: "image/%" },
    },
    order: [["createdAt", "DESC"]],
  });

  const coverMap = {};
  for (const f of files) {
    if (!coverMap[f.entityId]) coverMap[f.entityId] = f.downloadUrl;
  }

  return plain.map((l) => ({
    ...attachDisplayContentToLot(l),
    coverImageUrl: coverMap[l.id] || null,
  }));
}

const list = async (req, res) => {
  const items = await InventoryLot.findAll({
    include: [
      {
        model: CustomAttributeValue,
        as: "attributes",
        include: [{ model: CustomAttributeDefinition, as: "definition", attributes: ["id", "name", "type", "options"] }]
      },
      supplierInclude
    ],
    order: [["id", "ASC"]]
  });
  const data = await attachLotCoverImages(items);
  res.json({ success: true, data });
};

const getById = async (req, res) => {
  const item = await InventoryLot.findByPk(req.params.id, {
    include: [
      {
        model: CustomAttributeValue,
        as: "attributes",
        include: [{ model: CustomAttributeDefinition, as: "definition", attributes: ["id", "name", "type", "options"] }]
      },
      supplierInclude
    ]
  });
  if (!item) return res.status(404).json({ success: false, message: "Not found" });
  const [data] = await attachLotCoverImages([item]);
  res.json({ success: true, data });
};

function formatLotRecord(lot) {
  return attachDisplayContentToLot(lot);
}

function prepareLotPayload(body) {
  const payload = { ...body };
  if (body.filterValues !== undefined) {
    payload.filterValues = normalizeFilterValues(body.filterValues);
  }
  if (body.hsCode !== undefined) {
    const hs = body.hsCode != null ? String(body.hsCode).trim() : "";
    payload.hsCode = hs || null;
    if (hs) {
      payload.filterValues = {
        ...(payload.filterValues || normalizeFilterValues(body.filterValues) || {}),
        hsCode: hs,
      };
    }
  }
  if (body.packagingType !== undefined) {
    const p = body.packagingType != null ? String(body.packagingType).trim() : "";
    payload.packagingType = p || null;
  }
  if (body.displayContent !== undefined) {
    return applyDisplayContentToPayload(payload, body);
  }
  applyHashtagsToPayload(payload, body);
  return payload;
}

function applyHashtagsToPayload(payload, body) {
  if (body.hashtags === undefined) return payload;
  if (countRawHashtags(body) > MAX_HASHTAGS) {
    const err = new Error(`حداکثر ${MAX_HASHTAGS} هشتگ مجاز است`);
    err.status = 400;
    throw err;
  }
  const tags = parseHashtagsInput(body);
  payload.hashtags = tags.length ? tags : null;
  return payload;
}

const create = async (req, res) => {
  try {
    const payload = prepareLotPayload(req.body);
    const isAdmin = Boolean(req.user?.roles?.includes?.("Administrator") || req.user?.isAdmin);
    const { allowedUnits, allowedPackaging } = await assertProductListable(payload.productId, { isAdmin });
    validateUnitAndPackaging(payload, { allowedUnits, allowedPackaging });
    const created = await InventoryLot.create(payload);
    res.status(201).json({ success: true, data: formatLotRecord(created) });
  } catch (error) {
    if (error.status === 400 || error.status === 403 || error.status === 404) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    throw error;
  }
};

const update = async (req, res) => {
  const id = req.params.id;
  try {
    const existing = await InventoryLot.findByPk(id);
    if (!existing) return res.status(404).json({ success: false, message: "Not found" });
    const payload = prepareLotPayload(req.body);
    const productId = payload.productId != null ? payload.productId : existing.productId;
    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ success: false, message: "محصول یافت نشد" });
    const allowedUnits = Array.isArray(product.allowedMeasurementUnits)
      ? product.allowedMeasurementUnits
      : Array.isArray(product.validUnits)
        ? product.validUnits
        : [];
    const allowedPackaging = Array.isArray(product.allowedPackagingTypes)
      ? product.allowedPackagingTypes
      : [];
    const unitCheck = {
      unit: payload.unit !== undefined ? payload.unit : existing.unit,
      packagingType: payload.packagingType !== undefined ? payload.packagingType : existing.packagingType,
    };
    validateUnitAndPackaging(unitCheck, { allowedUnits, allowedPackaging });
    const [count] = await InventoryLot.update(payload, { where: { id } });
    if (!count) return res.status(404).json({ success: false, message: "Not found" });
    const updated = await InventoryLot.findByPk(id, {
      include: [
        {
          model: CustomAttributeValue,
          as: "attributes",
          include: [{ model: CustomAttributeDefinition, as: "definition", attributes: ["id", "name", "type", "options"] }],
        },
        supplierInclude,
      ],
    });
    const [data] = await attachLotCoverImages([updated]);
    res.json({ success: true, data });
  } catch (error) {
    if (error.status === 400 || error.status === 403 || error.status === 404) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    throw error;
  }
};

const remove = async (req, res) => {
  const id = req.params.id;
  const count = await InventoryLot.destroy({ where: { id } });
  if (!count) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true });
};

const reserve = async (req, res) => {
  const id = req.params.id;
  const { quantity } = req.body;
  const lot = await InventoryLot.findByPk(id);
  if (!lot) return res.status(404).json({ success: false, message: "Not found" });

  const available = parseFloat(lot.totalQuantity) - parseFloat(lot.reservedQuantity || 0);
  if (quantity > available) {
    return res.status(400).json({ success: false, message: "Insufficient inventory" });
  }

  lot.reservedQuantity = parseFloat(lot.reservedQuantity || 0) + parseFloat(quantity);
  lot.status = "reserved";
  await lot.save();

  await TransactionHistory.create({
    changeType: "reserve",
    inventoryLotId: lot.id,
    deltaQuantity: quantity,
    actorUserId: req.user?.id || 0
  });

  res.json({ success: true, data: lot });
};

const release = async (req, res) => {
  const id = req.params.id;
  const { quantity } = req.body;
  const lot = await InventoryLot.findByPk(id);
  if (!lot) return res.status(404).json({ success: false, message: "Not found" });

  const currentReserved = parseFloat(lot.reservedQuantity || 0);
  if (quantity > currentReserved) {
    return res.status(400).json({ success: false, message: "Release exceeds reserved" });
  }

  lot.reservedQuantity = currentReserved - parseFloat(quantity);
  if (lot.reservedQuantity === 0) {
    lot.status = "harvested";
  }
  await lot.save();

  await TransactionHistory.create({
    changeType: "release",
    inventoryLotId: lot.id,
    deltaQuantity: -Math.abs(quantity),
    actorUserId: req.user?.id || 0
  });

  res.json({ success: true, data: lot });
};

// محاسبه قیمت بر اساس tiered pricing برای موجودی
const calculatePrice = async (req, res) => {
  try {
    const inventoryLotId = parseInt(req.params.id);
    const quantity = parseFloat(req.query.quantity);

    if (!inventoryLotId || !quantity || quantity <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Inventory lot ID and valid quantity are required" 
      });
    }

    const inventoryLot = await InventoryLot.findByPk(inventoryLotId, {
      include: [
        supplierInclude
      ]
    });

    if (!inventoryLot) {
      return res.status(404).json({ 
        success: false, 
        message: "Inventory lot not found" 
      });
    }

    // Check if requested quantity is available
    const availableQuantity = parseFloat(inventoryLot.totalQuantity) - parseFloat(inventoryLot.reservedQuantity || 0);
    if (quantity > availableQuantity) {
      return res.status(400).json({
        success: false,
        message: `موجودی کافی نیست. موجودی قابل فروش: ${availableQuantity} ${inventoryLot.unit}`
      });
    }

    const pricing = getInventoryPricing(inventoryLot, quantity);
    
    res.json({ 
      success: true, 
      data: {
        ...pricing,
        inventoryLot: {
          id: inventoryLot.id,
          supplier: inventoryLot.supplier,
          productId: inventoryLot.productId,
          qualityGrade: inventoryLot.qualityGrade,
          unit: inventoryLot.unit,
          availableQuantity: availableQuantity
        }
      }
    });
  } catch (error) {
    console.error("Error calculating inventory price:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

// تنظیم قیمت‌گذاری پلکانی برای موجودی
const setTieredPricing = async (req, res) => {
  try {
    const inventoryLotId = parseInt(req.params.id);
    const { tieredPricing, minimumOrderQuantity } = req.body;

    if (!inventoryLotId) {
      return res.status(400).json({ 
        success: false, 
        message: "Inventory lot ID is required" 
      });
    }

    const inventoryLot = await InventoryLot.findByPk(inventoryLotId);
    if (!inventoryLot) {
      return res.status(404).json({ 
        success: false, 
        message: "Inventory lot not found" 
      });
    }

    // Validate tiered pricing structure
    if (tieredPricing && Array.isArray(tieredPricing)) {
      for (const tier of tieredPricing) {
        if (!tier.minQuantity || !tier.pricePerUnit) {
          return res.status(400).json({
            success: false,
            message: "هر سطح قیمت باید حداقل مقدار و قیمت داشته باشد"
          });
        }
      }
    }

    // Update the inventory lot
    const updateData = {};
    if (tieredPricing !== undefined) updateData.tieredPricing = tieredPricing;
    if (minimumOrderQuantity !== undefined) updateData.minimumOrderQuantity = minimumOrderQuantity;

    await InventoryLot.update(updateData, { where: { id: inventoryLotId } });

    const updatedLot = await InventoryLot.findByPk(inventoryLotId, {
      include: [
        supplierInclude
      ]
    });

    res.json({ 
      success: true, 
      data: updatedLot 
    });
  } catch (error) {
    console.error("Error setting tiered pricing:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

module.exports = { list, getById, create, update, remove, reserve, release, calculatePrice, setTieredPricing };

