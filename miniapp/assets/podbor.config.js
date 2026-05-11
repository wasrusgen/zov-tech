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

/* === Новая структура: бренд-стратегия / бюджет / стратегия подбора === */

const PODBOR_BRAND_STRATEGY = [
  { key: "ai",        label: "Пусть AI решит",               hint: "оптимально под бюджет и стратегию", recommended: true },
  { key: "single",    label: "Одна марка на всю кухню",      hint: "моноблочный комплект, премиум-сценарий" },
  { key: "different", label: "Разные марки по категориям",   hint: "соберём оптимальный микс" },
];

/* Бренды для single-brand-кухни, актуально на 2026 (РФ).
   ⚠ — параллельный импорт. ⭐ recommended — частый выбор для кухонь ЗОВ-СПб. */
const PODBOR_SINGLE_BRAND_OPTIONS = [
  // 💎 Премиум (от 100к ₽ за позицию)
  { key: "miele",    label: "Miele ⚠",     tier: "premium", note: "parallel" },
  { key: "gaggenau", label: "Gaggenau ⚠",  tier: "premium", note: "parallel" },
  { key: "vzug",     label: "V-Zug ⚠",     tier: "premium", note: "parallel" },
  { key: "smeg",     label: "Smeg ⚠",      tier: "premium", note: "parallel" },
  { key: "asko",     label: "Asko",       tier: "premium", note: "available" },
  { key: "liebherr", label: "Liebherr ⚠",  tier: "premium", note: "parallel" },

  // ★ Средний — цена/качество (40–100к ₽)
  { key: "bosch",    label: "Bosch ⚠",     tier: "middle",  note: "parallel" },
  { key: "siemens",  label: "Siemens ⚠",   tier: "middle",  note: "parallel" },
  { key: "neff",     label: "NEFF ⚠",      tier: "middle",  note: "parallel" },
  { key: "haier",    label: "Haier",      tier: "middle",  note: "available", recommended: true },
  { key: "electrolux", label: "Electrolux", tier: "middle", note: "available" },
  { key: "aeg",      label: "AEG",        tier: "middle",  note: "available" },
  { key: "lg",       label: "LG",         tier: "middle",  note: "available" },
  { key: "samsung",  label: "Samsung",    tier: "middle",  note: "available" },

  // ₽ Бюджет (15–40к ₽ за позицию)
  { key: "kuppersberg", label: "Kuppersberg", tier: "budget", note: "available", recommended: true },
  { key: "maunfeld",    label: "Maunfeld",    tier: "budget", note: "available" },
  { key: "weissgauff",  label: "Weissgauff",  tier: "budget", note: "available" },
  { key: "korting",     label: "Körting",     tier: "budget", note: "available" },
  { key: "gorenje",     label: "Gorenje",     tier: "budget", note: "available" },
  { key: "hansa",       label: "Hansa",       tier: "budget", note: "available" },
  { key: "beko",        label: "Beko",        tier: "budget", note: "available" },
  { key: "hotpoint",    label: "Hotpoint",    tier: "budget", note: "available" },
  { key: "indesit",     label: "Indesit",     tier: "budget", note: "available" },
  { key: "hisense",     label: "Hisense",     tier: "budget", note: "available" },
  { key: "midea",       label: "Midea",       tier: "budget", note: "available" },
  { key: "candy",       label: "Candy",       tier: "budget", note: "available" },
  { key: "atlant",      label: "Атлант",     tier: "budget", note: "available" },

  { key: "ai_pick",     label: "Пусть AI выберет под бюджет", recommended: true },
];

/* Доля бюджета каждой категории от полного комплекта (для адаптивных вилок). */
const PODBOR_BUDGET_SHARES = {
  fridge: 25, hob: 12, oven: 15, dw: 10,
  hood: 8, microwave: 5, coffee: 15, washer: 10,
};

/* Базовые вилки для ПОЛНОГО комплекта 8 категорий (в тыс. ₽).
   Адаптируются по выбранным категориям через PODBOR_BUDGET_SHARES. */
const PODBOR_BUDGET_RANGES = {
  luxe:    { from: 1500, to: 3000 },  // от 1.5М
  premium: { from: 700,  to: 1500 },
  middle:  { from: 350,  to: 700  },
  budget:  { from: 100,  to: 350  },
};

const PODBOR_BUDGET_PRESETS = [
  { key: "luxe",    label: "Люкс",         desc: "лучшее без оглядки на цену" },
  { key: "premium", label: "Премиум",      desc: "топовые модели · все опции" },
  { key: "middle",  label: "Средний",      desc: "оптимальный баланс · цена/функции", recommended: true },
  { key: "budget",  label: "Бюджет",       desc: "только нужное" },
  { key: "exact",   label: "Точные цифры", desc: "вилки от-до по каждой категории" },
];

const PODBOR_PICK_STRATEGIES = [
  { key: "reviews",       label: "Лучшее по отзывам",         hint: "топ по рейтингам пользователей" },
  { key: "balance",       label: "Цена / качество",            hint: "оптимальный баланс",            recommended: true },
  { key: "premium_brand", label: "Топ-бренды премиум",         hint: "Miele · Gaggenau · Sub-Zero" },
  { key: "cheap",         label: "Самое доступное",            hint: "надёжный минимум" },
  { key: "tech",          label: "Современные технологии",     hint: "Wi-Fi · инверторы · пар" },
  { key: "style",         label: "Стилевая согласованность",   hint: "единый дизайн-язык всей техники" },
];

/* Сколько моделей предлагать в каждой категории.
   Меньше = быстрее, больше = больше выбора, но AI ответ дольше и нагрузка на парсеры. */
const PODBOR_MODEL_COUNTS = [
  { key: "3",  label: "3 модели",  hint: "быстро · базовый выбор" },
  { key: "5",  label: "5 моделей", hint: "оптимально · хороший баланс", recommended: true },
  { key: "7",  label: "7 моделей", hint: "максимум · долго" },
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
    ],
  },
  hob: {
    steps: [
      {
        key: "heat_source",
        title: "Источник нагрева",
        type: "single",
        options: [
          { key: "elec",  label: "Электричество",       hint: "индукция / Hi-Light",        pict: "hob_src_elec" },
          { key: "gas",   label: "Газ",                 hint: "открытое пламя / на стекле", pict: "hob_src_gas" },
          { key: "combi", label: "Комбинированная",     hint: "газ + электро",              pict: "hob_src_combi" },
        ],
      },
      {
        key: "subtype",
        title: "Подтип",
        type: "multi",
        optionsBy: {
          dependsOn: "heat_source",
          map: {
            elec: [
              { key: "induction", label: "Индукция",     hint: "магнитный нагрев посуды" },
              { key: "hilight",   label: "Hi-Light",      hint: "стеклокерамика · спираль" },
            ],
            gas: [
              { key: "open",  label: "Открытое пламя",   hint: "металл + чугунные решётки" },
              { key: "glass", label: "Газ под стеклом",  hint: "стеклокерамика + конфорки" },
            ],
            combi: [
              { key: "induction", label: "Индукция",     hint: "электро-зона" },
              { key: "hilight",   label: "Hi-Light",      hint: "электро-зона" },
              { key: "open",  label: "Газ · открытое",   hint: "газ-зона" },
              { key: "glass", label: "Газ под стеклом",  hint: "газ-зона" },
            ],
          },
        },
      },
      {
        key: "width",
        title: "Размер (ширина)",
        type: "single",
        options: [
          { key: "30", label: "30 см", hint: "Domino · модульная" },
          { key: "45", label: "45 см", hint: "узкая" },
          { key: "60", label: "60 см", hint: "стандарт", star: true },
          { key: "75", label: "75 см", hint: "расширенная" },
          { key: "90", label: "90 см", hint: "максимальная" },
        ],
      },
      {
        key: "burners",
        title: "Количество конфорок",
        type: "single",
        options: [
          { key: "2", label: "2" },
          { key: "3", label: "3" },
          { key: "4", label: "4", star: true },
          { key: "5", label: "5" },
          { key: "6", label: "6" },
        ],
      },
    ],
  },
  oven: {
    steps: [
      {
        key: "install",
        title: "Тип установки",
        type: "single",
        options: [
          { key: "built_in", label: "Встраиваемый",        hint: "под фасад ЗОВ",   star: true, pict: "oven_install_builtin" },
          { key: "stove",    label: "Плита с духовкой",    hint: "отдельностоящая", pict: "oven_install_stove" },
        ],
      },
      {
        key: "functions",
        title: "Функции",
        type: "multi",
        optionsBy: {
          dependsOn: "install",
          map: {
            built_in: [
              { key: "basic",      label: "Базовая (статика)",  hint: "без вентилятора" },
              { key: "convection", label: "Конвекция",           hint: "равномерный жар", star: true },
              { key: "pyrolysis",  label: "Пиролиз",             hint: "самоочистка при 500°" },
              { key: "steam",      label: "Пар",                 hint: "хлеб, мясо без пересушки" },
              { key: "microwave",  label: "Микроволны (комби)",  hint: "заменяет СВЧ" },
              { key: "grill",      label: "Гриль / Турбо-гриль", hint: "корочка сверху" },
            ],
            stove: [
              { key: "gas_oven",    label: "Газовая духовка" },
              { key: "elec_oven",   label: "Электро-духовка" },
              { key: "combi_stove", label: "Газ-плита + электро-духовка" },
            ],
          },
        },
      },
      {
        key: "size",
        title: "Размер",
        type: "single",
        optionsBy: {
          dependsOn: "install",
          map: {
            built_in: [
              { key: "std60",   label: "60 × 60 см", hint: "стандарт", star: true },
              { key: "compact", label: "60 × 45 см", hint: "компакт · в колонну" },
              { key: "wide90",  label: "90 × 60 см", hint: "широкий · премиум" },
            ],
            stove: [
              { key: "50", label: "50 см" },
              { key: "60", label: "60 см", star: true },
              { key: "85", label: "85 см" },
              { key: "90", label: "90 см" },
            ],
          },
        },
      },
      {
        key: "location",
        title: "Где ставим",
        type: "single",
        condition: { install: "built_in" },
        options: [
          { key: "under_top", label: "Под столешницу", hint: "нижний ряд" },
          { key: "in_column", label: "В колонне",      hint: "на уровне глаз", star: true },
          { key: "with_pair", label: "В пенале",       hint: "+ СВЧ / кофемашина" },
        ],
      },
    ],
  },
  dw: {
    steps: [
      // 1. Тип встройки
      {
        key: "install",
        title: "Тип встройки",
        type: "single",
        options: [
          { key: "full",         label: "Полновстраиваемая",     hint: "фасад ЗОВ полностью",     star: true, pict: "dw_install_full" },
          { key: "partial",      label: "Частично встраиваемая", hint: "видна панель управления", pict: "dw_install_partial" },
          { key: "freestanding", label: "Отдельностоящая",       hint: "без фасада",              pict: "dw_install_freestanding" },
        ],
      },
      // 2. Размер
      {
        key: "width",
        title: "Размер (ширина)",
        type: "single",
        options: [
          { key: "45", label: "45 см", hint: "9–10 комплектов" },
          { key: "60", label: "60 см", hint: "13–14 комплектов", star: true },
        ],
      },
      // 3. Корзины + программы
      {
        key: "baskets",
        title: "Корзины и программы",
        type: "single",
        options: [
          { key: "two_basic",  label: "2 корзины · базовый набор",      hint: "5-6 программ · эконом" },
          { key: "three_std",  label: "3 корзины · стандарт",            hint: "8-10 программ · оптимум", star: true },
          { key: "three_pro",  label: "3 корзины · расширенный",         hint: "12+ программ · стекло, авто, кастрюли" },
        ],
      },
    ],
  },
  hood: {
    steps: [
      {
        key: "form_factor",
        title: "Форм-фактор",
        type: "single",
        options: [
          { key: "built_in_drawer", label: "Встроенная · выдвижная", hint: "скрытая в шкафу, выдвигается панель", star: true, pict: "hood_form_drawer" },
          { key: "fully_hidden",    label: "Полностью скрытая",       hint: "внутри шкафа без панели",  pict: "hood_form_hidden" },
          { key: "dome",            label: "Купольная / каминная",    hint: "видимый купол над плитой", pict: "hood_form_dome" },
          { key: "inclined",        label: "Наклонная",               hint: "стекло под углом",         pict: "hood_form_inclined" },
          { key: "island",          label: "Островная",               hint: "с потолка над островом",   pict: "hood_form_island" },
          { key: "downdraft",       label: "Downdraft",               hint: "выдвижная из столешницы",  pict: "hood_form_downdraft" },
          { key: "hob_combo",       label: "Hood-in-hob",             hint: "встроенная в варочную",    pict: "hood_form_hob" },
        ],
      },
      {
        key: "mode",
        title: "Подключение",
        type: "single",
        options: [
          { key: "exhaust", label: "Отвод в вентшахту", star: true },
          { key: "recirc",  label: "Рециркуляция",     hint: "угольный фильтр" },
          { key: "combi",   label: "Универсальная",    hint: "оба режима" },
        ],
      },
      {
        key: "width",
        title: "Ширина",
        type: "single",
        options: [
          { key: "50",  label: "50 см" },
          { key: "60",  label: "60 см", star: true },
          { key: "75",  label: "75 см" },
          { key: "90",  label: "90 см" },
          { key: "120", label: "120 см", hint: "островная / купольная" },
        ],
      },
      {
        key: "color",
        title: "Цвет / материал",
        type: "multi",
        condition: { form_factor: ["dome", "inclined", "island"] },
        options: [
          { key: "inox",        label: "Нержавейка" },
          { key: "black",       label: "Чёрный" },
          { key: "white",       label: "Белый" },
          { key: "glass_black", label: "Стекло чёрное" },
          { key: "glass_white", label: "Стекло белое" },
          { key: "copper",      label: "Медь / латунь", hint: "премиум" },
        ],
      },
    ],
  },
  microwave: {
    steps: [
      {
        key: "install",
        title: "Тип установки",
        type: "single",
        options: [
          { key: "built_in",     label: "Встраиваемая",     hint: "в колонну с духовкой",  star: true, pict: "microwave_install_builtin" },
          { key: "freestanding", label: "Отдельностоящая",  hint: "на столешнице / полке", pict: "microwave_install_freestanding" },
        ],
      },
      {
        key: "functions",
        title: "Функции",
        type: "multi",
        options: [
          { key: "solo",       label: "Соло",        hint: "только нагрев" },
          { key: "grill",      label: "Гриль",       hint: "корочка сверху" },
          { key: "convection", label: "Конвекция",   hint: "мини-духовка" },
          { key: "steam",      label: "Пар",         hint: "" },
          { key: "inverter",   label: "Инвертор",    hint: "плавная мощность · не пересушивает" },
        ],
      },
      {
        key: "size",
        title: "Размер",
        type: "single",
        optionsBy: {
          dependsOn: "install",
          map: {
            built_in: [
              { key: "38h", label: "~38 см H", hint: "стандартная встройка", star: true },
              { key: "45h", label: "~45 см H", hint: "под компакт-духовку" },
            ],
            freestanding: [
              { key: "17l", label: "17 л" },
              { key: "20l", label: "20 л", star: true },
              { key: "25l", label: "25 л" },
              { key: "32l", label: "32 л" },
            ],
          },
        },
      },
    ],
  },
  coffee: {
    steps: [
      {
        key: "type",
        title: "Тип кофемашины",
        type: "single",
        options: [
          { key: "built_in_grinder", label: "Встраиваемая зерновая",    hint: "60 × 45 см · в колонну",     star: true, pict: "coffee_type_builtin" },
          { key: "free_grinder",     label: "Отдельностоящая зерновая", hint: "на столешнице",              pict: "coffee_type_free_grinder" },
          { key: "capsule",          label: "Капсульная",               hint: "Nespresso / Dolce Gusto",    pict: "coffee_type_capsule" },
          { key: "manual",           label: "Рожковая",                 hint: "бариста-стиль с холдером",   pict: "coffee_type_manual" },
          { key: "tap",              label: "Кран-кофемашина",          hint: "под столешницу, премиум",    pict: "coffee_type_tap" },
        ],
      },
      {
        key: "milk",
        title: "Молочная система",
        type: "multi",
        condition: { type: ["built_in_grinder", "free_grinder", "manual"] },
        options: [
          { key: "auto",         label: "Автоматический капучинатор", hint: "латте / капучино одной кнопкой" },
          { key: "manual_steam", label: "Ручной паровой кран",        hint: "" },
          { key: "none",         label: "Без молочной системы",       hint: "только эспрессо" },
          { key: "cup_warm",     label: "Подогрев чашек сверху",      hint: "" },
        ],
      },
      {
        key: "water",
        title: "Подключение воды",
        type: "single",
        condition: { type: ["built_in_grinder", "tap"] },
        options: [
          { key: "tank",       label: "С резервуаром",        hint: "без подвода воды" },
          { key: "water_line", label: "Автоподключение к водопроводу", star: true },
        ],
      },
      {
        key: "size",
        title: "Размер",
        type: "single",
        condition: { type: "built_in_grinder" },
        options: [
          { key: "std",    label: "60 × 45 см", hint: "стандарт", star: true },
          { key: "narrow", label: "45 × 45 см", hint: "узкая" },
        ],
      },
    ],
  },
  washer: {
    steps: [
      {
        key: "install",
        title: "Тип установки",
        type: "single",
        options: [
          { key: "built_in",     label: "Встраиваемая",     hint: "скрытая фасадом ЗОВ", star: true, pict: "washer_install_builtin" },
          { key: "under_top",    label: "Под столешницу",   hint: "открытая, без фасада", pict: "washer_install_undertop" },
          { key: "freestanding", label: "Отдельностоящая",  hint: "",                     pict: "washer_install_freestanding" },
        ],
      },
      {
        key: "function",
        title: "Функция",
        type: "single",
        options: [
          { key: "wash_only",  label: "Только стирка", star: true },
          { key: "wash_dry",   label: "Стирка + сушка (combo)" },
          { key: "dryer_pair", label: "Отдельная сушильная рядом", hint: "в одну колонну · ~170 см H" },
        ],
      },
      {
        key: "depth",
        title: "Глубина",
        type: "single",
        options: [
          { key: "45", label: "45 см", hint: "узкая · под модуль ЗОВ", star: true },
          { key: "60", label: "60 см", hint: "стандарт · нестандартный модуль" },
        ],
      },
      {
        key: "load_type",
        title: "Загрузка",
        type: "single",
        options: [
          { key: "front",    label: "Фронтальная", star: true },
          { key: "vertical", label: "Вертикальная", hint: "только отдельностоящая" },
        ],
      },
      {
        key: "load_kg",
        title: "Объём загрузки",
        type: "single",
        options: [
          { key: "to6",  label: "до 6 кг",  hint: "1–2 человека" },
          { key: "6_8",  label: "6–8 кг",   hint: "семья 3–4", star: true },
          { key: "8_10", label: "8–10 кг",  hint: "большая семья" },
          { key: "10+",  label: "10+ кг",   hint: "очень большие объёмы" },
        ],
      },
    ],
  },
};

/* Бренды по категориям, актуально на 2026 РФ.
   ⚠ — параллельный импорт; остальные — официально доступны. */
const PODBOR_BRANDS = {
  fridge: {
    premium: ["Miele ⚠", "Liebherr ⚠", "Gaggenau ⚠", "V-Zug ⚠", "Asko"],
    middle:  ["Bosch ⚠", "Siemens ⚠", "NEFF ⚠", "Haier", "LG", "Samsung", "Electrolux", "AEG"],
    budget:  ["Kuppersberg", "Maunfeld", "Weissgauff", "Hansa", "Beko", "Gorenje", "Hotpoint", "Indesit", "Hisense", "Атлант"],
  },
  hob: {
    premium: ["Miele ⚠", "Gaggenau ⚠", "Asko", "Smeg ⚠"],
    middle:  ["Bosch ⚠", "Siemens ⚠", "NEFF ⚠", "Haier", "Electrolux", "AEG"],
    budget:  ["Kuppersberg", "Maunfeld", "Weissgauff", "Korting", "Hansa", "Beko", "Gorenje", "Midea"],
  },
  oven: {
    premium: ["Miele ⚠", "Gaggenau ⚠", "NEFF ⚠", "Asko", "Smeg ⚠"],
    middle:  ["Bosch ⚠", "Siemens ⚠", "Haier", "Electrolux", "AEG"],
    budget:  ["Kuppersberg", "Maunfeld", "Weissgauff", "Korting", "Hansa", "Beko", "Gorenje"],
  },
  dw: {
    premium: ["Miele ⚠", "Asko", "V-Zug ⚠"],
    middle:  ["Bosch ⚠", "Siemens ⚠", "NEFF ⚠", "Electrolux", "Haier", "Whirlpool"],
    budget:  ["Kuppersberg", "Maunfeld", "Weissgauff", "Hansa", "Beko", "Gorenje", "Indesit", "Candy"],
  },
  hood: {
    premium: ["Miele ⚠", "Falmec ⚠", "Faber ⚠", "Smeg ⚠"],
    middle:  ["Bosch ⚠", "Siemens ⚠", "Elica ⚠", "Haier"],
    budget:  ["Kuppersberg", "Maunfeld", "Weissgauff", "Elikor", "Hansa", "Krona", "Korting"],
  },
  microwave: {
    premium: ["Miele ⚠", "NEFF ⚠"],
    middle:  ["Bosch ⚠", "Siemens ⚠", "Samsung", "LG", "Haier"],
    budget:  ["Kuppersberg", "Maunfeld", "Weissgauff", "Hansa", "Midea", "Whirlpool"],
  },
  coffee: {
    premium: ["Miele ⚠", "Jura ⚠", "Smeg ⚠"],
    middle:  ["Bosch ⚠", "Siemens ⚠", "NEFF ⚠", "De'Longhi ⚠"],
    budget:  ["Kuppersberg", "Maunfeld", "Polaris", "Redmond", "Kitfort"],
  },
  washer: {
    premium: ["Miele ⚠", "Asko", "V-Zug ⚠"],
    middle:  ["Bosch ⚠", "Siemens ⚠", "Haier", "LG", "Samsung", "Electrolux"],
    budget:  ["Kuppersberg", "Maunfeld", "Weissgauff", "Hansa", "Beko", "Indesit", "Атлант", "Candy"],
  },
};
