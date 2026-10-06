// Creates ../bug-tracker.zip containing only what WordPress needs at runtime.
import { execSync } from 'node:child_process';
import { rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const stage = path.resolve(root, '../.package/bug-tracker');
rmSync(path.resolve(root, '../.package'), { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
for (const item of ['bug-tracker.php', 'uninstall.php', 'readme.txt', 'includes', 'admin', 'build']) {
  if (existsSync(path.join(root, item))) cpSync(path.join(root, item), path.join(stage, item), { recursive: true });
}
const out = path.resolve(root, '../dist/bug-tracker.zip');
mkdirSync(path.dirname(out), { recursive: true });
rmSync(out, { force: true });
execSync(`zip -rq "${out}" bug-tracker`, { cwd: path.resolve(root, '../.package') });
rmSync(path.resolve(root, '../.package'), { recursive: true, force: true });
console.log('Created', out);
