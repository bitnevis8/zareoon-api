const service = require("./service");
const catalogStore = require("./catalogStore");

function handle(res, fn) {
  return fn()
    .then((data) => res.json({ success: true, data }))
    .catch((error) => {
      const status = error.status || 500;
      if (status >= 500) console.error("exportPathway error:", error);
      res.status(status).json({
        success: false,
        message: error.message || "خطای سرور",
      });
    });
}

const listTemplates = (req, res) =>
  handle(res, async () => {
    await catalogStore.ensureCatalogLoaded();
    return service.listTemplateCatalog();
  });

const getAdminCatalog = (req, res) =>
  handle(res, async () => {
    const catalog = await catalogStore.getCatalog();
    const defaults = catalogStore.defaultCatalog();
    return {
      catalog,
      defaultsMeta: {
        familyCount: Object.keys(defaults.families).length,
        stepCount: Object.keys(defaults.steps).length,
      },
      serviceKeyHints: Object.keys(require("./engine/serviceCategoryMap").SERVICE_MAP),
      phaseOptions: catalog.phases,
    };
  });

const saveAdminCatalog = (req, res) =>
  handle(res, async () => {
    if (!req.body || typeof req.body !== "object") {
      const err = new Error("بدنه درخواست نامعتبر است");
      err.status = 400;
      throw err;
    }
    // accept either full catalog or { catalog: {...} }
    const payload = req.body.catalog && typeof req.body.catalog === "object" ? req.body.catalog : req.body;
    const saved = await catalogStore.saveCatalog(payload);
    return { catalog: saved, message: "کاتالوگ مسیر صادرات ذخیره شد" };
  });

const resetAdminCatalog = (req, res) =>
  handle(res, async () => {
    const catalog = await catalogStore.resetCatalogToDefaults();
    return { catalog, message: "کاتالوگ به پیش‌فرض سیستم بازگردانی شد" };
  });

const preview = (req, res) => handle(res, async () => service.previewPathway(req, req.body));

const list = (req, res) => handle(res, async () => service.listProjects(req));

const getById = (req, res) => handle(res, async () => service.getProjectById(req, req.params.id));

const create = (req, res) =>
  handle(res, async () => {
    const data = await service.createProject(req, req.body);
    return data;
  });

const update = (req, res) => handle(res, async () => service.updateProject(req, req.params.id, req.body));

const remove = (req, res) => handle(res, async () => service.deleteProject(req, req.params.id));

const updateStep = (req, res) =>
  handle(res, async () => service.updateStep(req, req.params.id, req.params.stepId, req.body));

const createServiceRequest = (req, res) =>
  handle(res, async () => service.createServiceRequest(req, req.params.id, req.body));

const addDocument = (req, res) =>
  handle(res, async () => service.addDocument(req, req.params.id, req.body));

module.exports = {
  listTemplates,
  getAdminCatalog,
  saveAdminCatalog,
  resetAdminCatalog,
  preview,
  list,
  getById,
  create,
  update,
  remove,
  updateStep,
  createServiceRequest,
  addDocument,
};
