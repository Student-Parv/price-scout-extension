import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

describe('scaffold', () => {
  it('manifest is MV3 and asks only for scripting on the sites it already runs on', () => {
    const m = JSON.parse(readFileSync('public/manifest.json', 'utf8'));
    expect(m.manifest_version).toBe(3);
    expect(m.permissions).toEqual(['scripting']);
    expect(m.host_permissions).toEqual(m.content_scripts[0].matches);
  });
  it('manifest wires the toolbar icon to the background worker', () => {
    const m = JSON.parse(readFileSync('public/manifest.json', 'utf8'));
    expect(m.background.service_worker).toBe('background.js');
    expect(m.action.default_popup).toBeUndefined();
    expect(m.action.default_title).toMatch(/Price Scout/);
    for (const size of ['16', '32', '48', '128']) {
      expect(existsSync(`public/${m.icons[size]}`)).toBe(true);
      expect(m.action.default_icon[size]).toBe(m.icons[size]);
    }
  });
  it('legacy prototype files are gone', () => {
    for (const f of ['content.js', 'popup.html', 'popup.js', 'styles.css']) {
      expect(existsSync(f)).toBe(false);
    }
  });
});
