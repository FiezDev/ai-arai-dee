import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://fiezdev.github.io',
  base: '/ai-arai-dee/',
  output: 'static',
  integrations: [react()],
  vite: {
    server: {
      allowedHosts: ['ittipols-macbook-air'],
    },
    plugins: [tailwindcss()],
  },
});
