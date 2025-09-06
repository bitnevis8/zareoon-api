const sequelize = require('../src/core/database/mysql/connection');
const Product = require('../src/modules/farmer/product/model');
const InventoryLot = require('../src/modules/farmer/inventoryLot/model');

const testStockCalculation = async () => {
  try {
    console.log('🧪 Testing stock calculation...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Get all products
    const allProducts = await Product.findAll({
      where: { isActive: true },
      order: [["id", "ASC"]]
    });
    console.log(`📦 Found ${allProducts.length} products`);
    
    // Get all inventory lots
    const { Op } = require('sequelize');
    const allInventoryLots = await InventoryLot.findAll({
      where: { status: { [Op.in]: ["harvested", "reserved"] } }
    });
    console.log(`📦 Found ${allInventoryLots.length} inventory lots`);
    
    // Test wheat products
    const wheatProducts = allProducts.filter(p => p.parentId === 1001);
    console.log(`\n🌾 Wheat products (parentId: 1001):`);
    wheatProducts.forEach(product => {
      console.log(`  - ${product.name} (ID: ${product.id}, orderable: ${product.isOrderable})`);
    });
    
    // Test inventory lots for wheat products
    console.log(`\n📊 Inventory lots for wheat products:`);
    for (const product of wheatProducts) {
      const productLots = allInventoryLots.filter(lot => lot.productId === product.id);
      console.log(`\n  ${product.name} (ID: ${product.id}):`);
      if (productLots.length > 0) {
        let totalStock = 0;
        let reservedStock = 0;
        productLots.forEach(lot => {
          const total = parseFloat(lot.totalQuantity || 0);
          const reserved = parseFloat(lot.reservedQuantity || 0);
          const available = total - reserved;
          totalStock += total;
          reservedStock += reserved;
          console.log(`    - ${lot.qualityGrade}: ${total}kg total, ${reserved}kg reserved, ${available}kg available`);
        });
        const availableStock = totalStock - reservedStock;
        console.log(`    📈 Total: ${totalStock}kg, Reserved: ${reservedStock}kg, Available: ${availableStock}kg`);
      } else {
        console.log(`    ❌ No inventory lots found`);
      }
    }
    
    // Test wheat category (ID: 1001)
    console.log(`\n🌾 Wheat category (ID: 1001):`);
    const calculateCategoryStock = (categoryId) => {
      let totalStock = 0;
      const findChildrenRecursive = (currentParentId) => {
        const directChildren = allProducts.filter(p => p.parentId === currentParentId);
        directChildren.forEach(child => {
          if (child.isOrderable) {
            const productLots = allInventoryLots.filter(lot => lot.productId === child.id);
            if (productLots.length > 0) {
              const childTotalStock = productLots.reduce((sum, lot) => sum + (lot.totalQuantity || 0), 0);
              const childReservedStock = productLots.reduce((sum, lot) => sum + (lot.reservedQuantity || 0), 0);
              const childAvailableStock = childTotalStock - childReservedStock;
              totalStock += childAvailableStock;
              console.log(`    - ${child.name}: ${childAvailableStock}kg available`);
            }
          } else {
            findChildrenRecursive(child.id);
          }
        });
      };
      findChildrenRecursive(categoryId);
      return totalStock;
    };
    
    const wheatTotalStock = calculateCategoryStock(1001);
    console.log(`    📈 Total wheat available stock: ${wheatTotalStock}kg`);
    
    console.log('\n✅ Stock calculation test completed!');
    
  } catch (error) {
    console.error('❌ Error during stock calculation test:', error);
  } finally {
    await sequelize.close();
  }
};

testStockCalculation();
