import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.platform === 'linux') {
  run('npx', ['--no-install', 'node-gtk', 'bundle', '--archive']);
  run(process.execPath, ['scripts/package-appimage.mjs']);
} else if (process.platform === 'win32') {
  run(process.execPath, ['scripts/package-windows.mjs']);
} else if (process.platform === 'darwin') {
  run(process.execPath, ['scripts/package-macos.mjs']);
} else {
  throw new Error(`Unsupported packaging platform: ${process.platform}`);
}
