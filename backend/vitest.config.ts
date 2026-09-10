import { defineConfig } from 'vitest/config';

process.env.DB_DRIVER = 'pglite';
process.env.DB_PGLITE_DATA_DIR = 'memory://';

export default defineConfig({
  test: {
    fileParallelism: false,
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
  },
});
