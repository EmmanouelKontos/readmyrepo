import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

/**
 * Production builds get a stricter in-page CSP than dev: no websocket (HMR) origins and
 * `script-src 'self'` (dev needs inline scripts for React Fast Refresh).
 */
function strictProductionCsp(): Plugin {
  return {
    name: 'strict-production-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(' ws: wss:', '').replace("form-action 'self';", "default-src 'self'; script-src 'self'; form-action 'self';");
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), strictProductionCsp()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          if (id.includes('/src/lib/preset')) {
            return 'presets';
          }
        },
      },
    },
  },
});
