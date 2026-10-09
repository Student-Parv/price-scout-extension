import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

describe('scaffold', () => {
  it('manifest is MV3 with no permissions', () => {
    const m = JSON.parse(readFileSync('public/manifest.json', 'utf8'));
    expect(m.manifest_version).toBe(3);
    expect(m.permissions).toEqual([]);
    expect(m.host_permissions).toBeUndefined();
  });
  it('legacy prototype files are gone', () => {
    for (const f of ['content.js', 'popup.html', 'popup.js', 'styles.css']) {
      expect(existsSync(f)).toBe(false);
    }
  });
});
