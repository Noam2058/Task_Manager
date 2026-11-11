import { defineConfig } from 'vitest/config';
import path from 'node:path';
process.env.TZ = 'Asia/Jerusalem';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { include: ['src/**/*.test.ts'] },
});
