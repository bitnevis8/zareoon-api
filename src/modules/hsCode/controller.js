const BaseController = require("../../core/baseController");
const HsCode = require("./model");
const { Op } = require("sequelize");

class HsCodeController extends BaseController {
  constructor() {
    super();
  }

  async search(req, res) {
    try {
      const q = String(req.query.q || req.query.query || "").trim();
      const limitRaw = parseInt(req.query.limit, 10);
      const offsetRaw = parseInt(req.query.offset, 10);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;
      const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

      if (!q || q.length < 2) {
        return this.response(res, 200, true, "عبارت جستجو کوتاه است", {
          rows: [],
          count: 0,
          limit,
          offset,
        });
      }

      const digits = q.replace(/\D/g, "");
      const or = [{ descriptionFa: { [Op.like]: `%${q}%` } }];
      if (digits.length >= 2) {
        or.unshift({ hsCode: { [Op.like]: `${digits}%` } });
        or.push({ hsCode: { [Op.like]: `%${digits}%` } });
      }

      const { rows, count } = await HsCode.findAndCountAll({
        where: { isActive: true, [Op.or]: or },
        order: [["hsCode", "ASC"]],
        limit,
        offset,
        attributes: ["id", "hsCode", "descriptionFa", "customsDuty", "commercialProfit", "year"],
      });

      return this.response(res, 200, true, "نتایج تعرفه", {
        rows,
        count,
        limit,
        offset,
      });
    } catch (error) {
      console.error("HsCode search error:", error);
      return this.response(res, 500, false, error.message || "خطا در جستجوی تعرفه", null, error);
    }
  }

  async getByCode(req, res) {
    try {
      const code = String(req.params.code || "").replace(/\D/g, "");
      if (!code) {
        return this.response(res, 400, false, "کد تعرفه الزامی است");
      }
      const row = await HsCode.findOne({
        where: { hsCode: code, isActive: true },
        attributes: ["id", "hsCode", "descriptionFa", "customsDuty", "commercialProfit", "year"],
      });
      if (!row) return this.response(res, 404, false, "ردیف تعرفه یافت نشد");
      return this.response(res, 200, true, "ردیف تعرفه", row);
    } catch (error) {
      console.error("HsCode getByCode error:", error);
      return this.response(res, 500, false, "خطا در دریافت تعرفه", null, error);
    }
  }

  async getAll(req, res) {
    try {
      const limitRaw = parseInt(req.query.limit, 10);
      const offsetRaw = parseInt(req.query.offset, 10);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
      const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

      const { rows, count } = await HsCode.findAndCountAll({
        where: { isActive: true },
        order: [["hsCode", "ASC"]],
        limit,
        offset,
        attributes: ["id", "hsCode", "descriptionFa", "customsDuty", "commercialProfit", "year"],
      });

      return this.response(res, 200, true, "لیست تعرفه‌ها", { rows, count, limit, offset });
    } catch (error) {
      console.error("HsCode getAll error:", error);
      return this.response(res, 500, false, "خطا در دریافت لیست", null, error);
    }
  }
}

module.exports = new HsCodeController();
