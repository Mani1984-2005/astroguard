import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const host = process.env.HOST?.trim() || '127.0.0.1';
  const allowedHosts: true | string[] =
    host === '0.0.0.0' || host === '::' ? true : [host, '127.0.0.1', 'localhost'];

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      host,
      port: 3000,
      allowedHosts,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      fs: {
        strict: true,
        deny: [
          '**/server-data/**',
          '**/.astroguard-server/**',
          '**/python_engine/**',
          '**/scripts/**',
          '**/server.ts',
          '**/firestore.rules',
          '**/firebase-blueprint.json',
          '**/security_spec.md',
          '**/.env',
          '**/.env.*',
          '**/*.key',
          '**/*.pem',
          '**/*.crt',
          '**/*.p12',
          '**/*.pfx',
          '**/*.jks',
          '**/*.keystore',
          '**/*.bak',
          '**/*.backup',
          '**/*.old',
          '**/*.orig',
          '**/*.tmp',
          '**/*.log',
          '**/.git/**',
        ],
      },
    },
  };
});
