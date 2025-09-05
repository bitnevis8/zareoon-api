const BaseController = require("../../../core/baseController");
const User = require("./model");
const Role = require("../role/model");
const bcrypt = require("bcryptjs");
const config = require("config");
const Joi = require("joi");
const { Op } = require("sequelize");

class UserController extends BaseController {
  constructor() {
    super(User);
  }

  // ✅ دریافت تمام کاربران
  async getAll(req, res) {
    try {
      console.log("Starting getAll method...");
      const { sortBy, sortOrder, q, role, isActive, isEmailVerified, isMobileVerified } = req.query;
      
      // ساخت where clause برای جستجو
      const whereClause = {};
      if (q) {
        whereClause[Op.or] = [
          { firstName: { [Op.like]: `%${q}%` } },
          { lastName: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } },
          { mobile: { [Op.like]: `%${q}%` } },
          { username: { [Op.like]: `%${q}%` } },
        ];
      }

      // اضافه کردن فیلترها
      if (isActive !== undefined && isActive !== '') {
        whereClause.isActive = isActive === 'true';
      }
      if (isEmailVerified !== undefined && isEmailVerified !== '') {
        whereClause.isEmailVerified = isEmailVerified === 'true';
      }
      if (isMobileVerified !== undefined && isMobileVerified !== '') {
        whereClause.isMobileVerified = isMobileVerified === 'true';
      }

      // ساخت include برای فیلتر نقش
      const includeOptions = [{
        model: Role,
        as: "userRoles"
      }];

      if (role) {
        includeOptions[0].where = { name: role };
        includeOptions[0].required = true;
      }

      // ساخت order
      const order = [];
      const allowedSortColumns = ["id", "firstName", "lastName", "email", "mobile", "username", "createdAt"];

      if (sortBy && allowedSortColumns.includes(sortBy)) {
        order.push([sortBy, sortOrder && sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC"]);
      }

      const users = await User.findAll({
        where: whereClause,
        include: includeOptions,
        order: order.length > 0 ? order : [['id', 'ASC']] // Default sort by id ASC
      });
      console.log("✅ Users found successfully");
      return this.response(res, 200, true, "لیست کاربران دریافت شد.", users);
    } catch (error) {
      console.error("❌ Error in getAll:", error);
      return this.response(
        res,
        500,
        false,
        error.message || "خطا در دریافت داده‌ها",
        null,
        error
      );
    }
  }

  // ✅ دریافت یک کاربر بر اساس ID
  async getOne(req, res) {
    try {
      const user = await User.findByPk(req.params.id, {
        include: [{
          model: Role,
          as: "userRoles"
        }]
      });
      
      if (!user) {
        console.warn("⚠️ User not found:", req.params.id);
        return this.response(res, 404, false, "کاربر یافت نشد.");
      }

      console.log("✅ User retrieved successfully:", req.params.id);
      return this.response(res, 200, true, "کاربر دریافت شد.", user);
    } catch (error) {
      console.error("❌ Error in getOne:", error);
      return this.response(res, 500, false, "خطا در دریافت داده", null, error);
    }
  }

  // ✅ ایجاد یک کاربر جدید
  async create(req, res) {
    try {
      const {
        firstName,
        lastName,
        email,
        mobile,
        phone,
        username,
        password,
        roleIds,
        avatar,
      } = req.body;

      // اعتبارسنجی ورودی‌ها
      const schema = Joi.object({
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        mobile: Joi.string()
          .pattern(/^[0-9]{11}$/)
          .optional(),
        phone: Joi.string().optional(),
        username: Joi.string().optional(),
        password: Joi.string().min(6).required(),
        roleIds: Joi.array().items(Joi.number().integer()).optional(),
        avatar: Joi.string().optional(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        console.warn("⚠️ Validation error:", error.details[0].message);
        return this.response(res, 400, false, error.details[0].message);
      }

      // چک کردن تکراری بودن ایمیل یا موبایل
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [{ email: value.email }, { mobile: value.mobile }],
        },
      });

      if (existingUser) {
        console.warn("⚠️ Duplicate user attempt:", value.email);
        return this.response(
          res,
          400,
          false,
          "ایمیل یا موبایل قبلاً ثبت شده است."
        );
      }

      // ایجاد کاربر جدید
      const newUser = await User.create({
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
        mobile: value.mobile || null,
        phone: value.phone || null,
        username: value.username || null,
        password: value.password,
        avatar: value.avatar || null,
        isEmailVerified: true,
      });

      // اگر roleIds ارائه شده باشد، نقش‌ها را به کاربر اضافه کنید
      if (value.roleIds && value.roleIds.length > 0) {
        const roles = await Role.findAll({
          where: {
            id: value.roleIds
          }
        });
        await newUser.setUserRoles(roles);
      }

      console.log("✅ User created successfully:", newUser.id);
      return this.response(res, 201, true, "کاربر جدید ایجاد شد.", newUser);
    } catch (error) {
      console.error("❌ Error in create:", error);
      return this.response(res, 500, false, "خطا در ایجاد کاربر", null, error);
    }
  }

  // ✅ ویرایش یک کاربر
  async update(req, res) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) {
        console.warn("⚠️ User not found for update:", req.params.id);
        return this.response(res, 404, false, "کاربر یافت نشد.");
      }

      const {
        firstName,
        lastName,
        email,
        mobile,
        phone,
        username,
        password,
        roleIds,
        avatar,
      } = req.body;

      // بروزرسانی اطلاعات کاربر
      const updates = {
        firstName: firstName ?? user.firstName,
        lastName: lastName ?? user.lastName,
        email: email ?? user.email,
        mobile: mobile ?? user.mobile,
        phone: phone ?? user.phone,
        username: username ?? user.username,
        avatar: avatar ?? user.avatar,
      };

      if (password) {
        updates.password = password;
      }

      // بروزرسانی اطلاعات کاربر
      await user.update(updates);

      // اگر roleIds ارائه شده باشد، نقش‌های کاربر را بروزرسانی کنید
      if (roleIds && roleIds.length > 0) {
        const roles = await Role.findAll({
          where: {
            id: roleIds
          }
        });
        await user.setUserRoles(roles);
      } else if (roleIds && roleIds.length === 0) {
        // If an empty array is provided, clear all roles
        await user.setUserRoles([]);
      }
      
      console.log("✅ User updated successfully:", user.id);
      return this.response(res, 200, true, "کاربر بروزرسانی شد.", user);
    } catch (error) {
      console.error("❌ Error in update:", error);
      return this.response(
        res,
        500,
        false,
        "خطا در بروزرسانی کاربر",
        null,
        error
      );
    }
  }

  // ✅ حذف یک کاربر
  async delete(req, res) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) {
        console.warn("⚠️ User not found for deletion:", req.params.id);
        return this.response(res, 404, false, "کاربر یافت نشد.");
      }

      await user.destroy();
      console.log("✅ User deleted successfully:", req.params.id);
      return this.response(res, 200, true, "کاربر حذف شد.");
    } catch (error) {
      console.error("❌ Error in delete:", error);
      return this.response(res, 500, false, "خطا در حذف کاربر", null, error);
    }
  }

  // ✅ جستجوی کاربران
  async search(req, res) {
    try {
      const { q, limit = 10, offset = 0, sortBy, sortOrder } = req.query; // Get sortBy and sortOrder from query

      const whereClause = {};
      if (q) {
        whereClause[Op.or] = [
          { firstName: { [Op.like]: `%${q}%` } },
          { lastName: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } },
          { mobile: { [Op.like]: `%${q}%` } },
          { username: { [Op.like]: `%${q}%` } },
        ];
      }

      const order = [];
      const allowedSortColumns = ["id", "firstName", "lastName", "email", "mobile", "username", "createdAt"];

      if (sortBy && allowedSortColumns.includes(sortBy)) {
        order.push([sortBy, sortOrder && sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC"]);
      }

      const users = await User.findAndCountAll({
        where: whereClause,
        include: [{
          model: Role,
          as: "userRoles"
        }],
        order: order.length > 0 ? order : [['createdAt', 'DESC']], // Default sort by createdAt DESC
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      console.log("✅ Users searched successfully:", users.count);
      return this.response(res, 200, true, "نتایج جستجو دریافت شد.", users);
    } catch (error) {
      console.error("❌ Error in search:", error);
      return this.response(
        res,
        500,
        false,
        error.message || "خطا در جستجو",
        null,
        error
      );
    }
  }
}

module.exports = new UserController();
