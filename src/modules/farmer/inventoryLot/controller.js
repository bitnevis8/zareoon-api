const { Op } = require("sequelize");
const InventoryLot = require("./model");
const User = require("../../user/user/model");
const TransactionHistory = require("../transactionHistory/model");
const CustomAttributeValue = require("../customAttributeValue/model");
const CustomAttributeDefinition = require("../customAttributeDefinition/model");

const list = async (req, res) => {
  const items = await InventoryLot.findAll({
    include: [
      {
        model: CustomAttributeValue,
        as: "attributes",
        include: [{ model: CustomAttributeDefinition, as: "definition", attributes: ["id", "name", "type", "options"] }]
      },
      { model: User, as: "farmer", attributes: ["id","firstName","lastName","username","mobile"] }
    ],
    order: [["id", "ASC"]]
  });
  res.json({ success: true, data: items });
};

const getById = async (req, res) => {
  const item = await InventoryLot.findByPk(req.params.id, {
    include: [
      {
        model: CustomAttributeValue,
        as: "attributes",
        include: [{ model: CustomAttributeDefinition, as: "definition", attributes: ["id", "name", "type", "options"] }]
      },
      { model: User, as: "farmer", attributes: ["id","firstName","lastName","username","mobile"] }
    ]
  });
  if (!item) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: item });
};

const create = async (req, res) => {
  const created = await InventoryLot.create(req.body);
  res.status(201).json({ success: true, data: created });
};

const update = async (req, res) => {
  const id = req.params.id;
  const [count] = await InventoryLot.update(req.body, { where: { id } });
  if (!count) return res.status(404).json({ success: false, message: "Not found" });
  const updated = await InventoryLot.findByPk(id);
  res.json({ success: true, data: updated });
};

const remove = async (req, res) => {
  const id = req.params.id;
  const count = await InventoryLot.destroy({ where: { id } });
  if (!count) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true });
};

const reserve = async (req, res) => {
  const id = req.params.id;
  const { quantity } = req.body;
  const lot = await InventoryLot.findByPk(id);
  if (!lot) return res.status(404).json({ success: false, message: "Not found" });

  const available = parseFloat(lot.totalQuantity) - parseFloat(lot.reservedQuantity || 0);
  if (quantity > available) {
    return res.status(400).json({ success: false, message: "Insufficient inventory" });
  }

  lot.reservedQuantity = parseFloat(lot.reservedQuantity || 0) + parseFloat(quantity);
  lot.status = "reserved";
  await lot.save();

  await TransactionHistory.create({
    changeType: "reserve",
    inventoryLotId: lot.id,
    deltaQuantity: quantity,
    actorUserId: req.user?.id || 0
  });

  res.json({ success: true, data: lot });
};

const release = async (req, res) => {
  const id = req.params.id;
  const { quantity } = req.body;
  const lot = await InventoryLot.findByPk(id);
  if (!lot) return res.status(404).json({ success: false, message: "Not found" });

  const currentReserved = parseFloat(lot.reservedQuantity || 0);
  if (quantity > currentReserved) {
    return res.status(400).json({ success: false, message: "Release exceeds reserved" });
  }

  lot.reservedQuantity = currentReserved - parseFloat(quantity);
  if (lot.reservedQuantity === 0) {
    lot.status = "harvested";
  }
  await lot.save();

  await TransactionHistory.create({
    changeType: "release",
    inventoryLotId: lot.id,
    deltaQuantity: -Math.abs(quantity),
    actorUserId: req.user?.id || 0
  });

  res.json({ success: true, data: lot });
};

module.exports = { list, getById, create, update, remove, reserve, release };

