const OrderRequestItem = require('./model');

// Update status of a specific order request item
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const item = await OrderRequestItem.findByPk(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'آیتم درخواست سفارش یافت نشد' });
    }

    await item.update({
      status: status || 'pending',
      statusNotes: notes || item.statusNotes
    });

    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error updating order request item status:', error);
    res.status(500).json({ success: false, message: 'خطا در به‌روزرسانی وضعیت آیتم درخواست سفارش' });
  }
};

module.exports = { updateStatus };
