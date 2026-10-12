import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/react/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/react/setup.js'],
    clearMocks: true,
    restoreMocks: true,
  },
}));
