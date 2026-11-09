/** Цели Яндекс.Метрики. Без личных данных — только параметры запроса. */
declare global {
  interface Window {
    ym?: (id: number, action: string, goal: string, params?: Record<string, unknown>) => void;
    __YM_ID__?: number;
  }
}

export function goal(name: string, params?: Record<string, unknown>) {
  try {
    if (window.ym && window.__YM_ID__) window.ym(window.__YM_ID__, 'reachGoal', name, params);
  } catch {
    /* аналитика не должна ломать сайт */
  }
  if (import.meta.env.DEV) console.debug('[goal]', name, params ?? '');
}

/** Клики по телефону, почте и мессенджерам — делегированием. */
export function trackContactClicks() {
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith('tel:')) goal('click_tel');
    else if (href.startsWith('mailto:') && !a.hasAttribute('data-no-track')) goal('click_mail');
    else if (/t\.me|wa\.me/.test(href)) goal('click_msg');
  });
}
