const {
  getTradeSettings,
  updateTradeSettings,
  getPublicVipCategories,
} = require("./service");

const getTrade = async (req, res) => {
  try {
    const data = await getTradeSettings();
    res.json({ success: true, data });
  } catch (error) {
    console.error("Site settings getTrade error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت تنظیمات" });
  }
};

const patchTrade = async (req, res) => {
  try {
    const { tradeProvidersAutoApprove, vipTradeCategories } = req.body;

    if (
      tradeProvidersAutoApprove !== undefined &&
      typeof tradeProvidersAutoApprove !== "boolean"
    ) {
      return res.status(400).json({ success: false, message: "مقدار نامعتبر است" });
    }

    if (vipTradeCategories !== undefined && typeof vipTradeCategories !== "object") {
      return res.status(400).json({ success: false, message: "پیکربندی VIP نامعتبر است" });
    }

    const data = await updateTradeSettings({ tradeProvidersAutoApprove, vipTradeCategories });
    res.json({ success: true, data, message: "تنظیمات ذخیره شد" });
  } catch (error) {
    console.error("Site settings patchTrade error:", error);
    res.status(500).json({ success: false, message: "خطا در ذخیره تنظیمات" });
  }
};

const getVipPublic = async (_req, res) => {
  try {
    const categories = await getPublicVipCategories();
    res.json({ success: true, data: { categories } });
  } catch (error) {
    console.error("Site settings getVipPublic error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت تنظیمات VIP" });
  }
};

module.exports = { getTrade, patchTrade, getVipPublic };
