import { goal } from './analytics';

/**
 * Конструктор запроса: собирает текст и открывает почту/мессенджер посетителя.
 * Ничего не отправляет на сервер (PLAN.md §7).
 */
type Req = { cats: string[]; volume: string; city: string; deadline: string; comment: string };

function read(form: HTMLFormElement): Req {
  const fd = new FormData(form);
  const s = (k: string) => String(fd.get(k) ?? '').trim();
  return {
    cats: fd.getAll('cat').map(String),
    volume: s('volume'),
    city: s('city'),
    deadline: s('deadline'),
    comment: s('comment'),
  };
}

function subject(r: Req) {
  const what = r.cats.length ? (r.cats.length > 2 ? `${r.cats.slice(0, 2).join(', ')} и др.` : r.cats.join(', ')) : 'материалы';
  return `Запрос КП: ${what}${r.volume ? `, ${r.volume}` : ''}`;
}

function body(r: Req) {
  const lines = ['Здравствуйте!', 'Прошу подготовить коммерческое предложение.', ''];
  if (r.cats.length) lines.push(`Что нужно: ${r.cats.join('; ')}`);
  if (r.volume) lines.push(`Объём: ${r.volume}`);
  if (r.city) lines.push(`Город доставки: ${r.city}`);
  if (r.deadline) lines.push(`Срок: ${r.deadline}`);
  if (r.comment) lines.push('', r.comment);
  lines.push('', '(Если есть ТЗ или спецификация — прикрепляю к письму.)', '', '— запрос составлен на minsteel.info');
  return lines.join('\n');
}

function isEmpty(r: Req) {
  return !r.cats.length && !r.comment;
}

function params(r: Req, channel: string) {
  return { channel, cats: r.cats.length, volume: r.volume || 'не указан' };
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function init(form: HTMLFormElement) {
  const preview = form.querySelector<HTMLElement>('[data-preview]');
  const error = form.querySelector<HTMLElement>('.rb__error');
  const copyLabel = form.querySelector<HTMLElement>('[data-copy-label]');
  const email = form.dataset.email ?? '';
  const tg = form.dataset.telegram ?? '';
  const wa = form.dataset.whatsapp ?? '';

  const refresh = () => {
    const r = read(form);
    if (preview) preview.textContent = `Тема: ${subject(r)}\n\n${body(r)}`;
    if (error && !isEmpty(r)) error.hidden = true;
  };
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  refresh();

  const send = async (channel: string) => {
    const r = read(form);
    if (isEmpty(r)) {
      if (error) error.hidden = false;
      return;
    }
    const text = body(r);
    goal(`kp_send_${channel}`, params(r, channel));
    if (channel === 'mail') {
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject(r))}&body=${encodeURIComponent(text)}`;
    } else if (channel === 'telegram' && tg) {
      // Telegram не везде подставляет текст в личный чат — копируем его заранее.
      await copy(text);
      window.open(`https://t.me/${tg}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } else if (channel === 'whatsapp' && wa) {
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } else if (channel === 'copy') {
      const ok = await copy(`Тема: ${subject(r)}\n\n${text}`);
      if (copyLabel) {
        const prev = copyLabel.textContent;
        copyLabel.textContent = ok ? 'Скопировано' : 'Не удалось — скопируйте из превью';
        setTimeout(() => (copyLabel.textContent = prev), 2200);
      }
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void send('mail');
  });
  form.querySelectorAll<HTMLButtonElement>('button[data-channel]:not([type=submit])').forEach((b) =>
    b.addEventListener('click', () => void send(b.dataset.channel!)),
  );
}

function preselect(form: HTMLFormElement, slugs: string[]) {
  form.querySelectorAll<HTMLInputElement>('input[name=cat]').forEach((i) => {
    if (slugs.includes(i.dataset.slug!)) i.checked = true;
  });
  form.dispatchEvent(new Event('change'));
}

export function initRequest() {
  const forms = [...document.querySelectorAll<HTMLFormElement>('form[data-request-builder]')];
  forms.forEach(init);
  const form = forms[0];
  if (!form) return;

  // Карточка продукта: отметить позицию в запросе и перейти к форме
  document.addEventListener('click', (e) => {
    const pick = (e.target as HTMLElement).closest<HTMLElement>('[data-request-pick]');
    if (!pick) return;
    preselect(form, [pick.dataset.requestPick!]);
    goal('kp_open_product', { slug: pick.dataset.requestPick });
  });
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href$="#contacts"]');
    if (a) goal('kp_open', { from: a.dataset.from ?? '' });
  });
}
