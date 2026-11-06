import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    pool: 'threads',
    environment: 'jsdom',
    include: ['tests/react/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/react/setup.js'],
    maxWorkers: 1,
    clearMocks: true,
    restoreMocks: true,
  },
}));
