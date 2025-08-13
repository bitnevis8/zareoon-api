/*
  Usage:
    node api/src/modules/farmer/product/updateUnitsInSeederData.js

  What it does:
  - Reads seederData.json (array of products/categories)
  - If an item has no explicit `unit`, infers a default unit based on `validUnits`:
      Kilogram -> kg
      Ton -> ton
      Liter -> l
      Count -> count
      Box -> box
      Crate -> crate
      Pack -> pack
  - Writes back the updated JSON with a pretty format
*/

const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, 'seederData.json');

function inferUnit(validUnits) {
  if (!Array.isArray(validUnits)) return null;
  const pref = (s) => validUnits.some(v => String(v).toLowerCase() === s);
  if (pref('kilogram')) return 'kg';
  if (pref('ton')) return 'ton';
  if (pref('liter')) return 'l';
  if (pref('count')) return 'count';
  if (pref('box')) return 'box';
  if (pref('crate')) return 'crate';
  if (pref('pack')) return 'pack';
  return null;
}

function run() {
  const raw = fs.readFileSync(target, 'utf-8');
  const data = JSON.parse(raw);
  let changed = 0;
  const out = data.map((n) => {
    const hasUnit = Object.prototype.hasOwnProperty.call(n, 'unit');
    if (!hasUnit || n.unit == null || n.unit === '') {
      const inferred = inferUnit(n.validUnits);
      if (inferred) {
        changed += 1;
        return { ...n, unit: inferred };
      }
      return { ...n, unit: n.unit ?? null };
    }
    return n;
  });
  fs.writeFileSync(target, JSON.stringify(out, null, 2), 'utf-8');
  console.log(`Updated ${changed} items with inferred unit in seederData.json`);
}

run();

