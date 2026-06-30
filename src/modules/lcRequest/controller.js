const LcRequest = require("./model");
const User = require("../user/user/model");

const userAttrs = ["id", "firstName", "lastName", "username", "mobile", "email"];

const create = async (req, res) => {
  try {
    const {
      fullName,
      company,
      phone,
      email,
      tradeType,
      productDescription,
      estimatedAmount,
      currency,
      bankName,
      notes,
    } = req.body;

    if (!fullName?.trim() || !phone?.trim()) {
      return res.status(400).json({ success: false, message: "نام و شماره تماس الزامی است" });
    }

    const validTradeTypes = ["import", "export", "both"];
    const trade = validTradeTypes.includes(tradeType) ? tradeType : "import";

    const record = await LcRequest.create({
      userId: req.user?.id || req.user?.userId || null,
      fullName: fullName.trim(),
      company: company?.trim() || null,
      phone: phone.trim(),
      email: email?.trim() || null,
      tradeType: trade,
      productDescription: productDescription?.trim() || null,
      estimatedAmount: estimatedAmount != null && estimatedAmount !== "" ? estimatedAmount : null,
      currency: currency?.trim() || "USD",
      bankName: bankName?.trim() || null,
      notes: notes?.trim() || null,
      status: "pending",
    });

    res.status(201).json({ success: true, data: record, message: "درخواست LC ثبت شد" });
  } catch (error) {
    console.error("LC request create error:", error);
    res.status(500).json({ success: false, message: "خطا در ثبت درخواست" });
  }
};

const list = async (req, res) => {
  try {
    const where = {};
    if (req.query?.status) where.status = req.query.status;

    const items = await LcRequest.findAll({
      where,
      include: [{ model: User, as: "user", attributes: userAttrs }],
      order: [["id", "DESC"]],
    });

    res.json({ success: true, data: items });
  } catch (error) {
    console.error("LC request list error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت درخواست‌ها" });
  }
};

const getById = async (req, res) => {
  try {
    const item = await LcRequest.findByPk(req.params.id, {
      include: [{ model: User, as: "user", attributes: userAttrs }],
    });
    if (!item) return res.status(404).json({ success: false, message: "یافت نشد" });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error("LC request getById error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت درخواست" });
  }
};

const updateStatus = async (req, res) => {
  try {
    const item = await LcRequest.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "یافت نشد" });

    const validStatuses = ["pending", "contacted", "in_progress", "completed", "rejected"];
    const { status, adminNotes } = req.body;

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "وضعیت نامعتبر است" });
    }

    if (status) item.status = status;
    if (adminNotes !== undefined) item.adminNotes = adminNotes?.trim() || null;

    await item.save();

    const updated = await LcRequest.findByPk(item.id, {
      include: [{ model: User, as: "user", attributes: userAttrs }],
    });

    res.json({ success: true, data: updated, message: "به‌روزرسانی شد" });
  } catch (error) {
    console.error("LC request updateStatus error:", error);
    res.status(500).json({ success: false, message: "خطا در به‌روزرسانی" });
  }
};

module.exports = { create, list, getById, updateStatus };
