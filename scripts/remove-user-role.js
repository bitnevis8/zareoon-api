const sequelize = require('../src/core/database/mysql/connection');
const Role = require('../src/modules/user/role/model');
const UserRole = require('../src/modules/user/userRole/model');

const removeUserRole = async () => {
  try {
    console.log('🔍 Starting user role removal...');
    
    // Find the user role
    const userRole = await Role.findOne({
      where: { name: 'user' }
    });
    
    if (!userRole) {
      console.log('✅ User role not found - already removed or never existed');
      return;
    }
    
    console.log('🔍 Found user role with ID:', userRole.id);
    
    // Remove all user-role associations for user role
    const deletedUserRoles = await UserRole.destroy({
      where: { roleId: userRole.id }
    });
    
    console.log(`✅ Removed ${deletedUserRoles} user-role associations for user role`);
    
    // Delete the user role itself
    await userRole.destroy();
    
    console.log('✅ User role successfully removed from database');
    
  } catch (error) {
    console.error('❌ Error removing user role:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
};

// Run the script
removeUserRole()
  .then(() => {
    console.log('🎉 User role removal completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 User role removal failed:', error);
    process.exit(1);
  });
