/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Относительные пути: собранный сайт работает из любой папки на любом статическом хостинге.
  base: './',
  plugins: [react()],
  server: {
    allowedHosts: ['.trycloudflare.com'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});