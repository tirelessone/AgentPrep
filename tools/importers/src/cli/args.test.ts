import { describe, expect, it } from 'vitest';

import { readFlags } from './args';

describe('importer CLI flags', () => {
  it('accepts the pnpm argument separator before named flags', () => {
    const flags = readFlags(['--', '--input', 'data.json', '--output', 'manifest.json']);
    expect(flags.require('input')).toBe('data.json');
    expect(flags.require('output')).toBe('manifest.json');
  });
});
