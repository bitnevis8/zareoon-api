const CustomAttributeValue = require("./model");

const list = async (req, res) => {
  const items = await CustomAttributeValue.findAll();
  res.json({ success: true, data: items });
};

const getById = async (req, res) => {
  const item = await CustomAttributeValue.findByPk(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: item });
};

const create = async (req, res) => {
  const created = await CustomAttributeValue.create(req.body);
  res.status(201).json({ success: true, data: created });
};

const update = async (req, res) => {
  const id = req.params.id;
  const [count] = await CustomAttributeValue.update(req.body, { where: { id } });
  if (!count) return res.status(404).json({ success: false, message: "Not found" });
  const updated = await CustomAttributeValue.findByPk(id);
  res.json({ success: true, data: updated });
};

const remove = async (req, res) => {
  const id = req.params.id;
  const count = await CustomAttributeValue.destroy({ where: { id } });
  if (!count) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true });
};

module.exports = { list, getById, create, update, remove };

