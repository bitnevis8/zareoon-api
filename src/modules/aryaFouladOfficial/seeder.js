const User = require("../user/user/model");
const data = require("./seederData.json");
const {
  ensureRole,
  upsertAccount,
  upsertTradeProvider,
  ensureProviderWorkspace,
} = require("../zareoonOfficial/seeder");

/**
 * صفحه رسمی بازرسی مهندسی آریا فولاد قرن برای مهدی رحیمی
 */
async function seedAryaFouladOfficial() {
  console.log("🌱 Seeding Arya Foulad Qarn inspection services...");

  const ownerEmail = data.ownerEmail || "rahimi@zareoon.ir";
  const user = await User.findOne({ where: { email: ownerEmail } });
  if (!user) {
    console.warn(`⚠️ Owner user not found (${ownerEmail}); skip Arya Foulad seed`);
    return;
  }

  await ensureRole(user.id, "service_provider");

  const account = await upsertAccount(user, {
    ...(data.account || {}),
    shopStatus: "INACTIVE",
    shopContacts: null,
  });
  console.log(`✅ Arya account ready id=${account.id} slug=${account.profileSlug} (no public shop)`);

  const workspace = await ensureProviderWorkspace(user, account);
  console.log(`✅ Arya workspace ready id=${workspace.id} slug=${workspace.profileSlug}`);

  const officialAvatar = data.avatarUrl || "/images/advertice/afg-insp.png";
  if (user.avatar !== officialAvatar) {
    await user.update({ avatar: officialAvatar });
    console.log(`✅ Arya avatar set → ${officialAvatar}`);
  }

  const providerCfg = {
    ...(data.tradeProvider || {}),
    logoUrl: data.tradeProvider?.logoUrl || officialAvatar,
  };
  const provider = await upsertTradeProvider(user, providerCfg, workspace.id);
  console.log(`✅ Arya trade provider ready id=${provider.id} slug=${provider.profileSlug}`);

  console.log("✅ Arya Foulad Qarn seeding completed! → /afg-insp");
}

module.exports = seedAryaFouladOfficial;
