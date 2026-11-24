// Validates a plugin directory and prints its release metadata as key=value lines (GITHUB_OUTPUT format).
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SCOPE = '@jetbrains/';
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

export function releaseInfo(root, plugin) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(plugin ?? '')) {
    throw new Error(`Invalid plugin directory: ${plugin}`);
  }
  const expected = join(realpathSync(root), plugin);
  if (realpathSync(expected) !== expected) {
    throw new Error('Plugin must be a real top-level directory, not a symlink');
  }
  const pkg = JSON.parse(readFileSync(join(expected, 'package.json'), 'utf8'));
  if (pkg.name !== SCOPE + plugin) {
    throw new Error(`${plugin}/package.json name must be ${SCOPE}${plugin}`);
  }
  if (typeof pkg.version !== 'string' || !SEMVER.test(pkg.version)) {
    throw new Error(`${plugin}/package.json version must be semver without build metadata`);
  }
  const lock = JSON.parse(readFileSync(join(expected, 'package-lock.json'), 'utf8'));
  if (lock.packages?.['']?.name !== pkg.name || lock.packages?.['']?.version !== pkg.version) {
    throw new Error(`${plugin}/package-lock.json disagrees with package.json; run npm install`);
  }
  if (pkg.scripts?.package !== 'headlamp-plugin package' || typeof pkg.scripts?.build !== 'string') {
    throw new Error(`${plugin}/package.json must define build and "package": "headlamp-plugin package"`);
  }
  return {
    plugin,
    version: pkg.version,
    tag: `${plugin}-${pkg.version}`,
    archive: `${pkg.name.slice(1).replace('/', '-')}-${pkg.version}.tar.gz`,
    prerelease: pkg.version.includes('-'),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const info = releaseInfo(process.cwd(), process.argv[2]);
    for (const [key, value] of Object.entries(info)) console.log(`${key}=${value}`);
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
