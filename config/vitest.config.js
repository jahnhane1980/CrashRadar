import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec}.js'],
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Standardmäßig wird oft alles gecovered. Wir können das auf src/ einschränken:
      include: ['src/**/*.js'],
      exclude: ['src/index.js'] // index.js ist nur der Entry-Point
    },
  },
});
