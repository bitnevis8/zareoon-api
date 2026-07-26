const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Conversation = require("./conversation/model");
const Message = require("./message/model");
const User = require("../user/user/model");
const File = require("../fileUpload/model");
const ftpService = require("../fileUpload/services/ftpService");
const { optimizeMessageImage } = require("./services/imageOptimizer");
const sequelize = require("../../core/database/mysql/connection");

const USER_ATTRS = ["id", "firstName", "lastName", "username", "mobile", "nationalId", "avatar"];

function currentUserId(req) {
  return req.user?.userId || req.user?.id;
}

function normalizeParticipants(userId, recipientId) {
  const a = Number(userId);
  const b = Number(recipientId);
  return a < b ? [a, b] : [b, a];
}

/** تبدیل ارقام فارسی/عربی به انگلیسی */
function toEnglishDigits(str) {
  return String(str || "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function formatUser(user) {
  if (!user) return null;
  const u = user.get ? user.get({ plain: true }) : user;
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    mobile: u.mobile,
    nationalId: u.nationalId || null,
    avatar: u.avatar,
    displayName: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || `کاربر ${u.id}`,
  };
}

function getOtherUser(conversation, userId) {
  if (conversation.participantOneId === userId) return conversation.participantTwo;
  return conversation.participantOne;
}

async function assertParticipant(conversationId, userId) {
  const conversation = await Conversation.findByPk(conversationId, {
    include: [
      { model: User, as: "participantOne", attributes: USER_ATTRS },
      { model: User, as: "participantTwo", attributes: USER_ATTRS },
    ],
  });
  if (!conversation) return null;
  if (conversation.participantOneId !== userId && conversation.participantTwoId !== userId) {
    return false;
  }
  return conversation;
}

function formatMessage(msg) {
  const m = msg.get ? msg.get({ plain: true }) : msg;
  const attachment = m.attachment
    ? {
        id: m.attachment.id,
        downloadUrl: m.attachment.downloadUrl,
        mimeType: m.attachment.mimeType,
        size: m.attachment.size,
        originalName: m.attachment.originalName,
      }
    : null;
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    body: m.body,
    messageType: m.messageType,
    attachment,
    readAt: m.readAt,
    createdAt: m.createdAt,
    sender: m.sender ? formatUser(m.sender) : null,
  };
}

async function getUnreadMap(conversationIds, userId) {
  if (!conversationIds.length) return {};
  const rows = await Message.findAll({
    attributes: ["conversationId", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
    where: {
      conversationId: { [Op.in]: conversationIds },
      senderId: { [Op.ne]: userId },
      readAt: null,
    },
    group: ["conversationId"],
    raw: true,
  });
  return Object.fromEntries(rows.map((r) => [r.conversationId, Number(r.count)]));
}

const listConversations = async (req, res) => {
  try {
    const userId = currentUserId(req);
    const conversations = await Conversation.findAll({
      where: {
        [Op.or]: [{ participantOneId: userId }, { participantTwoId: userId }],
      },
      include: [
        { model: User, as: "participantOne", attributes: USER_ATTRS },
        { model: User, as: "participantTwo", attributes: USER_ATTRS },
      ],
      order: [["updatedAt", "DESC"]],
    });

    const unreadMap = await getUnreadMap(
      conversations.map((c) => c.id),
      userId
    );

    const data = conversations.map((c) => {
      const other = getOtherUser(c, userId);
      return {
        id: c.id,
        otherUser: formatUser(other),
        lastMessage: {
          preview: c.lastMessagePreview,
          type: c.lastMessageType,
          at: c.lastMessageAt,
        },
        unreadCount: unreadMap[c.id] || 0,
        updatedAt: c.updatedAt,
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error("messaging listConversations:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت گفتگوها" });
  }
};

const createConversation = async (req, res) => {
  try {
    const userId = currentUserId(req);
    const recipientId = Number(req.body?.recipientId);

    if (!recipientId || recipientId === userId) {
      return res.status(400).json({ success: false, message: "گیرنده نامعتبر است" });
    }

    const recipient = await User.findByPk(recipientId, { attributes: USER_ATTRS });
    if (!recipient || !recipient.isActive) {
      return res.status(404).json({ success: false, message: "کاربر یافت نشد" });
    }

    const [one, two] = normalizeParticipants(userId, recipientId);
    let conversation = await Conversation.findOne({
      where: { participantOneId: one, participantTwoId: two },
      include: [
        { model: User, as: "participantOne", attributes: USER_ATTRS },
        { model: User, as: "participantTwo", attributes: USER_ATTRS },
      ],
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participantOneId: one,
        participantTwoId: two,
      });
      await conversation.reload({
        include: [
          { model: User, as: "participantOne", attributes: USER_ATTRS },
          { model: User, as: "participantTwo", attributes: USER_ATTRS },
        ],
      });
    }

    const other = getOtherUser(conversation, userId);
    res.status(201).json({
      success: true,
      data: {
        id: conversation.id,
        otherUser: formatUser(other),
        lastMessage: null,
        unreadCount: 0,
      },
    });
  } catch (error) {
    console.error("messaging createConversation:", error);
    res.status(500).json({ success: false, message: "خطا در ایجاد گفتگو" });
  }
};

const getConversation = async (req, res) => {
  try {
    const userId = currentUserId(req);
    const conversation = await assertParticipant(req.params.id, userId);
    if (conversation === null) {
      return res.status(404).json({ success: false, message: "گفتگو یافت نشد" });
    }
    if (conversation === false) {
      return res.status(403).json({ success: false, message: "دسترسی مجاز نیست" });
    }

    const other = getOtherUser(conversation, userId);
    const unreadMap = await getUnreadMap([conversation.id], userId);

    res.json({
      success: true,
      data: {
        id: conversation.id,
        otherUser: formatUser(other),
        unreadCount: unreadMap[conversation.id] || 0,
      },
    });
  } catch (error) {
    console.error("messaging getConversation:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت گفتگو" });
  }
};

const getMessages = async (req, res) => {
  try {
    const userId = currentUserId(req);
    const conversation = await assertParticipant(req.params.id, userId);
    if (conversation === null) {
      return res.status(404).json({ success: false, message: "گفتگو یافت نشد" });
    }
    if (conversation === false) {
      return res.status(403).json({ success: false, message: "دسترسی مجاز نیست" });
    }

    const limit = Math.min(Number(req.query.limit) || 40, 100);
    const before = req.query.before ? Number(req.query.before) : null;
    const after = req.query.after ? Number(req.query.after) : null;

    const where = { conversationId: conversation.id };
    if (before) where.id = { [Op.lt]: before };
    if (after) where.id = { [Op.gt]: after };

    const order = after ? [["id", "ASC"]] : [["id", "DESC"]];

    const messages = await Message.findAll({
      where,
      include: [
        { model: User, as: "sender", attributes: USER_ATTRS },
        { model: File, as: "attachment" },
      ],
      order,
      limit: after ? 50 : limit,
    });

    const list = after ? messages : messages.reverse();

    res.json({
      success: true,
      data: list.map(formatMessage),
      hasMore: !after && messages.length === limit,
    });
  } catch (error) {
    console.error("messaging getMessages:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت پیام‌ها" });
  }
};

const sendTextMessage = async (req, res) => {
  try {
    const userId = currentUserId(req);
    const conversation = await assertParticipant(req.params.id, userId);
    if (conversation === null) {
      return res.status(404).json({ success: false, message: "گفتگو یافت نشد" });
    }
    if (conversation === false) {
      return res.status(403).json({ success: false, message: "دسترسی مجاز نیست" });
    }

    const body = (req.body?.body || "").trim();
    if (!body) {
      return res.status(400).json({ success: false, message: "متن پیام خالی است" });
    }
    if (body.length > 5000) {
      return res.status(400).json({ success: false, message: "پیام بیش از حد طولانی است" });
    }

    const preview = body.length > 120 ? `${body.slice(0, 120)}…` : body;
    const message = await Message.create({
      conversationId: conversation.id,
      senderId: userId,
      body,
      messageType: "text",
    });

    await conversation.update({
      lastMessageAt: new Date(),
      lastMessagePreview: preview,
      lastMessageType: "text",
    });

    await message.reload({
      include: [
        { model: User, as: "sender", attributes: USER_ATTRS },
        { model: File, as: "attachment" },
      ],
    });

    res.status(201).json({ success: true, data: formatMessage(message) });
  } catch (error) {
    console.error("messaging sendTextMessage:", error);
    res.status(500).json({ success: false, message: "خطا در ارسال پیام" });
  }
};

const sendImageMessage = async (req, res) => {
  let optimizedPath = null;
  try {
    const userId = currentUserId(req);
    const conversation = await assertParticipant(req.params.id, userId);
    if (conversation === null) {
      return res.status(404).json({ success: false, message: "گفتگو یافت نشد" });
    }
    if (conversation === false) {
      return res.status(403).json({ success: false, message: "دسترسی مجاز نیست" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "تصویر ارسال نشده است" });
    }

    const caption = (req.body?.body || "").trim().slice(0, 500);

    const { outputPath, mimeType, size } = await optimizeMessageImage(req.file.path);
    optimizedPath = outputPath;

    const uniqueSuffix = crypto.randomBytes(8).toString("hex");
    const fileName = `msg-${Date.now()}-${uniqueSuffix}.jpg`;

    const { relativePath } = await ftpService.uploadFile(
      outputPath,
      "messages",
      fileName,
      "images"
    );

    const file = await File.create({
      fileName,
      originalName: req.file.originalname,
      path: relativePath,
      mimeType,
      size,
      module: "messages",
      fileType: "images",
      entityId: null,
      uploaderId: userId,
    });

    const message = await Message.create({
      conversationId: conversation.id,
      senderId: userId,
      body: caption || null,
      messageType: "image",
      fileId: file.id,
    });

    await file.update({ entityId: message.id });

    await conversation.update({
      lastMessageAt: new Date(),
      lastMessagePreview: caption || "📷 تصویر",
      lastMessageType: "image",
    });

    await message.reload({
      include: [
        { model: User, as: "sender", attributes: USER_ATTRS },
        { model: File, as: "attachment" },
      ],
    });

    res.status(201).json({ success: true, data: formatMessage(message) });
  } catch (error) {
    console.error("messaging sendImageMessage:", error);
    res.status(500).json({ success: false, message: "خطا در ارسال تصویر" });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (optimizedPath && fs.existsSync(optimizedPath)) fs.unlinkSync(optimizedPath);
  }
};

const markConversationRead = async (req, res) => {
  try {
    const userId = currentUserId(req);
    const conversation = await assertParticipant(req.params.id, userId);
    if (conversation === null) {
      return res.status(404).json({ success: false, message: "گفتگو یافت نشد" });
    }
    if (conversation === false) {
      return res.status(403).json({ success: false, message: "دسترسی مجاز نیست" });
    }

    const now = new Date();
    await Message.update(
      { readAt: now },
      {
        where: {
          conversationId: conversation.id,
          senderId: { [Op.ne]: userId },
          readAt: null,
        },
      }
    );

    res.json({ success: true, message: "پیام‌ها خوانده شد" });
  } catch (error) {
    console.error("messaging markConversationRead:", error);
    res.status(500).json({ success: false, message: "خطا در به‌روزرسانی وضعیت خوانده‌شدن" });
  }
};

const unreadCount = async (req, res) => {
  try {
    const userId = currentUserId(req);
    const conversations = await Conversation.findAll({
      where: {
        [Op.or]: [{ participantOneId: userId }, { participantTwoId: userId }],
      },
      attributes: ["id"],
    });
    const ids = conversations.map((c) => c.id);
    if (!ids.length) {
      return res.json({ success: true, data: { total: 0 } });
    }

    const total = await Message.count({
      where: {
        conversationId: { [Op.in]: ids },
        senderId: { [Op.ne]: userId },
        readAt: null,
      },
    });

    res.json({ success: true, data: { total } });
  } catch (error) {
    console.error("messaging unreadCount:", error);
    res.status(500).json({ success: false, message: "خطا در شمارش پیام‌های خوانده‌نشده" });
  }
};

const searchUsers = async (req, res) => {
  try {
    const userId = currentUserId(req);
    const qRaw = (req.query.q || "").trim();
    const q = toEnglishDigits(qRaw).trim();
    const limit = Math.min(Number(req.query.limit) || 15, 30);

    const where = {
      id: { [Op.ne]: userId },
      isActive: true,
    };

    if (q) {
      const compact = q.replace(/[\s-]/g, "");
      const digitsOnly = compact.replace(/\D/g, "");
      const isDigitsOnly = /^\d+$/.test(compact);
      const looksLikeNationalId = isDigitsOnly && digitsOnly.length >= 8 && digitsOnly.length <= 10;
      const looksLikeMobile =
        /^09\d{9}$/.test(digitsOnly) ||
        (isDigitsOnly && digitsOnly.length >= 10 && digitsOnly.length <= 11 && digitsOnly.startsWith("09"));

      // کد ملی / موبایل کامل حتی با الگوی رقم — بدون حداقل ۲ حرف نام
      const allowIdentifierSearch = looksLikeNationalId || looksLikeMobile;
      if (q.length < 2 && !allowIdentifierSearch) {
        return res.json({ success: true, data: [] });
      }

      const or = [];

      // nationalId / mobile / username — تطبیق دقیق یا نرمال‌شده
      or.push({ username: q });
      or.push({ username: compact });
      if (digitsOnly) {
        or.push({ nationalId: digitsOnly });
        or.push({ nationalId: compact });
        or.push({ mobile: digitsOnly });
        or.push({ mobile: compact });
        if (digitsOnly.length === 10 && digitsOnly.startsWith("9")) {
          or.push({ mobile: `0${digitsOnly}` });
        }
      }

      // نام: حداقل ۲ کاراکتر (برای کوئری غیررقم‌محض شناسه)
      if (q.length >= 2 && !allowIdentifierSearch) {
        const { fulltextWhere, likeOrWhere } = require("../../utils/mysqlFulltext");
        const ft = fulltextWhere(["first_name", "last_name"], q);
        const like = likeOrWhere(["firstName", "lastName", "username"], q);
        if (ft) or.push(ft);
        if (like?.[Op.or]) or.push(...like[Op.or]);
      } else if (allowIdentifierSearch && q.length >= 2 && !isDigitsOnly) {
        const { likeOrWhere } = require("../../utils/mysqlFulltext");
        const like = likeOrWhere(["username"], q);
        if (like?.[Op.or]) or.push(...like[Op.or]);
      }

      where[Op.or] = or;
    }

    const users = await User.findAll({
      where,
      attributes: USER_ATTRS,
      order: [["firstName", "ASC"]],
      limit,
    });

    res.json({ success: true, data: users.map(formatUser) });
  } catch (error) {
    console.error("messaging searchUsers:", error);
    res.status(500).json({ success: false, message: "خطا در جستجوی کاربران" });
  }
};

module.exports = {
  listConversations,
  createConversation,
  getConversation,
  getMessages,
  sendTextMessage,
  sendImageMessage,
  markConversationRead,
  unreadCount,
  searchUsers,
};
