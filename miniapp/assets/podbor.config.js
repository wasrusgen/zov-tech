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

/* Параметры по категориям.
   ----------------------------------------------------------
   Новая схема (иерархический wizard):
     steps: [
       {
         key: "install",
         title: "Тип установки",
         type: "single" | "multi",
         options: [ { key, label, hint, star?, pict? } ]
         // ИЛИ если опции зависят от предыдущего шага:
         optionsBy: { dependsOn: "<prevStepKey>", map: { <prevVal>: [options] } }
       },
       ...
     ]

   Старая схема (legacy, без wizard):
     primary: [...], features: [...]
   ---------------------------------------------------------- */
const PODBOR_PARAMS = {
  fridge: {
    steps: [
      {
        key: "install",
        title: "Тип установки",
        type: "single",
        options: [
          { key: "built_in",     label: "Встроенный",     hint: "под фасад",   pict: "fridge_install_builtin" },
          { key: "freestanding", label: "Отдельностоящий", hint: "соло на полу", pict: "fridge_install_freestanding" },
        ],
      },
      {
        key: "chamber",
        title: "Тип камеры",
        type: "single",
        optionsBy: {
          dependsOn: "install",
          map: {
            built_in: [
              { key: "single",     label: "Однокамерный",        hint: "только холод",          pict: "fridge_bi_single" },
              { key: "two_chamber", label: "Двухкамерный",       hint: "холод + мороз",         pict: "fridge_bi_two" },
              { key: "col_cold",   label: "Холодильная колонна", hint: "только холод · высокая", pict: "fridge_bi_colcold" },
              { key: "col_freeze", label: "Морозильная колонна", hint: "только мороз · высокая", pict: "fridge_bi_colfreeze" },
              { key: "col_pair",   label: "Пара колонн",         hint: "холод + мороз · рядом",  pict: "fridge_bi_colpair" },
            ],
            freestanding: [
              { key: "single",      label: "Однокамерный",       hint: "мини · бар",            pict: "fridge_fs_single" },
              { key: "two_chamber", label: "Двухкамерный",       hint: "морозилка снизу",       pict: "fridge_fs_two" },
              { key: "sbs",         label: "Side-by-Side",       hint: "распашной · 2 двери",   pict: "fridge_fs_sbs" },
              { key: "french",      label: "French Door",        hint: "2 двери · ящик мороза", pict: "fridge_fs_french" },
              { key: "freezer",     label: "Морозильная камера", hint: "отдельный морозильник", pict: "fridge_fs_freezer" },
            ],
          },
        },
      },
      {
        key: "size",
        title: "Размер",
        type: "single",
        options: [
          { key: "narrow",   label: "Узкий",    hint: "W 45–55 см" },
          { key: "standard", label: "Стандарт", hint: "W 55–60 см", star: true },
          { key: "wide",     label: "Широкий",  hint: "W 60–75 см" },
          { key: "xl",       label: "XL",       hint: "W 80–100 см · SbS / French Door" },
        ],
      },
      {
        key: "features",
        title: "Особенности",
        type: "multi",
        options: [
          { key: "nofrost",   label: "No Frost",            hint: "не нужно размораживать" },
          { key: "inverter",  label: "Inverter",            hint: "тише и экономичнее" },
          { key: "freshzone", label: "Зона свежести",       hint: "BioFresh / овощи дольше" },
          { key: "silent",    label: "≤40 дБ",              hint: "почти не слышно ночью" },
          { key: "smart",     label: "Wi-Fi",               hint: "управление с телефона" },
          { key: "ice",       label: "Лёдогенератор",       hint: "кубики автоматически" },
          { key: "wine",      label: "Винная зона",         hint: "" },
          { key: "dispenser", label: "Диспенсер воды",      hint: "холодная вода / лёд через дверь" },
        ],
      },
    ],
  },
  hob: {
    primary: [
      { key: "heat", label: "Тип нагрева", options: [
        { key: "induction", label: "Индукция" },
        { key: "hi_light",  label: "Hi-Light (стеклокерамика)" },
        { key: "gas",       label: "Газ" },
        { key: "domino",    label: "Domino (модульная)" },
      ]},
      { key: "width", label: "Ширина, см", options: [
        { key: "30", label: "30" }, { key: "45", label: "45" },
        { key: "60", label: "60" }, { key: "80", label: "80" }, { key: "90", label: "90" },
      ]},
      { key: "zones", label: "Число зон", options: [
        { key: "2", label: "2" }, { key: "3", label: "3" },
        { key: "4", label: "4" }, { key: "5", label: "5" },
      ]},
      { key: "color", label: "Цвет", options: [
        { key: "black", label: "Чёрный" }, { key: "white", label: "Белый" },
        { key: "frameless", label: "Без рамки" }, { key: "inox", label: "Нерж. сталь" },
      ]},
    ],
    features: [
      { key: "boost",      label: "PowerBoost",        hint: "форсаж — кипятит за минуту" },
      { key: "flex",       label: "FlexZone",          hint: "объединяет зоны под большую сковороду" },
      { key: "hob2hood",   label: "Hob2Hood",          hint: "вытяжка автоматически следит за варочной" },
      { key: "child_lock", label: "Защита от детей",   hint: "блокировка панели" },
    ],
  },
  oven: {
    primary: [
      { key: "config", label: "Конфигурация", options: [
        { key: "compact_combi", label: "Компакт + СВЧ" },
        { key: "full_60",       label: "Полный 60 см" },
        { key: "xl_90",         label: "XL 90 см" },
        { key: "two_separate",  label: "2 отдельных прибора" },
      ]},
      { key: "color", label: "Цвет", options: [
        { key: "black", label: "Чёрный" },
        { key: "inox",  label: "Нерж. сталь" },
        { key: "white", label: "Белый" },
        { key: "blackglass", label: "Чёрное стекло" },
        { key: "anthracite", label: "Антрацит" },
      ]},
      { key: "cleaning", label: "Очистка", options: [
        { key: "hydro", label: "Гидролиз" },
        { key: "pyro",  label: "Пиролиз" },
        { key: "eco",   label: "Eco / каталитическая" },
        { key: "aqua",  label: "Aqua" },
        { key: "std",   label: "Стандарт" },
      ]},
    ],
    features: [
      { key: "4d",        label: "4D HotAir",       hint: "конвекция с 4 сторон — равномерное запекание" },
      { key: "steam",     label: "Пар",             hint: "хлеб с румяной корочкой, мясо без пересушки" },
      { key: "probe",     label: "Термощуп",        hint: "готовит до точной температуры (medium / well-done)" },
      { key: "autopilot", label: "Автопилот",       hint: "выбираешь блюдо — духовка сама ставит режим" },
      { key: "softclose", label: "SoftClose",       hint: "дверца закрывается плавно" },
      { key: "smart",     label: "Smart / Wi-Fi",   hint: "следишь за приготовлением с телефона" },
    ],
  },
  dw: {
    primary: [
      { key: "width", label: "Ширина, см", options: [
        { key: "45", label: "45" }, { key: "60", label: "60" },
      ]},
      { key: "mount", label: "Монтаж", options: [
        { key: "full_built_in", label: "Полная встройка (под фасад)" },
        { key: "partial",       label: "Частичная встройка" },
        { key: "freestanding",  label: "Отдельная" },
      ]},
      { key: "settings", label: "Комплектов", options: [
        { key: "8-9",   label: "8–9 (для 2–3 человек)" },
        { key: "10-11", label: "10–11 (семья 3–4)" },
        { key: "12-14", label: "12–14 (большая семья)" },
      ]},
    ],
    features: [
      { key: "aquastop", label: "AquaStop",   hint: "защита от протечек — машина сама перекроет воду" },
      { key: "tray",     label: "3-й лоток",   hint: "отдельная полка для столовых приборов" },
      { key: "autoopen", label: "AutoOpen",   hint: "приоткрывает дверь после мойки — сухая посуда" },
      { key: "silent",   label: "≤44 дБ",     hint: "можно мыть ночью, не слышно" },
      { key: "smart",    label: "Smart / Wi-Fi", hint: "уведомление на телефон когда готово" },
    ],
  },
  hood: {
    primary: [
      { key: "type", label: "Тип", options: [
        { key: "inclined",   label: "Наклонная" },
        { key: "t_shape",    label: "Т-образная" },
        { key: "dome",       label: "Купольная" },
        { key: "built_in",   label: "Встроенная" },
        { key: "telescopic", label: "Телескопическая" },
        { key: "island",     label: "Островная" },
      ]},
      { key: "width", label: "Ширина, см", options: [
        { key: "50", label: "50" }, { key: "60", label: "60" },
        { key: "80", label: "80" }, { key: "90", label: "90" },
      ]},
      { key: "color", label: "Цвет", options: [
        { key: "inox",        label: "Нерж. сталь" },
        { key: "black",       label: "Чёрный" },
        { key: "white",       label: "Белый" },
        { key: "black_glass", label: "Чёрное стекло" },
      ]},
      { key: "mode", label: "Режим работы", options: [
        { key: "exhaust", label: "Только отвод (вентиляция)" },
        { key: "recirc",  label: "Только рециркуляция (фильтр)" },
        { key: "combi",   label: "Оба режима" },
      ]},
    ],
    features: [
      { key: "hi_perf",    label: "Производительность 600+ м³/ч", hint: "сильно тянет — для большой кухни / wok" },
      { key: "perimeter",  label: "Периметральная вытяжка",        hint: "тянет с краёв — больше пара захватывает" },
      { key: "low_noise",  label: "Тихая работа ≤50 дБ",           hint: "не оглушает за столом" },
      { key: "smart",      label: "Smart / Wi-Fi",                 hint: "автоматическая работа в паре с варочной" },
    ],
  },
  microwave: {
    primary: [
      { key: "type", label: "Размещение", options: [
        { key: "builtin",      label: "Встроенная" },
        { key: "freestanding", label: "Отдельная" },
      ]},
      { key: "volume", label: "Объём, л", options: [
        { key: "to20",  label: "до 20" },
        { key: "20-25", label: "20–25" },
        { key: "25+",   label: "25+" },
      ]},
    ],
    features: [
      { key: "grill",      label: "Гриль",      hint: "запекает корочку сверху" },
      { key: "convection", label: "Конвекция",  hint: "работает как маленькая духовка" },
      { key: "inverter",   label: "Инвертор",   hint: "плавная мощность — не пересушивает" },
    ],
  },
  coffee: {
    primary: [
      { key: "type", label: "Размещение", options: [
        { key: "builtin",      label: "Встроенная" },
        { key: "freestanding", label: "Отдельная" },
      ]},
      { key: "tech", label: "Тип", options: [
        { key: "auto_grinder", label: "Автомат с кофемолкой" },
        { key: "capsule",      label: "Капсульная" },
        { key: "manual",       label: "Рожковая (бариста)" },
      ]},
    ],
    features: [
      { key: "milk",     label: "Капучинатор", hint: "автоматическое латте/капучино" },
      { key: "profiles", label: "Профили",     hint: "у каждого свой размер/крепость" },
      { key: "smart",    label: "Smart / Wi-Fi", hint: "управление с телефона" },
    ],
  },
  washer: {
    primary: [
      { key: "type", label: "Размещение", options: [
        { key: "builtin",      label: "Встроенная" },
        { key: "freestanding", label: "Отдельная" },
      ]},
      { key: "load", label: "Загрузка, кг", options: [
        { key: "to6",  label: "до 6" },
        { key: "6-8",  label: "6–8" },
        { key: "8-10", label: "8–10" },
        { key: "10+",  label: "10+" },
      ]},
      { key: "depth", label: "Глубина", options: [
        { key: "slim",     label: "Slim (до 45 см)" },
        { key: "standard", label: "Стандарт (60 см)" },
      ]},
    ],
    features: [
      { key: "steam",  label: "Пар",          hint: "освежает без стирки, убивает аллергены" },
      { key: "dry",    label: "Сушка",        hint: "достал — и сразу в шкаф" },
      { key: "silent", label: "≤50 дБ",       hint: "ночная стирка не разбудит" },
      { key: "smart",  label: "Smart / Wi-Fi", hint: "запуск с телефона, уведомления" },
    ],
  },
};

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
