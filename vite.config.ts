import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub project Pages serve a site from `/<repository>/`, so a production
 * build has to prefix every asset URL with that path. The dev server keeps
 * serving from `/`, so local development is unaffected.
 *
 * A fork with a different repository name sets VITE_BASE_PATH (for example
 * `/my-outage-app/`) instead of editing this file.
 */
const productionBase = process.env.VITE_BASE_PATH || '/PowerPulse/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? productionBase : '/',
  plugins: [react()],
}));
