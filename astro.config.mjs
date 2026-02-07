import { defineConfig } from 'astro/config';

export default defineConfig({
  // GitHub Pages (repo pages) config
  site: 'https://md-mini-bot.github.io',
  base: '/transcrab/',
  output: 'static',
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
});
