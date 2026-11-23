import { describe, expect, it } from 'vitest';
import { parseGtpl } from '../parser/parser.js';
import { emitGtplTemplateWithSourceMap } from './template.js';

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeVlq(segment: string): number[] {
  const values: number[] = [];
  let value = 0;
  let shift = 0;

  for (const character of segment) {
    const digit = BASE64.indexOf(character);
    if (digit < 0) throw new Error(`Invalid source-map character: ${character}`);

    value |= (digit & 31) << shift;
    if ((digit & 32) !== 0) {
      shift += 5;
      continue;
    }

    const negative = (value & 1) === 1;
    values.push(negative ? -(value >> 1) : value >> 1);
    value = 0;
    shift = 0;
  }

  if (shift !== 0) throw new Error('Incomplete source-map VLQ segment.');
  return values;
}

function sourcePositions(mappings: string): string[] {
  const positions: string[] = [];
  let sourceLine = 0;
  let sourceColumn = 0;

  for (const line of mappings.split(';')) {
    for (const segment of line.split(',').filter(Boolean)) {
      const values = decodeVlq(segment);
      if (values.length !== 4) continue;

      sourceLine += values[2]!;
      sourceColumn += values[3]!;
      positions.push(`${sourceLine}:${sourceColumn}`);
    }
  }

  return positions;
}

function positionAt(source: string, offset: number): string {
  const before = source.slice(0, offset);
  const lines = before.split(/\r\n|\r|\n/);
  return `${lines.length - 1}:${lines.at(-1)!.length}`;
}

describe('GTPL source maps', () => {
  it.each(['\n', '\r\n', '\r'])('maps expression tokens to exact source positions (%s)', (newline) => {
    const source = `<StLabel [visible]="ready && enabled">${newline}  {{user.isActive(name)}}${newline}</StLabel>`;
    const parsed = parseGtpl(source);
    expect(parsed.diagnostics).toEqual([]);

    const generated = emitGtplTemplateWithSourceMap(parsed.nodes, {
      source: 'view.gtpl',
      sourceContent: source,
    });
    const positions = sourcePositions(generated.map.mappings);

    for (const token of ['ready', 'enabled', 'user', 'name']) {
      expect(positions).toContain(positionAt(source, source.indexOf(token)));
    }
    expect(generated.code).not.toContain('__GEF_MAP_');
  });
});
