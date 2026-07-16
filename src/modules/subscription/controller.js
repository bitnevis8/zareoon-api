const { UserSubscription } = require("./model");
const { PLANS, getPlanById, planTotalMonths } = require("./plans");
const zarinpal = require("./zarinpal");

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function publicPlan(plan) {
  return {
    id: plan.id,
    name: plan.name,
    durationMonths: plan.durationMonths,
    bonusMonths: plan.bonusMonths,
    totalMonths: planTotalMonths(plan),
    priceToman: plan.priceToman,
    badge: plan.badge,
    highlight: plan.highlight,
    features: plan.features,
    isFree: plan.priceToman === 0,
  };
}

exports.listPlans = async (_req, res) => {
  return res.json({
    success: true,
    data: PLANS.map(publicPlan),
    gateway: {
      provider: "zarinpal",
      sandbox: zarinpal.isSandbox(),
      configured: Boolean(zarinpal.merchantId()),
    },
  });
};

exports.mySubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const active = await UserSubscription.findOne({
      where: { userId, status: "active" },
      order: [["ends_at", "DESC"]],
    });

    if (active && active.endsAt && new Date(active.endsAt) < new Date()) {
      active.status = "expired";
      await active.save();
      return res.json({ success: true, data: { planId: "free", status: "expired", subscription: active } });
    }

    if (!active) {
      return res.json({ success: true, data: { planId: "free", status: "free", subscription: null } });
    }

    return res.json({
      success: true,
      data: {
        planId: active.planId,
        status: active.status,
        subscription: active,
        plan: publicPlan(getPlanById(active.planId) || PLANS[0]),
      },
    });
  } catch (error) {
    console.error("mySubscription:", error);
    return res.status(500).json({ success: false, message: "خطا در دریافت اشتراک" });
  }
};

exports.startCheckout = async (req, res) => {
  try {
    const userId = req.user.id;
    const planId = String(req.body?.planId || "");
    const plan = getPlanById(planId);

    if (!plan) {
      return res.status(400).json({ success: false, message: "بسته نامعتبر است" });
    }

    if (plan.priceToman <= 0) {
      return res.json({
        success: true,
        data: { planId: "free", activated: true, message: "بسته رایگان نیاز به پرداخت ندارد" },
      });
    }

    const pending = await UserSubscription.create({
      userId,
      planId: plan.id,
      status: "pending",
      amountToman: plan.priceToman,
      gateway: "zarinpal",
      meta: { planName: plan.name },
    });

    const { authority, paymentUrl } = await zarinpal.requestPayment({
      amountToman: plan.priceToman,
      description: `اشتراک ${plan.name} — زارعون`,
      email: req.user.email,
      mobile: req.user.mobile,
      metadata: { subscription_id: String(pending.id), user_id: String(userId) },
    });

    pending.authority = authority;
    await pending.save();

    return res.json({
      success: true,
      data: {
        subscriptionId: pending.id,
        authority,
        paymentUrl,
        amountToman: plan.priceToman,
      },
    });
  } catch (error) {
    console.error("startCheckout:", error);
    const message =
      error.code === "ZARINPAL_NOT_CONFIGURED"
        ? "درگاه پرداخت هنوز پیکربندی نشده است. Merchant ID زرین‌پال را در سرور تنظیم کنید."
        : error.message || "خطا در شروع پرداخت";
    return res.status(error.code === "ZARINPAL_NOT_CONFIGURED" ? 503 : 500).json({
      success: false,
      message,
    });
  }
};

exports.verifyCheckout = async (req, res) => {
  try {
    const authority = String(req.body?.authority || req.query?.Authority || "");
    const status = String(req.body?.status || req.query?.Status || "");

    if (!authority) {
      return res.status(400).json({ success: false, message: "کد پیگیری پرداخت یافت نشد" });
    }

    const sub = await UserSubscription.findOne({ where: { authority } });
    if (!sub) {
      return res.status(404).json({ success: false, message: "سفارش اشتراک یافت نشد" });
    }

    if (sub.status === "active") {
      return res.json({
        success: true,
        data: { alreadyActive: true, subscription: sub, plan: publicPlan(getPlanById(sub.planId)) },
      });
    }

    if (status && status.toUpperCase() !== "OK") {
      sub.status = "canceled";
      await sub.save();
      return res.status(400).json({ success: false, message: "پرداخت توسط کاربر لغو شد" });
    }

    const verified = await zarinpal.verifyPayment({
      authority,
      amountToman: sub.amountToman,
    });

    const plan = getPlanById(sub.planId);
    const months = planTotalMonths(plan);
    const startsAt = new Date();
    const endsAt = addMonths(startsAt, months || 1);

    // expire previous active
    await UserSubscription.update(
      { status: "expired" },
      { where: { userId: sub.userId, status: "active" } }
    );

    sub.status = "active";
    sub.refId = verified.refId;
    sub.startsAt = startsAt;
    sub.endsAt = endsAt;
    sub.meta = { ...(sub.meta || {}), verifyCode: verified.code, cardPan: verified.cardPan };
    await sub.save();

    return res.json({
      success: true,
      data: {
        subscription: sub,
        plan: publicPlan(plan),
        refId: verified.refId,
      },
    });
  } catch (error) {
    console.error("verifyCheckout:", error);
    return res.status(500).json({ success: false, message: error.message || "خطا در تأیید پرداخت" });
  }
};
