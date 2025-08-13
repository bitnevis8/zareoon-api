const Location = require("./model");
const seederData = require("./seederData.json");

const seedLocations = async () => {
  try {
    console.log("🌱 Seeding Locations...");

    // Extract data array from JSON structure
    const locations = seederData.data || seederData;

    // Sort by divisionType ascending so parents are inserted first
    const sortedLocations = locations.sort((a, b) => {
      const da = parseInt(a.divisionType || 99, 10);
      const db = parseInt(b.divisionType || 99, 10);
      return da - db;
    });

    // Disable FK checks for bulk insert performance
    await Location.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const location of sortedLocations) {
      const data = {
        id: location.id,
        parentId: location.parentId,
        name: location.name,
        displayName: location.displayName,
        displayNameFull: location.displayNameFull || null,
        displayNameFull2: location.displayNameFull2 || null,
        code: location.code || null,
        divisionType: location.divisionType,
        divisionTypeName: location.divisionTypeName || null,
        slug: location.slug || null,
      };

      try {
        const existed = await Location.findByPk(data.id);
        if (!existed) {
          await Location.create(data);
          console.log(`✅ Location created: ${data.name}`);
        } else {
          // Update existing record with new fields
          await Location.update(data, { where: { id: data.id } });
          console.log(`🔄 Location updated: ${data.name}`);
        }
      } catch (error) {
        console.error(`❌ Error creating/updating location ${data.name}:`, error.message);
        // Continue with next location instead of stopping
      }
    }

    await Location.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log("✅ Locations seeding completed!");
  } catch (error) {
    console.error("❌ Error seeding Locations:", error);
    throw error;
  }
};

module.exports = seedLocations; 