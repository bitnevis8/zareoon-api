const sequelize = require("../../core/database/mysql/connection");
const {
  ExportProject,
  ExportStepInstance,
  ExportDocument,
  ExportServiceRequest,
  ExportProgressLog,
} = require("./model");
const InventoryLot = require("../farmer/inventoryLot/model");
const Product = require("../farmer/product/model");
const { DISCLAIMER_FA, STEP_STATUSES, PROJECT_STATUSES } = require("./constants");
const { buildPathway, recalculateStepStatuses, computeProgress, pickNextAction } = require("./engine/buildPathway");
const {
  resolveCategoryContext,
  listFamiliesPublic,
  ROOT_COVERAGE,
} = require("./engine/resolveFamily");
const { STARTER_PACKS } = require("./engine/templates");
const catalogStore = require("./catalogStore");
const { isAdmin } = require("../../utils/roles");
const {
  ensurePersonalWorkspaceFromReq,
  getWorkspaceContextForUser,
  preferredWorkspaceIdFromReq,
  assertWorkspacePermission,
} = require("../workspace/service");
const { WORKSPACE_PERMISSIONS } = require("../workspace/constants");

function makeReferenceCode() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `XP${y}${m}${d}-${rand}`;
}

async function resolveAccess(req, { requireManage = false } = {}) {
  const user = req.user;
  if (!user) {
    const err = new Error("احراز هویت انجام نشده است");
    err.status = 401;
    throw err;
  }
  const preferred = preferredWorkspaceIdFromReq(req);
  const ensured = await ensurePersonalWorkspaceFromReq(req);
  const ctx = await getWorkspaceContextForUser(user, {
    preferredWorkspaceId: preferred || ensured.workspace.id,
  });
  if (requireManage && !isAdmin(user)) {
    assertWorkspacePermission(ctx.membership, WORKSPACE_PERMISSIONS.MANAGE_PRODUCTS);
  }
  return { user, workspace: ctx.workspace, membership: ctx.membership, admin: isAdmin(user) };
}

async function loadProductContext({ inventoryLotId, productId, workspaceId, user, admin }) {
  let lot = null;
  let product = null;

  if (inventoryLotId) {
    lot = await InventoryLot.findByPk(inventoryLotId, {
      include: [{ model: Product, as: "product" }],
    });
    if (!lot) {
      const err = new Error("موجودی یافت نشد");
      err.status = 404;
      throw err;
    }
    if (!admin && lot.workspaceId && Number(lot.workspaceId) !== Number(workspaceId)) {
      const err = new Error("دسترسی به این موجودی مجاز نیست");
      err.status = 403;
      throw err;
    }
    product = lot.product || (lot.productId ? await Product.findByPk(lot.productId) : null);
  } else if (productId) {
    product = await Product.findByPk(productId);
    if (!product) {
      const err = new Error("محصول یافت نشد");
      err.status = 404;
      throw err;
    }
  }

  const categoryCtx = product
    ? await resolveCategoryContext(product, Product)
    : { rootCategoryId: null, rootSlug: null, l2Id: null, l2Slug: null, slugPath: [] };
  const tradeCompliance = product?.tradeCompliance || {};

  return { lot, product, tradeCompliance, ...categoryCtx };
}

function defaultTitle({ product, lot, destinationCountry, quantity, unit }) {
  const name = lot?.title || product?.name || "کالا";
  const dest = destinationCountry ? ` به ${destinationCountry}` : "";
  const qty = quantity != null && unit ? ` — ${quantity} ${unit}` : "";
  return `صادرات ${name}${dest}${qty}`.slice(0, 250);
}

async function createProject(req, body) {
  const { user, workspace, admin } = await resolveAccess(req, { requireManage: true });
  const {
    inventoryLotId,
    productId,
    title,
    originCountry = "IR",
    originCity,
    destinationCountry,
    destinationCity,
    quantity,
    unit,
    estimatedValue,
    currency = "USD",
    customerType = "unknown",
    packagingType,
    transportMode = "unspecified",
    incoterm = "unspecified",
    paymentMethod = "unspecified",
    plannedShipDate,
    notes,
    hints,
    exportFamily,
    freightSnapshot,
  } = body || {};

  if (!inventoryLotId && !productId) {
    const err = new Error("انتخاب محصول یا موجودی الزامی است");
    err.status = 400;
    throw err;
  }
  if (!destinationCountry?.trim()) {
    const err = new Error("کشور مقصد الزامی است");
    err.status = 400;
    throw err;
  }

  const {
    lot,
    product,
    rootCategoryId,
    rootSlug,
    l2Slug,
    slugPath,
    tradeCompliance,
  } = await loadProductContext({
    inventoryLotId,
    productId,
    workspaceId: workspace.id,
    user,
    admin,
  });

  const resolvedQty = quantity != null && quantity !== "" ? quantity : lot?.quantity ?? null;
  const resolvedUnit = unit || lot?.unit || product?.validUnits?.[0] || null;
  const resolvedPackaging = packagingType || lot?.packagingType || null;
  const resolvedOriginCity = originCity || lot?.locationLabel || null;

  await catalogStore.ensureCatalogLoaded();

  const pathway = buildPathway({
    product: product
      ? {
          id: product.id,
          name: product.name,
          englishName: product.englishName,
          slug: product.slug,
        }
      : { name: lot?.title },
    rootCategoryId,
    l2Slug,
    slugPath,
    tradeCompliance,
    originCountry: originCountry || "IR",
    originCity: resolvedOriginCity,
    destinationCountry: String(destinationCountry).trim().toUpperCase(),
    destinationCity: destinationCity || null,
    quantity: resolvedQty,
    unit: resolvedUnit,
    transportMode,
    incoterm,
    paymentMethod,
    packagingType: resolvedPackaging,
    hints: {
      ...(hints || {}),
      exportFamily: exportFamily || hints?.exportFamily,
      rootSlug,
      l2Slug,
    },
  });

  const projectTitle =
    (title && String(title).trim()) ||
    defaultTitle({
      product,
      lot,
      destinationCountry: pathway.context.destinationCountry,
      quantity: resolvedQty,
      unit: resolvedUnit,
    });

  const productSnapshot = {
    productId: product?.id || null,
    inventoryLotId: lot?.id || null,
    name: lot?.title || product?.name || null,
    englishName: product?.englishName || null,
    unit: resolvedUnit,
    hsCode: lot?.hsCode || null,
    packagingType: resolvedPackaging,
    tradeCompliance,
    rootCategoryId,
    rootSlug,
    l2Slug,
    slugPath,
    coverImageUrl: lot?.coverImageUrl || product?.imageUrl || null,
  };

  const result = await sequelize.transaction(async (t) => {
    const project = await ExportProject.create(
      {
        referenceCode: makeReferenceCode(),
        workspaceId: workspace.id,
        ownerUserId: user.id,
        createdByUserId: user.id,
        title: projectTitle,
        status: "active",
        exportFamily: pathway.exportFamily,
        templateVersion: pathway.templateVersion,
        inventoryLotId: lot?.id || null,
        productId: product?.id || null,
        productSnapshot,
        originCountry: pathway.context.originCountry,
        originCity: pathway.context.originCity,
        destinationCountry: pathway.context.destinationCountry,
        destinationCity: pathway.context.destinationCity,
        quantity: resolvedQty,
        unit: resolvedUnit,
        estimatedValue: estimatedValue != null && estimatedValue !== "" ? estimatedValue : null,
        currency: currency || "USD",
        customerType: customerType || "unknown",
        packagingType: resolvedPackaging,
        transportMode: pathway.context.transportMode,
        incoterm: pathway.context.incoterm,
        paymentMethod: pathway.context.paymentMethod,
        plannedShipDate: plannedShipDate || null,
        notes: notes?.trim() || null,
        flags: pathway.flags,
        matchedRuleIds: pathway.matchedRuleIds,
        pathwaySnapshot: {
          disclaimer: pathway.disclaimer,
          phases: pathway.phases,
          familyTitleFa: pathway.familyTitleFa,
          familyDescriptionFa: pathway.familyDescriptionFa,
          summary: pathway.summary,
          destinationHint: pathway.context.destinationHint,
          matchedBy: pathway.matchedBy || null,
          l2Slug: pathway.context?.l2Slug || null,
          freightSnapshot: freightSnapshot || null,
        },
        progressPercent: 0,
      },
      { transaction: t }
    );

    const stepRows = pathway.steps.map((step) => ({
      projectId: project.id,
      code: step.code,
      title: step.title,
      description: step.description,
      phase: step.phase,
      sortOrder: step.sortOrder,
      required: step.required,
      status: step.status,
      dependencies: step.dependencies,
      documents: step.documents,
      warnings: step.warnings,
      serviceLinks: step.serviceLinks,
      toolLinks: step.toolLinks,
      helpContent: step.helpContent,
      responsibleParty: step.responsibleParty,
      estimatedDuration: step.estimatedDuration,
      requiredOutput: step.requiredOutput,
      templateSnapshot: step,
    }));

    await ExportStepInstance.bulkCreate(stepRows, { transaction: t });

    // Seed pending document requirements from first certifications/customs steps
    const docSeeds = [];
    for (const step of pathway.steps) {
      for (const docTitle of step.documents || []) {
        docSeeds.push({
          projectId: project.id,
          stepInstanceId: null,
          workspaceId: workspace.id,
          uploadedByUserId: user.id,
          title: docTitle,
          docType: docTitle,
          status: "pending",
        });
      }
    }
    // de-dupe by title
    const seen = new Set();
    const uniqueDocs = [];
    for (const d of docSeeds) {
      const key = d.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueDocs.push(d);
    }
    if (uniqueDocs.length) {
      await ExportDocument.bulkCreate(uniqueDocs.slice(0, 40), { transaction: t });
    }

    await ExportProgressLog.create(
      {
        projectId: project.id,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: "project_created",
        toStatus: "active",
        message: "پروژه مسیر صادرات ایجاد شد",
        meta: { exportFamily: pathway.exportFamily, matchedRuleIds: pathway.matchedRuleIds },
      },
      { transaction: t }
    );

    return project;
  });

  return getProjectById(req, result.id);
}

async function listProjects(req) {
  const { workspace, admin, user } = await resolveAccess(req);
  const where = admin && req.query?.all === "1" ? {} : { workspaceId: workspace.id };
  if (req.query?.status) where.status = req.query.status;

  const items = await ExportProject.findAll({
    where,
    order: [["id", "DESC"]],
    attributes: {
      exclude: ["pathwaySnapshot"],
    },
  });

  return {
    items,
    disclaimer: DISCLAIMER_FA,
    meta: { workspaceId: workspace.id, userId: user.id },
  };
}

function serializeProject(project, steps, documents, serviceRequests, logs) {
  const stepPlain = steps.map((s) => (s.toJSON ? s.toJSON() : s));
  const progress = computeProgress(stepPlain);
  const next = pickNextAction(stepPlain);
  const missingDocs = (documents || []).filter((d) => d.status === "pending" || d.status === "rejected");
  const warnings = [];
  for (const s of stepPlain) {
    for (const w of s.warnings || []) warnings.push({ stepCode: s.code, text: w });
  }
  const costs = stepPlain
    .filter((s) => s.costAmount != null)
    .map((s) => ({
      stepCode: s.code,
      title: s.title,
      amount: s.costAmount,
      currency: s.costCurrency || project.currency,
    }));

  const phases = project.pathwaySnapshot?.phases || [];
  const stepsByPhase = phases.map((p) => ({
    ...p,
    steps: stepPlain.filter((s) => s.phase === p.id),
  }));

  return {
    project: {
      ...(project.toJSON ? project.toJSON() : project),
      progressPercent: progress.percent,
      progress,
    },
    steps: stepPlain,
    stepsByPhase,
    documents: documents || [],
    serviceRequests: serviceRequests || [],
    logs: logs || [],
    nextAction: next,
    missingDocuments: missingDocs,
    warnings,
    costs,
    totalCostRecorded: costs.reduce((sum, c) => sum + Number(c.amount || 0), 0),
    disclaimer: project.pathwaySnapshot?.disclaimer || DISCLAIMER_FA,
    providersNeeded: stepPlain
      .filter((s) => ["ready", "optional", "in_progress", "waiting_for_provider"].includes(s.status))
      .flatMap((s) =>
        (s.serviceLinks || []).map((link) => ({
          stepCode: s.code,
          stepTitle: s.title,
          ...link,
        }))
      ),
  };
}

async function getProjectById(req, id) {
  const { workspace, admin } = await resolveAccess(req);
  const project = await ExportProject.findByPk(id);
  if (!project) {
    const err = new Error("پروژه یافت نشد");
    err.status = 404;
    throw err;
  }
  if (!admin && Number(project.workspaceId) !== Number(workspace.id)) {
    const err = new Error("دسترسی مجاز نیست");
    err.status = 403;
    throw err;
  }

  const [steps, documents, serviceRequests, logs] = await Promise.all([
    ExportStepInstance.findAll({ where: { projectId: project.id }, order: [["sort_order", "ASC"]] }),
    ExportDocument.findAll({ where: { projectId: project.id }, order: [["id", "ASC"]] }),
    ExportServiceRequest.findAll({ where: { projectId: project.id }, order: [["id", "DESC"]] }),
    ExportProgressLog.findAll({
      where: { projectId: project.id },
      order: [["id", "DESC"]],
      limit: 50,
    }),
  ]);

  return serializeProject(project, steps, documents, serviceRequests, logs);
}

async function updateProject(req, id, body) {
  const { user, workspace, admin } = await resolveAccess(req, { requireManage: true });
  const project = await ExportProject.findByPk(id);
  if (!project) {
    const err = new Error("پروژه یافت نشد");
    err.status = 404;
    throw err;
  }
  if (!admin && Number(project.workspaceId) !== Number(workspace.id)) {
    const err = new Error("دسترسی مجاز نیست");
    err.status = 403;
    throw err;
  }

  const allowed = [
    "title",
    "originCity",
    "destinationCity",
    "quantity",
    "unit",
    "estimatedValue",
    "currency",
    "customerType",
    "packagingType",
    "transportMode",
    "incoterm",
    "paymentMethod",
    "plannedShipDate",
    "notes",
    "status",
  ];
  for (const key of allowed) {
    if (body[key] !== undefined) project[key] = body[key];
  }
  if (body.freightSnapshot !== undefined) {
    const snap = project.pathwaySnapshot && typeof project.pathwaySnapshot === "object" ? project.pathwaySnapshot : {};
    project.set("pathwaySnapshot", { ...snap, freightSnapshot: body.freightSnapshot });
    if (body.freightSnapshot?.mode && ["sea", "air", "road", "rail", "multimodal"].includes(body.freightSnapshot.mode)) {
      if (!project.transportMode || project.transportMode === "unspecified") {
        project.transportMode = body.freightSnapshot.mode;
      }
    }
  }
  if (body.status && !PROJECT_STATUSES.includes(body.status)) {
    const err = new Error("وضعیت پروژه نامعتبر است");
    err.status = 400;
    throw err;
  }
  if (body.status === "completed") project.completedAt = new Date();
  await project.save();

  await ExportProgressLog.create({
    projectId: project.id,
    workspaceId: workspace.id,
    actorUserId: user.id,
    action: "project_updated",
    message: "اطلاعات پروژه به‌روزرسانی شد",
    meta: { keys: Object.keys(body || {}) },
  });

  return getProjectById(req, id);
}

async function updateStep(req, projectId, stepId, body) {
  const { user, workspace, admin } = await resolveAccess(req, { requireManage: true });
  const project = await ExportProject.findByPk(projectId);
  if (!project) {
    const err = new Error("پروژه یافت نشد");
    err.status = 404;
    throw err;
  }
  if (!admin && Number(project.workspaceId) !== Number(workspace.id)) {
    const err = new Error("دسترسی مجاز نیست");
    err.status = 403;
    throw err;
  }

  const step = await ExportStepInstance.findOne({ where: { id: stepId, projectId } });
  if (!step) {
    const err = new Error("مرحله یافت نشد");
    err.status = 404;
    throw err;
  }

  const fromStatus = step.status;
  if (body.status != null) {
    if (!STEP_STATUSES.includes(body.status)) {
      const err = new Error("وضعیت مرحله نامعتبر است");
      err.status = 400;
      throw err;
    }
    // dependency guard when starting/completing
    if (["ready", "in_progress", "completed"].includes(body.status) || body.status === "optional") {
      const all = await ExportStepInstance.findAll({ where: { projectId } });
      const completed = new Set(
        all.filter((s) => s.status === "completed" || s.status === "not_applicable").map((s) => s.code)
      );
      const deps = step.dependencies || [];
      const depsMet = deps.every((d) => completed.has(d));
      if (!depsMet && body.status !== "not_applicable" && fromStatus === "locked") {
        const err = new Error("پیش‌نیازهای این مرحله هنوز تکمیل نشده است");
        err.status = 400;
        throw err;
      }
    }
    step.status = body.status;
    if (body.status === "in_progress" && !step.startedAt) step.startedAt = new Date();
    if (body.status === "completed") step.completedAt = new Date();
  }

  if (body.notes !== undefined) step.notes = body.notes;
  if (body.costAmount !== undefined) step.costAmount = body.costAmount;
  if (body.costCurrency !== undefined) step.costCurrency = body.costCurrency;
  if (body.providerId !== undefined) step.providerId = body.providerId;
  if (body.providerName !== undefined) step.providerName = body.providerName;
  if (body.toolOutputs !== undefined) {
    step.toolOutputs = { ...(step.toolOutputs || {}), ...body.toolOutputs };
  }

  await step.save();

  // Recalculate sibling statuses for lock/ready
  const allSteps = await ExportStepInstance.findAll({ where: { projectId }, order: [["sort_order", "ASC"]] });
  const recalculated = recalculateStepStatuses(
    allSteps.map((s) => {
      const plain = s.toJSON();
      if (plain.id === step.id) {
        plain.status = step.status;
      }
      return plain;
    })
  );

  await sequelize.transaction(async (t) => {
    for (const row of recalculated) {
      if (row.id === step.id) continue;
      const current = allSteps.find((s) => s.id === row.id);
      if (!current) continue;
      // Only auto-flip between locked/ready/optional
      if (!["locked", "ready", "optional"].includes(current.status) && current.status !== row.status) {
        if (current.status !== "locked" && row.status === "locked") {
          // don't force-lock active work unless deps broken — already handled
        }
      }
      if (["locked", "ready", "optional"].includes(current.status) && current.status !== row.status) {
        current.status = row.status;
        // eslint-disable-next-line no-await-in-loop
        await current.save({ transaction: t });
      }
      if (current.status === "locked" && row.status === "ready") {
        current.status = "ready";
        // eslint-disable-next-line no-await-in-loop
        await current.save({ transaction: t });
      }
    }

    const fresh = await ExportStepInstance.findAll({
      where: { projectId },
      transaction: t,
    });
    const progress = computeProgress(fresh.map((s) => s.toJSON()));
    project.progressPercent = progress.percent;
    const costSum = fresh.reduce((sum, s) => sum + Number(s.costAmount || 0), 0);
    project.totalCostRecorded = costSum;
    if (progress.percent >= 100) {
      project.status = "completed";
      project.completedAt = project.completedAt || new Date();
    }
    await project.save({ transaction: t });

    await ExportProgressLog.create(
      {
        projectId,
        stepInstanceId: step.id,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: "step_updated",
        fromStatus,
        toStatus: step.status,
        message: body.message || null,
        meta: { code: step.code },
      },
      { transaction: t }
    );
  });

  return getProjectById(req, projectId);
}

async function createServiceRequest(req, projectId, body) {
  const { user, workspace, admin } = await resolveAccess(req, { requireManage: true });
  const project = await ExportProject.findByPk(projectId);
  if (!project) {
    const err = new Error("پروژه یافت نشد");
    err.status = 404;
    throw err;
  }
  if (!admin && Number(project.workspaceId) !== Number(workspace.id)) {
    const err = new Error("دسترسی مجاز نیست");
    err.status = 403;
    throw err;
  }

  const step = body.stepInstanceId
    ? await ExportStepInstance.findOne({ where: { id: body.stepInstanceId, projectId } })
    : null;

  const record = await ExportServiceRequest.create({
    projectId,
    stepInstanceId: step?.id || null,
    workspaceId: workspace.id,
    requestedByUserId: user.id,
    serviceKey: body.serviceKey || null,
    categoryId: body.categoryId || null,
    subcategoryId: body.subcategoryId || null,
    providerId: body.providerId || null,
    title: body.title?.trim() || `درخواست قیمت — ${step?.title || project.title}`,
    message: body.message?.trim() || null,
    status: "sent",
    meta: {
      destinationCountry: project.destinationCountry,
      originCountry: project.originCountry,
      exportFamily: project.exportFamily,
      productName: project.productSnapshot?.name,
    },
  });

  if (step && step.status === "ready") {
    step.status = "waiting_for_provider";
    if (!step.startedAt) step.startedAt = new Date();
    await step.save();
  }

  await ExportProgressLog.create({
    projectId,
    stepInstanceId: step?.id || null,
    workspaceId: workspace.id,
    actorUserId: user.id,
    action: "service_request_created",
    message: record.title,
    meta: { serviceRequestId: record.id },
  });

  return getProjectById(req, projectId);
}

async function addDocument(req, projectId, body) {
  const { user, workspace, admin } = await resolveAccess(req, { requireManage: true });
  const project = await ExportProject.findByPk(projectId);
  if (!project) {
    const err = new Error("پروژه یافت نشد");
    err.status = 404;
    throw err;
  }
  if (!admin && Number(project.workspaceId) !== Number(workspace.id)) {
    const err = new Error("دسترسی مجاز نیست");
    err.status = 403;
    throw err;
  }

  const doc = await ExportDocument.create({
    projectId,
    stepInstanceId: body.stepInstanceId || null,
    workspaceId: workspace.id,
    uploadedByUserId: user.id,
    title: body.title?.trim() || "سند",
    docType: body.docType || null,
    fileUrl: body.fileUrl || null,
    fileUploadId: body.fileUploadId || null,
    status: body.fileUrl ? "uploaded" : "pending",
    notes: body.notes || null,
  });

  if (body.stepInstanceId && body.fileUrl) {
    const step = await ExportStepInstance.findOne({
      where: { id: body.stepInstanceId, projectId },
    });
    if (step && ["ready", "optional", "waiting_for_document"].includes(step.status)) {
      step.status = "in_progress";
      if (!step.startedAt) step.startedAt = new Date();
      await step.save();
    }
  }

  await ExportProgressLog.create({
    projectId,
    stepInstanceId: body.stepInstanceId || null,
    workspaceId: workspace.id,
    actorUserId: user.id,
    action: "document_added",
    message: doc.title,
    meta: { documentId: doc.id },
  });

  return getProjectById(req, projectId);
}

async function previewPathway(req, body) {
  await resolveAccess(req);
  const { inventoryLotId, productId } = body || {};
  const { workspace, admin, user } = await resolveAccess(req);
  const {
    lot,
    product,
    rootCategoryId,
    rootSlug,
    l2Slug,
    slugPath,
    tradeCompliance,
  } = await loadProductContext({
    inventoryLotId,
    productId,
    workspaceId: workspace.id,
    user,
    admin,
  });

  await catalogStore.ensureCatalogLoaded();

  const pathway = buildPathway({
    product: product
      ? { id: product.id, name: product.name, englishName: product.englishName, slug: product.slug }
      : { name: lot?.title },
    rootCategoryId,
    l2Slug,
    slugPath,
    tradeCompliance,
    originCountry: body.originCountry || "IR",
    originCity: body.originCity || lot?.locationLabel,
    destinationCountry: body.destinationCountry,
    destinationCity: body.destinationCity,
    quantity: body.quantity ?? lot?.quantity,
    unit: body.unit || lot?.unit,
    transportMode: body.transportMode || "unspecified",
    incoterm: body.incoterm || "unspecified",
    paymentMethod: body.paymentMethod || "unspecified",
    packagingType: body.packagingType || lot?.packagingType,
    hints: {
      ...(body.hints || {}),
      exportFamily: body.exportFamily || body.hints?.exportFamily,
      rootSlug,
      l2Slug,
    },
  });

  return {
    pathway,
    productSnapshot: {
      lotId: lot?.id,
      productId: product?.id,
      name: lot?.title || product?.name,
      rootCategoryId,
      rootSlug,
      l2Slug,
    },
  };
}

async function listTemplateCatalog() {
  const catalog = await catalogStore.ensureCatalogLoaded();
  return {
    version: require("./constants").TEMPLATE_VERSION,
    catalogVersion: catalog.version,
    updatedAt: catalog.updatedAt,
    disclaimer: DISCLAIMER_FA,
    starterPacks: STARTER_PACKS,
    families: listFamiliesPublic(),
    rootCoverage: catalog.rootCoverage || ROOT_COVERAGE,
    noteFa:
      "قالب‌ها بر اساس «خانواده صادراتی» هستند نه تک‌تک زیردسته‌ها. هر ریشه اصلی کاتالوگ به یک خانواده پیش‌فرض وصل است؛ زیردسته‌های مهم (مثل میوه تازه یا کود) خانواده را دقیق‌تر می‌کنند. ادمین می‌تواند خانواده‌ها و مراحل را از تنظیمات سایت ویرایش کند.",
  };
}

async function deleteProject(req, id) {
  const { workspace, admin } = await resolveAccess(req, { requireManage: true });
  const project = await ExportProject.findByPk(id);
  if (!project) {
    const err = new Error("پروژه یافت نشد");
    err.status = 404;
    throw err;
  }
  if (!admin && Number(project.workspaceId) !== Number(workspace.id)) {
    const err = new Error("دسترسی مجاز نیست");
    err.status = 403;
    throw err;
  }
  await project.update({ status: "cancelled" });
  return { success: true };
}

module.exports = {
  createProject,
  listProjects,
  getProjectById,
  updateProject,
  updateStep,
  createServiceRequest,
  addDocument,
  previewPathway,
  listTemplateCatalog,
  deleteProject,
  buildPathway,
};
