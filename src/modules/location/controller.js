const BaseController = require("../../core/baseController");
const Location = require("./model");
const { Op } = require("sequelize");
const axios = require("axios");

class LocationController extends BaseController {
  constructor() {
    super(Location);
  }

  // ✅ دریافت تمام لوکیشن‌ها
  async getAll(req, res) {
    try {
      const { type, parentId, sortBy, sortOrder } = req.query;
      const order = [];
      const allowedSortColumns = ["name", "displayName", "divisionType", "createdAt"];

      if (sortBy && allowedSortColumns.includes(sortBy)) {
        order.push([sortBy, sortOrder && sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC"]);
      }

      const whereClause = { isActive: true };
      
      // فیلتر بر اساس نوع تقسیمات کشوری
      if (type !== undefined) {
        whereClause.divisionType = parseInt(type);
      }

      // فیلتر بر اساس والد
      if (parentId !== undefined) {
        whereClause.parentId = parentId === 'null' ? null : parseInt(parentId);
      }

      const locations = await Location.findAll({
        where: whereClause,
        order: order.length > 0 ? order : [['name', 'ASC']]
      });

      return this.response(res, 200, true, "لیست لوکیشن‌ها دریافت شد.", locations);
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

  // ✅ دریافت یک لوکیشن بر اساس ID
  async getOne(req, res) {
    try {
      const location = await Location.findByPk(req.params.id);
      
      if (!location) {
        return this.response(res, 404, false, "لوکیشن یافت نشد.");
      }

      return this.response(res, 200, true, "لوکیشن دریافت شد.", location);
    } catch (error) {
      console.error("❌ Error in getOne:", error);
      return this.response(res, 500, false, "خطا در دریافت داده", null, error);
    }
  }

  // ✅ دریافت یک لوکیشن بر اساس slug
  async getBySlug(req, res) {
    try {
      const { slug } = req.params;
      
      if (!slug) {
        return this.response(res, 400, false, "Slug لوکیشن الزامی است.");
      }

      const decodedSlug = decodeURIComponent(slug);
      
      const location = await Location.findOne({
        where: { 
          slug: decodedSlug,
          isActive: true 
        }
      });
      
      if (!location) {
        return this.response(res, 404, false, "لوکیشن یافت نشد.");
      }

      return this.response(res, 200, true, "لوکیشن دریافت شد.", location);
    } catch (error) {
      console.error("❌ Error in getBySlug:", error);
      return this.response(res, 500, false, "خطا در دریافت داده", null, error);
    }
  }

  // ✅ دریافت لوکیشن بر اساس نام
  async getByName(req, res) {
    try {
      const { name } = req.params;
      
      if (!name) {
        return this.response(res, 400, false, "نام لوکیشن الزامی است.");
      }

      const decodedName = decodeURIComponent(name);
      
      const location = await Location.findOne({
        where: { 
          name: decodedName,
          isActive: true 
        }
      });
      
      if (!location) {
        return this.response(res, 404, false, "لوکیشن یافت نشد.");
      }

      return this.response(res, 200, true, "لوکیشن دریافت شد.", location);
    } catch (error) {
      console.error("❌ Error in getByName:", error);
      return this.response(res, 500, false, "خطا در دریافت داده", null, error);
    }
  }

  // ✅ دریافت فرزندان یک لوکیشن
  async getChildren(req, res) {
    try {
      const { parentId } = req.params;
      
      if (!parentId) {
        return this.response(res, 400, false, "شناسه والد الزامی است.");
      }

      const children = await Location.findAll({
        where: { 
          parentId: parentId === 'null' ? null : parseInt(parentId),
          isActive: true 
        },
        order: [['name', 'ASC']]
      });

      return this.response(res, 200, true, "فرزندان لوکیشن دریافت شد.", children);
    } catch (error) {
      console.error("❌ Error in getChildren:", error);
      return this.response(res, 500, false, "خطا در دریافت داده", null, error);
    }
  }

  // ✅ دریافت فرزندان یک لوکیشن بر اساس slug والد
  async getChildrenBySlug(req, res) {
    try {
      const { parentSlug } = req.params;
      
      if (!parentSlug) {
        return this.response(res, 400, false, "Slug والد الزامی است.");
      }

      const decodedParentSlug = decodeURIComponent(parentSlug);
      
      // ابتدا والد را پیدا می‌کنیم
      const parent = await Location.findOne({
        where: { 
          slug: decodedParentSlug,
          isActive: true 
        }
      });

      if (!parent) {
        return this.response(res, 404, false, "لوکیشن والد یافت نشد.");
      }

      // سپس فرزندان را پیدا می‌کنیم
      const children = await Location.findAll({
        where: { 
          parentId: parent.id,
          isActive: true 
        },
        order: [['name', 'ASC']]
      });

      return this.response(res, 200, true, "فرزندان لوکیشن دریافت شد.", children);
    } catch (error) {
      console.error("❌ Error in getChildrenBySlug:", error);
      return this.response(res, 500, false, "خطا در دریافت داده", null, error);
    }
  }

  // ✅ جستجوی لوکیشن‌ها
  async search(req, res) {
    try {
      const { q, type, limit = 50 } = req.query;
      
      if (!q) {
        return this.response(res, 400, false, "پارامتر جستجو الزامی است.");
      }

      const whereClause = {
        isActive: true,
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { displayName: { [Op.like]: `%${q}%` } },
          { code: { [Op.like]: `%${q}%` } }
        ]
      };

      // فیلتر بر اساس نوع تقسیمات کشوری
      if (type !== undefined) {
        whereClause.divisionType = parseInt(type);
      }

      const results = await Location.findAll({
        where: whereClause,
        limit: parseInt(limit),
        order: [['name', 'ASC']]
      });

      return this.response(res, 200, true, "نتایج جستجو دریافت شد.", results);
    } catch (error) {
      console.error("❌ Error in search:", error);
      return this.response(res, 500, false, "خطا در جستجو", null, error);
    }
  }

  // ✅ ایجاد لوکیشن جدید
  async create(req, res) {
    try {
      const { name, displayName, code, divisionType, parentId, latitude, longitude, population, area, extra } = req.body;

      if (!name || !displayName || divisionType === undefined) {
        return this.response(res, 400, false, "نام، نام نمایشی و نوع تقسیمات کشوری الزامی است.");
      }

      const location = await Location.create({
        name,
        displayName,
        code,
        divisionType: parseInt(divisionType),
        parentId: parentId || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        population: population ? parseInt(population) : null,
        area: area ? parseFloat(area) : null,
        extra: extra ? JSON.parse(extra) : null,
        isActive: true
      });

      return this.response(res, 201, true, "لوکیشن با موفقیت ایجاد شد.", location);
    } catch (error) {
      console.error("❌ Error in create:", error);
      return this.response(res, 500, false, "خطا در ایجاد لوکیشن", null, error);
    }
  }

  // ✅ ویرایش لوکیشن
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const location = await Location.findByPk(id);
      
      if (!location) {
        return this.response(res, 404, false, "لوکیشن یافت نشد.");
      }

      // تبدیل نوع داده‌ها
      if (updateData.divisionType !== undefined) {
        updateData.divisionType = parseInt(updateData.divisionType);
      }
      if (updateData.parentId !== undefined) {
        updateData.parentId = updateData.parentId || null;
      }
      if (updateData.latitude !== undefined) {
        updateData.latitude = updateData.latitude ? parseFloat(updateData.latitude) : null;
      }
      if (updateData.longitude !== undefined) {
        updateData.longitude = updateData.longitude ? parseFloat(updateData.longitude) : null;
      }
      if (updateData.population !== undefined) {
        updateData.population = updateData.population ? parseInt(updateData.population) : null;
      }
      if (updateData.area !== undefined) {
        updateData.area = updateData.area ? parseFloat(updateData.area) : null;
      }
      if (updateData.extra !== undefined) {
        updateData.extra = updateData.extra ? JSON.parse(updateData.extra) : null;
      }

      await location.update(updateData);

      return this.response(res, 200, true, "لوکیشن با موفقیت ویرایش شد.", location);
    } catch (error) {
      console.error("❌ Error in update:", error);
      return this.response(res, 500, false, "خطا در ویرایش لوکیشن", null, error);
    }
  }

  // ✅ ویرایش لوکیشن بر اساس slug
  async updateBySlug(req, res) {
    try {
      const { slug } = req.params;
      const updateData = req.body;

      const decodedSlug = decodeURIComponent(slug);
      
      const location = await Location.findOne({
        where: { 
          slug: decodedSlug,
          isActive: true 
        }
      });
      
      if (!location) {
        return this.response(res, 404, false, "لوکیشن یافت نشد.");
      }

      // تبدیل نوع داده‌ها
      if (updateData.divisionType !== undefined) {
        updateData.divisionType = parseInt(updateData.divisionType);
      }
      if (updateData.parentId !== undefined) {
        updateData.parentId = updateData.parentId || null;
      }
      if (updateData.latitude !== undefined) {
        updateData.latitude = updateData.latitude ? parseFloat(updateData.latitude) : null;
      }
      if (updateData.longitude !== undefined) {
        updateData.longitude = updateData.longitude ? parseFloat(updateData.longitude) : null;
      }
      if (updateData.population !== undefined) {
        updateData.population = updateData.population ? parseInt(updateData.population) : null;
      }
      if (updateData.area !== undefined) {
        updateData.area = updateData.area ? parseFloat(updateData.area) : null;
      }
      if (updateData.extra !== undefined) {
        updateData.extra = updateData.extra ? JSON.parse(updateData.extra) : null;
      }

      await location.update(updateData);

      return this.response(res, 200, true, "لوکیشن با موفقیت ویرایش شد.", location);
    } catch (error) {
      console.error("❌ Error in updateBySlug:", error);
      return this.response(res, 500, false, "خطا در ویرایش لوکیشن", null, error);
    }
  }

  // ✅ حذف لوکیشن
  async delete(req, res) {
    try {
      const { id } = req.params;

      const location = await Location.findByPk(id);
      
      if (!location) {
        return this.response(res, 404, false, "لوکیشن یافت نشد.");
      }

      // بررسی وجود فرزندان
      const childrenCount = await Location.count({
        where: { parentId: id, isActive: true }
      });

      if (childrenCount > 0) {
        return this.response(res, 400, false, "این لوکیشن دارای فرزند است و قابل حذف نیست.");
      }

      await location.update({ isActive: false });

      return this.response(res, 200, true, "لوکیشن با موفقیت حذف شد.");
    } catch (error) {
      console.error("❌ Error in delete:", error);
      return this.response(res, 500, false, "خطا در حذف لوکیشن", null, error);
    }
  }

  // ✅ حذف لوکیشن بر اساس slug
  async deleteBySlug(req, res) {
    try {
      const { slug } = req.params;

      const decodedSlug = decodeURIComponent(slug);
      
      const location = await Location.findOne({
        where: { 
          slug: decodedSlug,
          isActive: true 
        }
      });
      
      if (!location) {
        return this.response(res, 404, false, "لوکیشن یافت نشد.");
      }

      // بررسی وجود فرزندان
      const childrenCount = await Location.count({
        where: { parentId: location.id, isActive: true }
      });

      if (childrenCount > 0) {
        return this.response(res, 400, false, "این لوکیشن دارای فرزند است و قابل حذف نیست.");
      }

      await location.update({ isActive: false });

      return this.response(res, 200, true, "لوکیشن با موفقیت حذف شد.");
    } catch (error) {
      console.error("❌ Error in deleteBySlug:", error);
      return this.response(res, 500, false, "خطا در حذف لوکیشن", null, error);
    }
  }

  // ✅ دریافت لوکیشن‌ها بر اساس نوع تقسیمات کشوری
  async getByDivisionType(req, res) {
    try {
      const { type } = req.params;
      
      if (type === undefined || isNaN(parseInt(type))) {
        return this.response(res, 400, false, "نوع تقسیمات کشوری الزامی است.");
      }

      const locations = await Location.findAll({
        where: { 
          divisionType: parseInt(type),
          isActive: true 
        },
        order: [['name', 'ASC']]
      });

      return this.response(res, 200, true, "لوکیشن‌ها بر اساس نوع تقسیمات کشوری دریافت شد.", locations);
    } catch (error) {
      console.error("❌ Error in getByDivisionType:", error);
      return this.response(res, 500, false, "خطا در دریافت داده", null, error);
    }
  }

  // ✅ دریافت درخت سلسله‌مراتبی لوکیشن‌ها
  async getHierarchy(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return this.response(res, 400, false, "شناسه لوکیشن الزامی است.");
      }

      // دریافت مسیر کامل از ریشه تا مکان فعلی
      const buildPath = async (locationId) => {
        const path = [];
        let currentId = locationId;
        
        while (currentId) {
          const location = await Location.findByPk(currentId);
          if (!location) break;
          
          path.unshift(location);
          currentId = location.parentId;
        }
        
        return path;
      };

      const hierarchy = await buildPath(id);

      return this.response(res, 200, true, "مسیر سلسله‌مراتبی لوکیشن دریافت شد.", hierarchy);
    } catch (error) {
      console.error("❌ Error in getHierarchy:", error);
      return this.response(res, 500, false, "خطا در دریافت مسیر سلسله‌مراتبی", null, error);
    }
  }

  // ✅ دریافت درخت سلسله‌مراتبی لوکیشن‌ها بر اساس slug
  async getHierarchyBySlug(req, res) {
    try {
      const { slug } = req.params;
      
      if (!slug) {
        return this.response(res, 400, false, "Slug لوکیشن الزامی است.");
      }

      const decodedSlug = decodeURIComponent(slug);
      
      // ابتدا لوکیشن را پیدا می‌کنیم
      const location = await Location.findOne({
        where: { 
          slug: decodedSlug,
          isActive: true 
        }
      });

      if (!location) {
        return this.response(res, 404, false, "لوکیشن یافت نشد.");
      }

      // دریافت مسیر کامل از ریشه تا مکان فعلی
      const buildPath = async (locationId) => {
        const path = [];
        let currentId = locationId;
        
        while (currentId) {
          const location = await Location.findByPk(currentId);
          if (!location) break;
          
          path.unshift(location);
          currentId = location.parentId;
        }
        
        return path;
      };

      const hierarchy = await buildPath(location.id);

      return this.response(res, 200, true, "مسیر سلسله‌مراتبی لوکیشن دریافت شد.", hierarchy);
    } catch (error) {
      console.error("❌ Error in getHierarchyBySlug:", error);
      return this.response(res, 500, false, "خطا در دریافت مسیر سلسله‌مراتبی", null, error);
    }
  }


  // ✅ دریافت اطلاعات ویکی‌پدیا برای لوکیشن
  async getWikiDetails(req, res) {
    try {
      const { id } = req.params;
      const location = await Location.findByPk(id);
      if (!location) {
        return this.response(res, 404, false, "لوکیشن یافت نشد.");
      }

      // تابع پیدا کردن شهرستان والد (مستقیم یا غیرمستقیم)
      const findParentCounty = async (locationId) => {
        let currentId = locationId;
        
        while (currentId) {
          const currentLocation = await Location.findByPk(currentId);
          if (!currentLocation) break;
          
          // اگر شهرستان باشد (divisionType === 2)
          if (currentLocation.divisionType === 2) {
            return currentLocation;
          }
          
          currentId = currentLocation.parentId;
        }
        
        return null;
      };

      // تابع ساخت نام جستجو دقیق برای هر لوکیشن
      const buildExactSearchName = async (location) => {
        // برای divisionType 3 (بخش): نام دقیق با شهرستان
        if (location.divisionType === 3) {
          const county = await findParentCounty(location.id);
          if (county) {
            // اگر نام بخش "مرکزی" باشد
            if (location.name === "مرکزی") {
              return `بخش مرکزی شهرستان ${county.name}`;
            } else {
              return `بخش ${location.name} شهرستان ${county.name}`;
            }
          }
        }
        
        // برای divisionType 4، 5، 6: نام دقیق با والد
        if ([4, 5, 6].includes(location.divisionType)) {
          // پیدا کردن والد
          const parent = await Location.findByPk(location.parentId);
          if (parent) {
            // اگر والد "مرکزی" باشد، شهرستان را پیدا کن
            if (parent.name === "مرکزی") {
              const county = await findParentCounty(location.parentId);
              if (county) {
                return `${location.name} (${county.name})`;
              }
            } else {
              // اگر والد "مرکزی" نباشد، نام والد را استفاده کن
              return `${location.name} (${parent.name})`;
            }
          }
        }
        
        // برای سایر موارد، نام اصلی را برگردان
        return location.name;
      };

      // ساخت عبارت جستجو دقیق بر اساس نوع تقسیمات
      let searchTerm = '';
      
      if (location.divisionType === 0) {
        // کشور: فقط displayName
        searchTerm = location.displayName;
      } else if (location.divisionType === 1) {
        // استان: فقط displayName
        searchTerm = location.displayName;
      } else if (location.divisionType === 2) {
        // شهرستان: اولویت با name، اگر نبود displayName
        searchTerm = location.name || location.displayName;
      } else {
        // برای divisionType 3، 4، 5، 6: از تابع جدید استفاده کن
        searchTerm = await buildExactSearchName(location);
      }

      let wikiPageId = null;
      let wikiData = null;
      let wikidataInfo = null;
      
      // مرحله اول: جستجو صفحه ویکی‌پدیا با عبارت دقیق
      try {
        console.log(`🔍 Searching for: "${searchTerm}"`);
        
        const searchRes = await axios.get('https://fa.wikipedia.org/w/api.php', {
          params: {
            action: 'query',
            list: 'search',
            srsearch: searchTerm,
            format: 'json',
            srlimit: 5
          }
        });
        
        if (searchRes.data.query && searchRes.data.query.search.length > 0) {
          // بررسی نتایج برای یافتن مطابقت دقیق
          const results = searchRes.data.query.search;
          
          for (const result of results) {
            const title = result.title.toLowerCase();
            const locationName = location.name.toLowerCase();
            const searchLower = searchTerm.toLowerCase();
            
            // بررسی مطابقت دقیق‌تر
            // ویژه برای کشور ایران
            if (location.divisionType === 0 && locationName === "ایران") {
              if (title === "ایران") {
                wikiPageId = result.pageid;
                console.log(`✅ Found exact match for Iran: "${result.title}"`);
                break;
              }
            } else if (title.includes(locationName) && title.includes(searchLower)) {
              wikiPageId = result.pageid;
              console.log(`✅ Found exact match: "${result.title}"`);
              break;
            }
          }
          
          // اگر مطابقت دقیق پیدا نشد، از اولین نتیجه استفاده کن
          if (!wikiPageId) {
            wikiPageId = results[0].pageid;
            console.log(`📝 Using first result: "${results[0].title}"`);
          }
        } else {
          // اگر با عبارت دقیق پیدا نشد، fallback بر اساس نوع تقسیمات
          let fallbackSearchTerm = '';
          
          if (location.divisionType === 0 || location.divisionType === 1) {
            // کشور یا استان: فقط name
            fallbackSearchTerm = location.name;
          } else if (location.divisionType === 2) {
            // شهرستان: فقط name
            fallbackSearchTerm = location.name;
          } else {
            // برای divisionType 3، 4، 5، 6: از تابع جدید استفاده کن
            fallbackSearchTerm = await buildExactSearchName(location);
          }
          
          console.log(`🔄 Fallback search for: "${fallbackSearchTerm}"`);
          
          const searchRes2 = await axios.get('https://fa.wikipedia.org/w/api.php', {
            params: {
              action: 'query',
              list: 'search',
              srsearch: fallbackSearchTerm,
              format: 'json',
              srlimit: 1
            }
          });
          if (searchRes2.data.query && searchRes2.data.query.search.length > 0) {
            wikiPageId = searchRes2.data.query.search[0].pageid;
            console.log(`📝 Using fallback result: "${searchRes2.data.query.search[0].title}"`);
          }
        }
      } catch (err) {
        console.error('❌ Wikipedia search error:', err.message);
        return this.response(res, 500, false, "خطا در جستجوی ویکی‌پدیا", null, err);
      }

      // مرحله دوم: واکشی اطلاعات صفحه ویکی‌پدیا
      if (wikiPageId) {
        try {
          const detailRes = await axios.get('https://fa.wikipedia.org/w/api.php', {
            params: {
              action: 'query',
              prop: 'extracts|pageimages|coordinates',
              pageids: wikiPageId,
              exintro: 1,
              explaintext: 1,
              piprop: 'original',
              pithumbsize: 600,
              format: 'json'
            }
          });
          const page = detailRes.data.query.pages[wikiPageId];
          wikiData = {
            title: page.title,
            extract: page.extract,
            image: page.original?.source || null,
            coordinates: page.coordinates?.[0] || null
          };
          console.log(`📄 Retrieved Wikipedia content for: "${page.title}"`);
        } catch (err) {
          console.error('❌ Wikipedia content fetch error:', err.message);
          wikiData = null;
        }
      }

      // مرحله سوم: دریافت اطلاعات Wikidata
      if (wikiPageId) {
        try {
          // دریافت Wikidata ID از ویکی‌پدیا
          const wikidataRes = await axios.get('https://fa.wikipedia.org/w/api.php', {
            params: {
              action: 'query',
              prop: 'pageprops',
              pageids: wikiPageId,
              ppprop: 'wikibase_item',
              format: 'json'
            }
          });
          
          const pageProps = wikidataRes.data.query.pages[wikiPageId].pageprops;
          if (pageProps && pageProps.wikibase_item) {
            const wikidataId = pageProps.wikibase_item;
            
            // دریافت اطلاعات از Wikidata
            const wikidataDataRes = await axios.get('https://www.wikidata.org/w/api.php', {
              params: {
                action: 'wbgetentities',
                ids: wikidataId,
                props: 'claims|descriptions|labels|sitelinks',
                languages: 'fa,en',
                format: 'json'
              }
            });
            
            const entity = wikidataDataRes.data.entities[wikidataId];
            if (entity) {
              wikidataInfo = {
                id: wikidataId,
                labels: entity.labels,
                descriptions: entity.descriptions,
                claims: entity.claims,
                sitelinks: entity.sitelinks
              };
              console.log(`🌐 Retrieved Wikidata info for: ${wikidataId}`);
            }
          }
        } catch (err) {
          console.log('Wikidata fetch error:', err.message);
          wikidataInfo = null;
        }
      }

      return this.response(res, 200, true, "اطلاعات ویکی‌پدیا و Wikidata دریافت شد.", {
        location,
        wiki: wikiData,
        wikidata: wikidataInfo,
        searchTerm: searchTerm
      });

    } catch (error) {
      console.error('❌ Error in getWikiDetails:', error);
      return this.response(res, 500, false, "خطا در دریافت اطلاعات ویکی‌پدیا و Wikidata", null, error);
    }
  }

  // ✅ دریافت اطلاعات ویکی‌پدیا برای لوکیشن بر اساس slug
  async getWikiDetailsBySlug(req, res) {
    try {
      const { slug } = req.params;
      
      const decodedSlug = decodeURIComponent(slug);
      
      const location = await Location.findOne({
        where: { 
          slug: decodedSlug,
          isActive: true 
        }
      });
      
      if (!location) {
        return this.response(res, 404, false, "لوکیشن یافت نشد.");
      }

      // تابع پیدا کردن شهرستان والد (مستقیم یا غیرمستقیم)
      const findParentCounty = async (locationId) => {
        let currentId = locationId;
        
        while (currentId) {
          const currentLocation = await Location.findByPk(currentId);
          if (!currentLocation) break;
          
          // اگر شهرستان باشد (divisionType === 2)
          if (currentLocation.divisionType === 2) {
            return currentLocation;
          }
          
          currentId = currentLocation.parentId;
        }
        
        return null;
      };

      // تابع ساخت نام جستجو دقیق برای هر لوکیشن
      const buildExactSearchName = async (location) => {
        // برای divisionType 3 (بخش): نام دقیق با شهرستان
        if (location.divisionType === 3) {
          const county = await findParentCounty(location.id);
          if (county) {
            // اگر نام بخش "مرکزی" باشد
            if (location.name === "مرکزی") {
              return `بخش مرکزی شهرستان ${county.name}`;
            } else {
              return `بخش ${location.name} شهرستان ${county.name}`;
            }
          }
        }
        
        // برای divisionType 4، 5، 6: نام دقیق با والد
        if ([4, 5, 6].includes(location.divisionType)) {
          // پیدا کردن والد
          const parent = await Location.findByPk(location.parentId);
          if (parent) {
            // اگر والد "مرکزی" باشد، شهرستان را پیدا کن
            if (parent.name === "مرکزی") {
              const county = await findParentCounty(location.parentId);
              if (county) {
                return `${location.name} (${county.name})`;
              }
            } else {
              // اگر والد "مرکزی" نباشد، نام والد را استفاده کن
              return `${location.name} (${parent.name})`;
            }
          }
        }
        
        // برای سایر موارد، نام اصلی را برگردان
        return location.name;
      };

      // ساخت عبارت جستجو دقیق بر اساس نوع تقسیمات
      let searchTerm = '';
      
      if (location.divisionType === 0) {
        // کشور: فقط displayName
        searchTerm = location.displayName;
      } else if (location.divisionType === 1) {
        // استان: فقط displayName
        searchTerm = location.displayName;
      } else if (location.divisionType === 2) {
        // شهرستان: اولویت با name، اگر نبود displayName
        searchTerm = location.name || location.displayName;
      } else {
        // برای divisionType 3، 4، 5، 6: از تابع جدید استفاده کن
        searchTerm = await buildExactSearchName(location);
      }

      let wikiPageId = null;
      let wikiData = null;
      let wikidataInfo = null;
      
      // مرحله اول: جستجو صفحه ویکی‌پدیا با عبارت دقیق
      try {
        console.log(`🔍 Searching for: "${searchTerm}"`);
        
        const searchRes = await axios.get('https://fa.wikipedia.org/w/api.php', {
          params: {
            action: 'query',
            list: 'search',
            srsearch: searchTerm,
            format: 'json',
            srlimit: 5
          }
        });
        
        if (searchRes.data.query && searchRes.data.query.search.length > 0) {
          // بررسی نتایج برای یافتن مطابقت دقیق
          const results = searchRes.data.query.search;
          
          for (const result of results) {
            const title = result.title.toLowerCase();
            const locationName = location.name.toLowerCase();
            const searchLower = searchTerm.toLowerCase();
            
            // بررسی مطابقت دقیق‌تر
            // ویژه برای کشور ایران
            if (location.divisionType === 0 && locationName === "ایران") {
              if (title === "ایران") {
                wikiPageId = result.pageid;
                console.log(`✅ Found exact match for Iran: "${result.title}"`);
                break;
              }
            } else if (title.includes(locationName) && title.includes(searchLower)) {
              wikiPageId = result.pageid;
              console.log(`✅ Found exact match: "${result.title}"`);
              break;
            }
          }
          
          // اگر مطابقت دقیق پیدا نشد، از اولین نتیجه استفاده کن
          if (!wikiPageId) {
            wikiPageId = results[0].pageid;
            console.log(`📝 Using first result: "${results[0].title}"`);
          }
        } else {
          // اگر با عبارت دقیق پیدا نشد، fallback بر اساس نوع تقسیمات
          let fallbackSearchTerm = '';
          
          if (location.divisionType === 0 || location.divisionType === 1) {
            // کشور یا استان: فقط name
            fallbackSearchTerm = location.name;
          } else if (location.divisionType === 2) {
            // شهرستان: فقط name
            fallbackSearchTerm = location.name;
          } else {
            // برای divisionType 3، 4، 5، 6: از تابع جدید استفاده کن
            fallbackSearchTerm = await buildExactSearchName(location);
          }
          
          console.log(`🔄 Fallback search for: "${fallbackSearchTerm}"`);
          
          const searchRes2 = await axios.get('https://fa.wikipedia.org/w/api.php', {
            params: {
              action: 'query',
              list: 'search',
              srsearch: fallbackSearchTerm,
              format: 'json',
              srlimit: 1
            }
          });
          if (searchRes2.data.query && searchRes2.data.query.search.length > 0) {
            wikiPageId = searchRes2.data.query.search[0].pageid;
            console.log(`📝 Using fallback result: "${searchRes2.data.query.search[0].title}"`);
          }
        }
      } catch (err) {
        console.error('❌ Wikipedia search error:', err.message);
        return this.response(res, 500, false, "خطا در جستجوی ویکی‌پدیا", null, err);
      }

      // مرحله دوم: واکشی اطلاعات صفحه ویکی‌پدیا
      if (wikiPageId) {
        try {
          const detailRes = await axios.get('https://fa.wikipedia.org/w/api.php', {
            params: {
              action: 'query',
              prop: 'extracts|pageimages|coordinates',
              pageids: wikiPageId,
              exintro: 1,
              explaintext: 1,
              piprop: 'original',
              pithumbsize: 600,
              format: 'json'
            }
          });
          const page = detailRes.data.query.pages[wikiPageId];
          wikiData = {
            title: page.title,
            extract: page.extract,
            image: page.original?.source || null,
            coordinates: page.coordinates?.[0] || null
          };
          console.log(`📄 Retrieved Wikipedia content for: "${page.title}"`);
        } catch (err) {
          console.error('❌ Wikipedia content fetch error:', err.message);
          wikiData = null;
        }
      }

      // مرحله سوم: دریافت اطلاعات Wikidata
      if (wikiPageId) {
        try {
          // دریافت Wikidata ID از ویکی‌پدیا
          const wikidataRes = await axios.get('https://fa.wikipedia.org/w/api.php', {
            params: {
              action: 'query',
              prop: 'pageprops',
              pageids: wikiPageId,
              ppprop: 'wikibase_item',
              format: 'json'
            }
          });
          
          const pageProps = wikidataRes.data.query.pages[wikiPageId].pageprops;
          if (pageProps && pageProps.wikibase_item) {
            const wikidataId = pageProps.wikibase_item;
            
            // دریافت اطلاعات از Wikidata
            const wikidataDataRes = await axios.get('https://www.wikidata.org/w/api.php', {
              params: {
                action: 'wbgetentities',
                ids: wikidataId,
                props: 'claims|descriptions|labels|sitelinks',
                languages: 'fa,en',
                format: 'json'
              }
            });
            
            const entity = wikidataDataRes.data.entities[wikidataId];
            if (entity) {
              wikidataInfo = {
                id: wikidataId,
                labels: entity.labels,
                descriptions: entity.descriptions,
                claims: entity.claims,
                sitelinks: entity.sitelinks
              };
              console.log(`🌐 Retrieved Wikidata info for: ${wikidataId}`);
            }
          }
        } catch (err) {
          console.log('Wikidata fetch error:', err.message);
          wikidataInfo = null;
        }
      }

      return this.response(res, 200, true, "اطلاعات ویکی‌پدیا و Wikidata دریافت شد.", {
        location,
        wiki: wikiData,
        wikidata: wikidataInfo,
        searchTerm: searchTerm
      });
    } catch (error) {
      return this.response(res, 500, false, "خطا در دریافت اطلاعات ویکی‌پدیا و Wikidata", null, error);
    }
  }

  // ✅ دریافت اطلاعات Wikidata برای لوکیشن
  async getWikidataInfo(req, res) {
    try {
      const { id } = req.params;
      const location = await Location.findByPk(id);
      if (!location) {
        return this.response(res, 404, false, "لوکیشن یافت نشد.");
      }

      // تابع پیدا کردن شهرستان والد (مستقیم یا غیرمستقیم)
      const findParentCounty = async (locationId) => {
        let currentId = locationId;
        
        while (currentId) {
          const currentLocation = await Location.findByPk(currentId);
          if (!currentLocation) break;
          
          // اگر شهرستان باشد (divisionType === 2)
          if (currentLocation.divisionType === 2) {
            return currentLocation;
          }
          
          currentId = currentLocation.parentId;
        }
        
        return null;
      };

      // ساخت عبارت جستجو بر اساس نوع تقسیمات
      let searchTerm = '';
      
      if (location.divisionType === 0) {
        // کشور: فقط displayName
        searchTerm = location.displayName;
      } else if (location.divisionType === 1) {
        // استان: فقط displayName
        searchTerm = location.displayName;
      } else if (location.divisionType === 2) {
        // شهرستان: اولویت با name، اگر نبود displayName
        searchTerm = location.name || location.displayName;
      } else {
        // پایین‌تر از شهرستان: displayName + خط فاصله + نام شهرستان والد
        const parentCounty = await findParentCounty(location.parentId);
        if (parentCounty) {
          searchTerm = `${location.displayName} - ${parentCounty.displayName}`;
        } else {
          // اگر شهرستان والد پیدا نشد، فقط displayName
          searchTerm = location.displayName;
        }
      }

      let wikiPageId = null;
      let wikidataInfo = null;
      
      // مرحله اول: جستجو صفحه ویکی‌پدیا
      try {
        const searchRes = await axios.get('https://fa.wikipedia.org/w/api.php', {
          params: {
            action: 'query',
            list: 'search',
            srsearch: searchTerm,
            format: 'json',
            srlimit: 1
          }
        });
        if (searchRes.data.query && searchRes.data.query.search.length > 0) {
          wikiPageId = searchRes.data.query.search[0].pageid;
        } else {
          // اگر با عبارت کامل پیدا نشد، fallback بر اساس نوع تقسیمات
          let fallbackSearchTerm = '';
          
          if (location.divisionType === 0 || location.divisionType === 1) {
            // کشور یا استان: فقط name
            fallbackSearchTerm = location.name;
          } else if (location.divisionType === 2) {
            // شهرستان: فقط name
            fallbackSearchTerm = location.name;
          } else {
            // پایین‌تر از شهرستان: ابتدا شهرستان والد را پیدا کن
            const parentCounty = await findParentCounty(location.parentId);
            if (parentCounty) {
              fallbackSearchTerm = parentCounty.name; // از نام شهرستان والد استفاده کن
            } else {
              fallbackSearchTerm = `${location.displayName} ایران`;
            }
          }
          
          const searchRes2 = await axios.get('https://fa.wikipedia.org/w/api.php', {
            params: {
              action: 'query',
              list: 'search',
              srsearch: fallbackSearchTerm,
              format: 'json',
              srlimit: 1
            }
          });
          if (searchRes2.data.query && searchRes2.data.query.search.length > 0) {
            wikiPageId = searchRes2.data.query.search[0].pageid;
          }
        }
      } catch (err) {
        return this.response(res, 500, false, "خطا در جستجوی ویکی‌پدیا", null, err);
      }

      // مرحله دوم: دریافت اطلاعات Wikidata
      if (wikiPageId) {
        try {
          // دریافت Wikidata ID از ویکی‌پدیا
          const wikidataRes = await axios.get('https://fa.wikipedia.org/w/api.php', {
            params: {
              action: 'query',
              prop: 'pageprops',
              pageids: wikiPageId,
              ppprop: 'wikibase_item',
              format: 'json'
            }
          });
          
          const pageProps = wikidataRes.data.query.pages[wikiPageId].pageprops;
          if (pageProps && pageProps.wikibase_item) {
            const wikidataId = pageProps.wikibase_item;
            
            // دریافت اطلاعات از Wikidata
            const wikidataDataRes = await axios.get('https://www.wikidata.org/w/api.php', {
              params: {
                action: 'wbgetentities',
                ids: wikidataId,
                props: 'claims|descriptions|labels|sitelinks',
                languages: 'fa,en',
                format: 'json'
              }
            });
            
            const entity = wikidataDataRes.data.entities[wikidataId];
            if (entity) {
              wikidataInfo = {
                id: wikidataId,
                labels: entity.labels,
                descriptions: entity.descriptions,
                claims: entity.claims,
                sitelinks: entity.sitelinks
              };
            }
          }
        } catch (err) {
          console.log('Wikidata fetch error:', err.message);
          wikidataInfo = null;
        }
      }

      return this.response(res, 200, true, "اطلاعات Wikidata دریافت شد.", {
        location,
        wikidata: wikidataInfo
      });
    } catch (error) {
      return this.response(res, 500, false, "خطا در دریافت اطلاعات Wikidata", null, error);
    }
  }

  // ✅ دریافت اطلاعات Wikidata برای لوکیشن بر اساس slug
  async getWikidataInfoBySlug(req, res) {
    try {
      const { slug } = req.params;
      
      const decodedSlug = decodeURIComponent(slug);
      
      const location = await Location.findOne({
        where: { 
          slug: decodedSlug,
          isActive: true 
        }
      });
      
      if (!location) {
        return this.response(res, 404, false, "لوکیشن یافت نشد.");
      }

      // تابع پیدا کردن شهرستان والد (مستقیم یا غیرمستقیم)
      const findParentCounty = async (locationId) => {
        let currentId = locationId;
        
        while (currentId) {
          const currentLocation = await Location.findByPk(currentId);
          if (!currentLocation) break;
          
          // اگر شهرستان باشد (divisionType === 2)
          if (currentLocation.divisionType === 2) {
            return currentLocation;
          }
          
          currentId = currentLocation.parentId;
        }
        
        return null;
      };

      // ساخت عبارت جستجو بر اساس نوع تقسیمات
      let searchTerm = '';
      
      if (location.divisionType === 0) {
        // کشور: فقط displayName
        searchTerm = location.displayName;
      } else if (location.divisionType === 1) {
        // استان: فقط displayName
        searchTerm = location.displayName;
      } else if (location.divisionType === 2) {
        // شهرستان: اولویت با name، اگر نبود displayName
        searchTerm = location.name || location.displayName;
      } else {
        // پایین‌تر از شهرستان: displayName + خط فاصله + نام شهرستان والد
        const parentCounty = await findParentCounty(location.parentId);
        if (parentCounty) {
          searchTerm = `${location.displayName} - ${parentCounty.displayName}`;
        } else {
          // اگر شهرستان والد پیدا نشد، فقط displayName
          searchTerm = location.displayName;
        }
      }

      let wikiPageId = null;
      let wikidataInfo = null;
      
      // مرحله اول: جستجو صفحه ویکی‌پدیا
      try {
        const searchRes = await axios.get('https://fa.wikipedia.org/w/api.php', {
          params: {
            action: 'query',
            list: 'search',
            srsearch: searchTerm,
            format: 'json',
            srlimit: 1
          }
        });
        if (searchRes.data.query && searchRes.data.query.search.length > 0) {
          wikiPageId = searchRes.data.query.search[0].pageid;
        } else {
          // اگر با عبارت کامل پیدا نشد، fallback بر اساس نوع تقسیمات
          let fallbackSearchTerm = '';
          
          if (location.divisionType === 0 || location.divisionType === 1) {
            // کشور یا استان: فقط name
            fallbackSearchTerm = location.name;
          } else if (location.divisionType === 2) {
            // شهرستان: فقط name
            fallbackSearchTerm = location.name;
          } else {
            // پایین‌تر از شهرستان: ابتدا شهرستان والد را پیدا کن
            const parentCounty = await findParentCounty(location.parentId);
            if (parentCounty) {
              fallbackSearchTerm = parentCounty.name; // از نام شهرستان والد استفاده کن
            } else {
              fallbackSearchTerm = `${location.displayName} ایران`;
            }
          }
          
          const searchRes2 = await axios.get('https://fa.wikipedia.org/w/api.php', {
            params: {
              action: 'query',
              list: 'search',
              srsearch: fallbackSearchTerm,
              format: 'json',
              srlimit: 1
            }
          });
          if (searchRes2.data.query && searchRes2.data.query.search.length > 0) {
            wikiPageId = searchRes2.data.query.search[0].pageid;
          }
        }
      } catch (err) {
        return this.response(res, 500, false, "خطا در جستجوی ویکی‌پدیا", null, err);
      }

      // مرحله دوم: دریافت اطلاعات Wikidata
      if (wikiPageId) {
        try {
          // دریافت Wikidata ID از ویکی‌پدیا
          const wikidataRes = await axios.get('https://fa.wikipedia.org/w/api.php', {
            params: {
              action: 'query',
              prop: 'pageprops',
              pageids: wikiPageId,
              ppprop: 'wikibase_item',
              format: 'json'
            }
          });
          
          const pageProps = wikidataRes.data.query.pages[wikiPageId].pageprops;
          if (pageProps && pageProps.wikibase_item) {
            const wikidataId = pageProps.wikibase_item;
            
            // دریافت اطلاعات از Wikidata
            const wikidataDataRes = await axios.get('https://www.wikidata.org/w/api.php', {
              params: {
                action: 'wbgetentities',
                ids: wikidataId,
                props: 'claims|descriptions|labels|sitelinks',
                languages: 'fa,en',
                format: 'json'
              }
            });
            
            const entity = wikidataDataRes.data.entities[wikidataId];
            if (entity) {
              wikidataInfo = {
                id: wikidataId,
                labels: entity.labels,
                descriptions: entity.descriptions,
                claims: entity.claims,
                sitelinks: entity.sitelinks
              };
            }
          }
        } catch (err) {
          console.log('Wikidata fetch error:', err.message);
          wikidataInfo = null;
        }
      }

      return this.response(res, 200, true, "اطلاعات Wikidata دریافت شد.", {
        location,
        wikidata: wikidataInfo
      });
    } catch (error) {
      return this.response(res, 500, false, "خطا در دریافت اطلاعات Wikidata", null, error);
    }
  }


}

module.exports = new LocationController(); 