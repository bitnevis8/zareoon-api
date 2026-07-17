const Product = require("../farmer/product/model");
const InventoryLot = require("../farmer/inventoryLot/model");
const CustomAttributeDefinition = require("../farmer/customAttributeDefinition/model");
const CustomAttributeValue = require("../farmer/customAttributeValue/model");
const Order = require("../farmer/order/model");
const OrderItem = require("../farmer/orderItem/model");
const OrderRequestItem = require("../farmer/orderRequestItem/model");
const TransactionHistory = require("../farmer/transactionHistory/model");
const User = require("../user/user/model");
const Role = require("../user/role/model");
const UserRole = require("../user/userRole/model");
const SiteSetting = require("../siteSetting/model");
const Location = require("../location/model");
const TradeServiceProvider = require("../tradeServiceProvider/model");
const ApplicantRequest = require("../applicantRequest/model");
const {
  EscrowRule,
  EscrowAgreement,
} = require("../escrow/model");

const SECTIONS = {
  products: {
    label: "products",
    model: Product,
    pk: "id",
    order: [["id", "ASC"]],
  },
  inventoryLots: {
    label: "inventoryLots",
    model: InventoryLot,
    pk: "id",
    order: [["id", "ASC"]],
  },
  attributeDefinitions: {
    label: "attributeDefinitions",
    model: CustomAttributeDefinition,
    pk: "id",
    order: [["id", "ASC"]],
  },
  attributeValues: {
    label: "attributeValues",
    model: CustomAttributeValue,
    pk: "id",
    order: [["id", "ASC"]],
  },
  orders: {
    label: "orders",
    model: Order,
    pk: "id",
    order: [["id", "ASC"]],
  },
  orderItems: {
    label: "orderItems",
    model: OrderItem,
    pk: "id",
    order: [["id", "ASC"]],
  },
  orderRequestItems: {
    label: "orderRequestItems",
    model: OrderRequestItem,
    pk: "id",
    order: [["id", "ASC"]],
  },
  transactionHistory: {
    label: "transactionHistory",
    model: TransactionHistory,
    pk: "id",
    order: [["id", "ASC"]],
  },
  users: {
    label: "users",
    model: User,
    pk: "id",
    order: [["id", "ASC"]],
    excludeOnExport: ["emailVerifyCode", "mobileVerifyCode"],
  },
  roles: {
    label: "roles",
    model: Role,
    pk: "id",
    order: [["id", "ASC"]],
  },
  userRoles: {
    label: "userRoles",
    model: UserRole,
    pk: ["userId", "roleId"],
    order: [["userId", "ASC"], ["roleId", "ASC"]],
  },
  siteSettings: {
    label: "siteSettings",
    model: SiteSetting,
    pk: "key",
    order: [["key", "ASC"]],
  },
  locations: {
    label: "locations",
    model: Location,
    pk: "id",
    order: [["id", "ASC"]],
  },
  tradeServiceProviders: {
    label: "tradeServiceProviders",
    model: TradeServiceProvider,
    pk: "id",
    order: [["id", "ASC"]],
  },
  applicantRequests: {
    label: "applicantRequests",
    model: ApplicantRequest,
    pk: "id",
    order: [["id", "ASC"]],
  },
  escrowRules: {
    label: "escrowRules",
    model: EscrowRule,
    pk: "id",
    order: [["id", "ASC"]],
  },
  escrowAgreements: {
    label: "escrowAgreements",
    model: EscrowAgreement,
    pk: "id",
    order: [["id", "ASC"]],
  },
};

/** Import order respects FK dependencies. */
const FULL_IMPORT_ORDER = [
  "roles",
  "users",
  "userRoles",
  "locations",
  "products",
  "attributeDefinitions",
  "inventoryLots",
  "attributeValues",
  "orders",
  "orderItems",
  "orderRequestItems",
  "transactionHistory",
  "siteSettings",
  "tradeServiceProviders",
  "applicantRequests",
  "escrowRules",
  "escrowAgreements",
];

function toPlain(row) {
  return row && typeof row.toJSON === "function" ? row.toJSON() : { ...row };
}

function stripExcluded(row, exclude = []) {
  if (!exclude.length) return row;
  const out = { ...row };
  for (const key of exclude) delete out[key];
  return out;
}

async function exportSection(sectionKey) {
  const def = SECTIONS[sectionKey];
  if (!def) {
    const err = new Error(`Unknown section: ${sectionKey}`);
    err.status = 400;
    throw err;
  }
  const rows = await def.model.findAll({ order: def.order });
  const data = rows.map((r) => stripExcluded(toPlain(r), def.excludeOnExport || []));
  return {
    version: 1,
    type: "section",
    section: sectionKey,
    exportedAt: new Date().toISOString(),
    count: data.length,
    data,
  };
}

async function exportFull() {
  const sections = {};
  for (const key of FULL_IMPORT_ORDER) {
    const payload = await exportSection(key);
    sections[key] = payload.data;
  }
  return {
    version: 1,
    type: "full",
    exportedAt: new Date().toISOString(),
    sections,
    counts: Object.fromEntries(
      Object.entries(sections).map(([k, rows]) => [k, Array.isArray(rows) ? rows.length : 0])
    ),
  };
}

function listSections() {
  return FULL_IMPORT_ORDER.map((key) => ({
    key,
    label: SECTIONS[key].label,
  }));
}

async function upsertRows(def, rows, { skipHooks = false } = {}) {
  if (!Array.isArray(rows) || !rows.length) return { created: 0, updated: 0, skipped: 0 };

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const Model = def.model;
  const pk = def.pk;

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") {
      skipped += 1;
      continue;
    }
    const row = { ...raw };

    try {
      if (Array.isArray(pk)) {
        const where = {};
        for (const k of pk) where[k] = row[k];
        if (pk.some((k) => row[k] == null)) {
          skipped += 1;
          continue;
        }
        const existing = await Model.findOne({ where });
        if (existing) {
          await existing.update(row, { hooks: !skipHooks });
          updated += 1;
        } else {
          await Model.create(row, { hooks: !skipHooks });
          created += 1;
        }
      } else {
        const id = row[pk];
        if (id == null) {
          skipped += 1;
          continue;
        }
        const existing = await Model.findByPk(id);
        if (existing) {
          // Avoid re-hashing already-hashed passwords on users
          await existing.update(row, { hooks: !skipHooks });
          updated += 1;
        } else {
          await Model.create(row, { hooks: !skipHooks });
          created += 1;
        }
      }
    } catch (e) {
      skipped += 1;
      console.warn(`[backup] upsert skip ${def.label}:`, e.message);
    }
  }

  return { created, updated, skipped };
}

async function importSection(sectionKey, payload, { mode = "merge" } = {}) {
  const def = SECTIONS[sectionKey];
  if (!def) {
    const err = new Error(`Unknown section: ${sectionKey}`);
    err.status = 400;
    throw err;
  }

  let rows = [];
  if (Array.isArray(payload)) rows = payload;
  else if (payload && Array.isArray(payload.data)) rows = payload.data;
  else if (payload && payload.sections && Array.isArray(payload.sections[sectionKey])) {
    rows = payload.sections[sectionKey];
  } else {
    const err = new Error("Invalid import payload: expected array or { data: [] }");
    err.status = 400;
    throw err;
  }

  if (mode === "replace") {
    await def.model.destroy({ where: {}, truncate: false });
  }

  const skipHooks = sectionKey === "users";
  const stats = await upsertRows(def, rows, { skipHooks });
  return { section: sectionKey, mode, ...stats, total: rows.length };
}

async function importFull(payload, { mode = "merge" } = {}) {
  if (!payload || payload.type !== "full" || !payload.sections || typeof payload.sections !== "object") {
    const err = new Error("Invalid full backup payload");
    err.status = 400;
    throw err;
  }

  if (mode === "replace") {
    // Destroy in reverse FK order so children go first
    for (const key of [...FULL_IMPORT_ORDER].reverse()) {
      const def = SECTIONS[key];
      if (!def) continue;
      try {
        await def.model.destroy({ where: {}, truncate: false });
      } catch (e) {
        console.warn(`[backup] replace clear ${key}:`, e.message);
      }
    }
  }

  const results = {};
  for (const key of FULL_IMPORT_ORDER) {
    const rows = payload.sections[key];
    if (!rows) continue;
    // Already cleared above when mode=replace
    results[key] = await importSection(key, rows, { mode: "merge" });
  }
  return { mode, results };
}

module.exports = {
  SECTIONS,
  FULL_IMPORT_ORDER,
  listSections,
  exportSection,
  exportFull,
  importSection,
  importFull,
};
