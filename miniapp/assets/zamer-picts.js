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
};

// Экспорт для использования в renderMarkdown
if (typeof window !== "undefined") window.ZAMER_PICTS = ZAMER_PICTS;
