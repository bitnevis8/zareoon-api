const Role = require("../modules/user/role/model");
const UserRole = require("../modules/user/userRole/model");

const DEFAULT_ROLE_CANDIDATES = ["user", "customer"];
const SELLER_ROLE_CANDIDATES = ["seller", "supplier"];
const SERVICE_PROVIDER_ROLE_CANDIDATES = ["service_provider"];

async function findRoleByCandidates(candidates) {
  for (const name of candidates) {
    const role = await Role.findOne({ where: { name } });
    if (role) return role;
  }
  return null;
}

async function ensureUserHasRole(userId, candidates) {
  if (!userId) return { ok: false, reason: "missing_user" };
  const role = await findRoleByCandidates(candidates);
  if (!role) return { ok: false, reason: "role_not_found" };

  const [link, created] = await UserRole.findOrCreate({
    where: { userId, roleId: role.id },
    defaults: { userId, roleId: role.id },
  });

  return { ok: true, role, link, created };
}

async function findDefaultUserRole() {
  return findRoleByCandidates(DEFAULT_ROLE_CANDIDATES);
}

async function ensureSellerRole(userId) {
  return ensureUserHasRole(userId, SELLER_ROLE_CANDIDATES);
}

async function ensureServiceProviderRole(userId) {
  return ensureUserHasRole(userId, SERVICE_PROVIDER_ROLE_CANDIDATES);
}

module.exports = {
  findRoleByCandidates,
  findDefaultUserRole,
  ensureUserHasRole,
  ensureSellerRole,
  ensureServiceProviderRole,
  DEFAULT_ROLE_CANDIDATES,
  SELLER_ROLE_CANDIDATES,
  SERVICE_PROVIDER_ROLE_CANDIDATES,
};
