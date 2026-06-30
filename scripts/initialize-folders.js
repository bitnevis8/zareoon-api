/**
 * ایجاد ساختار پوشه‌های FTP (یک‌بار اجرا کنید)
 * NODE_ENV=development node scripts/initialize-folders.js
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const ftpService = require('../src/modules/fileUpload/services/ftpService');

(async () => {
  try {
    await ftpService.initializeDirectoryStructure();
    console.log('✅ FTP directories initialized');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
})();
