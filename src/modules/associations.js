const User = require('./user/user/model');
const Role = require('./user/role/model');
const UserRole = require('./user/userRole/model');
// const { MissionOrder, MissionCompanion } = require('./aryafoulad/missionOrder/model');
const FileUpload = require('./fileUpload/model');
// const Item = require('./aryafoulad/warehouseModule/item/model');
// const Inventory = require('./aryafoulad/warehouseModule/inventory/model');
// const Warehouse = require('./aryafoulad/warehouseModule/warehouse/model');
// const StockHistory = require('./aryafoulad/warehouseModule/stockHistory/model');
// const ItemAssignment = require('./aryafoulad/warehouseModule/itemAssignment/model');

// Articles module removed

// Import مدل‌های ماژول location
const Location = require('./location/model');
// ===== Farmer module models =====
const Product = require('./farmer/product/model');
const CustomAttributeDefinition = require('./farmer/customAttributeDefinition/model');
const InventoryLot = require('./farmer/inventoryLot/model');
const CustomAttributeValue = require('./farmer/customAttributeValue/model');
const Order = require('./farmer/order/model');
const OrderItem = require('./farmer/orderItem/model');
const TransactionHistory = require('./farmer/transactionHistory/model');
const OrderRequestItem = require('./farmer/orderRequestItem/model');

// تعریف ارتباطات بین مدل‌ها
const defineAssociations = () => {
    // ارتباطات مربوط به کاربران و نقش‌ها
    // User.belongsTo(Role, { 
    //     foreignKey: "roleId", 
    //     as: "role",
    //     onDelete: 'RESTRICT',
    //     onUpdate: 'CASCADE'
    // });
    // Role.hasMany(User, { 
    //     foreignKey: "roleId", 
    //     as: "users" 
    // });

    // ارتباطات Many-to-Many بین User و Role
    User.belongsToMany(Role, {
        through: UserRole,
        foreignKey: 'userId',
        otherKey: 'roleId',
        as: 'userRoles',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });
    Role.belongsToMany(User, {
        through: UserRole,
        foreignKey: 'roleId',
        otherKey: 'userId',
        as: 'roleUsers',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // ارتباطات مربوط به ماموریت‌ها
    // MissionOrder.belongsTo(User, { 
    //     foreignKey: 'userId', 
    //     as: 'user',
    //     onDelete: 'RESTRICT',
    //     onUpdate: 'CASCADE'
    // });
    // MissionOrder.belongsToMany(User, { 
    //     through: MissionCompanion, 
    //     as: 'missionCompanions',
    //     foreignKey: 'missionOrderId',
    //     otherKey: 'userId',
    //     onDelete: 'CASCADE',
    //     onUpdate: 'CASCADE'
    // });
    // User.belongsToMany(MissionOrder, { 
    //     through: MissionCompanion, 
    //     as: 'missions',
    //     foreignKey: 'userId',
    //     otherKey: 'missionOrderId',
    //     onDelete: 'CASCADE',
    //     onUpdate: 'CASCADE'
    // });

    // ارتباطات مربوط به فایل‌ها
    // MissionOrder.hasMany(FileUpload, {
    //     foreignKey: 'missionOrderId',
    //     as: 'files',
    //     onDelete: 'CASCADE',
    //     onUpdate: 'CASCADE'
    // });
    // FileUpload.belongsTo(MissionOrder, {
    //     foreignKey: 'missionOrderId',
    //     as: 'missionOrder',
    //     onDelete: 'CASCADE',
    //     onUpdate: 'CASCADE'
    // });

    // ارتباطات مربوط به انبار
    // Warehouse.hasMany(Inventory, { 
    //     foreignKey: 'warehouseId', 
    //     as: 'inventories',
    //     onDelete: 'RESTRICT',
    //     onUpdate: 'CASCADE'
    // });
    // Inventory.belongsTo(Warehouse, { 
    //     foreignKey: 'warehouseId', 
    //     as: 'warehouse',
    //     onDelete: 'RESTRICT',
    //     onUpdate: 'CASCADE'
    // });

    // ارتباطات مربوط به کالا
    // Item.hasMany(Inventory, { 
    //     foreignKey: 'itemId', 
    //     as: 'inventories',
    //     onDelete: 'RESTRICT',
    //     onUpdate: 'CASCADE'
    // });
    // Inventory.belongsTo(Item, { 
    //     foreignKey: 'itemId', 
    //     as: 'item',
    //     onDelete: 'RESTRICT',
    //     onUpdate: 'CASCADE'
    // });

    // ارتباطات مربوط به تخصیص کالا
    // Item.hasMany(ItemAssignment, { 
    //     foreignKey: 'itemId', 
    //     as: 'assignments',
    //     onDelete: 'RESTRICT',
    //     onUpdate: 'CASCADE'
    // });
    // ItemAssignment.belongsTo(Item, { 
    //     foreignKey: 'itemId', 
    //     as: 'assignedItem',
    //     onDelete: 'RESTRICT',
    //     onUpdate: 'CASCADE'
    // });

    // ارتباطات مربوط به تاریخچه موجودی
    // Inventory.hasMany(StockHistory, { 
    //     foreignKey: 'inventoryId', 
    //     as: 'stockHistory',
    //     onDelete: 'CASCADE',
    //     onUpdate: 'CASCADE'
    // });
    // StockHistory.belongsTo(Inventory, { 
    //     foreignKey: 'inventoryId', 
    //     as: 'inventory',
    //     onDelete: 'CASCADE',
    //     onUpdate: 'CASCADE'
    // });

    // ارتباطات مربوط به تخصیص و کاربر
    // ItemAssignment.belongsTo(User, { 
    //     foreignKey: 'userId', 
    //     as: 'assignedUser',
    //     onDelete: 'RESTRICT',
    //     onUpdate: 'CASCADE'
    // });

    // ===== Articles associations removed =====

    // ===== ارتباطات ماژول Location =====
    
    // ارتباطات سلسله‌مراتبی Location (self-referencing)
    Location.hasMany(Location, { 
        foreignKey: 'parentId', 
        as: 'children',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
    });
    Location.belongsTo(Location, { 
        foreignKey: 'parentId', 
        as: 'parent',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
    });

    // ===== Farmer module associations =====
    // Product self hierarchy (categories and products in one table)
    Product.hasMany(Product, { foreignKey: 'parentId', as: 'children', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
    Product.belongsTo(Product, { foreignKey: 'parentId', as: 'parent', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });

    // CustomAttributeDefinition relation: can point to category (non-orderable) or specific product (orderable)
    Product.hasMany(CustomAttributeDefinition, { foreignKey: 'categoryId', as: 'attributeDefinitions', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    CustomAttributeDefinition.belongsTo(Product, { foreignKey: 'categoryId', as: 'category', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    Product.hasMany(CustomAttributeDefinition, { foreignKey: 'productId', as: 'productAttributeDefinitions', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    CustomAttributeDefinition.belongsTo(Product, { foreignKey: 'productId', as: 'product', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

    // InventoryLot relations
    User.hasMany(InventoryLot, { foreignKey: 'farmerId', as: 'inventoryLots', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
    InventoryLot.belongsTo(User, { foreignKey: 'farmerId', as: 'farmer', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
    Product.hasMany(InventoryLot, { foreignKey: 'productId', as: 'inventoryLots', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
    InventoryLot.belongsTo(Product, { foreignKey: 'productId', as: 'product', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });

    // CustomAttributeValue -> InventoryLot & Definition
    InventoryLot.hasMany(CustomAttributeValue, { foreignKey: 'inventoryLotId', as: 'attributes', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    CustomAttributeValue.belongsTo(InventoryLot, { foreignKey: 'inventoryLotId', as: 'inventoryLot', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    CustomAttributeDefinition.hasMany(CustomAttributeValue, { foreignKey: 'attributeDefinitionId', as: 'values', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    CustomAttributeValue.belongsTo(CustomAttributeDefinition, { foreignKey: 'attributeDefinitionId', as: 'definition', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

    // Orders & Cart
    User.hasMany(Order, { foreignKey: 'customerId', as: 'orders', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
    Order.belongsTo(User, { foreignKey: 'customerId', as: 'customer', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
    Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    InventoryLot.hasMany(OrderItem, { foreignKey: 'inventoryLotId', as: 'orderItems', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
    OrderItem.belongsTo(InventoryLot, { foreignKey: 'inventoryLotId', as: 'inventoryLot', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });

    // Order request items (pre-allocation)
    Order.hasMany(OrderRequestItem, { foreignKey: 'orderId', as: 'requestItems', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    OrderRequestItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

    // Cart relations (local require to avoid circular at top)
    const { Cart, CartItem } = require('./farmer/cart/model');
    User.hasMany(Cart, { foreignKey: 'customerId', as: 'carts', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
    Cart.belongsTo(User, { foreignKey: 'customerId', as: 'customer', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
    Cart.hasMany(CartItem, { foreignKey: 'cartId', as: 'items', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    CartItem.belongsTo(Cart, { foreignKey: 'cartId', as: 'cart', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

    // TransactionHistory
    InventoryLot.hasMany(TransactionHistory, { foreignKey: 'inventoryLotId', as: 'transactions', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    TransactionHistory.belongsTo(InventoryLot, { foreignKey: 'inventoryLotId', as: 'inventoryLot', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
};

module.exports = defineAssociations; 