const { spawnSync } = require("child_process");

const REGISTRIES = [
  { name: "پارس‌پک", url: "https://mirror.abrha.net/repository/npm/" },
  { name: "لیارا", url: "https://package-mirror.liara.ir/repository/npm/" },
  { name: "npm اصلی", url: "https://registry.npmjs.org/" },
];

const projectDir = process.cwd();
const extraArgs = process.argv.slice(2);

function runInstall(registry, label) {
  console.log(`\n>>> npm install — ${label} (${registry})\n`);
  const result = spawnSync("npm", ["install", ...extraArgs], {
    cwd: projectDir,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      npm_config_registry: registry,
      ZAREOON_NPM_FALLBACK: "1",
    },
  });
  return result.status === 0;
}

for (let i = 0; i < REGISTRIES.length; i++) {
  const { name, url } = REGISTRIES[i];
  if (runInstall(url, name)) {
    process.exit(0);
  }
  const next = REGISTRIES[i + 1];
  if (next) {
    console.error(
      `\nمیرور ${name} در دسترس نبود یا نصب ناموفق بود؛ تلاش با ${next.name}...\n`
    );
  }
}

process.exit(1);
