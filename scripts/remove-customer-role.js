const sequelize = require('../src/core/database/mysql/connection');
const Role = require('../src/modules/user/role/model');
const UserRole = require('../src/modules/user/userRole/model');

const removeCustomerRole = async () => {
  try {
    console.log('🔍 Starting customer role removal...');
    
    // Find the customer role
    const customerRole = await Role.findOne({
      where: { name: 'customer' }
    });
    
    if (!customerRole) {
      console.log('✅ Customer role not found - already removed or never existed');
      return;
    }
    
    console.log('🔍 Found customer role with ID:', customerRole.id);
    
    // Remove all user-role associations for customer role
    const deletedUserRoles = await UserRole.destroy({
      where: { roleId: customerRole.id }
    });
    
    console.log(`✅ Removed ${deletedUserRoles} user-role associations for customer role`);
    
    // Delete the customer role itself
    await customerRole.destroy();
    
    console.log('✅ Customer role successfully removed from database');
    
  } catch (error) {
    console.error('❌ Error removing customer role:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
};

// Run the script
removeCustomerRole()
  .then(() => {
    console.log('🎉 Customer role removal completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Customer role removal failed:', error);
    process.exit(1);
  });
