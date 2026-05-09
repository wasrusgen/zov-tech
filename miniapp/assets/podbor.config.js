/* ============================================================
   Подбор техники — статические данные (адаптация 02_Чек-лист_клиенту.html)
   ============================================================ */

const PODBOR_CATEGORIES = [
  { key: "fridge",    icon: "cat_fridge",    label: "Холодильник" },
  { key: "hob",       icon: "cat_hob",       label: "Варочная панель" },
  { key: "oven",      icon: "cat_oven",      label: "Духовой шкаф" },
  { key: "dw",        icon: "cat_dw",        label: "Посудомоечная" },
  { key: "hood",      icon: "cat_hood",      label: "Вытяжка" },
  { key: "microwave", icon: "cat_microwave", label: "Микроволновка" },
  { key: "coffee",    icon: "cat_coffee",    label: "Кофемашина" },
  { key: "washer",    icon: "cat_washer",    label: "Стиральная машина" },
];

const PODBOR_BUDGET_TIERS = [
  { key: "premium", label: "Премиум", hint: "лучшее без оглядки на цену" },
  { key: "middle",  label: "Средний", hint: "разумный баланс цена/функции" },
  { key: "budget",  label: "Бюджет",  hint: "только нужное" },
];

const PODBOR_INFRA = {
  stove: [
    { key: "induction", label: "Индукция / 380 В" },
    { key: "el_220",    label: "Электрика 220 В" },
    { key: "gas",       label: "Газ" },
    { key: "any",       label: "Не знаю / любой" },
  ],
  vent: [
    { key: "yes", label: "Да — есть выводы в вентиляцию" },
    { key: "no",  label: "Нет — рециркуляция с угольным фильтром" },
    { key: "unknown", label: "Не знаю — менеджер уточнит" },
  ],
};

const PODBOR_PRIORITIES = [
  { key: "balance",  label: "Цена / качество" },
  { key: "reviews",  label: "Отзывы" },
  { key: "popular",  label: "Популярность бренда" },
  { key: "design",   label: "Дизайн и цвет" },
  { key: "tech",     label: "Технологичность" },
  { key: "service",  label: "Сервис и гарантия" },
];

/* Бренды для каждой категории — для чипов с тирами.
   Сокращённый набор; полный список можно расширить из исходного HTML. */
const PODBOR_BRANDS = {
  fridge: {
    premium: ["Liebherr", "Miele", "Sub-Zero", "V-ZUG"],
    middle:  ["Bosch", "Siemens", "Samsung", "LG"],
    budget:  ["Indesit", "Beko", "Hotpoint"],
  },
  hob: {
    premium: ["Miele", "Gaggenau", "AEG"],
    middle:  ["Bosch", "Siemens", "Electrolux", "Hansa"],
    budget:  ["Hotpoint", "Beko", "Indesit"],
  },
  oven: {
    premium: ["Miele", "Gaggenau", "Neff"],
    middle:  ["Bosch", "Siemens", "Electrolux", "AEG"],
    budget:  ["Hansa", "Beko", "Hotpoint"],
  },
  dw: {
    premium: ["Miele", "Asko", "V-ZUG"],
    middle:  ["Bosch", "Siemens", "Electrolux"],
    budget:  ["Hansa", "Beko", "Indesit"],
  },
  hood: {
    premium: ["Miele", "Falmec", "Faber"],
    middle:  ["Bosch", "Siemens", "Elica"],
    budget:  ["Hansa", "Hotpoint", "Maunfeld"],
  },
  microwave: {
    premium: ["Miele", "Neff"],
    middle:  ["Bosch", "Siemens", "Samsung", "LG"],
    budget:  ["Whirlpool", "Hansa", "Beko"],
  },
  coffee: {
    premium: ["Miele", "Jura", "De'Longhi PrimaDonna"],
    middle:  ["De'Longhi", "Saeco", "Bosch"],
    budget:  ["Krups", "Philips"],
  },
  washer: {
    premium: ["Miele", "Asko", "V-ZUG"],
    middle:  ["Bosch", "Siemens", "Samsung", "LG"],
    budget:  ["Indesit", "Hotpoint", "Beko"],
  },
};
