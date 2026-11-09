// @ts-check
import { defineConfig } from 'astro/config';

/**
 * SITE_URL и BASE_PATH задаются при сборке (см. .github/workflows/deploy.yml):
 * - свой домен (minsteel.info): SITE_URL=https://minsteel.info, BASE_PATH=/
 * - GitHub Pages без домена:    SITE_URL=https://<user>.github.io, BASE_PATH=/<repo>
 */
export default defineConfig({
  site: process.env.SITE_URL || 'https://minsteel.info',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
