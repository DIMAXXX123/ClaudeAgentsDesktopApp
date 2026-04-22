const fs = require('node:fs');
const path = require('node:path');

const rendererRoot = path.resolve(__dirname, '..', 'renderer');
const standaloneRoot = path.join(rendererRoot, '.next', 'standalone', 'renderer');

const pairs = [
  { src: path.join(rendererRoot, '.next', 'static'), dst: path.join(standaloneRoot, '.next', 'static') },
  { src: path.join(rendererRoot, 'public'), dst: path.join(standaloneRoot, 'public') },
];

function copyRecursive(src, dst) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true, force: true });
  return true;
}

let copied = 0;
for (const { src, dst } of pairs) {
  if (copyRecursive(src, dst)) {
    console.log(`[copy-static] ${path.relative(rendererRoot, src)} -> ${path.relative(rendererRoot, dst)}`);
    copied++;
  } else {
    console.log(`[copy-static] skip (missing): ${path.relative(rendererRoot, src)}`);
  }
}

console.log(`[copy-static] ${copied}/${pairs.length} copied`);
