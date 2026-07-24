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
const { slugify, ensureUniqueSlug, generateProfileSlug, assertPublicSlugAvailable, validatePublicSlug, isPublicSlugAvailable } = require("./utils");
const {
  ENTITY_TYPE_LABELS,
  ENTITY_FIELD_SCHEMAS,
  getSchemaForEntity,
} = require("../account/entitySchemas");
const { ENTITY_NAV_BADGES } = require("../account/navLabels");
const File = require("../fileUpload/model");
const { formatHashtags } = require("../../utils/hashtags");
const { attachDisplayContentToLot } = require("../../utils/inventoryDisplayContent");
const { getPageDeletionGraceDays } = require("../siteSetting/service");
const {
  isPubliclyVisible,
  canAcceptOrders,
  maybeArchiveExpired,
  publicLifecyclePayload,
  normalizePageStatus,
  PAGE_STATUSES,
} = require("../../utils/pageLifecycle");
const {
  DEFAULT_BUSINESS_HOURS,
  getProfileFieldsMap,
  saveProfileFields,
  getOrCreateAccountForUser,
  setUserPageVisibility,
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
  const [followerCount, followingCount, postsCount, productCount, reviewStats, dealCount] = await Promise.all([
    SupplierFollow.count({ where: { followingId: supplierId } }),
    SupplierFollow.count({ where: { followerId: supplierId } }),
    SupplierPost.count({ where: { userId: supplierId } }),
    (async () => {
      const lots = await InventoryLot.findAll({
        where: { farmerId: supplierId, status: "harvested" },
        attributes: ["totalQuantity", "reservedQuantity", "price", "tieredPricing"],
      });
      return lots.filter((l) => {
        const avail = parseFloat(l.totalQuantity || 0) - parseFloat(l.reservedQuantity || 0);
        const inquiry = l.price == null && !(Array.isArray(l.tieredPricing) && l.tieredPricing.length);
        return avail > 0 || inquiry;
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
    followingCount,
    postsCount,
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

function resolveLotPublicTitle(lot) {
  const dc = lot.displayContent && typeof lot.displayContent === "object" ? lot.displayContent : null;
  if (dc) {
    for (const code of ["fa", "en", "ar", "tr", "ru", "ur", "es", "nl", "fi"]) {
      const title = dc[code]?.title;
      if (title && String(title).trim()) return String(title).trim();
    }
  }
  const product = lot.product || lot.Product || null;
  return (
    (lot.englishName && String(lot.englishName).trim()) ||
    (lot.arabicName && String(lot.arabicName).trim()) ||
    (product?.name && String(product.name).trim()) ||
    null
  );
}

function mapActivePublicProducts(lots, { includeEmpty = false } = {}) {
  return lots
    .map((lot) => {
      const total = parseFloat(lot.totalQuantity || 0);
      const reserved = parseFloat(lot.reservedQuantity || 0);
      const available = Math.max(0, total - reserved);
      const normalized = attachDisplayContentToLot(lot);
      const displayTitle = resolveLotPublicTitle(normalized);
      const inquiryListing = lot.price == null && !(Array.isArray(lot.tieredPricing) && lot.tieredPricing.length);
      return {
        id: lot.id,
        productId: lot.productId,
        name: displayTitle,
        imageUrl: lot.product?.imageUrl || lot.Product?.imageUrl,
        coverImageUrl: lot.coverImageUrl || normalized.coverImageUrl,
        qualityGrade: lot.qualityGrade,
        unit: lot.unit,
        price: lot.price,
        tieredPricing: lot.tieredPricing,
        totalQuantity: lot.totalQuantity,
        reservedQuantity: lot.reservedQuantity,
        availableQuantity: available,
        hashtags: formatHashtags(normalized.hashtags || lot.hashtags),
        inquiryListing,
        displayContent: normalized.displayContent,
      };
    })
    .filter((p) => includeEmpty || p.availableQuantity > 0 || p.inquiryListing);
}

const getPublicProfile = async (req, res) => {
  try {
    const key = String(req.params.slug || "").trim();
    if (!key || /^\d+$/.test(key)) {
      return res.status(404).json({ success: false, message: "صفحه تأمین‌کننده یافت نشد" });
    }

    const found = await findPublicAccountBySlugOrId(key);
    const viewerId = req.user?.userId || req.user?.id;

    if (!found) {
      return res.status(404).json({ success: false, message: "صفحه تأمین‌کننده یافت نشد" });
    }

    const { account, user } = found;

    if (!account.profileSlug) {
      return res.status(404).json({ success: false, message: "صفحه تأمین‌کننده یافت نشد" });
    }

    const graceDays = await getPageDeletionGraceDays();
    const archived = await maybeArchiveExpired(account, graceDays);
    if (archived.changed) await account.reload();

    const shopStatus = normalizePageStatus(account.shopStatus);
    const isOwner = Number(viewerId) === Number(user.id);

    if (account.isPublic === false && !isOwner) {
      return res.status(404).json({ success: false, message: "این پروفایل عمومی نیست" });
    }
    if (!isPubliclyVisible(shopStatus) && !isOwner) {
      return res.status(404).json({ success: false, message: "صفحه تأمین‌کننده یافت نشد" });
    }

    const profile = await formatAccountPublic(account, user);
    const lifecycle = publicLifecyclePayload(shopStatus, {
      deletionRequestedAt: account.deletionRequestedAt,
      graceDays,
    });
    Object.assign(profile, lifecycle);
    profile.shopStatus = shopStatus;
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
      if (viewerId !== user.id && canAcceptOrders(shopStatus)) {
        // هر کاربر واردشده (به‌جز صاحب صفحه) می‌تواند امتیاز ۵ستاره‌ای بدهد
        canReview = true;
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
    const activeProducts = mapActivePublicProducts(lotsWithCovers, {
      includeEmpty: isOwner,
    });

    res.json({
      success: true,
      data: {
        profile,
        stats,
        isFollowing,
        canReview,
        myReview,
        isOwner,
        products: canAcceptOrders(shopStatus) || isOwner ? activeProducts : [],
        canOrder: canAcceptOrders(shopStatus),
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

/** فهرست/جستجوی عمومی پست‌های فروشگاه‌های عمومی */
const listPublicPosts = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 60);
    const safe = q.replace(/[%_\\]/g, "").slice(0, 80);
    const where = {};
    if (safe) {
      const { fulltextWhere, likeOrWhere } = require("../../utils/mysqlFulltext");
      const ft = safe.length >= 2 ? fulltextWhere(["body"], safe) : null;
      const like = likeOrWhere(["body"], safe);
      if (ft) where[Op.and] = [ft];
      else if (like) Object.assign(where, like);
    }

    const posts = await SupplierPost.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: Math.min(limit * 3, 120),
    });

    const userIds = [...new Set(posts.map((p) => p.userId).filter(Boolean))];
    if (!userIds.length) {
      return res.json({ success: true, data: [] });
    }

    const accounts = await Account.findAll({
      where: {
        userId: { [Op.in]: userIds },
        profileSlug: { [Op.ne]: null },
        isPublic: true,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "username", "avatar"],
          required: true,
        },
      ],
    });

    const byUserId = new Map();
    for (const acc of accounts) {
      if (!isPubliclyVisible(acc.shopStatus || "ACTIVE")) continue;
      byUserId.set(acc.userId, acc);
    }

    const needle = safe.toLowerCase();
    const data = [];
    for (const post of posts) {
      const acc = byUserId.get(post.userId);
      if (!acc) continue;
      const formatted = formatPostRecord(post);
      if (needle) {
        const bodyOk = String(formatted.body || "").toLowerCase().includes(needle);
        const tags = Array.isArray(formatted.hashtags) ? formatted.hashtags : [];
        const tagOk = tags.some((tag) =>
          String(tag || "")
            .replace(/^#/, "")
            .toLowerCase()
            .includes(needle)
        );
        if (!bodyOk && !tagOk) continue;
      }
      const u = acc.user;
      const authorName =
        [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() ||
        u?.username ||
        acc.profileSlug;
      data.push({
        ...formatted,
        profileSlug: acc.profileSlug,
        authorName,
        authorAvatar: u?.avatar || null,
        href: `/${acc.profileSlug}?tab=posts`,
      });
      if (data.length >= limit) break;
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error("listPublicPosts:", error);
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
    if (body.displayName !== undefined) {
      accountUpdates.displayName = String(body.displayName || "").trim().slice(0, 120) || null;
    }
    if (body.headline !== undefined) accountUpdates.headline = String(body.headline).slice(0, 200);
    if (body.bio !== undefined) accountUpdates.bio = String(body.bio).slice(0, 5000);
    if (body.publicPhone !== undefined) accountUpdates.publicPhone = String(body.publicPhone).slice(0, 30);
    if (body.publicLandline !== undefined) {
      accountUpdates.publicLandline = String(body.publicLandline || "").slice(0, 30) || null;
    }
    if (body.publicEmail !== undefined) {
      accountUpdates.publicEmail = String(body.publicEmail || "").trim().slice(0, 120) || null;
    }
    {
      const { applyShopContactsToAccountPatch } = require("../../utils/shopContacts");
      applyShopContactsToAccountPatch(body, accountUpdates);
    }
    if (body.coverImage !== undefined) accountUpdates.coverImage = body.coverImage;
    if (body.businessHours !== undefined) accountUpdates.businessHours = body.businessHours;
    if (body.country !== undefined) accountUpdates.country = String(body.country).slice(0, 100);
    if (body.addressLabel !== undefined) {
      accountUpdates.addressLabel = String(body.addressLabel || "").trim().slice(0, 300) || null;
    }
    if (body.latitude !== undefined || body.longitude !== undefined) {
      const lat = body.latitude != null && body.latitude !== "" ? Number(body.latitude) : null;
      const lng = body.longitude != null && body.longitude !== "" ? Number(body.longitude) : null;
      if (lat != null && Number.isFinite(lat) && lng != null && Number.isFinite(lng)) {
        accountUpdates.latitude = lat;
        accountUpdates.longitude = lng;
      } else if (body.latitude === null || body.longitude === null) {
        accountUpdates.latitude = null;
        accountUpdates.longitude = null;
      }
    }

    const wantsPublic =
      body.isPublic !== undefined
        ? !!body.isPublic
        : body.isProfilePublic !== undefined
          ? !!body.isProfilePublic
          : undefined;
    if (wantsPublic !== undefined) {
      try {
        await setUserPageVisibility(userId, wantsPublic, { requirePermission: true });
        await account.reload();
      } catch (visErr) {
        return res.status(visErr.statusCode || 403).json({ success: false, message: visErr.message });
      }
    }

    if (body.profileSlug !== undefined) {
      const nextRaw = String(body.profileSlug || "").trim();
      const current = String(account.profileSlug || "").toLowerCase();
      const {
        slugify,
        assertPublicSlugAvailable: assertSlug,
      } = require("../../utils/publicPageSlug");
      const nextNorm = slugify(nextRaw);

      if (!account.profileSlug) {
        try {
          accountUpdates.profileSlug = await assertSlug(nextRaw, {
            excludeAccountId: account.id,
            excludeUserId: userId,
          });
        } catch (slugErr) {
          return res.status(slugErr.statusCode || 400).json({ success: false, message: slugErr.message });
        }
      } else if (nextNorm && nextNorm !== current) {
        // تغییر اسلاگ فوری نیست — درخواست زمان‌بندی‌شده
        try {
          const { scheduleSlugChange, formatPendingBanner } = require("../publicSlug/service");
          const scheduled = await scheduleSlugChange(userId, nextRaw);
          // بقیه فیلدها را ذخیره کن و پیام تغییر آدرس برگردان
          if (Object.keys(accountUpdates).length) {
            await account.update(accountUpdates);
          }
          if (body.profileFields && typeof body.profileFields === "object") {
            await saveProfileFields(
              account.id,
              accountUpdates.entityType || account.entityType,
              body.profileFields
            );
          }
          await account.reload();
          const profile = await formatAccountPublic(account, owner);
          profile.entityTypeLabel = ENTITY_TYPE_LABELS[account.entityType];
          profile.fieldSchema = getSchemaForEntity(account.entityType);
          return res.json({
            success: true,
            data: profile,
            slugChange: formatPendingBanner(scheduled.request),
            message: scheduled.message,
          });
        } catch (slugErr) {
          return res.status(slugErr.statusCode || 400).json({ success: false, message: slugErr.message });
        }
      }
    }

    if (Object.keys(accountUpdates).length) {
      await account.update(accountUpdates);
    }

    if (accountUpdates.profileSlug) {
      const TradeServiceProvider = require("../tradeServiceProvider/model");
      await TradeServiceProvider.update(
        { profileSlug: accountUpdates.profileSlug },
        { where: { userId } }
      );
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

    // هر کاربر واردشده می‌تواند به صفحه اختصاصی امتیاز دهد؛ orderId اختیاری است
    const orderId = (await hasTradedWith(reviewerId, supplierId)) || null;

    const [review, created] = await SupplierReview.findOrCreate({
      where: { supplierId, reviewerId },
      defaults: { rating, comment: comment || null, orderId },
    });

    if (!created) {
      await review.update({
        rating,
        comment: comment || null,
        ...(orderId ? { orderId } : {}),
      });
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
    const followingCount = await SupplierFollow.count({ where: { followerId: userId } });

    res.json({
      success: true,
      data: {
        ...profile,
        followingCount,
        entityTypeLabel: ENTITY_TYPE_LABELS[account.entityType],
        fieldSchema: getSchemaForEntity(account.entityType),
        entityTypes: Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => ({ value, label })),
        isProfilePublic: account.isPublic !== false,
        canHidePublicPage: !!account.canHidePublicPage,
      },
    });
  } catch (error) {
    console.error("getMyProfileSettings:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت تنظیمات" });
  }
};

const checkSlugAvailable = async (req, res) => {
  try {
    const {
      validatePublicSlug,
      isPublicSlugAvailable,
      loadBlockedPageSlugs,
      loadSlugLengthRules,
    } = require("../../utils/publicPageSlug");
    const [blocked, rules] = await Promise.all([loadBlockedPageSlugs(), loadSlugLengthRules()]);
    const validated = validatePublicSlug(req.query?.slug || "", blocked, rules);
    if (!validated.ok) {
      return res.json({
        success: true,
        data: {
          available: false,
          slug: validated.slug,
          message: validated.message,
          slugRules: rules,
        },
      });
    }
    const excludeAccountId = req.query?.excludeAccountId ? Number(req.query.excludeAccountId) : null;
    const excludeUserId = req.user?.userId || req.user?.id || null;
    const available = await isPublicSlugAvailable(validated.slug, {
      excludeAccountId,
      excludeUserId: excludeUserId ? Number(excludeUserId) : null,
    });
    res.json({
      success: true,
      data: {
        available,
        slug: validated.slug,
        message: available ? "این نام آزاد است" : validated.message || "این نام قبلاً رزرو شده است",
        slugRules: rules,
      },
    });
  } catch (error) {
    console.error("checkSlugAvailable:", error);
    res.status(500).json({ success: false, message: "خطا در بررسی نام" });
  }
};

const listRecentPublicShops = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 24);
    const rows = await Account.findAll({
      where: {
        profileSlug: { [Op.ne]: null },
        isPublic: true,
        shopStatus: { [Op.in]: ["ACTIVE", "PENDING_DELETION", "CLOSED", "SUSPENDED"] },
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "username", "avatar"],
          required: true,
        },
      ],
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: Math.min(limit * 3, 60),
    });

    const candidates = [];
    for (const a of rows) {
      if (!isPubliclyVisible(a.shopStatus || "ACTIVE")) continue;
      candidates.push(a);
      if (candidates.length >= limit) break;
    }

    const userIds = candidates.map((a) => a.user?.id).filter(Boolean);
    const serviceUserIds = new Set();
    if (userIds.length) {
      const TradeServiceProvider = require("../tradeServiceProvider/model");
      const providers = await TradeServiceProvider.findAll({
        where: {
          userId: { [Op.in]: userIds },
          status: "approved",
          isPublic: true,
          pageStatus: { [Op.in]: ["ACTIVE", "PENDING_DELETION", "CLOSED", "SUSPENDED"] },
        },
        attributes: ["userId", "pageStatus"],
      });
      for (const p of providers) {
        if (isPubliclyVisible(p.pageStatus || "ACTIVE")) {
          serviceUserIds.add(Number(p.userId));
        }
      }
    }

    const data = candidates.map((a) => {
      const u = a.user;
      const displayName =
        String(a.displayName || "").trim() ||
        [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() ||
        u?.username ||
        a.profileSlug;
      const slug = a.profileSlug;
      const avatar =
        u?.avatar ||
        (String(slug || "").toLowerCase() === "zareoon" ? "/images/logo.png" : null);
      return {
        id: a.id,
        userId: u?.id,
        profileSlug: slug,
        displayName,
        headline: a.headline || null,
        avatar,
        hasServices: serviceUserIds.has(Number(u?.id)),
        profileUrl: `/${slug}`,
        createdAt: a.createdAt,
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error("listRecentPublicShops:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت فروشگاه‌ها" });
  }
};

const adminListShops = async (req, res) => {
  try {
    const items = await Account.findAll({
      where: { profileSlug: { [Op.ne]: null } },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "username", "mobile", "email", "isActive"],
          required: true,
        },
      ],
      order: [["updatedAt", "DESC"]],
      limit: 500,
    });
    res.json({
      success: true,
      data: items.map((a) => ({
        id: a.id,
        profileSlug: a.profileSlug,
        isPublic: a.isPublic !== false,
        canHidePublicPage: !!a.canHidePublicPage,
        shopStatus: a.shopStatus || "ACTIVE",
        deletionRequestedAt: a.deletionRequestedAt || null,
        headline: a.headline,
        user: a.user,
        profileUrl: a.profileSlug ? `/${a.profileSlug}` : null,
        updatedAt: a.updatedAt,
      })),
    });
  } catch (error) {
    console.error("adminListShops:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت فروشگاه‌ها" });
  }
};

const adminUpdateShop = async (req, res) => {
  try {
    const account = await Account.findByPk(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: "یافت نشد" });

    const updates = {};
    if (req.body.canHidePublicPage !== undefined) {
      updates.canHidePublicPage = !!req.body.canHidePublicPage;
      if (!updates.canHidePublicPage) {
        updates.isPublic = true;
      }
    }
    if (req.body.isPublic !== undefined) {
      updates.isPublic = !!req.body.isPublic;
    }
    if (req.body.shopStatus !== undefined) {
      const next = normalizePageStatus(req.body.shopStatus, null);
      if (!next || !PAGE_STATUSES.includes(next)) {
        return res.status(400).json({ success: false, message: "وضعیت فروشگاه نامعتبر است" });
      }
      updates.shopStatus = next;
      if (next === "PENDING_DELETION" && !account.deletionRequestedAt) {
        updates.deletionRequestedAt = new Date();
      }
      if (next === "ACTIVE") {
        updates.deletionRequestedAt = null;
      }
    }

    if (Object.keys(updates).length) {
      await account.update(updates);
      if (updates.isPublic !== undefined && account.userId) {
        const TradeServiceProvider = require("../tradeServiceProvider/model");
        await TradeServiceProvider.update(
          { isPublic: updates.isPublic },
          { where: { userId: account.userId } }
        );
      }
    }

    await account.reload();
    res.json({
      success: true,
      data: {
        id: account.id,
        profileSlug: account.profileSlug,
        isPublic: account.isPublic !== false,
        canHidePublicPage: !!account.canHidePublicPage,
        shopStatus: account.shopStatus,
        deletionRequestedAt: account.deletionRequestedAt,
      },
      message: "ذخیره شد",
    });
  } catch (error) {
    console.error("adminUpdateShop:", error);
    res.status(500).json({ success: false, message: "خطا در ذخیره" });
  }
};

const requestShopDeletion = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "احراز هویت لازم است" });
    const account = await Account.findOne({ where: { userId } });
    if (!account?.profileSlug) {
      return res.status(404).json({ success: false, message: "فروشگاهی یافت نشد" });
    }
    const graceDays = await getPageDeletionGraceDays();
    await account.update({
      shopStatus: "PENDING_DELETION",
      deletionRequestedAt: new Date(),
    });
    res.json({
      success: true,
      data: {
        shopStatus: account.shopStatus,
        deletionRequestedAt: account.deletionRequestedAt,
      },
      message: `درخواست بستن فروشگاه ثبت شد. صفحه حدود ${graceDays} روز دیگر نمایش داده می‌شود ولی سفارش جدید قبول نمی‌کند.`,
    });
  } catch (error) {
    console.error("requestShopDeletion:", error);
    res.status(500).json({ success: false, message: "خطا در ثبت درخواست حذف" });
  }
};

const cancelShopDeletion = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "احراز هویت لازم است" });
    const account = await Account.findOne({ where: { userId } });
    if (!account) return res.status(404).json({ success: false, message: "یافت نشد" });
    if (normalizePageStatus(account.shopStatus) !== "PENDING_DELETION") {
      return res.status(400).json({ success: false, message: "درخواست حذفی در جریان نیست" });
    }
    await account.update({ shopStatus: "ACTIVE", deletionRequestedAt: null });
    res.json({ success: true, data: { shopStatus: "ACTIVE" }, message: "فروشگاه دوباره فعال شد" });
  } catch (error) {
    console.error("cancelShopDeletion:", error);
    res.status(500).json({ success: false, message: "خطا در لغو حذف" });
  }
};

const getMySocialStats = async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "ورود لازم است" });

    const [followingCount, followerCount, postsCount] = await Promise.all([
      SupplierFollow.count({ where: { followerId: userId } }),
      SupplierFollow.count({ where: { followingId: userId } }),
      SupplierPost.count({ where: { userId } }),
    ]);

    let productCount = 0;
    try {
      productCount = await InventoryLot.count({
        where: { farmerId: userId },
      });
    } catch {
      productCount = 0;
    }

    res.json({
      success: true,
      data: { productCount, followerCount, followingCount, postsCount },
    });
  } catch (error) {
    console.error("getMySocialStats:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت آمار" });
  }
};

module.exports = {
  optionalAuth,
  getEntitySchemas,
  getPublicProfile,
  getPosts,
  listPublicPosts,
  getReviews,
  createPost,
  deletePost,
  toggleFollow,
  createReview,
  getMyProfileSettings,
  getMySocialStats,
  updateMyProfile,
  checkSlugAvailable,
  listRecentPublicShops,
  adminListShops,
  adminUpdateShop,
  requestShopDeletion,
  cancelShopDeletion,
};
