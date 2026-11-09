/**
 * Единый источник фактов о компании.
 * Всё, что помечено TODO, — заглушки до подтверждения владельцами (см. PLAN.md §13).
 */
export const site = {
  name: 'МинСтил',
  legalName: 'ООО «МинСтил»',
  domain: 'minsteel.info',
  url: 'https://minsteel.info',
  since: 2010,
  email: 'sales@minsteel.info',
  phones: [
    { display: '+7 (812) 580-21-71', tel: '+78125802171' },
    { display: '+7 (812) 960-75-64', tel: '+78129607564' },
  ],
  /** Мессенджеры: null — кнопка не показывается. TODO: аккаунты от владельцев. */
  messengers: {
    telegram: null as string | null, // логин без @, например 'minsteel_sales'
    whatsapp: null as string | null, // номер в формате 7XXXXXXXXXX
  },
  /** Почтовый/юридический адрес. Офис не принимает посетителей — без карты. */
  address: '194100, Санкт-Петербург, ул. Кантемировская, д. 12, лит. А, пом. 34Н, 35Н',
  hours: null as string | null, // TODO: время работы
  /** Реквизиты (от владельцев, 10.11.2026). */
  requisites: {
    inn: '7802493963',
    kpp: '780201001',
    ogrn: '1107847038166',
  },
};

/** Логотипы — с официальных сайтов клиентов (размещение согласовано). null — сайта/логотипа нет, выводим название. */
export const clients = [
  { name: 'ПАО «Северсталь»', short: 'Северсталь', logo: 'severstal.svg', h: 40 },
  { name: 'Холдинг «НК-Теплохиммонтаж»', short: 'НК-Теплохиммонтаж', logo: 'nktm.svg', h: 56 },
  { name: 'ООО «Ахмадиев Тонапо Инжиниринг»', short: 'Ахмадиев Тонапо Инжиниринг', logo: 'ati.svg', h: 38 },
  { name: '«Изометика»', short: 'Изометика', logo: 'izometika.png', h: 46 },
  { name: 'ООО «РЕФМЕТ»', short: 'РЕФМЕТ', logo: 'refmet.svg', h: 26 },
];

export const yearsOnMarket = (now = new Date()) => now.getFullYear() - site.since;
