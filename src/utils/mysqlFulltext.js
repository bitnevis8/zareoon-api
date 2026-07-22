const { Op } = require("sequelize");
const sequelize = require("../core/database/mysql/connection");

/**
 * ساخت عبارت BOOLEAN MODE برای MySQL FULLTEXT
 * مثال: "برنج ایرانی" → "+برنج* +ایرانی*"
 */
function buildBooleanQuery(raw, { maxTokens = 8 } = {}) {
  const q = String(raw || "").trim();
  if (!q) return null;

  const tokens = q
    .split(/[\s,،_+-]+/)
    .map((t) => t.replace(/[+\-><()~*"@\\]/g, "").trim())
    .filter((t) => t.length >= 1)
    .slice(0, maxTokens);

  if (!tokens.length) return null;

  // برای توکن‌های خیلی کوتاه فقط خود توکن؛ برای بقیه prefix *
  return tokens
    .map((t) => (t.length >= 2 ? `+${t}*` : `+${t}`))
    .join(" ");
}

/**
 * شرط MATCH ... AGAINST برای Sequelize where
 * @param {string[]} columns — نام ستون‌های دیتابیس (snake_case)
 */
function fulltextWhere(columns, rawQuery, { boolean = true } = {}) {
  const cols = (columns || []).filter(Boolean);
  if (!cols.length) return null;

  const boolQ = buildBooleanQuery(rawQuery);
  if (!boolQ) return null;

  const colList = cols.join(", ");
  const mode = boolean ? "IN BOOLEAN MODE" : "IN NATURAL LANGUAGE MODE";
  const escaped = sequelize.escape(boolQ);

  return sequelize.where(
    sequelize.literal(`MATCH(${colList}) AGAINST(${escaped} ${mode})`),
    { [Op.gt]: 0 }
  );
}

/**
 * OR از LIKE برای fallback وقتی FULLTEXT در دسترس نیست یا کوئری کوتاه است
 * @param {Array<{field: string, value?: string}>|string[]} fields — camelCase فیلدهای مدل
 */
function likeOrWhere(fields, rawQuery) {
  const q = String(rawQuery || "").trim();
  if (!q) return null;
  const pattern = `%${q}%`;
  const list = (fields || []).map((f) => {
    if (typeof f === "string") return { [f]: { [Op.like]: pattern } };
    return { [f.field]: { [Op.like]: `%${f.value ?? q}%` } };
  });
  if (!list.length) return null;
  return { [Op.or]: list };
}

/**
 * تلاش با FULLTEXT؛ در صورت خطا یا نتیجه خالی اجباری نیست — caller تصمیم می‌گیرد.
 */
async function findWithFulltextFallback({
  model,
  fulltextColumns,
  likeFields,
  rawQuery,
  findOptions = {},
  preferFulltext = true,
}) {
  const q = String(rawQuery || "").trim();
  if (!q) {
    return model.findAll(findOptions);
  }

  if (preferFulltext && q.length >= 2) {
    const ft = fulltextWhere(fulltextColumns, q);
    if (ft) {
      try {
        const rows = await model.findAll({
          ...findOptions,
          where: {
            ...(findOptions.where || {}),
            [Op.and]: [ft],
          },
        });
        if (rows.length) return rows;
      } catch (e) {
        // ایندکس هنوز ساخته نشده یا کالیشن پشتیبانی نمی‌کند
        if (!/Can't find FULLTEXT|ER_FT_MATCHING_KEY_NOT_FOUND|syntax/i.test(e.message || "")) {
          console.warn("FULLTEXT search fallback:", e.message);
        }
      }
    }
  }

  const like = likeOrWhere(likeFields, q);
  return model.findAll({
    ...findOptions,
    where: {
      ...(findOptions.where || {}),
      ...(like || {}),
    },
  });
}

module.exports = {
  buildBooleanQuery,
  fulltextWhere,
  likeOrWhere,
  findWithFulltextFallback,
};
