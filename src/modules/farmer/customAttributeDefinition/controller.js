const CustomAttributeDefinition = require("./model");

const list = async (req, res) => {
  const where = {};
  if (req.query.categoryId !== undefined) {
    const cid = Number(req.query.categoryId);
    if (Number.isFinite(cid)) where.categoryId = cid;
  }
  const items = await CustomAttributeDefinition.findAll({ where, order: [["id", "ASC"]] });
  res.json({ success: true, data: items });
};

const getById = async (req, res) => {
  const item = await CustomAttributeDefinition.findByPk(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: item });
};

const create = async (req, res) => {
  const created = await CustomAttributeDefinition.create(req.body);
  res.status(201).json({ success: true, data: created });
};

const update = async (req, res) => {
  const id = req.params.id;
  const [count] = await CustomAttributeDefinition.update(req.body, { where: { id } });
  if (!count) return res.status(404).json({ success: false, message: "Not found" });
  const updated = await CustomAttributeDefinition.findByPk(id);
  res.json({ success: true, data: updated });
};

const remove = async (req, res) => {
  const id = req.params.id;
  const count = await CustomAttributeDefinition.destroy({ where: { id } });
  if (!count) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true });
};

module.exports = { list, getById, create, update, remove };

