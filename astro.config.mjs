import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import { remarkWikilinks } from './src/lib/wikilink.mjs';

export default defineConfig({
  site: 'https://hari487-coder.github.io',
  integrations: [icon()],
  markdown: { remarkPlugins: [remarkWikilinks] },
  vite: { plugins: [tailwindcss()] },
});
