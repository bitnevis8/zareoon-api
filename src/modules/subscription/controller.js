const { UserSubscription } = require("./model");
const { PLANS, getPlanById, planTotalMonths, BILLING_PERIODS, priceForPlanPeriod } = require("./plans");
const zibal = require("./zibal");
const { ensurePersonalWorkspaceFromReq, getActiveWorkspaceSubscription } = require("../workspace/service");
const { WorkspaceSubscription } = require("../workspace/model");
const { periodMonths } = require("../workspace/plans");

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function publicPlan(plan) {
  if (!plan) return null;
  return {
    id: plan.id,
    name: plan.name,
    durationMonths: plan.durationMonths,
    bonusMonths: plan.bonusMonths || 0,
    totalMonths: planTotalMonths(plan),
    priceToman: plan.priceToman,
    badge: plan.badge,
    highlight: plan.highlight,
    features: plan.features,
    limits: plan.limits || null,
    isFree: plan.priceToman === 0,
    badgeKind: plan.badgeKind || null,
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
    noteFa: "اشتراک متعلق به Workspace است. جزئیات دوره پرداخت: GET /workspace/catalog",
  });
};

exports.mySubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const ensured = await ensurePersonalWorkspaceFromReq(req).catch(() => null);
    if (ensured?.workspace?.id) {
      const wsSub = await getActiveWorkspaceSubscription(ensured.workspace.id);
      if (wsSub) {
        if (wsSub.endsAt && new Date(wsSub.endsAt) < new Date()) {
          wsSub.status = "expired";
          await wsSub.save();
        } else {
          return res.json({
            success: true,
            data: {
              planId: wsSub.planId,
              billingPeriod: wsSub.billingPeriod,
              status: wsSub.status,
              scope: "workspace",
              workspaceId: ensured.workspace.id,
              subscription: wsSub,
              plan: publicPlan(getPlanById(wsSub.planId) || PLANS[0]),
            },
          });
        }
      }
    }

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
        scope: "legacy_user",
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
    const billingPeriod = String(req.body?.billingPeriod || BILLING_PERIODS.MONTHLY);
    const plan = getPlanById(planId);

    if (!plan) {
      return res.status(400).json({ success: false, message: "بسته نامعتبر است" });
    }

    const amountToman =
      billingPeriod && Object.values(BILLING_PERIODS).includes(billingPeriod)
        ? priceForPlanPeriod(plan.id, billingPeriod)
        : plan.priceToman;

    if (amountToman <= 0) {
      return res.json({
        success: true,
        data: { planId: "free", activated: true, message: "بسته رایگان نیاز به پرداخت ندارد" },
      });
    }

    const ensured = await ensurePersonalWorkspaceFromReq(req);
    const pending = await UserSubscription.create({
      userId,
      planId: plan.id,
      status: "pending",
      amountToman,
      gateway: "zibal",
      meta: { planName: plan.name, billingPeriod, workspaceId: ensured?.workspace?.id || null },
    });

    if (ensured?.workspace?.id) {
      await WorkspaceSubscription.create({
        workspaceId: ensured.workspace.id,
        planId: plan.id,
        billingPeriod: billingPeriod || BILLING_PERIODS.MONTHLY,
        status: "pending",
        amountToman,
        gateway: "zibal",
        legacyUserSubscriptionId: pending.id,
        meta: { planName: plan.name },
      });
    }

    const { trackId, paymentUrl } = await zibal.requestPayment({
      amountToman,
      description: `اشتراک ${plan.name} — زارعون`,
      mobile: req.user.mobile,
      orderId: String(pending.id),
    });

    pending.authority = trackId;
    await pending.save();

    if (ensured?.workspace?.id) {
      await WorkspaceSubscription.update(
        { authority: String(trackId) },
        { where: { legacyUserSubscriptionId: pending.id } }
      );
    }

    return res.json({
      success: true,
      data: {
        subscriptionId: pending.id,
        trackId,
        authority: trackId,
        paymentUrl,
        amountToman,
        billingPeriod,
        workspaceId: ensured?.workspace?.id || null,
        workspaceName: ensured?.workspace?.displayName || ensured?.workspace?.name || null,
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

    const canceled =
      (success !== "" && success !== "1") ||
      (success === "" && status !== "" && status.toUpperCase() !== "OK" && status !== "1");
    if (canceled) {
      sub.status = "canceled";
      await sub.save();
      await WorkspaceSubscription.update(
        { status: "canceled" },
        { where: { legacyUserSubscriptionId: sub.id } }
      );
      return res.status(400).json({ success: false, message: "پرداخت توسط کاربر لغو شد" });
    }

    const verified = await zibal.verifyPayment({ trackId });

    const plan = getPlanById(sub.planId);
    const billingPeriod = sub.meta?.billingPeriod || BILLING_PERIODS.MONTHLY;
    const months = periodMonths(billingPeriod) || planTotalMonths(plan) || 1;
    const startsAt = new Date();
    const endsAt = addMonths(startsAt, months);

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

    const wsPending = await WorkspaceSubscription.findOne({
      where: { legacyUserSubscriptionId: sub.id },
    });
    if (wsPending) {
      await WorkspaceSubscription.update(
        { status: "expired" },
        { where: { workspaceId: wsPending.workspaceId, status: "active" } }
      );
      wsPending.status = "active";
      wsPending.refId = verified.refId;
      wsPending.startsAt = startsAt;
      wsPending.endsAt = endsAt;
      wsPending.billingPeriod = billingPeriod;
      await wsPending.save();
    }

    return res.json({
      success: true,
      data: {
        subscription: sub,
        plan: publicPlan(plan),
        refId: verified.refId,
        billingPeriod,
        scope: wsPending ? "workspace" : "legacy_user",
      },
    });
  } catch (error) {
    console.error("verifyCheckout:", error);
    return res.status(500).json({ success: false, message: error.message || "خطا در تأیید پرداخت" });
  }
};
