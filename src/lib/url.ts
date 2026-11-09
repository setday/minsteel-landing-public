/**
 * Пути с учётом base (GitHub Pages без своего домена отдаёт сайт из /<repo>/).
 * withBase('#contacts') → '/#contacts' или '/minsteel/#contacts'.
 */
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const withBase = (path = '') => `${base}/${path.replace(/^\//, '')}`;
