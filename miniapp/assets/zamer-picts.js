/* ============================================================
   Эскизы для чек-листа замера. Стиль — Editorial Calm:
   walnut #6B4A2B stroke, paper #FBF7F0 fill, лёгкая тень.
   Render: вставляются в markdown через директиву `@pict:KEY` на отдельной строке.
   ============================================================ */

const ZAMER_PICTS = {

  // 1. Вид сверху — план комнаты с пронумерованными стенами
  topview: `
<svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg" class="zp-svg">
  <defs>
    <filter id="zp-shadow1" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#6B4A2B" flood-opacity="0.18"/>
    </filter>
  </defs>
  <!-- комната -->
  <rect x="30" y="30" width="180" height="120" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="2.2" filter="url(#zp-shadow1)"/>
  <!-- дверь (проём на стене 4) -->
  <line x1="30" y1="100" x2="30" y2="130" stroke="#FBF7F0" stroke-width="4"/>
  <path d="M 30 100 A 30 30 0 0 1 60 130" fill="none" stroke="#6B4A2B" stroke-width="1.2" stroke-dasharray="2,2"/>
  <!-- метки стен -->
  <text x="120" y="22" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="#6B4A2B">Стена 1</text>
  <text x="222" y="93" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="#6B4A2B" writing-mode="tb">Стена 2</text>
  <text x="120" y="168" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="#6B4A2B">Стена 3</text>
  <text x="18" y="93" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="#6B4A2B" writing-mode="tb">Стена 4</text>
  <!-- номера на углах -->
  <circle cx="30" cy="30" r="9" fill="#6B4A2B"/>
  <text x="30" y="33.5" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="#FBF7F0">1</text>
  <circle cx="210" cy="30" r="9" fill="#6B4A2B"/>
  <text x="210" y="33.5" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="#FBF7F0">2</text>
  <circle cx="210" cy="150" r="9" fill="#6B4A2B"/>
  <text x="210" y="153.5" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="#FBF7F0">3</text>
  <circle cx="30" cy="150" r="9" fill="#6B4A2B"/>
  <text x="30" y="153.5" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="#FBF7F0">4</text>
  <!-- компас N -->
  <g transform="translate(202, 158)">
    <circle r="7" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="0.8"/>
    <path d="M 0 -5 L 2 2 L 0 0 L -2 2 Z" fill="#6B4A2B"/>
    <text y="-9" text-anchor="middle" font-family="Inter, sans-serif" font-size="7" font-weight="700" fill="#6B4A2B">С</text>
  </g>
</svg>`.trim(),

  // 2. По часовой стрелке — план + изогнутая стрелка
  clockwise: `
<svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg" class="zp-svg">
  <defs>
    <filter id="zp-shadow2" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#6B4A2B" flood-opacity="0.18"/>
    </filter>
    <marker id="zp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#003E7E"/>
    </marker>
  </defs>
  <!-- комната -->
  <rect x="30" y="30" width="180" height="120" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="2.2" filter="url(#zp-shadow2)"/>
  <!-- стрелка по часовой: старт в верхнем-левом углу, идёт вдоль стен -->
  <path d="M 50 50 L 190 50 L 190 130 L 50 130 L 50 60"
        fill="none" stroke="#003E7E" stroke-width="2.5" stroke-linecap="round"
        marker-end="url(#zp-arrow)"/>
  <!-- точка СТАРТ -->
  <circle cx="50" cy="50" r="5" fill="#003E7E"/>
  <text x="48" y="44" text-anchor="end" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="#003E7E">старт</text>
  <!-- номера стен -->
  <text x="120" y="44" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" font-weight="600" fill="#6B4A2B">1 →</text>
  <text x="184" y="93" text-anchor="end" font-family="Inter, sans-serif" font-size="10" font-weight="600" fill="#6B4A2B">2 ↓</text>
  <text x="120" y="146" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" font-weight="600" fill="#6B4A2B">← 3</text>
  <text x="56" y="93" font-family="Inter, sans-serif" font-size="10" font-weight="600" fill="#6B4A2B">↑ 4</text>
</svg>`.trim(),

  // 3. Проёмы — фронтальный вид стены с дверью + окном + балконом
  openings: `
<svg viewBox="0 0 280 180" xmlns="http://www.w3.org/2000/svg" class="zp-svg">
  <defs>
    <filter id="zp-shadow3" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#6B4A2B" flood-opacity="0.18"/>
    </filter>
  </defs>
  <!-- стена -->
  <rect x="20" y="30" width="240" height="120" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="2.2" filter="url(#zp-shadow3)"/>
  <!-- дверь слева -->
  <rect x="40" y="50" width="40" height="100" fill="none" stroke="#6B4A2B" stroke-width="1.6"/>
  <line x1="40" y1="50" x2="80" y2="150" stroke="#6B4A2B" stroke-width="0.8" stroke-dasharray="2,2"/>
  <line x1="80" y1="50" x2="40" y2="150" stroke="#6B4A2B" stroke-width="0.8" stroke-dasharray="2,2"/>
  <text x="60" y="44" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="#6B4A2B">ДВ1</text>
  <!-- окно посередине, с подоконником -->
  <rect x="120" y="60" width="60" height="55" fill="none" stroke="#6B4A2B" stroke-width="1.6"/>
  <line x1="120" y1="60" x2="180" y2="115" stroke="#6B4A2B" stroke-width="0.8" stroke-dasharray="2,2"/>
  <line x1="180" y1="60" x2="120" y2="115" stroke="#6B4A2B" stroke-width="0.8" stroke-dasharray="2,2"/>
  <text x="150" y="54" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="#6B4A2B">ОК1</text>
  <!-- балкон справа (двойная вертикаль) -->
  <rect x="210" y="50" width="40" height="100" fill="none" stroke="#6B4A2B" stroke-width="1.6"/>
  <rect x="213" y="53" width="34" height="94" fill="none" stroke="#6B4A2B" stroke-width="0.7"/>
  <text x="230" y="44" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="#6B4A2B">БК1</text>
  <!-- размеры окна: ширина, высота, низ от пола -->
  <line x1="120" y1="124" x2="180" y2="124" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="120" y1="121" x2="120" y2="127" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="180" y1="121" x2="180" y2="127" stroke="#003E7E" stroke-width="0.9"/>
  <text x="150" y="134" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8" fill="#003E7E">ширина</text>
  <!-- высота окна -->
  <line x1="188" y1="60" x2="188" y2="115" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="185" y1="60" x2="191" y2="60" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="185" y1="115" x2="191" y2="115" stroke="#003E7E" stroke-width="0.9"/>
  <text x="192" y="91" font-family="JetBrains Mono, monospace" font-size="8" fill="#003E7E">высота</text>
  <!-- низ подоконника от пола -->
  <line x1="110" y1="115" x2="110" y2="150" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="107" y1="115" x2="113" y2="115" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="107" y1="150" x2="113" y2="150" stroke="#003E7E" stroke-width="0.9"/>
  <text x="106" y="135" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="8" fill="#003E7E">↓пол</text>
  <!-- линия пола -->
  <line x1="10" y1="150" x2="270" y2="150" stroke="#6B4A2B" stroke-width="2"/>
</svg>`.trim(),

  // 4. Замер коммуникаций — стена с точками R1, Sw1, Wc1 и двумя размерами на точку
  comms: `
<svg viewBox="0 0 280 180" xmlns="http://www.w3.org/2000/svg" class="zp-svg">
  <defs>
    <filter id="zp-shadow4" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#6B4A2B" flood-opacity="0.18"/>
    </filter>
  </defs>
  <!-- стена -->
  <rect x="20" y="30" width="240" height="120" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="2.2" filter="url(#zp-shadow4)"/>
  <!-- база — правый угол подписан -->
  <text x="252" y="42" text-anchor="end" font-family="Inter, sans-serif" font-size="8" font-weight="700" fill="#6B4A2B">БАЗА: ПУ</text>
  <!-- линия пола -->
  <line x1="20" y1="150" x2="260" y2="150" stroke="#6B4A2B" stroke-width="2"/>

  <!-- точка R1 (розетка) — крестик + шильд -->
  <g transform="translate(80, 110)">
    <line x1="-5" y1="0" x2="5" y2="0" stroke="#C0392B" stroke-width="1.5"/>
    <line x1="0" y1="-5" x2="0" y2="5" stroke="#C0392B" stroke-width="1.5"/>
    <line x1="0" y1="0" x2="12" y2="-12" stroke="#6B4A2B" stroke-width="0.8"/>
    <rect x="12" y="-22" width="26" height="14" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="0.8"/>
    <text x="25" y="-12" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="#C0392B">R1</text>
  </g>
  <!-- размер до правого угла (горизонталь) -->
  <line x1="80" y1="160" x2="260" y2="160" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="80" y1="157" x2="80" y2="163" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="260" y1="157" x2="260" y2="163" stroke="#003E7E" stroke-width="0.9"/>
  <text x="170" y="170" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8" fill="#003E7E">→ ПУ</text>
  <!-- размер до пола (вертикаль) -->
  <line x1="68" y1="110" x2="68" y2="150" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="65" y1="110" x2="71" y2="110" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="65" y1="150" x2="71" y2="150" stroke="#003E7E" stroke-width="0.9"/>
  <text x="64" y="133" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="8" fill="#003E7E">↑пол</text>

  <!-- точка Sw1 (выключатель) -->
  <g transform="translate(160, 80)">
    <line x1="-5" y1="0" x2="5" y2="0" stroke="#27AE60" stroke-width="1.5"/>
    <line x1="0" y1="-5" x2="0" y2="5" stroke="#27AE60" stroke-width="1.5"/>
    <line x1="0" y1="0" x2="14" y2="-14" stroke="#6B4A2B" stroke-width="0.8"/>
    <rect x="14" y="-24" width="30" height="14" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="0.8"/>
    <text x="29" y="-14" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="#27AE60">Sw1</text>
  </g>

  <!-- точка Wc1 (вода холодная) -->
  <g transform="translate(220, 120)">
    <line x1="-5" y1="0" x2="5" y2="0" stroke="#2980B9" stroke-width="1.5"/>
    <line x1="0" y1="-5" x2="0" y2="5" stroke="#2980B9" stroke-width="1.5"/>
    <line x1="0" y1="0" x2="-14" y2="-14" stroke="#6B4A2B" stroke-width="0.8"/>
    <rect x="-44" y="-24" width="30" height="14" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="0.8"/>
    <text x="-29" y="-14" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="#2980B9">Wc1</text>
  </g>
</svg>`.trim(),

  // 5. Перепады пола и потолка — разрез
  levels: `
<svg viewBox="0 0 280 180" xmlns="http://www.w3.org/2000/svg" class="zp-svg">
  <defs>
    <filter id="zp-shadow5" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#6B4A2B" flood-opacity="0.18"/>
    </filter>
    <pattern id="zp-slab" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="10" stroke="#6B4A2B" stroke-width="0.5"/>
    </pattern>
  </defs>
  <!-- стены (тонкие вертикальные) -->
  <rect x="20" y="20" width="240" height="140" fill="none" stroke="#6B4A2B" stroke-width="1.2" filter="url(#zp-shadow5)"/>
  <!-- бетонная плита (нижний слой) -->
  <rect x="20" y="135" width="240" height="25" fill="url(#zp-slab)" stroke="#6B4A2B" stroke-width="1"/>
  <!-- стяжка / нулевой пол (волнистая чтобы показать перепад) -->
  <path d="M 20 120 Q 60 116 100 122 T 180 119 T 260 121" fill="none" stroke="#6B4A2B" stroke-width="2"/>
  <line x1="20" y1="120" x2="20" y2="135" stroke="#6B4A2B" stroke-width="1.5"/>
  <line x1="260" y1="121" x2="260" y2="135" stroke="#6B4A2B" stroke-width="1.5"/>
  <text x="30" y="115" font-family="Inter, sans-serif" font-size="9" font-weight="600" fill="#6B4A2B">0,000 (нулевой пол)</text>
  <text x="30" y="153" font-family="Inter, sans-serif" font-size="8" fill="#6B4A2B">+88 над плитой</text>

  <!-- потолок — с перепадом справа (короб) -->
  <line x1="20" y1="45" x2="180" y2="45" stroke="#6B4A2B" stroke-width="2"/>
  <line x1="180" y1="45" x2="180" y2="65" stroke="#6B4A2B" stroke-width="2"/>
  <line x1="180" y1="65" x2="260" y2="65" stroke="#6B4A2B" stroke-width="2"/>
  <text x="100" y="40" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="600" fill="#6B4A2B">потолок</text>
  <text x="220" y="60" text-anchor="middle" font-family="Inter, sans-serif" font-size="8" fill="#6B4A2B">короб</text>

  <!-- размер: высота помещения слева -->
  <line x1="10" y1="45" x2="10" y2="120" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="7" y1="45" x2="13" y2="45" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="7" y1="120" x2="13" y2="120" stroke="#003E7E" stroke-width="0.9"/>
  <text x="13" y="85" font-family="JetBrains Mono, monospace" font-size="8" fill="#003E7E" transform="rotate(-90, 13, 85)">H1</text>
  <!-- размер: высота помещения справа (меньше из-за короба) -->
  <line x1="270" y1="65" x2="270" y2="121" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="267" y1="65" x2="273" y2="65" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="267" y1="121" x2="273" y2="121" stroke="#003E7E" stroke-width="0.9"/>
  <text x="267" y="95" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="8" fill="#003E7E" transform="rotate(-90, 267, 95)">H2</text>
</svg>`.trim(),

  // 6. Стена 1 — чистая стена, базовые габариты
  wall1: `
<svg viewBox="0 0 300 195" xmlns="http://www.w3.org/2000/svg" class="zp-svg">
  <defs>
    <filter id="zpf-wa1" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#6B4A2B" flood-opacity="0.18"/>
    </filter>
  </defs>
  <!-- Заголовок -->
  <text x="150" y="12" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" font-weight="700" fill="#6B4A2B">СТЕНА — фронтальный вид</text>
  <!-- Стена -->
  <rect x="50" y="28" width="200" height="112" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="2.5" filter="url(#zpf-wa1)"/>
  <!-- Пол -->
  <line x1="22" y1="140" x2="278" y2="140" stroke="#6B4A2B" stroke-width="2.5"/>
  <line x1="22" y1="140" x2="27" y2="147" stroke="#6B4A2B" stroke-width="1"/>
  <line x1="35" y1="140" x2="40" y2="147" stroke="#6B4A2B" stroke-width="1"/>
  <line x1="48" y1="140" x2="53" y2="147" stroke="#6B4A2B" stroke-width="1"/>
  <line x1="61" y1="140" x2="66" y2="147" stroke="#6B4A2B" stroke-width="1"/>
  <line x1="235" y1="140" x2="240" y2="147" stroke="#6B4A2B" stroke-width="1"/>
  <line x1="248" y1="140" x2="253" y2="147" stroke="#6B4A2B" stroke-width="1"/>
  <line x1="261" y1="140" x2="266" y2="147" stroke="#6B4A2B" stroke-width="1"/>
  <!-- Угловые символы -->
  <rect x="44" y="134" width="12" height="12" fill="#6B4A2B" rx="1"/>
  <rect x="244" y="134" width="12" height="12" fill="#6B4A2B" rx="1"/>
  <text x="50" y="162" text-anchor="middle" font-family="Inter,sans-serif" font-size="8.5" font-weight="700" fill="#6B4A2B">ЛУ</text>
  <text x="250" y="162" text-anchor="middle" font-family="Inter,sans-serif" font-size="8.5" font-weight="700" fill="#6B4A2B">ПУ</text>
  <!-- Метки 4 внутренних углов стены -->
  <text x="56" y="40" font-family="Inter,sans-serif" font-size="8" fill="#6B4A2B" opacity="0.5">ЛВ</text>
  <text x="244" y="40" text-anchor="end" font-family="Inter,sans-serif" font-size="8" fill="#6B4A2B" opacity="0.5">ПВ</text>
  <text x="56" y="136" font-family="Inter,sans-serif" font-size="8" fill="#6B4A2B" opacity="0.5">ЛН</text>
  <text x="244" y="136" text-anchor="end" font-family="Inter,sans-serif" font-size="8" fill="#6B4A2B" opacity="0.5">ПН</text>
  <!-- Дуга угла (α°) — иллюстрация замера угла в каждом из 4 углов -->
  <path d="M 50 126 A 14 14 0 0 1 64 140" fill="none" stroke="#E67E22" stroke-width="1.4"/>
  <text x="70" y="137" font-family="Inter,sans-serif" font-size="9" fill="#E67E22">α°</text>
  <!-- БАЗА: ПУ (нотация базового угла) -->
  <rect x="218" y="112" width="46" height="16" fill="#E67E22" rx="3" opacity="0.88"/>
  <text x="241" y="124" text-anchor="middle" font-family="Inter,sans-serif" font-size="8.5" font-weight="700" fill="#FBF7F0">БАЗА: ПУ</text>
  <!-- РАЗМЕР: ШИРИНА L (сверху) -->
  <line x1="50" y1="17" x2="250" y2="17" stroke="#003E7E" stroke-width="1.2"/>
  <line x1="50" y1="13" x2="50" y2="21" stroke="#003E7E" stroke-width="1.2"/>
  <line x1="250" y1="13" x2="250" y2="21" stroke="#003E7E" stroke-width="1.2"/>
  <line x1="50" y1="17" x2="50" y2="28" stroke="#003E7E" stroke-width="0.7" stroke-dasharray="2,2"/>
  <line x1="250" y1="17" x2="250" y2="28" stroke="#003E7E" stroke-width="0.7" stroke-dasharray="2,2"/>
  <rect x="112" y="10" width="76" height="13" fill="#FBF7F0"/>
  <text x="150" y="20" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9" fill="#003E7E">L — ширина</text>
  <!-- РАЗМЕР: ВЫСОТА H (справа) -->
  <line x1="272" y1="28" x2="272" y2="140" stroke="#003E7E" stroke-width="1.2"/>
  <line x1="268" y1="28" x2="276" y2="28" stroke="#003E7E" stroke-width="1.2"/>
  <line x1="268" y1="140" x2="276" y2="140" stroke="#003E7E" stroke-width="1.2"/>
  <line x1="250" y1="28" x2="272" y2="28" stroke="#003E7E" stroke-width="0.7" stroke-dasharray="2,2"/>
  <line x1="250" y1="140" x2="272" y2="140" stroke="#003E7E" stroke-width="0.7" stroke-dasharray="2,2"/>
  <text x="286" y="84" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9" fill="#003E7E" transform="rotate(90,286,84)">H — высота</text>
  <!-- Серединный размер пунктиром (Lc — «если стена играет») -->
  <line x1="50" y1="84" x2="250" y2="84" stroke="#003E7E" stroke-width="0.8" stroke-dasharray="4,3" opacity="0.4"/>
  <text x="253" y="87" font-family="JetBrains Mono,monospace" font-size="8" fill="#003E7E" opacity="0.55">Lc</text>
  <!-- Центральная подпись -->
  <text x="150" y="80" text-anchor="middle" font-family="Inter,sans-serif" font-size="9.5" fill="#6B4A2B" opacity="0.22">чистая стена</text>
</svg>`.trim(),

  // 7. Стена 2 — стена с дверным проёмом и разбивкой на сегменты
  wall2: `
<svg viewBox="0 0 320 215" xmlns="http://www.w3.org/2000/svg" class="zp-svg">
  <defs>
    <filter id="zpf-wa2" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#6B4A2B" flood-opacity="0.18"/>
    </filter>
  </defs>
  <!-- Заголовок -->
  <text x="160" y="12" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" font-weight="700" fill="#6B4A2B">СТЕНА — дверной проём</text>
  <!-- Стена -->
  <rect x="45" y="28" width="240" height="117" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="2.5" filter="url(#zpf-wa2)"/>
  <!-- Дверной проём — серый прямоугольник (проём = пустота) -->
  <rect x="120" y="55" width="55" height="90" fill="#D8D4CC" stroke="#6B4A2B" stroke-width="1.5"/>
  <!-- Дуга открывания -->
  <path d="M 120 145 A 55 55 0 0 1 175 90" fill="none" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="3,2"/>
  <text x="147" y="49" text-anchor="middle" font-family="Inter,sans-serif" font-size="8.5" font-weight="700" fill="#6B4A2B">ДВ1</text>
  <!-- Пол -->
  <line x1="18" y1="145" x2="302" y2="145" stroke="#6B4A2B" stroke-width="2.5"/>
  <line x1="18" y1="145" x2="23" y2="152" stroke="#6B4A2B" stroke-width="1"/>
  <line x1="31" y1="145" x2="36" y2="152" stroke="#6B4A2B" stroke-width="1"/>
  <line x1="275" y1="145" x2="280" y2="152" stroke="#6B4A2B" stroke-width="1"/>
  <line x1="288" y1="145" x2="293" y2="152" stroke="#6B4A2B" stroke-width="1"/>
  <!-- Угловые символы -->
  <rect x="39" y="139" width="12" height="12" fill="#6B4A2B" rx="1"/>
  <rect x="273" y="139" width="12" height="12" fill="#6B4A2B" rx="1"/>
  <text x="45" y="172" text-anchor="middle" font-family="Inter,sans-serif" font-size="8.5" font-weight="700" fill="#6B4A2B">ЛУ</text>
  <text x="279" y="172" text-anchor="middle" font-family="Inter,sans-serif" font-size="8.5" font-weight="700" fill="#6B4A2B">ПУ</text>
  <!-- БАЗА: ПУ -->
  <rect x="238" y="117" width="46" height="16" fill="#E67E22" rx="3" opacity="0.88"/>
  <text x="261" y="129" text-anchor="middle" font-family="Inter,sans-serif" font-size="8.5" font-weight="700" fill="#FBF7F0">БАЗА: ПУ</text>
  <!-- РАЗМЕР: Высота двери В (слева от проёма) -->
  <line x1="104" y1="55" x2="104" y2="145" stroke="#C0392B" stroke-width="1"/>
  <line x1="101" y1="55" x2="107" y2="55" stroke="#C0392B" stroke-width="1"/>
  <line x1="101" y1="145" x2="107" y2="145" stroke="#C0392B" stroke-width="1"/>
  <line x1="104" y1="55" x2="120" y2="55" stroke="#C0392B" stroke-width="0.7" stroke-dasharray="2,2"/>
  <line x1="104" y1="145" x2="120" y2="145" stroke="#C0392B" stroke-width="0.7" stroke-dasharray="2,2"/>
  <text x="101" y="103" text-anchor="end" font-family="JetBrains Mono,monospace" font-size="9" fill="#C0392B" transform="rotate(-90,101,103)">В</text>
  <!-- РАЗМЕРЫ СЕГМЕНТОВ (под полом) -->
  <!-- A: ЛУ → левый край двери -->
  <line x1="45" y1="158" x2="120" y2="158" stroke="#003E7E" stroke-width="1.1"/>
  <line x1="45" y1="155" x2="45" y2="161" stroke="#003E7E" stroke-width="1.1"/>
  <line x1="120" y1="155" x2="120" y2="161" stroke="#003E7E" stroke-width="1.1"/>
  <text x="82" y="172" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9" fill="#003E7E">A</text>
  <!-- Ш: ширина двери -->
  <line x1="120" y1="158" x2="175" y2="158" stroke="#C0392B" stroke-width="1.1"/>
  <line x1="120" y1="155" x2="120" y2="161" stroke="#C0392B" stroke-width="1.1"/>
  <line x1="175" y1="155" x2="175" y2="161" stroke="#C0392B" stroke-width="1.1"/>
  <text x="147" y="172" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9" fill="#C0392B">Ш</text>
  <!-- B: правый край двери → ПУ -->
  <line x1="175" y1="158" x2="279" y2="158" stroke="#003E7E" stroke-width="1.1"/>
  <line x1="175" y1="155" x2="175" y2="161" stroke="#003E7E" stroke-width="1.1"/>
  <line x1="279" y1="155" x2="279" y2="161" stroke="#003E7E" stroke-width="1.1"/>
  <text x="227" y="172" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9" fill="#003E7E">B</text>
  <!-- ОБЩАЯ ШИРИНА L (сверху) -->
  <line x1="45" y1="17" x2="285" y2="17" stroke="#003E7E" stroke-width="1.2"/>
  <line x1="45" y1="13" x2="45" y2="21" stroke="#003E7E" stroke-width="1.2"/>
  <line x1="285" y1="13" x2="285" y2="21" stroke="#003E7E" stroke-width="1.2"/>
  <line x1="45" y1="17" x2="45" y2="28" stroke="#003E7E" stroke-width="0.7" stroke-dasharray="2,2"/>
  <line x1="285" y1="17" x2="285" y2="28" stroke="#003E7E" stroke-width="0.7" stroke-dasharray="2,2"/>
  <rect x="105" y="10" width="110" height="13" fill="#FBF7F0"/>
  <text x="165" y="20" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9" fill="#003E7E">L = A + Ш + B</text>
</svg>`.trim(),

  // 8. Стена 3 — окно + коммуникации с двумя привязками на каждую точку
  wall3: `
<svg viewBox="0 0 360 255" xmlns="http://www.w3.org/2000/svg" class="zp-svg">
  <defs>
    <filter id="zpf-wa3" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#6B4A2B" flood-opacity="0.18"/>
    </filter>
  </defs>
  <!-- Заголовок -->
  <text x="180" y="12" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" font-weight="700" fill="#6B4A2B">СТЕНА — окно + коммуникации</text>
  <!-- Стена -->
  <rect x="40" y="27" width="290" height="123" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="2.5" filter="url(#zpf-wa3)"/>
  <!-- Окно (голубая заливка = стекло) -->
  <rect x="163" y="52" width="75" height="58" fill="#D6EAF8" stroke="#6B4A2B" stroke-width="1.6"/>
  <line x1="200" y1="52" x2="200" y2="110" stroke="#6B4A2B" stroke-width="0.9"/>
  <line x1="163" y1="81" x2="238" y2="81" stroke="#6B4A2B" stroke-width="0.9"/>
  <text x="200" y="46" text-anchor="middle" font-family="Inter,sans-serif" font-size="8.5" font-weight="700" fill="#6B4A2B">ОК1</text>
  <!-- Пол -->
  <line x1="15" y1="150" x2="345" y2="150" stroke="#6B4A2B" stroke-width="2.5"/>
  <line x1="15" y1="150" x2="20" y2="157" stroke="#6B4A2B" stroke-width="1"/>
  <line x1="28" y1="150" x2="33" y2="157" stroke="#6B4A2B" stroke-width="1"/>
  <line x1="41" y1="150" x2="46" y2="157" stroke="#6B4A2B" stroke-width="1"/>
  <line x1="315" y1="150" x2="320" y2="157" stroke="#6B4A2B" stroke-width="1"/>
  <line x1="328" y1="150" x2="333" y2="157" stroke="#6B4A2B" stroke-width="1"/>
  <!-- Угловые символы -->
  <rect x="34" y="144" width="12" height="12" fill="#6B4A2B" rx="1"/>
  <rect x="318" y="144" width="12" height="12" fill="#6B4A2B" rx="1"/>
  <text x="40" y="172" text-anchor="middle" font-family="Inter,sans-serif" font-size="8.5" font-weight="700" fill="#6B4A2B">ЛУ</text>
  <text x="324" y="172" text-anchor="middle" font-family="Inter,sans-serif" font-size="8.5" font-weight="700" fill="#6B4A2B">ПУ</text>
  <!-- БАЗА: ПУ -->
  <rect x="278" y="120" width="46" height="16" fill="#E67E22" rx="3" opacity="0.88"/>
  <text x="301" y="132" text-anchor="middle" font-family="Inter,sans-serif" font-size="8.5" font-weight="700" fill="#FBF7F0">БАЗА: ПУ</text>
  <!-- === РАЗМЕРЫ ОКНА === -->
  <!-- Ширина окна Ш_ОК (над окном) -->
  <line x1="163" y1="40" x2="238" y2="40" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="163" y1="37" x2="163" y2="43" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="238" y1="37" x2="238" y2="43" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="163" y1="40" x2="163" y2="52" stroke="#003E7E" stroke-width="0.65" stroke-dasharray="2,2"/>
  <line x1="238" y1="40" x2="238" y2="52" stroke="#003E7E" stroke-width="0.65" stroke-dasharray="2,2"/>
  <rect x="172" y="33" width="47" height="12" fill="#FBF7F0"/>
  <text x="200" y="43" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="8.5" fill="#003E7E">Ш_ОК</text>
  <!-- Высота окна В_ОК (правее окна) -->
  <line x1="248" y1="52" x2="248" y2="110" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="245" y1="52" x2="251" y2="52" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="245" y1="110" x2="251" y2="110" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="238" y1="52" x2="248" y2="52" stroke="#003E7E" stroke-width="0.65" stroke-dasharray="2,2"/>
  <line x1="238" y1="110" x2="248" y2="110" stroke="#003E7E" stroke-width="0.65" stroke-dasharray="2,2"/>
  <text x="252" y="83" font-family="JetBrains Mono,monospace" font-size="8.5" fill="#003E7E">В_ОК</text>
  <!-- Подоконник от пола П (ещё правее) -->
  <line x1="260" y1="110" x2="260" y2="150" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="257" y1="110" x2="263" y2="110" stroke="#003E7E" stroke-width="0.9"/>
  <line x1="257" y1="150" x2="263" y2="150" stroke="#003E7E" stroke-width="0.9"/>
  <text x="264" y="133" font-family="JetBrains Mono,monospace" font-size="8.5" fill="#003E7E">П</text>
  <!-- === РОЗЕТКА R1 === -->
  <g transform="translate(95,122)">
    <line x1="-7" y1="0" x2="7" y2="0" stroke="#C0392B" stroke-width="2.2"/>
    <line x1="0" y1="-7" x2="0" y2="7" stroke="#C0392B" stroke-width="2.2"/>
    <line x1="7" y1="-7" x2="20" y2="-20" stroke="#6B4A2B" stroke-width="0.9"/>
    <rect x="20" y="-29" width="24" height="14" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="0.8"/>
    <text x="32" y="-18" text-anchor="middle" font-family="Inter,sans-serif" font-size="9.5" font-weight="700" fill="#C0392B">R1</text>
  </g>
  <!-- R1 → горизонталь до ПУ (A) -->
  <line x1="95" y1="163" x2="324" y2="163" stroke="#C0392B" stroke-width="1"/>
  <line x1="95" y1="160" x2="95" y2="166" stroke="#C0392B" stroke-width="1"/>
  <line x1="324" y1="160" x2="324" y2="166" stroke="#C0392B" stroke-width="1"/>
  <line x1="95" y1="150" x2="95" y2="163" stroke="#C0392B" stroke-width="0.65" stroke-dasharray="2,2"/>
  <rect x="140" y="156" width="96" height="12" fill="#FBF7F0"/>
  <text x="200" y="167" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="8.5" fill="#C0392B">A  (R1 → ПУ)</text>
  <!-- R1 → вертикаль до пола (B) -->
  <line x1="74" y1="122" x2="74" y2="150" stroke="#C0392B" stroke-width="1"/>
  <line x1="71" y1="122" x2="77" y2="122" stroke="#C0392B" stroke-width="1"/>
  <line x1="71" y1="150" x2="77" y2="150" stroke="#C0392B" stroke-width="1"/>
  <text x="70" y="138" text-anchor="end" font-family="JetBrains Mono,monospace" font-size="9" fill="#C0392B">B</text>
  <!-- === ТРУБА ХОЛОДНОЙ ВОДЫ Wc1 === -->
  <g transform="translate(292,92)">
    <circle r="8" fill="none" stroke="#2980B9" stroke-width="1.9"/>
    <line x1="-5" y1="0" x2="5" y2="0" stroke="#2980B9" stroke-width="1.9"/>
    <line x1="0" y1="-5" x2="0" y2="5" stroke="#2980B9" stroke-width="1.9"/>
    <line x1="-8" y1="-8" x2="-22" y2="-22" stroke="#6B4A2B" stroke-width="0.9"/>
    <rect x="-52" y="-32" width="30" height="14" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="0.8"/>
    <text x="-37" y="-21" text-anchor="middle" font-family="Inter,sans-serif" font-size="9.5" font-weight="700" fill="#2980B9">Wc1</text>
  </g>
  <!-- Wc1 → горизонталь до ПУ (C) -->
  <line x1="292" y1="177" x2="324" y2="177" stroke="#2980B9" stroke-width="1"/>
  <line x1="292" y1="174" x2="292" y2="180" stroke="#2980B9" stroke-width="1"/>
  <line x1="324" y1="174" x2="324" y2="180" stroke="#2980B9" stroke-width="1"/>
  <line x1="292" y1="150" x2="292" y2="177" stroke="#2980B9" stroke-width="0.65" stroke-dasharray="2,2"/>
  <rect x="266" y="181" width="84" height="12" fill="#FBF7F0"/>
  <text x="308" y="191" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="8" fill="#2980B9">C  (Wc1 → ПУ)</text>
  <!-- Wc1 → вертикаль до пола (D) -->
  <line x1="313" y1="92" x2="313" y2="150" stroke="#2980B9" stroke-width="1"/>
  <line x1="310" y1="92" x2="316" y2="92" stroke="#2980B9" stroke-width="1"/>
  <line x1="310" y1="150" x2="316" y2="150" stroke="#2980B9" stroke-width="1"/>
  <text x="317" y="123" font-family="JetBrains Mono,monospace" font-size="9" fill="#2980B9">D</text>
  <!-- ОБЩАЯ ШИРИНА L (сверху) -->
  <line x1="40" y1="16" x2="330" y2="16" stroke="#003E7E" stroke-width="1.2"/>
  <line x1="40" y1="12" x2="40" y2="20" stroke="#003E7E" stroke-width="1.2"/>
  <line x1="330" y1="12" x2="330" y2="20" stroke="#003E7E" stroke-width="1.2"/>
  <line x1="40" y1="16" x2="40" y2="27" stroke="#003E7E" stroke-width="0.7" stroke-dasharray="2,2"/>
  <line x1="330" y1="16" x2="330" y2="27" stroke="#003E7E" stroke-width="0.7" stroke-dasharray="2,2"/>
  <rect x="128" y="9" width="64" height="12" fill="#FBF7F0"/>
  <text x="185" y="19" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9" fill="#003E7E">L — ширина</text>
</svg>`.trim(),

  // 9. Вид сверху с коммуникациями — план + привязки точек к базовым углам стен
  topview_comms: `
<svg viewBox="0 0 290 205" xmlns="http://www.w3.org/2000/svg" class="zp-svg">
  <defs>
    <filter id="zpf-tvc" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#6B4A2B" flood-opacity="0.18"/>
    </filter>
  </defs>
  <!-- Заголовок -->
  <text x="145" y="12" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" font-weight="700" fill="#6B4A2B">ВИД СВЕРХУ — коммуникации</text>
  <!-- Комната -->
  <rect x="38" y="25" width="198" height="138" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="2.5" filter="url(#zpf-tvc)"/>
  <!-- Дверь (проём на стене 4) -->
  <line x1="38" y1="108" x2="38" y2="136" stroke="#FBF7F0" stroke-width="5"/>
  <path d="M 38 108 A 28 28 0 0 1 66 136" fill="none" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2,2"/>
  <!-- Окно на стене 1 (верхняя, синяя линия) -->
  <line x1="118" y1="25" x2="168" y2="25" stroke="#2980B9" stroke-width="4"/>
  <!-- Метки стен -->
  <text x="137" y="19" text-anchor="middle" font-family="Inter,sans-serif" font-size="9" font-weight="600" fill="#6B4A2B">Стена 1</text>
  <text x="249" y="96" font-family="Inter,sans-serif" font-size="9" font-weight="600" fill="#6B4A2B" writing-mode="tb">Стена 2</text>
  <text x="137" y="182" text-anchor="middle" font-family="Inter,sans-serif" font-size="9" font-weight="600" fill="#6B4A2B">Стена 3</text>
  <text x="26" y="96" font-family="Inter,sans-serif" font-size="9" font-weight="600" fill="#6B4A2B" writing-mode="tb">Стена 4</text>
  <!-- Нумерованные углы -->
  <circle cx="38" cy="25" r="9" fill="#6B4A2B"/>
  <text x="38" y="28.5" text-anchor="middle" font-family="Inter,sans-serif" font-size="8" font-weight="700" fill="#FBF7F0">1</text>
  <circle cx="236" cy="25" r="9" fill="#6B4A2B"/>
  <text x="236" y="28.5" text-anchor="middle" font-family="Inter,sans-serif" font-size="8" font-weight="700" fill="#FBF7F0">2</text>
  <circle cx="236" cy="163" r="9" fill="#6B4A2B"/>
  <text x="236" y="166.5" text-anchor="middle" font-family="Inter,sans-serif" font-size="8" font-weight="700" fill="#FBF7F0">3</text>
  <circle cx="38" cy="163" r="9" fill="#6B4A2B"/>
  <text x="38" y="166.5" text-anchor="middle" font-family="Inter,sans-serif" font-size="8" font-weight="700" fill="#FBF7F0">4</text>
  <!-- R1 (розетка) на стене 3 — крест внутри у стены -->
  <g transform="translate(88,157)">
    <line x1="-5" y1="0" x2="5" y2="0" stroke="#C0392B" stroke-width="2"/>
    <line x1="0" y1="-5" x2="0" y2="5" stroke="#C0392B" stroke-width="2"/>
    <text x="0" y="-8" text-anchor="middle" font-family="Inter,sans-serif" font-size="7.5" font-weight="700" fill="#C0392B">R1</text>
  </g>
  <!-- R1 → привязка к углу 3 (ПУ стены 3): пунктир вправо -->
  <line x1="88" y1="157" x2="236" y2="157" stroke="#C0392B" stroke-width="0.9" stroke-dasharray="4,2.5"/>
  <line x1="236" y1="154" x2="236" y2="160" stroke="#C0392B" stroke-width="0.9"/>
  <rect x="118" y="145" width="80" height="11" fill="#FBF7F0"/>
  <text x="158" y="154" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="8" fill="#C0392B">A → угол 3</text>
  <!-- Wc1 (труба) на стене 2 — кружок внутри у стены -->
  <g transform="translate(231,72)">
    <circle r="6.5" fill="none" stroke="#2980B9" stroke-width="1.7"/>
    <line x1="-4" y1="0" x2="4" y2="0" stroke="#2980B9" stroke-width="1.7"/>
    <line x1="0" y1="-4" x2="0" y2="4" stroke="#2980B9" stroke-width="1.7"/>
    <text x="-9" y="-9" text-anchor="end" font-family="Inter,sans-serif" font-size="7.5" font-weight="700" fill="#2980B9">Wc1</text>
  </g>
  <!-- Wc1 → привязка к углу 2 (ПУ стены 2): пунктир вверх -->
  <line x1="231" y1="72" x2="231" y2="25" stroke="#2980B9" stroke-width="0.9" stroke-dasharray="4,2.5"/>
  <line x1="228" y1="25" x2="234" y2="25" stroke="#2980B9" stroke-width="0.9"/>
  <rect x="194" y="40" width="50" height="11" fill="#FBF7F0"/>
  <text x="219" y="49" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="8" fill="#2980B9">B ↑ угол 2</text>
  <!-- Пояснение внизу -->
  <text x="145" y="198" text-anchor="middle" font-family="Inter,sans-serif" font-size="8" fill="#6B4A2B" opacity="0.65">A, B — расстояние от точки до базового угла стены</text>
</svg>`.trim(),

};

// Экспорт для использования в renderMarkdown
if (typeof window !== "undefined") window.ZAMER_PICTS = ZAMER_PICTS;
