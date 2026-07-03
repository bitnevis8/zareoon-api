const { Op } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");
const User = require("../user/user/model");
const Role = require("../user/role/model");
const Account = require("../account/model");
const SupplierPost = require("./post/model");
const { countRawHashtags } = require("../../utils/hashtags");
const {
  parsePostImageUrls,
  parsePostHashtags,
  formatPostRecord,
  MAX_POST_IMAGES,
  MAX_POST_HASHTAGS,
} = require("./post/postUtils");
const SupplierFollow = require("./follow/model");
const SupplierReview = require("./review/model");
const InventoryLot = require("../farmer/inventoryLot/model");
const Product = require("../farmer/product/model");
const Order = require("../farmer/order/model");
const OrderItem = require("../farmer/orderItem/model");
const { isSupplier, isAdmin } = require("../../utils/roles");
const { slugify, ensureUniqueSlug, generateProfileSlug } = require("./utils");
const {
  ENTITY_TYPE_LABELS,
  ENTITY_FIELD_SCHEMAS,
  getSchemaForEntity,
} = require("../account/entitySchemas");
const { ENTITY_NAV_BADGES } = require("../account/navLabels");
const File = require("../fileUpload/model");
const { formatHashtags } = require("../../utils/hashtags");
const {
  DEFAULT_BUSINESS_HOURS,
  getProfileFieldsMap,
  saveProfileFields,
  getOrCreateAccountForUser,
  findAccountBySlugOrId,
  findPublicAccountBySlugOrId,
  findSupplierBySlugOrId,
  formatAccountPublic,
} = require("../account/profileService");

const COMPLETED_STATUSES = ["completed", "delivered"];
const REVIEWER_ATTRS = ["id", "firstName", "lastName", "avatar"];

function currentUserId(req) {
  return req.user?.userId || req.user?.id;
}

async function resolveUserForPublicProfile(userId) {
  const user = await User.findByPk(userId, {
    include: [{ model: Role, as: "userRoles", through: { attributes: [] } }],
  });
  if (!user || !user.isActive) return null;
  const roles = (user.userRoles || []).map((r) => ({ name: r.name, nameEn: r.nameEn }));
  if (isSupplier({ roles }) || isAdmin({ roles })) return user;
  return null;
}

async function userIsSupplier(userId) {
  const user = await User.findByPk(userId, {
    include: [{ model: Role, as: "userRoles", through: { attributes: [] } }],
  });
  if (!user || !user.isActive) return null;
  const roles = (user.userRoles || []).map((r) => ({ name: r.name, nameEn: r.nameEn }));
  return isSupplier({ roles }) ? user : null;
}

async function hasTradedWith(customerId, supplierId) {
  const direct = await Order.findOne({
    where: {
      customerId,
      supplierId,
      status: { [Op.in]: COMPLETED_STATUSES },
    },
  });
  if (direct) return direct.id;

  const item = await OrderItem.findOne({
    include: [
      {
        model: Order,
        as: "order",
        where: { customerId, status: { [Op.in]: COMPLETED_STATUSES } },
        attributes: ["id"],
      },
      {
        model: InventoryLot,
        as: "inventoryLot",
        where: { farmerId: supplierId },
        attributes: ["id"],
      },
    ],
  });
  return item?.order?.id || item?.orderId || null;
}

async function getProfileStats(supplierId) {
  const [followerCount, productCount, reviewStats, dealCount] = await Promise.all([
    SupplierFollow.count({ where: { followingId: supplierId } }),
    (async () => {
      const lots = await InventoryLot.findAll({
        where: { farmerId: supplierId, status: "harvested" },
        attributes: ["totalQuantity", "reservedQuantity"],
      });
      return lots.filter((l) => {
        const avail = parseFloat(l.totalQuantity || 0) - parseFloat(l.reservedQuantity || 0);
        return avail > 0;
      }).length;
    })(),
    SupplierReview.findOne({
      attributes: [
        [sequelize.fn("AVG", sequelize.col("rating")), "avg"],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: { supplierId },
      raw: true,
    }),
    Order.count({
      where: { supplierId, status: { [Op.in]: COMPLETED_STATUSES } },
    }),
  ]);

  return {
    followerCount,
    productCount,
    reviewAverage: reviewStats?.avg ? Math.round(Number(reviewStats.avg) * 10) / 10 : null,
    reviewCount: Number(reviewStats?.count) || 0,
    completedDeals: dealCount,
    tradeScore: reviewStats?.avg ? Math.round(Number(reviewStats.avg) * 10) / 10 : null,
  };
}

const getEntitySchemas = async (_req, res) => {
  res.json({
    success: true,
    data: {
      entityTypes: Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => ({ value, label })),
      schemas: ENTITY_FIELD_SCHEMAS,
    },
  });
};

async function attachLotCoverImages(lots) {
  const arr = Array.isArray(lots) ? lots : [lots];
  const plain = arr.map((l) => (l.toJSON ? l.toJSON() : { ...l }));
  const ids = plain.map((l) => l.id).filter(Boolean);
  if (!ids.length) return plain;

  const files = await File.findAll({
    where: {
      module: "inventory",
      entityId: ids,
      mimeType: { [Op.like]: "image/%" },
    },
    order: [["createdAt", "DESC"]],
  });

  const coverMap = {};
  for (const f of files) {
    if (!coverMap[f.entityId]) coverMap[f.entityId] = f.downloadUrl;
  }

  return plain.map((l) => ({
    ...l,
    coverImageUrl: coverMap[l.id] || null,
  }));
}

function mapActivePublicProducts(lots) {
  return lots
    .map((lot) => {
      const total = parseFloat(lot.totalQuantity || 0);
      const reserved = parseFloat(lot.reservedQuantity || 0);
      const available = Math.max(0, total - reserved);
      return {
        id: lot.id,
        productId: lot.productId,
        name: lot.product?.name,
        imageUrl: lot.product?.imageUrl,
        coverImageUrl: lot.coverImageUrl,
        qualityGrade: lot.qualityGrade,
        unit: lot.unit,
        price: lot.price,
        tieredPricing: lot.tieredPricing,
        totalQuantity: lot.totalQuantity,
        reservedQuantity: lot.reservedQuantity,
        availableQuantity: available,
        hashtags: formatHashtags(lot.hashtags),
      };
    })
    .filter((p) => p.availableQuantity > 0);
}

const getPublicProfile = async (req, res) => {
  try {
    const found = await findPublicAccountBySlugOrId(req.params.slug);
    const viewerId = req.user?.userId || req.user?.id;

    if (!found) {
      return res.status(404).json({ success: false, message: "صفحه تأمین‌کننده یافت نشد" });
    }

    let { account, user } = found;

    if (account.isPublic === false && viewerId !== user.id) {
      return res.status(404).json({ success: false, message: "این پروفایل عمومی نیست" });
    }

    account = await getOrCreateAccountForUser(user);

    const profile = await formatAccountPublic(account, user);
    profile.entityTypeLabel = ENTITY_TYPE_LABELS[account.entityType] || account.entityType;
    profile.navBadge = ENTITY_NAV_BADGES[account.entityType] || "یوزر";
    profile.fieldSchema = getSchemaForEntity(account.entityType);

    const stats = await getProfileStats(user.id);
    let isFollowing = false;
    let canReview = false;
    let myReview = null;

    if (viewerId) {
      isFollowing = !!(await SupplierFollow.findOne({
        where: { followerId: viewerId, followingId: user.id },
      }));
      if (viewerId !== user.id) {
        canReview = !!(await hasTradedWith(viewerId, user.id));
        myReview = await SupplierReview.findOne({
          where: { supplierId: user.id, reviewerId: viewerId },
          attributes: ["id", "rating", "comment", "createdAt"],
        });
      }
    }

    const lotsRaw = await InventoryLot.findAll({
      where: {
        farmerId: user.id,
        status: "harvested",
      },
      include: [{ model: Product, as: "product", attributes: ["id", "name", "imageUrl"] }],
      limit: 48,
      order: [["updatedAt", "DESC"]],
    });
    const lotsWithCovers = await attachLotCoverImages(lotsRaw);
    const activeProducts = mapActivePublicProducts(lotsWithCovers);

    res.json({
      success: true,
      data: {
        profile,
        stats,
        isFollowing,
        canReview,
        myReview,
        isOwner: viewerId === user.id,
        products: activeProducts,
      },
    });
  } catch (error) {
    console.error("getPublicProfile:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت پروفایل" });
  }
};

const getPosts = async (req, res) => {
  try {
    const found = await findPublicAccountBySlugOrId(req.params.slug);
    if (!found) return res.status(404).json({ success: false, message: "یافت نشد" });

    const posts = await SupplierPost.findAll({
      where: { userId: found.user.id },
      order: [["createdAt", "DESC"]],
      limit: Math.min(Number(req.query.limit) || 30, 50),
    });

    res.json({ success: true, data: posts.map(formatPostRecord) });
  } catch (error) {
    console.error("getPosts:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت پست‌ها" });
  }
};

const getReviews = async (req, res) => {
  try {
    const found = await findPublicAccountBySlugOrId(req.params.slug);
    if (!found) return res.status(404).json({ success: false, message: "یافت نشد" });

    const reviews = await SupplierReview.findAll({
      where: { supplierId: found.user.id },
      include: [{ model: User, as: "reviewer", attributes: REVIEWER_ATTRS }],
      order: [["createdAt", "DESC"]],
      limit: 50,
    });

    res.json({
      success: true,
      data: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        reviewer: r.reviewer
          ? {
              id: r.reviewer.id,
              displayName: [r.reviewer.firstName, r.reviewer.lastName].filter(Boolean).join(" "),
              avatar: r.reviewer.avatar,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("getReviews:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت نظرات" });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const { jwtVerify } = require("jose");
    const config = require("config");
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(config.get("JWT_SECRET")));
      req.user = payload;
      req.user.userId = payload.userId || payload.id;
    }
  } catch {
    /* guest */
  }
  next();
};

const updateMyProfile = async (req, res) => {
  try {
    const userId = currentUserId(req);
    const owner = await resolveUserForPublicProfile(userId);
    if (!owner) {
      return res.status(403).json({ success: false, message: "فقط تأمین‌کنندگان می‌توانند پروفایل عمومی ویرایش کنند" });
    }

    const body = req.body || {};
    const account = await getOrCreateAccountForUser(owner, {
      entityType: body.entityType,
    });

    const accountUpdates = {};
    if (body.entityType && Account.rawAttributes.entityType.values.includes(body.entityType)) {
      accountUpdates.entityType = body.entityType;
    }
    if (body.headline !== undefined) accountUpdates.headline = String(body.headline).slice(0, 200);
    if (body.bio !== undefined) accountUpdates.bio = String(body.bio).slice(0, 5000);
    if (body.publicPhone !== undefined) accountUpdates.publicPhone = String(body.publicPhone).slice(0, 30);
    if (body.coverImage !== undefined) accountUpdates.coverImage = body.coverImage;
    if (body.businessHours !== undefined) accountUpdates.businessHours = body.businessHours;
    if (body.country !== undefined) accountUpdates.country = String(body.country).slice(0, 100);
    if (body.isPublic !== undefined) accountUpdates.isPublic = !!body.isPublic;
    if (body.isProfilePublic !== undefined) accountUpdates.isPublic = !!body.isProfilePublic;

    if (body.profileSlug !== undefined) {
      const clean = slugify(body.profileSlug);
      if (clean.length < 3) {
        return res.status(400).json({ success: false, message: "نام کاربری صفحه باید حداقل ۳ کاراکتر باشد" });
      }
      accountUpdates.profileSlug = await ensureUniqueSlug(clean, account.id);
    }

    if (Object.keys(accountUpdates).length) {
      await account.update(accountUpdates);
    }

    const entityType = accountUpdates.entityType || account.entityType;
    if (body.profileFields && typeof body.profileFields === "object") {
      await saveProfileFields(account.id, entityType, body.profileFields);
    }

    await account.reload();
    const profile = await formatAccountPublic(account, owner);
    profile.entityTypeLabel = ENTITY_TYPE_LABELS[account.entityType];
    profile.fieldSchema = getSchemaForEntity(account.entityType);

    res.json({
      success: true,
      data: profile,
      message: "حساب و پروفایل ذخیره شد",
    });
  } catch (error) {
    console.error("updateMyProfile:", error);
    res.status(500).json({ success: false, message: "خطا در ذخیره پروفایل" });
  }
};

const createPost = async (req, res) => {
  try {
    const userId = currentUserId(req);
    const bodyText = (req.body?.body || "").trim();
    if (!bodyText) return res.status(400).json({ success: false, message: "متن پست خالی است" });

    const owner = await resolveUserForPublicProfile(userId);
    if (!owner) {
      return res.status(403).json({ success: false, message: "دسترسی مجاز نیست" });
    }

    const imageUrls = parsePostImageUrls(req.body);
    const hashtags = parsePostHashtags(req.body);

    if (Array.isArray(req.body?.imageUrls) && req.body.imageUrls.length > MAX_POST_IMAGES) {
      return res.status(400).json({
        success: false,
        message: `حداکثر ${MAX_POST_IMAGES} تصویر برای هر پست مجاز است`,
      });
    }

    if (countRawHashtags(req.body) > MAX_POST_HASHTAGS) {
      return res.status(400).json({
        success: false,
        message: `حداکثر ${MAX_POST_HASHTAGS} هشتگ مجاز است`,
      });
    }

    const post = await SupplierPost.create({
      userId,
      body: bodyText.slice(0, 5000),
      imageUrl: imageUrls[0] || null,
      imageUrls: imageUrls.length ? imageUrls : null,
      hashtags: hashtags.length ? hashtags : null,
    });

    res.status(201).json({ success: true, data: formatPostRecord(post) });
  } catch (error) {
    console.error("createPost:", error);
    res.status(500).json({ success: false, message: "خطا در انتشار پست" });
  }
};

const deletePost = async (req, res) => {
  try {
    const userId = currentUserId(req);
    const post = await SupplierPost.findByPk(req.params.postId);
    if (!post || post.userId !== userId) {
      return res.status(404).json({ success: false, message: "پست یافت نشد" });
    }
    await post.destroy();
    res.json({ success: true, message: "پست حذف شد" });
  } catch (error) {
    console.error("deletePost:", error);
    res.status(500).json({ success: false, message: "خطا در حذف پست" });
  }
};

const toggleFollow = async (req, res) => {
  try {
    const followerId = currentUserId(req);
    const supplierId = Number(req.params.supplierId);
    if (followerId === supplierId) {
      return res.status(400).json({ success: false, message: "نمی‌توانید خودتان را دنبال کنید" });
    }

    const supplier = await userIsSupplier(supplierId);
    if (!supplier) return res.status(404).json({ success: false, message: "تأمین‌کننده یافت نشد" });

    const existing = await SupplierFollow.findOne({
      where: { followerId, followingId: supplierId },
    });

    if (existing) {
      await existing.destroy();
      const count = await SupplierFollow.count({ where: { followingId: supplierId } });
      return res.json({ success: true, data: { following: false, followerCount: count } });
    }

    await SupplierFollow.create({ followerId, followingId: supplierId });
    const count = await SupplierFollow.count({ where: { followingId: supplierId } });
    res.json({ success: true, data: { following: true, followerCount: count } });
  } catch (error) {
    console.error("toggleFollow:", error);
    res.status(500).json({ success: false, message: "خطا در دنبال کردن" });
  }
};

const createReview = async (req, res) => {
  try {
    const reviewerId = currentUserId(req);
    const supplierId = Number(req.params.supplierId);
    const rating = Number(req.body?.rating);
    const comment = (req.body?.comment || "").trim().slice(0, 2000);

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "امتیاز باید بین ۱ تا ۵ باشد" });
    }

    const supplier = await userIsSupplier(supplierId);
    if (!supplier) return res.status(404).json({ success: false, message: "تأمین‌کننده یافت نشد" });

    if (reviewerId === supplierId) {
      return res.status(400).json({ success: false, message: "امتیاز به خود ممنوع است" });
    }

    const orderId = await hasTradedWith(reviewerId, supplierId);
    if (!orderId) {
      return res.status(403).json({
        success: false,
        message: "فقط پس از معامله موفق می‌توانید امتیاز دهید",
      });
    }

    const [review, created] = await SupplierReview.findOrCreate({
      where: { supplierId, reviewerId },
      defaults: { rating, comment, orderId },
    });

    if (!created) {
      await review.update({ rating, comment, orderId });
    }

    const stats = await getProfileStats(supplierId);
    res.status(created ? 201 : 200).json({
      success: true,
      data: { review, stats },
      message: created ? "نظر ثبت شد" : "نظر به‌روزرسانی شد",
    });
  } catch (error) {
    console.error("createReview:", error);
    res.status(500).json({ success: false, message: "خطا در ثبت نظر" });
  }
};

const getMyProfileSettings = async (req, res) => {
  try {
    const userId = currentUserId(req);
    const owner = await resolveUserForPublicProfile(userId);
    if (!owner) return res.status(403).json({ success: false, message: "دسترسی مجاز نیست" });

    const account = await getOrCreateAccountForUser(owner);
    const profile = await formatAccountPublic(account, owner);

    res.json({
      success: true,
      data: {
        ...profile,
        entityTypeLabel: ENTITY_TYPE_LABELS[account.entityType],
        fieldSchema: getSchemaForEntity(account.entityType),
        entityTypes: Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => ({ value, label })),
        isProfilePublic: account.isPublic !== false,
      },
    });
  } catch (error) {
    console.error("getMyProfileSettings:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت تنظیمات" });
  }
};

module.exports = {
  optionalAuth,
  getEntitySchemas,
  getPublicProfile,
  getPosts,
  getReviews,
  updateMyProfile,
  getMyProfileSettings,
  createPost,
  deletePost,
  toggleFollow,
  createReview,
};
