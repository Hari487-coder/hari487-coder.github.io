import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://hari487-coder.github.io',
  integrations: [icon()],
  vite: { plugins: [tailwindcss()] },
});
