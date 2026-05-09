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

const PODBOR_FAMILY = [
  { key: "single",  label: "1 взрослый" },
  { key: "couple",  label: "Пара" },
  { key: "family",  label: "Семья с детьми" },
  { key: "multigen", label: "2+ поколения" },
];

const PODBOR_COOKING = [
  { key: "daily",  label: "Ежедневно" },
  { key: "weekly", label: "3–5 раз в неделю" },
  { key: "rare",   label: "По выходным или реже" },
];

const PODBOR_INFRA = {
  stove: [
    { key: "induction", label: "Индукция / 380 В" },
    { key: "el_220",    label: "Электрика 220 В" },
    { key: "gas",       label: "Газ" },
    { key: "any",       label: "Не знаю / любой" },
  ],
  vent: [
    { key: "shaft",     label: "Шахта вентиляции есть" },
    { key: "no_shaft",  label: "Только рециркуляция" },
    { key: "unknown",   label: "Не знаю" },
  ],
};

const PODBOR_TECHNIQUES = [
  { key: "bake",   label: "Выпечка" },
  { key: "steam",  label: "На пару" },
  { key: "grill",  label: "Гриль" },
  { key: "wok",    label: "Wok / стир-фрай" },
  { key: "low_t",  label: "Низкотемпературное" },
  { key: "smart",  label: "Умные режимы / Smart" },
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
