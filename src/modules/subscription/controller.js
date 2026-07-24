const { UserSubscription } = require("./model");
const { PLANS, getPlanById, planTotalMonths } = require("./plans");
const zibal = require("./zibal");

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
    limits: plan.limits || null,
    isFree: plan.priceToman === 0,
  };
}

exports.listPlans = async (_req, res) => {
  return res.json({
    success: true,
    data: PLANS.map(publicPlan),
    gateway: {
      provider: "zibal",
      sandbox: zibal.isSandbox(),
      configured: Boolean(zibal.merchantId()),
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
      gateway: "zibal",
      meta: { planName: plan.name },
    });

    const { trackId, paymentUrl } = await zibal.requestPayment({
      amountToman: plan.priceToman,
      description: `اشتراک ${plan.name} — زارعون`,
      mobile: req.user.mobile,
      orderId: String(pending.id),
    });

    pending.authority = trackId;
    await pending.save();

    return res.json({
      success: true,
      data: {
        subscriptionId: pending.id,
        trackId,
        authority: trackId,
        paymentUrl,
        amountToman: plan.priceToman,
      },
    });
  } catch (error) {
    console.error("startCheckout:", error);
    const message =
      error.code === "ZIBAL_NOT_CONFIGURED"
        ? "درگاه پرداخت هنوز پیکربندی نشده است. کد پذیرنده زیبال را در api/config تنظیم کنید."
        : error.message || "خطا در شروع پرداخت";
    return res.status(error.code === "ZIBAL_NOT_CONFIGURED" ? 503 : 500).json({
      success: false,
      message,
    });
  }
};

exports.verifyCheckout = async (req, res) => {
  try {
    const trackId = String(
      req.body?.trackId ||
        req.query?.trackId ||
        req.body?.authority ||
        req.query?.Authority ||
        req.query?.authority ||
        ""
    ).trim();
    const success = String(req.body?.success ?? req.query?.success ?? "").trim();
    const status = String(req.body?.status || req.query?.status || req.query?.Status || "").trim();

    if (!trackId) {
      return res.status(400).json({ success: false, message: "کد پیگیری پرداخت یافت نشد" });
    }

    const sub = await UserSubscription.findOne({ where: { authority: trackId } });
    if (!sub) {
      return res.status(404).json({ success: false, message: "سفارش اشتراک یافت نشد" });
    }

    if (sub.status === "active") {
      return res.json({
        success: true,
        data: { alreadyActive: true, subscription: sub, plan: publicPlan(getPlanById(sub.planId)) },
      });
    }

    // Zibal: success=1 means paid; also accept legacy Zarinpal Status=OK during transition
    const canceled =
      (success !== "" && success !== "1") ||
      (success === "" && status !== "" && status.toUpperCase() !== "OK" && status !== "1");
    if (canceled) {
      sub.status = "canceled";
      await sub.save();
      return res.status(400).json({ success: false, message: "پرداخت توسط کاربر لغو شد" });
    }

    const verified = await zibal.verifyPayment({ trackId });

    const plan = getPlanById(sub.planId);
    const months = planTotalMonths(plan);
    const startsAt = new Date();
    const endsAt = addMonths(startsAt, months || 1);

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
