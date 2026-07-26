const { Op } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");
const { isAdmin } = require("../../utils/roles");
const User = require("../user/user/model");

const PARTY_USER_ATTRS = ["id", "firstName", "lastName", "username", "mobile"];
const {
  EscrowRule,
  EscrowAgreement,
  EscrowMilestone,
  EscrowPaymentIntent,
  EscrowLedgerEntry,
  EscrowReleaseRequest,
  EscrowRefund,
  EscrowDispute,
  EscrowDisputeMessage,
  EscrowEvent,
} = require("./model");
const {
  ALLOWED_TRANSITIONS,
  TERMINAL_STATUSES,
  DISPUTE_OPEN_STATUSES,
  DEFAULT_PLATFORM_FEE_PERCENT,
  DEFAULT_EXPIRY_DAYS,
  DEFAULT_RELEASE_POLICY,
} = require("./constants");

function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10000) / 10000;
}

function generateReferenceCode() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ESC-${ymd}-${rnd}`;
}

function bothPartiesSigned(agreement) {
  return Boolean(agreement?.buyerSignedAt && agreement?.sellerSignedAt);
}

function formatPartyUser(user) {
  if (!user) return null;
  const u = user.get ? user.get({ plain: true }) : user;
  const displayName =
    [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.username || u.mobile || `کاربر ${u.id}`;
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    mobile: u.mobile,
    displayName,
  };
}

async function loadPartyUsersMap(userIds) {
  const ids = [...new Set((userIds || []).map((id) => Number(id)).filter(Boolean))];
  if (!ids.length) return {};
  const users = await User.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: PARTY_USER_ATTRS,
  });
  return Object.fromEntries(users.map((user) => [user.id, formatPartyUser(user)]));
}

function attachPartiesToAgreement(agreement, partyMap) {
  const plain = agreement.get ? agreement.get({ plain: true }) : { ...agreement };
  return {
    ...plain,
    buyer: partyMap[plain.buyerId] || null,
    seller: partyMap[plain.sellerId] || null,
  };
}

function assertTransition(current, next) {
  const allowed = ALLOWED_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    const err = new Error(`انتقال وضعیت از ${current} به ${next} مجاز نیست`);
    err.statusCode = 400;
    throw err;
  }
}

async function logEvent(agreementId, eventType, actor, payload, transaction) {
  return EscrowEvent.create(
    {
      agreementId,
      eventType,
      actorUserId: actor?.userId || null,
      actorRole: actor?.role || "system",
      payload: payload || null,
    },
    { transaction }
  );
}

function resolveActorRole(user, agreement) {
  if (!user) return "system";
  if (isAdmin(user)) return "admin";
  const uid = Number(user.id || user.userId);
  if (uid === Number(agreement.buyerId)) return "buyer";
  if (uid === Number(agreement.sellerId)) return "seller";
  return "unknown";
}

function assertPartyAccess(user, agreement) {
  const role = resolveActorRole(user, agreement);
  if (role === "unknown") {
    const err = new Error("دسترسی غیرمجاز");
    err.statusCode = 403;
    throw err;
  }
  return role;
}

async function findApplicableRule({ sellerId, dealTotal, currency }) {
  const rules = await EscrowRule.findAll({
    where: { isActive: true },
    order: [["priority", "DESC"], ["id", "DESC"]],
  });

  for (const rule of rules) {
    if (rule.targetType === "seller_user" && String(rule.targetId) !== String(sellerId)) continue;
    if (rule.currency && rule.currency !== currency) continue;
    return rule;
  }

  return rules.find((r) => r.targetType === "global") || null;
}

function calculateDepositFromRule(dealTotal, rule) {
  const total = roundMoney(dealTotal);
  if (!rule) {
    const percent = 30;
    return { depositAmount: roundMoney((total * percent) / 100), depositPercent: percent, ruleId: null };
  }

  let deposit =
    rule.depositType === "fixed"
      ? roundMoney(rule.depositFixedAmount || 0)
      : roundMoney((total * Number(rule.depositPercent || 0)) / 100);

  if (rule.minDepositAmount != null) deposit = Math.max(deposit, roundMoney(rule.minDepositAmount));
  if (rule.maxDepositAmount != null) deposit = Math.min(deposit, roundMoney(rule.maxDepositAmount));

  return {
    depositAmount: deposit,
    depositPercent: rule.depositType === "percent" ? Number(rule.depositPercent) : roundMoney((deposit / total) * 100),
    ruleId: rule.id,
    platformFeePercent: Number(rule.platformFeePercent || DEFAULT_PLATFORM_FEE_PERCENT),
  };
}

function parseReleasePolicy(rule) {
  const raw = rule?.releasePolicy;
  const base = typeof raw === "object" && raw ? { ...raw } : {};
  return {
    ...DEFAULT_RELEASE_POLICY,
    ...base,
    milestonePresets: {
      ...DEFAULT_RELEASE_POLICY.milestonePresets,
      ...(base.milestonePresets || {}),
    },
  };
}

function clampDepositPercent(percent, policy) {
  const min = Number(policy.minDepositPercent ?? 5);
  const max = Number(policy.maxDepositPercent ?? 100);
  return Math.min(max, Math.max(min, Number(percent)));
}

function resolveHoldDeposit({
  dealTotalAmount,
  holdMode = "auto",
  depositPercent,
  depositAmount: customAmount,
  depositOverride,
  rule,
}) {
  const total = roundMoney(dealTotalAmount);
  const policy = parseReleasePolicy(rule);
  const calc = calculateDepositFromRule(dealTotalAmount, rule);
  let deposit = calc.depositAmount;
  let effectivePercent = calc.depositPercent;
  const mode = depositOverride != null ? "custom_amount" : holdMode || "auto";

  if (mode === "full") {
    if (!policy.allowFullDealHold) {
      const err = new Error("قفل کل مبلغ معامله در تنظیمات فعال نیست");
      err.statusCode = 400;
      throw err;
    }
    deposit = total;
    effectivePercent = 100;
  } else if (mode === "custom_amount" || depositOverride != null || customAmount != null) {
    if (!policy.allowCustomDeposit) {
      const err = new Error("تعیین دستی مبلغ بیعانه در تنظیمات فعال نیست");
      err.statusCode = 400;
      throw err;
    }
    deposit = roundMoney(depositOverride != null ? depositOverride : customAmount);
    effectivePercent = total > 0 ? roundMoney((deposit / total) * 100) : 0;
  } else if (mode === "percent" && depositPercent != null) {
    const pct = clampDepositPercent(depositPercent, policy);
    deposit = roundMoney((total * pct) / 100);
    effectivePercent = pct;
  }

  if (deposit <= 0 || deposit > total) {
    const err = new Error("مبلغ بیعانه باید بیشتر از صفر و حداکثر برابر کل معامله باشد");
    err.statusCode = 400;
    throw err;
  }

  const pctCheck = total > 0 ? (deposit / total) * 100 : 0;
  if (pctCheck < policy.minDepositPercent || pctCheck > policy.maxDepositPercent) {
    const err = new Error(
      `درصد بیعانه باید بین ${policy.minDepositPercent}٪ و ${policy.maxDepositPercent}٪ باشد`
    );
    err.statusCode = 400;
    throw err;
  }

  return { depositAmount: deposit, depositPercent: effectivePercent, holdMode: mode, policy };
}

function resolveMilestoneRows({ milestones, milestonePreset, depositAmount, policy }) {
  let rows = Array.isArray(milestones) && milestones.length ? milestones : null;
  if (!rows && milestonePreset && policy.milestonePresets?.[milestonePreset]) {
    rows = policy.milestonePresets[milestonePreset].milestones;
  }
  if (!rows && policy.defaultMilestonePreset && policy.milestonePresets?.[policy.defaultMilestonePreset]) {
    rows = policy.milestonePresets[policy.defaultMilestonePreset].milestones;
  }
  if (!rows) {
    rows = DEFAULT_RELEASE_POLICY.milestonePresets.on_delivery.milestones;
  }

  const usingPercent = rows.every((m) => m.percentOfDeposit != null);
  if (usingPercent) {
    const sum = rows.reduce((s, m) => s + Number(m.percentOfDeposit || 0), 0);
    if (Math.abs(sum - 100) > 0.05) {
      const err = new Error("مجموع درصد مراحل آزادسازی باید ۱۰۰٪ باشد");
      err.statusCode = 400;
      throw err;
    }
  } else {
    const sum = rows.reduce((s, m) => s + roundMoney(m.amount || 0), 0);
    if (Math.abs(sum - roundMoney(depositAmount)) > 0.01) {
      const err = new Error("مجموع مبلغ مراحل باید برابر مبلغ قفل‌شده باشد");
      err.statusCode = 400;
      throw err;
    }
  }

  return rows.map((m) => ({
    title: m.title,
    description: m.description || null,
    percentOfDeposit: m.percentOfDeposit != null ? Number(m.percentOfDeposit) : null,
    amount: m.amount != null ? roundMoney(m.amount) : null,
    requiresBuyerApproval:
      m.requiresBuyerApproval !== undefined
        ? m.requiresBuyerApproval !== false
        : policy.releaseRequiresBuyerApproval !== false,
    requiresSellerConfirmation: Boolean(m.requiresSellerConfirmation),
    requiresAdminApproval: Boolean(m.requiresAdminApproval),
  }));
}

async function getGlobalEscrowRule() {
  return (
    (await EscrowRule.findOne({ where: { ruleCode: "GLOBAL_30", isActive: true } })) ||
    (await EscrowRule.findOne({ where: { targetType: "global", isActive: true }, order: [["id", "ASC"]] }))
  );
}

async function getEscrowSettings() {
  const globalRule = await getGlobalEscrowRule();
  const rules = await EscrowRule.findAll({ order: [["priority", "DESC"], ["id", "ASC"]] });
  const policy = parseReleasePolicy(globalRule);
  return {
    globalRule,
    rules,
    policy,
    milestonePresetOptions: Object.entries(policy.milestonePresets || {}).map(([id, preset]) => ({
      id,
      label: preset.label,
      milestones: preset.milestones,
    })),
  };
}

async function updateEscrowSettings(user, payload) {
  if (!isAdmin(user)) {
    const err = new Error("فقط مدیر می‌تواند تنظیمات بیعانه را تغییر دهد");
    err.statusCode = 403;
    throw err;
  }

  let globalRule = await getGlobalEscrowRule();
  if (!globalRule) {
    globalRule = await EscrowRule.create({
      ruleCode: "GLOBAL_30",
      name: "قانون عمومی",
      targetType: "global",
      depositType: "percent",
      depositPercent: 30,
      platformFeePercent: DEFAULT_PLATFORM_FEE_PERCENT,
      priority: 0,
      isActive: true,
      releasePolicy: DEFAULT_RELEASE_POLICY,
    });
  }

  const {
    defaultDepositPercent,
    platformFeePercent,
    minDepositPercent,
    maxDepositPercent,
    allowFullDealHold,
    allowCustomDeposit,
    releaseRequiresBuyerApproval,
    sellerCanRequestRelease,
    sellerReleaseRequiresBuyerApproval,
    defaultMilestonePreset,
  } = payload;

  const currentPolicy = parseReleasePolicy(globalRule);
  const nextPolicy = {
    ...currentPolicy,
    ...(minDepositPercent != null ? { minDepositPercent: Number(minDepositPercent) } : {}),
    ...(maxDepositPercent != null ? { maxDepositPercent: Number(maxDepositPercent) } : {}),
    ...(allowFullDealHold != null ? { allowFullDealHold: Boolean(allowFullDealHold) } : {}),
    ...(allowCustomDeposit != null ? { allowCustomDeposit: Boolean(allowCustomDeposit) } : {}),
    ...(releaseRequiresBuyerApproval != null
      ? { releaseRequiresBuyerApproval: Boolean(releaseRequiresBuyerApproval) }
      : {}),
    ...(sellerCanRequestRelease != null ? { sellerCanRequestRelease: Boolean(sellerCanRequestRelease) } : {}),
    ...(sellerReleaseRequiresBuyerApproval != null
      ? { sellerReleaseRequiresBuyerApproval: Boolean(sellerReleaseRequiresBuyerApproval) }
      : {}),
    ...(defaultMilestonePreset ? { defaultMilestonePreset } : {}),
  };

  await globalRule.update({
    ...(defaultDepositPercent != null ? { depositPercent: Number(defaultDepositPercent) } : {}),
    ...(platformFeePercent != null ? { platformFeePercent: Number(platformFeePercent) } : {}),
    releasePolicy: nextPolicy,
  });

  return getEscrowSettings();
}

async function updateEscrowRule(user, ruleId, payload) {
  if (!isAdmin(user)) {
    const err = new Error("فقط مدیر می‌تواند قوانین را ویرایش کند");
    err.statusCode = 403;
    throw err;
  }
  const rule = await EscrowRule.findByPk(ruleId);
  if (!rule) throw Object.assign(new Error("قانون یافت نشد"), { statusCode: 404 });
  await rule.update(payload);
  return rule;
}

async function previewDeposit({
  dealTotalAmount,
  currency,
  sellerId,
  holdMode,
  depositPercent,
  depositAmount,
}) {
  const rule = await findApplicableRule({ sellerId, dealTotal: dealTotalAmount, currency });
  const resolved = resolveHoldDeposit({
    dealTotalAmount,
    holdMode,
    depositPercent,
    depositAmount,
    rule,
  });
  const fee = roundMoney(
    (resolved.depositAmount * (rule?.platformFeePercent || DEFAULT_PLATFORM_FEE_PERCENT)) / 100
  );
  return {
    depositAmount: resolved.depositAmount,
    depositPercent: resolved.depositPercent,
    holdMode: resolved.holdMode,
    platformFeeAmount: fee,
    platformFeePercent: Number(rule?.platformFeePercent || DEFAULT_PLATFORM_FEE_PERCENT),
    ruleId: rule?.id || null,
    policy: resolved.policy,
    rule,
  };
}

async function appendLedger(
  {
    agreement,
    entryType,
    amount,
    actor,
    referenceType,
    referenceId,
    idempotencyKey,
    note,
  },
  transaction
) {
  if (idempotencyKey) {
    const existing = await EscrowLedgerEntry.findOne({ where: { idempotencyKey }, transaction });
    if (existing) return existing;
  }

  const amt = roundMoney(amount);
  let locked = roundMoney(agreement.lockedAmount);
  let released = roundMoney(agreement.releasedAmount);
  let refunded = roundMoney(agreement.refundedAmount);
  let feeCollected = roundMoney(agreement.feeCollectedAmount);

  if (entryType === "hold") locked = roundMoney(locked + amt);
  else if (entryType === "release") released = roundMoney(released + amt);
  else if (entryType === "refund") refunded = roundMoney(refunded + amt);
  else if (entryType === "fee") feeCollected = roundMoney(feeCollected + amt);

  await agreement.update(
    {
      lockedAmount: locked,
      releasedAmount: released,
      refundedAmount: refunded,
      feeCollectedAmount: feeCollected,
    },
    { transaction }
  );

  return EscrowLedgerEntry.create(
    {
      agreementId: agreement.id,
      entryType,
      amount: amt,
      currency: agreement.currency,
      balanceLockedAfter: locked,
      balanceReleasedAfter: released,
      balanceRefundedAfter: refunded,
      actorUserId: actor?.userId || null,
      actorRole: actor?.role || "system",
      referenceType,
      referenceId,
      idempotencyKey: idempotencyKey || null,
      note: note || null,
    },
    { transaction }
  );
}

async function hasBlockingDispute(agreementId, transaction) {
  const open = await EscrowDispute.findOne({
    where: {
      agreementId,
      blocksRelease: true,
      status: { [Op.in]: Array.from(DISPUTE_OPEN_STATUSES) },
    },
    transaction,
  });
  return Boolean(open);
}

async function createAgreement(payload, user) {
  const userId = user.id || user.userId;
  const {
    buyerId,
    sellerId,
    orderId,
    title,
    description,
    dealTotalAmount,
    currency = "IRR",
    fxRate,
    fxBaseCurrency,
    fxQuoteCurrency,
    milestones,
    milestonePreset,
    ruleId,
    holdMode = "auto",
    depositPercent,
    depositAmount: customDepositAmount,
    expiresInDays = DEFAULT_EXPIRY_DAYS,
    metadata,
  } = payload;

  if (!buyerId || !sellerId || !title || dealTotalAmount == null) {
    const err = new Error("خریدار، فروشنده، عنوان و مبلغ معامله الزامی است");
    err.statusCode = 400;
    throw err;
  }

  if (Number(buyerId) === Number(sellerId)) {
    const err = new Error("خریدار و فروشنده نمی‌توانند یکسان باشند");
    err.statusCode = 400;
    throw err;
  }

  const role = isAdmin(user) ? "admin" : userId === Number(buyerId) ? "buyer" : userId === Number(sellerId) ? "seller" : null;
  if (!role) {
    const err = new Error("فقط خریدار، فروشنده یا مدیر می‌توانند قرارداد ایجاد کنند");
    err.statusCode = 403;
    throw err;
  }

  let rule = null;
  if (ruleId) rule = await EscrowRule.findByPk(ruleId);
  else rule = await findApplicableRule({ sellerId, dealTotal: dealTotalAmount, currency });

  const resolved = resolveHoldDeposit({
    dealTotalAmount,
    holdMode,
    depositPercent,
    depositAmount: customDepositAmount,
    depositOverride: holdMode === "custom_amount" ? customDepositAmount : null,
    rule,
  });
  const depositAmount = resolved.depositAmount;
  const platformFeePercent = Number(rule?.platformFeePercent || DEFAULT_PLATFORM_FEE_PERCENT);
  const platformFeeAmount = roundMoney((depositAmount * platformFeePercent) / 100);
  const milestoneRows = resolveMilestoneRows({
    milestones,
    milestonePreset,
    depositAmount,
    policy: resolved.policy,
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + Number(expiresInDays || DEFAULT_EXPIRY_DAYS));

  return sequelize.transaction(async (transaction) => {
    const agreement = await EscrowAgreement.create(
      {
        referenceCode: generateReferenceCode(),
        orderId: orderId || null,
        buyerId,
        sellerId,
        createdByUserId: userId,
        ruleId: rule?.id || null,
        title,
        description: description || null,
        dealTotalAmount: roundMoney(dealTotalAmount),
        depositAmount,
        depositPercent: resolved.depositPercent,
        currency,
        fxRate: fxRate || null,
        fxBaseCurrency: fxBaseCurrency || currency,
        fxQuoteCurrency: fxQuoteCurrency || null,
        fxLockedAt: fxRate ? new Date() : null,
        platformFeePercent,
        platformFeeAmount,
        status: "draft",
        expiresAt,
        metadata: {
          ...(metadata || {}),
          holdMode: resolved.holdMode,
          milestonePreset: milestonePreset || resolved.policy.defaultMilestonePreset,
        },
      },
      { transaction }
    );

    let sort = 0;
    for (const m of milestoneRows) {
      const amount =
        m.amount != null
          ? roundMoney(m.amount)
          : roundMoney((depositAmount * Number(m.percentOfDeposit || 0)) / 100);
      await EscrowMilestone.create(
        {
          agreementId: agreement.id,
          sortOrder: sort++,
          title: m.title,
          description: m.description || null,
          amount,
          percentOfDeposit: m.percentOfDeposit != null ? Number(m.percentOfDeposit) : null,
          requiresBuyerApproval: m.requiresBuyerApproval !== false,
          requiresSellerConfirmation: Boolean(m.requiresSellerConfirmation),
          requiresAdminApproval: Boolean(m.requiresAdminApproval),
        },
        { transaction }
      );
    }

    await logEvent(
      agreement.id,
      "agreement_created",
      { userId, role },
      { dealTotalAmount, depositAmount, currency },
      transaction
    );

    return agreement;
  });
}

async function activateAgreement(agreementId, user) {
  return sequelize.transaction(async (transaction) => {
    const agreement = await EscrowAgreement.findByPk(agreementId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!agreement) throw Object.assign(new Error("قرارداد یافت نشد"), { statusCode: 404 });
    assertPartyAccess(user, agreement);
    if (agreement.status !== "draft") {
      throw Object.assign(new Error("فقط پیش‌نویس را می‌توان برای امضا ارسال کرد"), { statusCode: 400 });
    }
    assertTransition(agreement.status, "awaiting_signatures");
    const { CONTRACT_VERSION } = require("./contractText");
    await agreement.update(
      {
        status: "awaiting_signatures",
        contractVersion: CONTRACT_VERSION,
      },
      { transaction }
    );
    await logEvent(
      agreement.id,
      "awaiting_signatures",
      { userId: user.id, role: resolveActorRole(user, agreement) },
      { contractVersion: CONTRACT_VERSION },
      transaction
    );
    return agreement;
  });
}

async function createPaymentIntent(agreementId, user, { amount, dueAt, idempotencyKey } = {}) {
  return sequelize.transaction(async (transaction) => {
    const agreement = await EscrowAgreement.findByPk(agreementId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!agreement) throw Object.assign(new Error("قرارداد یافت نشد"), { statusCode: 404 });
    const role = resolveActorRole(user, agreement);
    if (role !== "buyer" && role !== "admin") {
      throw Object.assign(new Error("فقط خریدار می‌تواند درخواست پرداخت ایجاد کند"), { statusCode: 403 });
    }
    if (!bothPartiesSigned(agreement)) {
      throw Object.assign(new Error("ابتدا هر دو طرف باید قرارداد را با پیامک امضا کنند"), { statusCode: 400 });
    }
    if (agreement.status !== "awaiting_payment") {
      if (agreement.status === "awaiting_signatures" && bothPartiesSigned(agreement)) {
        assertTransition("awaiting_signatures", "awaiting_payment");
        await agreement.update({ status: "awaiting_payment" }, { transaction });
      } else {
        throw Object.assign(new Error("وضعیت قرارداد برای پرداخت مناسب نیست"), { statusCode: 400 });
      }
    }

    const remaining = roundMoney(Number(agreement.depositAmount) - Number(agreement.lockedAmount || 0));
    if (remaining <= 0) {
      throw Object.assign(new Error("وجه تضمین قبلاً به‌طور کامل تأمین شده است"), { statusCode: 400 });
    }

    const payAmount = roundMoney(amount != null ? amount : remaining);
    if (payAmount <= 0 || payAmount > remaining + 0.0001) {
      throw Object.assign(new Error(`مبلغ پرداخت باید بین مقدار مثبت و ${remaining} باشد`), { statusCode: 400 });
    }

    if (idempotencyKey) {
      const existing = await EscrowPaymentIntent.findOne({ where: { idempotencyKey }, transaction });
      if (existing) return existing;
    }

    const intent = await EscrowPaymentIntent.create(
      {
        agreementId: agreement.id,
        amount: payAmount,
        currency: agreement.currency,
        status: "awaiting_external",
        dueAt: dueAt || agreement.expiresAt,
        idempotencyKey: idempotencyKey || null,
      },
      { transaction }
    );

    await logEvent(
      agreement.id,
      "payment_intent_created",
      { userId: user.id, role },
      { paymentIntentId: intent.id, amount: payAmount },
      transaction
    );

    return intent;
  });
}

/**
 * تأیید پرداخت (زیبال / مدیر) — از پرداخت جزئی پشتیبانی می‌کند
 */
async function confirmPayment({
  agreementId,
  paymentIntentId,
  externalPaymentRef,
  amount,
  idempotencyKey,
  actorUser,
}) {
  return sequelize.transaction(async (transaction) => {
    const agreement = await EscrowAgreement.findByPk(agreementId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!agreement) throw Object.assign(new Error("قرارداد یافت نشد"), { statusCode: 404 });

    if (!bothPartiesSigned(agreement)) {
      throw Object.assign(new Error("تا قبل از امضای هر دو طرف، وجه قابل قفل نیست"), { statusCode: 400 });
    }

    const intent = paymentIntentId
      ? await EscrowPaymentIntent.findByPk(paymentIntentId, { transaction, lock: transaction.LOCK.UPDATE })
      : await EscrowPaymentIntent.findOne({
          where: { agreementId, status: { [Op.in]: ["pending", "awaiting_external"] } },
          order: [["id", "DESC"]],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

    if (!intent) throw Object.assign(new Error("درخواست پرداخت یافت نشد"), { statusCode: 404 });
    if (Number(intent.agreementId) !== Number(agreementId)) {
      throw Object.assign(new Error("پرداخت با این قرارداد هم‌خوان نیست"), { statusCode: 400 });
    }
    if (intent.status === "confirmed") return { agreement, intent, ledger: null };

    const payAmount = roundMoney(amount != null ? amount : intent.amount);
    const actor = {
      userId: actorUser?.id || null,
      role: actorUser ? resolveActorRole(actorUser, agreement) : "payment_gateway",
    };

    await intent.update(
      {
        status: "confirmed",
        confirmedAt: new Date(),
        externalPaymentRef: externalPaymentRef || intent.externalPaymentRef,
      },
      { transaction }
    );

    const ledger = await appendLedger(
      {
        agreement,
        entryType: "hold",
        amount: payAmount,
        actor,
        referenceType: "payment_intent",
        referenceId: intent.id,
        idempotencyKey: idempotencyKey || `hold-${intent.id}`,
        note: `تأیید پرداخت ${externalPaymentRef || ""}`.trim(),
      },
      transaction
    );

    await agreement.reload({ transaction });
    const locked = roundMoney(agreement.lockedAmount);
    const deposit = roundMoney(agreement.depositAmount);
    const fullyFunded = locked + 0.0001 >= deposit;

    if (fullyFunded && agreement.status === "awaiting_payment") {
      assertTransition("awaiting_payment", "funds_locked");
      await agreement.update({ status: "funds_locked", lockedAt: new Date() }, { transaction });
      assertTransition("funds_locked", "in_progress");
      await agreement.update({ status: "in_progress" }, { transaction });

      if (Number(agreement.platformFeeAmount) > 0 && Number(agreement.feeCollectedAmount || 0) <= 0) {
        await appendLedger(
          {
            agreement,
            entryType: "fee",
            amount: agreement.platformFeeAmount,
            actor: { role: "system" },
            referenceType: "payment_intent",
            referenceId: intent.id,
            idempotencyKey: idempotencyKey ? `${idempotencyKey}-fee` : `fee-${intent.id}`,
            note: "کارمزد سامانه",
          },
          transaction
        );
      }
    }

    await logEvent(
      agreement.id,
      fullyFunded ? "payment_confirmed_funds_locked" : "payment_partial_confirmed",
      actor,
      { paymentIntentId: intent.id, amount: payAmount, externalPaymentRef, locked, deposit, fullyFunded },
      transaction
    );

    await agreement.reload({ transaction });
    return { agreement, intent, ledger };
  });
}

async function confirmMilestone(agreementId, milestoneId, user, { approveAs } = {}) {
  return sequelize.transaction(async (transaction) => {
    const agreement = await EscrowAgreement.findByPk(agreementId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!agreement) throw Object.assign(new Error("قرارداد یافت نشد"), { statusCode: 404 });
    const role = assertPartyAccess(user, agreement);

    const milestone = await EscrowMilestone.findOne({
      where: { id: milestoneId, agreementId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!milestone) throw Object.assign(new Error("مرحله یافت نشد"), { statusCode: 404 });
    if (milestone.status === "released") return milestone;

    const now = new Date();
    if (approveAs === "buyer" || role === "buyer") {
      if (!milestone.requiresBuyerApproval) throw Object.assign(new Error("این مرحله نیاز به تأیید خریدار ندارد"), { statusCode: 400 });
      await milestone.update({ buyerApprovedAt: now, status: "in_review" }, { transaction });
    } else if (approveAs === "seller" || role === "seller") {
      if (!milestone.requiresSellerConfirmation) throw Object.assign(new Error("این مرحله نیاز به تأیید فروشنده ندارد"), { statusCode: 400 });
      await milestone.update({ sellerConfirmedAt: now, status: "in_review" }, { transaction });
    } else if (role === "admin") {
      await milestone.update({ adminApprovedAt: now, status: "approved" }, { transaction });
    } else {
      throw Object.assign(new Error("نقش نامعتبر برای تأیید مرحله"), { statusCode: 400 });
    }

    await milestone.reload({ transaction });
    const buyerOk = !milestone.requiresBuyerApproval || milestone.buyerApprovedAt;
    const sellerOk = !milestone.requiresSellerConfirmation || milestone.sellerConfirmedAt;
    const adminOk = !milestone.requiresAdminApproval || milestone.adminApprovedAt;

    if (buyerOk && sellerOk && adminOk) {
      await milestone.update({ status: "approved" }, { transaction });
      await requestRelease(
        agreement.id,
        user,
        {
          milestoneId: milestone.id,
          amount: milestone.amount,
          requestType: "milestone_auto",
          reason: `تأیید مرحله: ${milestone.title}`,
          autoApprove: true,
        },
        transaction
      );
    }

    await logEvent(
      agreement.id,
      "milestone_confirmed",
      { userId: user.id, role },
      { milestoneId: milestone.id },
      transaction
    );

    return milestone;
  });
}

async function requestRelease(agreementId, user, options = {}, existingTransaction = null) {
  const run = async (transaction) => {
    const agreement = await EscrowAgreement.findByPk(agreementId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!agreement) throw Object.assign(new Error("قرارداد یافت نشد"), { statusCode: 404 });
    const role = resolveActorRole(user, agreement);

    if (!["in_progress", "partially_released", "disputed"].includes(agreement.status)) {
      throw Object.assign(new Error("وضعیت قرارداد برای آزادسازی مناسب نیست"), { statusCode: 400 });
    }

    if (await hasBlockingDispute(agreement.id, transaction)) {
      throw Object.assign(new Error("به‌دلیل اختلاف باز، آزادسازی مسدود است"), { statusCode: 409 });
    }

    const amount = roundMoney(options.amount);
    const available = roundMoney(agreement.lockedAmount - agreement.releasedAmount - agreement.refundedAmount);
    if (amount <= 0 || amount > available) {
      throw Object.assign(new Error("مبلغ آزادسازی نامعتبر است"), { statusCode: 400 });
    }

    const release = await EscrowReleaseRequest.create(
      {
        agreementId: agreement.id,
        milestoneId: options.milestoneId || null,
        amount,
        currency: agreement.currency,
        status: options.autoApprove ? "approved" : "pending",
        requestType: options.requestType || (role === "admin" ? "admin_manual" : "seller_request"),
        requestedByUserId: user.id,
        reason: options.reason || null,
      },
      { transaction }
    );

    if (options.autoApprove || role === "admin") {
      await executeRelease(release.id, user, { adminNotes: options.adminNotes }, transaction);
    } else {
      await logEvent(
        agreement.id,
        "release_requested",
        { userId: user.id, role },
        { releaseRequestId: release.id, amount },
        transaction
      );
    }

    return release;
  };

  if (existingTransaction) return run(existingTransaction);
  return sequelize.transaction(run);
}

async function approveReleaseRequest(releaseRequestId, user, { adminNotes } = {}) {
  return sequelize.transaction(async (transaction) => {
    const release = await EscrowReleaseRequest.findByPk(releaseRequestId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!release) throw Object.assign(new Error("درخواست آزادسازی یافت نشد"), { statusCode: 404 });
    if (release.status !== "pending") return release;

    const agreement = await EscrowAgreement.findByPk(release.agreementId, { transaction });
    const role = resolveActorRole(user, agreement);
    if (role !== "admin" && role !== "buyer") {
      throw Object.assign(new Error("فقط خریدار یا مدیر می‌توانند آزادسازی را تأیید کنند"), { statusCode: 403 });
    }

    await release.update({ status: "approved", approvedByUserId: user.id, adminNotes: adminNotes || null }, { transaction });
    return executeRelease(release.id, user, { adminNotes }, transaction);
  });
}

async function executeRelease(releaseRequestId, user, { adminNotes } = {}, transaction) {
  const release = await EscrowReleaseRequest.findByPk(releaseRequestId, { transaction, lock: transaction.LOCK.UPDATE });
  const agreement = await EscrowAgreement.findByPk(release.agreementId, { transaction, lock: transaction.LOCK.UPDATE });

  if (await hasBlockingDispute(agreement.id, transaction)) {
    throw Object.assign(new Error("به‌دلیل اختلاف باز، آزادسازی مسدود است"), { statusCode: 409 });
  }

  const actor = { userId: user?.id, role: user ? resolveActorRole(user, agreement) : "system" };

  await appendLedger(
    {
      agreement,
      entryType: "release",
      amount: release.amount,
      actor,
      referenceType: "release_request",
      referenceId: release.id,
      idempotencyKey: `release-${release.id}`,
      note: adminNotes || release.reason,
    },
    transaction
  );

  if (release.milestoneId) {
    await EscrowMilestone.update(
      { status: "released", releasedAt: new Date() },
      { where: { id: release.milestoneId }, transaction }
    );
  }

  const netReleased = roundMoney(agreement.releasedAmount);
  const deposit = roundMoney(agreement.depositAmount);
  let nextStatus = agreement.status;
  if (netReleased >= deposit) {
    assertTransition(agreement.status, "fully_released");
    nextStatus = "fully_released";
  } else if (netReleased > 0) {
    if (agreement.status !== "partially_released") {
      assertTransition(agreement.status, "partially_released");
      nextStatus = "partially_released";
    }
  }

  await agreement.update({ status: nextStatus }, { transaction });
  await release.update({ status: "completed", completedAt: new Date(), approvedByUserId: user?.id || release.approvedByUserId }, { transaction });

  await logEvent(
    agreement.id,
    "funds_released",
    actor,
    { releaseRequestId: release.id, amount: release.amount, status: nextStatus },
    transaction
  );

  if (nextStatus === "fully_released") {
    assertTransition("fully_released", "completed");
    await agreement.update({ status: "completed", completedAt: new Date() }, { transaction });
    await logEvent(agreement.id, "agreement_completed", actor, null, transaction);
  }

  return release;
}

async function requestRefund(agreementId, user, { amount, reason, reasonCode }) {
  return sequelize.transaction(async (transaction) => {
    const agreement = await EscrowAgreement.findByPk(agreementId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!agreement) throw Object.assign(new Error("قرارداد یافت نشد"), { statusCode: 404 });
    const role = assertPartyAccess(user, agreement);

    const refundAmount = roundMoney(amount != null ? amount : agreement.lockedAmount - agreement.releasedAmount - agreement.refundedAmount);
    const available = roundMoney(agreement.lockedAmount - agreement.releasedAmount - agreement.refundedAmount);
    if (refundAmount <= 0 || refundAmount > available) {
      throw Object.assign(new Error("مبلغ برگشت نامعتبر است"), { statusCode: 400 });
    }

    const refund = await EscrowRefund.create(
      {
        agreementId: agreement.id,
        amount: refundAmount,
        currency: agreement.currency,
        reasonCode: reasonCode || null,
        reason: reason || null,
        status: role === "admin" ? "approved" : "pending",
        requestedByUserId: user.id,
      },
      { transaction }
    );

    if (role === "admin") {
      await executeRefund(refund.id, user, transaction);
    } else {
      await logEvent(
        agreement.id,
        "refund_requested",
        { userId: user.id, role },
        { refundId: refund.id, amount: refundAmount },
        transaction
      );
    }

    return refund;
  });
}

async function approveRefund(refundId, user) {
  return sequelize.transaction(async (transaction) => {
    const refund = await EscrowRefund.findByPk(refundId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!refund) throw Object.assign(new Error("درخواست برگشت یافت نشد"), { statusCode: 404 });
    if (!isAdmin(user)) throw Object.assign(new Error("فقط مدیر می‌تواند برگشت را تأیید کند"), { statusCode: 403 });
    if (refund.status === "completed") return refund;
    await refund.update({ status: "approved", approvedByUserId: user.id }, { transaction });
    return executeRefund(refund.id, user, transaction);
  });
}

async function executeRefund(refundId, user, transaction) {
  const refund = await EscrowRefund.findByPk(refundId, { transaction, lock: transaction.LOCK.UPDATE });
  const agreement = await EscrowAgreement.findByPk(refund.agreementId, { transaction, lock: transaction.LOCK.UPDATE });
  const actor = { userId: user.id, role: resolveActorRole(user, agreement) };

  await appendLedger(
    {
      agreement,
      entryType: "refund",
      amount: refund.amount,
      actor,
      referenceType: "refund",
      referenceId: refund.id,
      idempotencyKey: `refund-${refund.id}`,
      note: refund.reason,
    },
    transaction
  );

  assertTransition(agreement.status, "refunded");
  await agreement.update({ status: "refunded" }, { transaction });
  await refund.update({ status: "completed", completedAt: new Date() }, { transaction });

  await logEvent(agreement.id, "funds_refunded", actor, { refundId: refund.id, amount: refund.amount }, transaction);

  assertTransition("refunded", "completed");
  await agreement.update({ status: "completed", completedAt: new Date() }, { transaction });

  return refund;
}

async function openDispute(agreementId, user, { reason, description, attachments }) {
  return sequelize.transaction(async (transaction) => {
    const agreement = await EscrowAgreement.findByPk(agreementId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!agreement) throw Object.assign(new Error("قرارداد یافت نشد"), { statusCode: 404 });
    const role = assertPartyAccess(user, agreement);
    if (role !== "buyer" && role !== "seller") {
      throw Object.assign(new Error("فقط خریدار یا فروشنده می‌توانند اختلاف ثبت کنند"), { statusCode: 403 });
    }
    if (TERMINAL_STATUSES.has(agreement.status)) {
      throw Object.assign(new Error("قرارداد پایان‌یافته است"), { statusCode: 400 });
    }

    assertTransition(agreement.status, "disputed");
    await agreement.update({ status: "disputed" }, { transaction });

    const dispute = await EscrowDispute.create(
      {
        agreementId: agreement.id,
        openedByUserId: user.id,
        openedByRole: role,
        reason,
        description: description || null,
        attachments: attachments || null,
        status: "filed",
        blocksRelease: true,
      },
      { transaction }
    );

    await logEvent(agreement.id, "dispute_opened", { userId: user.id, role }, { disputeId: dispute.id, reason }, transaction);
    return dispute;
  });
}

async function resolveDispute(disputeId, user, { resolution, notes, buyerRefundPercent, sellerReleasePercent }) {
  return sequelize.transaction(async (transaction) => {
    if (!isAdmin(user)) throw Object.assign(new Error("فقط مدیر می‌تواند اختلاف را حل کند"), { statusCode: 403 });

    const dispute = await EscrowDispute.findByPk(disputeId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!dispute) throw Object.assign(new Error("اختلاف یافت نشد"), { statusCode: 404 });

    const agreement = await EscrowAgreement.findByPk(dispute.agreementId, { transaction, lock: transaction.LOCK.UPDATE });
    const statusMap = {
      buyer: "resolved_buyer",
      seller: "resolved_seller",
      split: "resolved_split",
      closed: "closed",
    };
    const newStatus = statusMap[resolution] || "closed";

    await dispute.update(
      {
        status: newStatus,
        resolutionNotes: notes || null,
        resolvedByUserId: user.id,
        resolvedAt: new Date(),
        blocksRelease: false,
        buyerRefundPercent: buyerRefundPercent != null ? Number(buyerRefundPercent) : null,
        sellerReleasePercent: sellerReleasePercent != null ? Number(sellerReleasePercent) : null,
      },
      { transaction }
    );

    const locked = roundMoney(agreement.lockedAmount - agreement.releasedAmount - agreement.refundedAmount);

    if (resolution === "buyer" && locked > 0) {
      const refund = await EscrowRefund.create(
        {
          agreementId: agreement.id,
          amount: locked,
          currency: agreement.currency,
          reason: notes || "حل اختلاف به نفع خریدار",
          reasonCode: "dispute_buyer",
          status: "approved",
          requestedByUserId: user.id,
          approvedByUserId: user.id,
        },
        { transaction }
      );
      await executeRefund(refund.id, user, transaction);
    } else if (resolution === "seller" && locked > 0) {
      await requestRelease(
        agreement.id,
        user,
        { amount: locked, requestType: "admin_manual", reason: notes || "حل اختلاف به نفع فروشنده", autoApprove: true },
        transaction
      );
    } else if (resolution === "split" && locked > 0) {
      const refundPart = roundMoney((locked * Number(buyerRefundPercent || 50)) / 100);
      const releasePart = roundMoney(locked - refundPart);
      if (refundPart > 0) {
        const refund = await EscrowRefund.create(
          {
            agreementId: agreement.id,
            amount: refundPart,
            currency: agreement.currency,
            reason: notes || "حل اختلاف تسهیمی — بخش خریدار",
            reasonCode: "dispute_split",
            status: "approved",
            requestedByUserId: user.id,
            approvedByUserId: user.id,
          },
          { transaction }
        );
        await executeRefund(refund.id, user, transaction);
      }
      if (releasePart > 0) {
        await requestRelease(
          agreement.id,
          user,
          { amount: releasePart, requestType: "admin_manual", reason: notes || "حل اختلاف تسهیمی — بخش فروشنده", autoApprove: true },
          transaction
        );
      }
    } else if (agreement.status === "disputed") {
      await agreement.update({ status: "in_progress" }, { transaction });
    }

    await logEvent(
      agreement.id,
      "dispute_resolved",
      { userId: user.id, role: "admin" },
      { disputeId: dispute.id, resolution },
      transaction
    );

    return dispute;
  });
}

async function cancelAgreement(agreementId, user, { reason } = {}) {
  return sequelize.transaction(async (transaction) => {
    const agreement = await EscrowAgreement.findByPk(agreementId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!agreement) throw Object.assign(new Error("قرارداد یافت نشد"), { statusCode: 404 });
    const role = assertPartyAccess(user, agreement);

    if (["funds_locked", "in_progress", "partially_released"].includes(agreement.status)) {
      const available = roundMoney(agreement.lockedAmount - agreement.releasedAmount - agreement.refundedAmount);
      if (available > 0) {
        const refund = await EscrowRefund.create(
          {
            agreementId: agreement.id,
            amount: available,
            currency: agreement.currency,
            reason: reason || "لغو قرارداد",
            reasonCode: "cancelled",
            status: "approved",
            requestedByUserId: user.id,
            approvedByUserId: isAdmin(user) ? user.id : null,
          },
          { transaction }
        );
        if (isAdmin(user) || role === "seller") {
          await executeRefund(refund.id, user, transaction);
          return agreement;
        }
      }
    }

    assertTransition(agreement.status, "cancelled");
    await agreement.update({ status: "cancelled", cancelledAt: new Date() }, { transaction });
    await logEvent(agreement.id, "agreement_cancelled", { userId: user.id, role }, { reason }, transaction);
    return agreement;
  });
}

async function getAgreementDetail(agreementId, user) {
  const agreement = await EscrowAgreement.findByPk(agreementId);
  if (!agreement) throw Object.assign(new Error("قرارداد یافت نشد"), { statusCode: 404 });
  assertPartyAccess(user, agreement);

  const [milestones, paymentIntents, ledger, releases, refunds, disputes, events] = await Promise.all([
    EscrowMilestone.findAll({ where: { agreementId }, order: [["sort_order", "ASC"]] }),
    EscrowPaymentIntent.findAll({ where: { agreementId }, order: [["id", "DESC"]] }),
    EscrowLedgerEntry.findAll({ where: { agreementId }, order: [["id", "ASC"]] }),
    EscrowReleaseRequest.findAll({ where: { agreementId }, order: [["id", "DESC"]] }),
    EscrowRefund.findAll({ where: { agreementId }, order: [["id", "DESC"]] }),
    EscrowDispute.findAll({ where: { agreementId }, order: [["id", "DESC"]] }),
    EscrowEvent.findAll({ where: { agreementId }, order: [["id", "ASC"]] }),
  ]);

  const partyMap = await loadPartyUsersMap([agreement.buyerId, agreement.sellerId]);
  const enriched = attachPartiesToAgreement(agreement, partyMap);
  const { buildContractDocument } = require("./contractText");
  const contract = buildContractDocument(agreement, {
    buyerName: enriched.buyer?.displayName,
    sellerName: enriched.seller?.displayName,
  });

  const remainingToDeposit = Math.max(
    0,
    roundMoney(Number(agreement.depositAmount) - Number(agreement.lockedAmount || 0))
  );

  return {
    agreement: enriched,
    milestones,
    paymentIntents,
    ledger,
    releases,
    refunds,
    disputes,
    events,
    viewerRole: resolveActorRole(user, agreement),
    contract,
    signatures: {
      buyerSigned: Boolean(agreement.buyerSignedAt),
      sellerSigned: Boolean(agreement.sellerSignedAt),
      buyerSignedAt: agreement.buyerSignedAt,
      sellerSignedAt: agreement.sellerSignedAt,
      bothSigned: bothPartiesSigned(agreement),
      contractVersion: agreement.contractVersion,
    },
    funding: {
      depositAmount: roundMoney(agreement.depositAmount),
      lockedAmount: roundMoney(agreement.lockedAmount),
      remainingToDeposit,
      currency: agreement.currency,
      zibalEligible: String(agreement.currency || "").toUpperCase() === "IRR",
    },
  };
}

function partyRoleForUser(user, agreement) {
  const role = resolveActorRole(user, agreement);
  if (role === "buyer" || role === "seller") return role;
  if (isAdmin(user)) return null;
  return null;
}

async function getContract(agreementId, user) {
  const detail = await getAgreementDetail(agreementId, user);
  return {
    contract: detail.contract,
    signatures: detail.signatures,
    agreement: {
      id: detail.agreement.id,
      referenceCode: detail.agreement.referenceCode,
      status: detail.agreement.status,
      title: detail.agreement.title,
    },
  };
}

async function requestSignOtp(agreementId, user, { acceptedTerms } = {}) {
  if (!acceptedTerms) {
    throw Object.assign(new Error("برای دریافت کد، ابتدا متن قرارداد را بپذیرید"), { statusCode: 400 });
  }

  const agreement = await EscrowAgreement.findByPk(agreementId);
  if (!agreement) throw Object.assign(new Error("قرارداد یافت نشد"), { statusCode: 404 });
  assertPartyAccess(user, agreement);

  if (!["draft", "awaiting_signatures"].includes(agreement.status)) {
    throw Object.assign(new Error("در این وضعیت امکان امضا نیست"), { statusCode: 400 });
  }

  if (agreement.status === "draft") {
    await activateAgreement(agreementId, user);
    await agreement.reload();
  }

  const role = partyRoleForUser(user, agreement);
  if (!role) {
    throw Object.assign(new Error("مدیر نیازی به امضای طرفین ندارد؛ خریدار و فروشنده باید امضا کنند"), {
      statusCode: 403,
    });
  }

  if ((role === "buyer" && agreement.buyerSignedAt) || (role === "seller" && agreement.sellerSignedAt)) {
    throw Object.assign(new Error("شما قبلاً این قرارداد را امضا کرده‌اید"), { statusCode: 400 });
  }

  const dbUser = await User.findByPk(user.id || user.userId);
  const mobile = dbUser?.mobile;
  if (!mobile) {
    throw Object.assign(new Error("برای امضا باید شماره موبایل در حساب کاربری ثبت باشد"), { statusCode: 400 });
  }

  const { generateOtpCode, hashOtp, sendVerifySms, normalizeMobile } = require("./escrowSms");
  const code = generateOtpCode();
  const meta = { ...(agreement.metadata || {}) };
  meta.signOtp = {
    role,
    codeHash: hashOtp(code),
    sentAt: new Date().toISOString(),
    attempts: 0,
    mobile: normalizeMobile(mobile),
  };
  await agreement.update({ metadata: meta });

  try {
    await sendVerifySms(mobile, code);
  } catch (e) {
    const err = new Error(e?.response?.data?.message || e.message || "ارسال پیامک ناموفق بود");
    err.statusCode = 502;
    throw err;
  }

  await logEvent(agreement.id, "sign_otp_sent", { userId: user.id, role }, { mobileMask: `${String(mobile).slice(0, 4)}****` });

  return {
    ok: true,
    role,
    expiresInSeconds: 180,
    mobileHint: `${String(mobile).slice(0, 4)}***${String(mobile).slice(-2)}`,
    message: "کد تأیید به شماره موبایل شما ارسال شد",
  };
}

async function verifySignOtp(agreementId, user, { code, clientIp } = {}) {
  const agreement = await EscrowAgreement.findByPk(agreementId);
  if (!agreement) throw Object.assign(new Error("قرارداد یافت نشد"), { statusCode: 404 });
  assertPartyAccess(user, agreement);

  const role = partyRoleForUser(user, agreement);
  if (!role) {
    throw Object.assign(new Error("فقط خریدار یا فروشنده می‌توانند امضا کنند"), { statusCode: 403 });
  }

  const challenge = agreement.metadata?.signOtp;
  const { hashOtp, isOtpExpired } = require("./escrowSms");
  if (!challenge || challenge.role !== role) {
    throw Object.assign(new Error("ابتدا درخواست کد پیامک را ارسال کنید"), { statusCode: 400 });
  }
  if (isOtpExpired(challenge.sentAt, 3)) {
    throw Object.assign(new Error("کد منقضی شده است؛ دوباره درخواست دهید"), { statusCode: 400 });
  }
  if ((challenge.attempts || 0) >= 5) {
    throw Object.assign(new Error("تعداد تلاش بیش از حد؛ دوباره کد بگیرید"), { statusCode: 429 });
  }

  if (hashOtp(String(code || "").trim()) !== challenge.codeHash) {
    const meta = { ...(agreement.metadata || {}) };
    meta.signOtp = { ...challenge, attempts: (challenge.attempts || 0) + 1 };
    await agreement.update({ metadata: meta });
    throw Object.assign(new Error("کد واردشده نادرست است"), { statusCode: 400 });
  }

  const { CONTRACT_VERSION } = require("./contractText");
  const patch = {
    contractVersion: agreement.contractVersion || CONTRACT_VERSION,
    metadata: { ...(agreement.metadata || {}), signOtp: null },
  };
  if (role === "buyer") {
    patch.buyerSignedAt = new Date();
    patch.buyerSignIp = clientIp || null;
  } else {
    patch.sellerSignedAt = new Date();
    patch.sellerSignIp = clientIp || null;
  }

  await agreement.update(patch);
  await agreement.reload();

  await logEvent(agreement.id, "party_signed", { userId: user.id, role }, { signedAt: new Date().toISOString() });

  if (bothPartiesSigned(agreement) && agreement.status === "awaiting_signatures") {
    assertTransition("awaiting_signatures", "awaiting_payment");
    await agreement.update({ status: "awaiting_payment" });
    await logEvent(agreement.id, "awaiting_payment", { userId: user.id, role }, { reason: "both_signed" });
    await agreement.reload();
  }

  const both = bothPartiesSigned(agreement);
  return {
    ok: true,
    role,
    bothSigned: both,
    status: agreement.status,
    message: both
      ? "هر دو طرف امضا کردند؛ خریدار می‌تواند پرداخت را شروع کند"
      : "امضای شما ثبت شد؛ منتظر امضای طرف مقابل بمانید",
  };
}

function frontendBaseUrl() {
  try {
    const host = require("config").get("FRONTEND.HOST");
    if (host) return String(host).replace(/\/$/, "");
  } catch {
    /* ignore */
  }
  return process.env.FRONTEND_URL || "https://zareoon.ir";
}

async function startZibalPayment(agreementId, user, { amount } = {}) {
  const agreement = await EscrowAgreement.findByPk(agreementId);
  if (!agreement) throw Object.assign(new Error("قرارداد یافت نشد"), { statusCode: 404 });
  assertPartyAccess(user, agreement);

  if (String(agreement.currency || "").toUpperCase() !== "IRR") {
    throw Object.assign(
      new Error("پرداخت اینترنتی زیبال فقط برای معاملات ریالی (IRR) فعال است. برای سایر ارزها با مدیریت هماهنگ کنید."),
      { statusCode: 400 }
    );
  }

  const intent = await createPaymentIntent(agreementId, user, { amount });
  const dbUser = await User.findByPk(user.id || user.userId);
  const zibal = require("../subscription/zibal");
  const callback = `${frontendBaseUrl()}/dashboard/escrow/callback`;

  const pay = await zibal.requestPayment({
    amountToman: Number(intent.amount),
    description: `حساب امانی زارعون ${agreement.referenceCode}`,
    mobile: dbUser?.mobile || undefined,
    orderId: `ESC-${agreement.id}-${intent.id}`,
    callbackUrl: callback,
  });

  const meta = { ...(intent.metadata || {}), zibalTrackId: pay.trackId };
  await intent.update({
    externalPaymentRef: pay.trackId,
    metadata: meta,
  });

  await logEvent(
    agreement.id,
    "zibal_payment_started",
    { userId: user.id, role: resolveActorRole(user, agreement) },
    { paymentIntentId: intent.id, trackId: pay.trackId, amount: intent.amount }
  );

  return {
    paymentUrl: pay.paymentUrl,
    trackId: pay.trackId,
    paymentIntentId: intent.id,
    amount: intent.amount,
    currency: intent.currency,
  };
}

async function verifyZibalPayment({ trackId, success, status }, user) {
  const id = String(trackId || "").trim();
  if (!id) throw Object.assign(new Error("کد پیگیری یافت نشد"), { statusCode: 400 });

  const recent = await EscrowPaymentIntent.findAll({
    where: { status: { [Op.in]: ["awaiting_external", "confirmed"] } },
    order: [["id", "DESC"]],
    limit: 80,
  });
  const found =
    recent.find((row) => row.externalPaymentRef === id || row.metadata?.zibalTrackId === id) || null;

  if (!found) {
    throw Object.assign(new Error("پرداخت متناظر با این پیگیری یافت نشد"), { statusCode: 404 });
  }

  const agreement = await EscrowAgreement.findByPk(found.agreementId);
  if (!agreement) throw Object.assign(new Error("قرارداد یافت نشد"), { statusCode: 404 });
  if (user) assertPartyAccess(user, agreement);

  if (found.status === "confirmed") {
    return {
      agreement,
      intent: found,
      refId: found.externalPaymentRef,
      trackId: id,
      message: "این پرداخت قبلاً تأیید شده است",
    };
  }

  const zibal = require("../subscription/zibal");
  let verify;
  try {
    verify = await zibal.verifyPayment({ trackId: id });
  } catch (e) {
    await found.update({ status: "failed" });
    throw Object.assign(new Error(e.message || "تأیید زیبال ناموفق بود"), { statusCode: 400 });
  }

  const result = await confirmPayment({
    agreementId: agreement.id,
    paymentIntentId: found.id,
    externalPaymentRef: verify.refId || id,
    amount: found.amount,
    idempotencyKey: `zibal-${id}`,
    actorUser: user || null,
  });

  return {
    ...result,
    refId: verify.refId,
    trackId: id,
    message: "پرداخت تأیید و در حساب امانی ثبت شد",
  };
}

async function listAgreements(user, { status, limit = 50, offset = 0 } = {}) {
  const userId = user.id || user.userId;
  const where = isAdmin(user)
    ? {}
    : { [Op.or]: [{ buyerId: userId }, { sellerId: userId }] };
  if (status) where.status = status;

  const result = await EscrowAgreement.findAndCountAll({
    where,
    order: [["id", "DESC"]],
    limit: Math.min(Number(limit) || 50, 100),
    offset: Number(offset) || 0,
  });

  const partyIds = result.rows.flatMap((row) => [row.buyerId, row.sellerId]);
  const partyMap = await loadPartyUsersMap(partyIds);
  const rows = result.rows.map((row) => attachPartiesToAgreement(row, partyMap));

  return { count: result.count, rows };
}

module.exports = {
  roundMoney,
  previewDeposit,
  createAgreement,
  activateAgreement,
  createPaymentIntent,
  confirmPayment,
  confirmMilestone,
  requestRelease,
  approveReleaseRequest,
  requestRefund,
  approveRefund,
  openDispute,
  resolveDispute,
  cancelAgreement,
  getAgreementDetail,
  listAgreements,
  getContract,
  requestSignOtp,
  verifySignOtp,
  startZibalPayment,
  verifyZibalPayment,
  findApplicableRule,
  calculateDepositFromRule,
  getEscrowSettings,
  updateEscrowSettings,
  updateEscrowRule,
  parseReleasePolicy,
};
