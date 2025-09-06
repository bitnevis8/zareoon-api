const mysqlConnection = require("../src/core/database/mysql/connection");

async function updateOrderItemStatusEnum() {
  try {
    console.log("🔄 Updating order_items.status ENUM...");
    
    // First, we need to modify the column to allow the new ENUM values
    await mysqlConnection.query(`
      ALTER TABLE order_items 
      MODIFY COLUMN status ENUM(
        'pending',
        'approved',
        'assigned', 
        'reviewing',
        'preparing',
        'ready',
        'shipped',
        'delivered',
        'cancelled',
        'rejected',
        'processing'
      ) NOT NULL DEFAULT 'pending'
    `);
    
    console.log("✅ order_items.status ENUM updated successfully!");
    
    // Update any existing records that might have invalid status values
    await mysqlConnection.query(`
      UPDATE order_items 
      SET status = 'pending' 
      WHERE status NOT IN (
        'pending', 'approved', 'assigned', 'reviewing', 
        'preparing', 'ready', 'shipped', 'delivered', 
        'cancelled', 'rejected', 'processing'
      )
    `);
    
    console.log("✅ Existing records updated to valid status values!");
    
  } catch (error) {
    console.error("❌ Error updating order_items.status ENUM:", error);
    throw error;
  } finally {
    await mysqlConnection.close();
  }
}

// Run the update
updateOrderItemStatusEnum()
  .then(() => {
    console.log("🎉 Database update completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Database update failed:", error);
    process.exit(1);
  });
