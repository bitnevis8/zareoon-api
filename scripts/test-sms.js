const { initializeDatabase } = require("../src/core/database/init");
const User = require("../src/modules/user/user/model");
const Role = require("../src/modules/user/role/model");
const UserRole = require("../src/modules/user/userRole/model");
const config = require("config");
const axios = require("axios");

async function testSMS() {
  try {
    console.log("🚀 Testing SMS system...");
    
    // Initialize database
    await initializeDatabase({ 
      force: false,
      seed: false,
      useMongoDB: false
    });
    
    console.log("✅ Database initialized");
    
    // Check if User role exists
    const userRole = await Role.findOne({ where: { name: "user" } });
    if (!userRole) {
      console.log("❌ User role not found. Creating...");
      await Role.create({
        name: "user",
        nameEn: "User",
        nameFa: "کاربر",
        description: "کاربر عادی سیستم"
      });
      console.log("✅ User role created");
    } else {
      console.log("✅ User role exists");
    }
    
    // Test mobile registration
    const testMobile = "09167326397";
    
    // Check if user already exists
    const existingUser = await User.findOne({ where: { mobile: testMobile } });
    if (existingUser) {
      console.log("⚠️ User already exists, deleting...");
      await UserRole.destroy({ where: { userId: existingUser.id } });
      await existingUser.destroy();
      console.log("✅ Old user deleted");
    }
    
    // Create new user
    const mobileVerifyCode = Math.floor(100000 + Math.random() * 900000);
    const newUser = await User.create({
      firstName: "تست",
      lastName: "کاربر",
      mobile: testMobile,
      username: "testuser",
      password: "123456",
      mobileVerifyCode,
      isMobileVerified: false,
      isActive: true,
    });
    
    console.log("✅ User created:", newUser.id);
    
    // Assign role
    const role = await Role.findOne({ where: { name: "user" } });
    await UserRole.create({
      userId: newUser.id,
      roleId: role.id
    });
    
    console.log("✅ Role assigned");
    
    // Test SMS sending
    const data = JSON.stringify({
      mobile: testMobile,
      templateId: config.get("SMS.TEMPLATE_ID"),
      parameters: [
        { name: "CODE", value: mobileVerifyCode.toString() }
      ]
    });

    const smsConfig = {
      method: "post",
      url: "https://api.sms.ir/v1/send/verify",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/plain",
        "x-api-key": config.get("SMS.API_KEY")
      },
      data: data
    };

    try {
      const response = await axios(smsConfig);
      console.log("✅ SMS sent successfully!");
      console.log("📱 SMS Response:", response.data);
      console.log("🔑 Verification code:", mobileVerifyCode);
    } catch (smsError) {
      console.error("❌ SMS sending failed:", smsError.response?.data || smsError.message);
    }
    
    console.log("✅ Test completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testSMS();
