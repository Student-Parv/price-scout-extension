import { defineConfig } from 'vitest/config';

// `vite build` bundles the content script; `vite build --mode background` adds the service worker next to it.
export default defineConfig(({ mode }) => {
  const background = mode === 'background';
  return {
    build: {
      outDir: 'dist',
      emptyOutDir: !background,
      target: 'es2022',
      minify: false,
      lib: {
        entry: background ? 'src/background/main.ts' : 'src/content/main.ts',
        name: background ? 'PriceScoutBackground' : 'PriceScout',
        formats: ['iife' as const],
        fileName: () => (background ? 'background.js' : 'content.js'),
      },
    },
    test: {
      environment: 'jsdom',
      include: ['tests/**/*.test.ts'],
    },
  };
});
