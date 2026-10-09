import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// jsdom replaces the global URL class, which node:fs rejects, so build a plain path instead.
const HERE = dirname(fileURLToPath(import.meta.url));

export function loadFixture(name: string): string {
  return readFileSync(join(HERE, 'fixtures', `${name}.html`), 'utf8');
}

export function mountFixture(name: string): void {
  document.body.innerHTML = loadFixture(name);
}
