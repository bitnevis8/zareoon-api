const { Op } = require("sequelize");
const InventoryLotDailyPrice = require("./dailyPriceModel");

function todayDateOnly(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizePriceDate(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function normalizeDailyPriceRows(rows) {
  if (!Array.isArray(rows)) return [];
  const byDate = new Map();
  for (const row of rows) {
    const priceDate = normalizePriceDate(row?.priceDate ?? row?.date ?? row?.price_date);
    const price = row?.price != null && row.price !== "" ? Number(row.price) : NaN;
    if (!priceDate || !Number.isFinite(price) || price < 0) continue;
    byDate.set(priceDate, { priceDate, price });
  }
  return [...byDate.values()].sort((a, b) => a.priceDate.localeCompare(b.priceDate));
}

async function syncLotDailyPrices(lotId, rows) {
  const id = Number(lotId);
  if (!Number.isFinite(id)) return [];
  const normalized = normalizeDailyPriceRows(rows);

  await InventoryLotDailyPrice.destroy({ where: { inventoryLotId: id } });
  if (!normalized.length) return [];

  await InventoryLotDailyPrice.bulkCreate(
    normalized.map((r) => ({
      inventoryLotId: id,
      priceDate: r.priceDate,
      price: r.price,
    }))
  );
  return normalized;
}

async function loadDailyPricesForLots(lotIds, { fromDate = null } = {}) {
  const ids = [...new Set((lotIds || []).map(Number).filter(Boolean))];
  if (!ids.length) return new Map();

  const where = { inventoryLotId: { [Op.in]: ids } };
  if (fromDate) {
    where.priceDate = { [Op.gte]: fromDate };
  }

  const rows = await InventoryLotDailyPrice.findAll({
    where,
    order: [
      ["inventoryLotId", "ASC"],
      ["priceDate", "ASC"],
    ],
  });

  const map = new Map();
  for (const row of rows) {
    const plain = row.toJSON ? row.toJSON() : row;
    const list = map.get(plain.inventoryLotId) || [];
    list.push({
      id: plain.id,
      priceDate: plain.priceDate,
      price: plain.price != null ? Number(plain.price) : null,
    });
    map.set(plain.inventoryLotId, list);
  }
  return map;
}

function findDailyPriceForDate(dailyPrices, dateStr) {
  if (!Array.isArray(dailyPrices) || !dailyPrices.length) return null;
  const target = normalizePriceDate(dateStr) || todayDateOnly();
  const hit = dailyPrices.find((r) => normalizePriceDate(r.priceDate) === target);
  if (!hit || hit.price == null || hit.price === "") return null;
  const n = Number(hit.price);
  return Number.isFinite(n) ? n : null;
}

/**
 * روی lot خام، قیمت مؤثر امروز (+ برنامه روزها) را می‌چسباند
 */
function applyDailyPricingToLot(lot, dailyPrices, forDate = todayDateOnly()) {
  if (!lot || typeof lot !== "object") return lot;
  const schedule = Array.isArray(dailyPrices) ? dailyPrices : [];
  const dayPrice = findDailyPriceForDate(schedule, forDate);
  const basePrice = lot.price != null && lot.price !== "" ? Number(lot.price) : null;
  const effectivePrice = dayPrice != null ? dayPrice : Number.isFinite(basePrice) ? basePrice : null;

  return {
    ...lot,
    dailyPrices: schedule,
    priceForDate: forDate,
    effectivePrice,
    priceFromSchedule: dayPrice != null,
  };
}

async function attachDailyPricingToLots(lots, { forDate = todayDateOnly(), includePast = false } = {}) {
  const arr = Array.isArray(lots) ? lots : [lots];
  const ids = arr.map((l) => l?.id).filter(Boolean);
  const fromDate = includePast ? null : forDate;
  const map = await loadDailyPricesForLots(ids, { fromDate });
  return arr.map((lot) => applyDailyPricingToLot(lot, map.get(lot.id) || [], forDate));
}

module.exports = {
  todayDateOnly,
  normalizePriceDate,
  normalizeDailyPriceRows,
  syncLotDailyPrices,
  loadDailyPricesForLots,
  findDailyPriceForDate,
  applyDailyPricingToLot,
  attachDailyPricingToLots,
};
