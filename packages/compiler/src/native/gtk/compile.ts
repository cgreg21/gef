import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { UiNode } from '../../ir/ui.js';
import { emitGtkC } from './emit.js';

export interface GtkNativeCompileOptions {
  outputFile: string;
  compiler?: string;
  pkgConfig?: string;
}

export interface GtkNativeCompileResult {
  success: boolean;
  outputFile: string;
  diagnostics: readonly string[];
}

/** Compile a static GTK4 UI tree to a native executable. */
export async function compileGtkNative(
  nodes: readonly UiNode[],
  options: GtkNativeCompileOptions,
): Promise<GtkNativeCompileResult> {
  const outputFile = resolve(options.outputFile);
  const generated = emitGtkC(nodes);
  if (!generated.success) {
    return { success: false, outputFile, diagnostics: generated.diagnostics };
  }

  let directory: string | undefined;
  try {
    directory = await mkdtemp(join(tmpdir(), 'gef-gtk-'));
    const sourceFile = join(directory, 'main.c');
    await writeFile(sourceFile, generated.source, 'utf8');

    const pkgConfig = spawnSync(options.pkgConfig ?? 'pkg-config', [
      '--cflags', '--libs', 'gtk4',
    ], { encoding: 'utf8' });
    if (pkgConfig.error || pkgConfig.status !== 0) {
      return {
        success: false,
        outputFile,
        diagnostics: [pkgConfig.error?.message ?? (pkgConfig.stderr.trim() || 'Unable to find GTK4 development files with pkg-config.')],
      };
    }

    const flags = pkgConfig.stdout.trim().split(/\s+/).filter(Boolean);
    await mkdir(dirname(outputFile), { recursive: true });
    const compilation = spawnSync(options.compiler ?? 'cc', [
      '-std=gnu11', sourceFile, '-o', outputFile, ...flags,
    ], { encoding: 'utf8' });
    if (compilation.error || compilation.status !== 0) {
      return {
        success: false,
        outputFile,
        diagnostics: [compilation.error?.message ?? (compilation.stderr.trim() || 'GTK4 C compilation failed.')],
      };
    }

    return { success: true, outputFile, diagnostics: [] };
  } catch (error) {
    return {
      success: false,
      outputFile,
      diagnostics: [error instanceof Error ? error.message : String(error)],
    };
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
