import type { CliIO } from '../index.js';

export function runDoctor(io: Pick<CliIO, 'run' | 'stdout'>): number {
  const checks = [
    { name: 'Node.js >= 22', ok: Number(process.versions.node.split('.')[0]) >= 22, detail: process.versions.node },
    ...([
      { name: 'Sass', command: 'npx', args: ['sass', '--version'] },
      { name: 'GJS', command: 'gjs', args: ['--version'] },
      { name: 'GNOME Shell 51', command: 'gnome-shell', args: ['--version'], matches: /GNOME Shell 51\./ },
      { name: 'GTK4', command: 'pkg-config', args: ['--modversion', 'gtk4'] },
      { name: 'libadwaita', command: 'pkg-config', args: ['--modversion', 'libadwaita-1'] },
      { name: 'GSettings schema compiler', command: 'glib-compile-schemas', args: ['--version'] },
      { name: 'ZIP archiver', command: 'zip', args: ['-v'] },
      { name: 'ZIP verifier', command: 'unzip', args: ['-v'] },
    ] as const).map((check) => {
      const result = io.run(check.command, check.args);
      const detail = result.output.trim() || (result.status === 0 ? 'available' : 'not installed');
      const ok = result.status === 0 && (!('matches' in check) || check.matches.test(detail));
      return { name: check.name, ok, detail };
    }),
  ];
  io.stdout(checks.map((check) => `${check.ok ? 'OK' : 'MISSING'}  ${check.name}: ${check.detail}`).join('\n'));
  return checks.every((check) => check.ok) ? 0 : 1;
}
