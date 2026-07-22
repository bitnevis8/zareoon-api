const HsCode = require("./model");
const tariffData = require("./seederData");

const YEAR = 1405;
const CHUNK = 500;

/**
 * سیدر تعرفه‌های گمرکی ایران (سال ۱۴۰۵)
 * منبع: iran_customs_tariffs_1405.json
 */
async function seedHsCodes() {
  console.log("🌱 Seeding HS Codes (Iran customs tariffs 1405)...");

  const rows = Array.isArray(tariffData) ? tariffData : tariffData.data || [];
  if (!rows.length) {
    console.warn("⚠️ No HS tariff rows found in iran_customs_tariffs_1405.json");
    return;
  }

  const mapped = rows
    .map((r) => {
      const hsCode = String(r.hsCode || r.code || "").replace(/\D/g, "");
      if (!hsCode) return null;
      return {
        hsCode,
        descriptionFa: String(r.descriptionFa || r.description || "").trim() || hsCode,
        customsDuty: Number(r.customsDuty) || 0,
        commercialProfit: Number(r.commercialProfit) || 0,
        year: YEAR,
        isActive: true,
      };
    })
    .filter(Boolean);

  // Upsert in chunks by unique hsCode
  let upserted = 0;
  for (let i = 0; i < mapped.length; i += CHUNK) {
    const slice = mapped.slice(i, i + CHUNK);
    await HsCode.bulkCreate(slice, {
      updateOnDuplicate: ["descriptionFa", "customsDuty", "commercialProfit", "year", "isActive", "updatedAt"],
    });
    upserted += slice.length;
    if (i === 0 || upserted % 2000 === 0 || upserted === mapped.length) {
      console.log(`  … ${upserted}/${mapped.length}`);
    }
  }

  console.log(`✅ HS Codes seeding completed! total=${mapped.length}`);
}

module.exports = seedHsCodes;
