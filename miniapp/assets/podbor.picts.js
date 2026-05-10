/* ============================================================
   Подбор техники — SVG-пиктограммы (стиль D · 3D перспектива)
   ------------------------------------------------------------
   PODBOR_PICTS_DEFS — injected once into <body> on load,
   содержит линейные градиенты, на которые ссылаются пиктограммы.
   PODBOR_PICTS — словарь key → SVG-строка.
   ============================================================ */

const PODBOR_PICTS_DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <linearGradient id="g-cold" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#F5EDDC"/>
    </linearGradient>
    <linearGradient id="g-freeze" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#F0E3C8"/>
      <stop offset="1" stop-color="#D8C9A8"/>
    </linearGradient>
    <linearGradient id="g-twoch" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.48" stop-color="#FBF7F0"/>
      <stop offset="0.52" stop-color="#F0E3C8"/>
      <stop offset="1" stop-color="#D8C9A8"/>
    </linearGradient>
    <linearGradient id="g-sbs" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#D8C9A8"/>
      <stop offset="0.48" stop-color="#F0E3C8"/>
      <stop offset="0.52" stop-color="#FBF7F0"/>
      <stop offset="1" stop-color="#FFFFFF"/>
    </linearGradient>
    <linearGradient id="g-sheen" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.5"/>
      <stop offset="0.3" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
  </defs>
</svg>
`;

/* Инжектим defs один раз */
(function injectPodborDefs() {
  if (typeof document === "undefined") return;
  function inject() {
    if (document.getElementById("podbor-picts-defs")) return;
    const wrap = document.createElement("div");
    wrap.id = "podbor-picts-defs";
    wrap.innerHTML = PODBOR_PICTS_DEFS;
    document.body.appendChild(wrap);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject, { once: true });
  } else {
    inject();
  }
})();

const PODBOR_PICTS = {
  /* ===== Холодильник · тип установки ===== */

  fridge_install_builtin: `
    <svg viewBox="0 0 96 128">
      <rect x="4" y="2" width="88" height="124" rx="4" fill="none" stroke="#6B4A2B" stroke-width="1.1" stroke-dasharray="3 3" opacity="0.45"/>
      <rect x="18" y="12" width="68" height="112" rx="4" fill="#6B4A2B" opacity="0.1"/>
      <rect x="14" y="8" width="68" height="112" rx="4" fill="url(#g-twoch)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="8" width="68" height="112" rx="4" fill="url(#g-sheen)"/>
      <line x1="14" y1="62" x2="82" y2="62" stroke="#6B4A2B" stroke-width="1.4"/>
      <rect x="76" y="16" width="3" height="38" rx="1.5" fill="#6B4A2B"/>
      <rect x="76" y="68" width="3" height="44" rx="1.5" fill="#6B4A2B"/>
    </svg>
  `,

  fridge_install_freestanding: `
    <svg viewBox="0 0 96 128">
      <rect x="18" y="12" width="68" height="108" rx="6" fill="#6B4A2B" opacity="0.1"/>
      <rect x="14" y="8" width="68" height="108" rx="6" fill="url(#g-twoch)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="8" width="68" height="108" rx="6" fill="url(#g-sheen)"/>
      <line x1="14" y1="60" x2="82" y2="60" stroke="#6B4A2B" stroke-width="1.4"/>
      <rect x="76" y="16" width="3" height="36" rx="1.5" fill="#6B4A2B"/>
      <rect x="76" y="66" width="3" height="42" rx="1.5" fill="#6B4A2B"/>
      <rect x="22" y="116" width="6" height="6" rx="1" fill="#6B4A2B"/>
      <rect x="68" y="116" width="6" height="6" rx="1" fill="#6B4A2B"/>
      <line x1="6" y1="124" x2="90" y2="124" stroke="#6B4A2B" stroke-width="0.8" opacity="0.35"/>
    </svg>
  `,

  /* ===== Холодильник · встроенный · тип камеры ===== */

  fridge_bi_single: `
    <svg viewBox="0 0 96 128">
      <rect x="4" y="2" width="88" height="124" rx="4" fill="none" stroke="#6B4A2B" stroke-width="1.1" stroke-dasharray="3 3" opacity="0.45"/>
      <rect x="18" y="12" width="68" height="112" rx="4" fill="#6B4A2B" opacity="0.1"/>
      <rect x="14" y="8" width="68" height="112" rx="4" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="8" width="68" height="112" rx="4" fill="url(#g-sheen)"/>
      <line x1="22" y1="30" x2="74" y2="30" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"/>
      <line x1="22" y1="50" x2="74" y2="50" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"/>
      <line x1="22" y1="70" x2="74" y2="70" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"/>
      <line x1="22" y1="90" x2="74" y2="90" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"/>
      <line x1="22" y1="110" x2="74" y2="110" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"/>
      <rect x="76" y="16" width="3" height="96" rx="1.5" fill="#6B4A2B"/>
    </svg>
  `,

  fridge_bi_two: `
    <svg viewBox="0 0 96 128">
      <rect x="4" y="2" width="88" height="124" rx="4" fill="none" stroke="#6B4A2B" stroke-width="1.1" stroke-dasharray="3 3" opacity="0.45"/>
      <rect x="18" y="12" width="68" height="112" rx="4" fill="#6B4A2B" opacity="0.1"/>
      <rect x="14" y="8" width="68" height="112" rx="4" fill="url(#g-twoch)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="8" width="68" height="112" rx="4" fill="url(#g-sheen)"/>
      <line x1="14" y1="64" x2="82" y2="64" stroke="#6B4A2B" stroke-width="1.4"/>
      <line x1="22" y1="22" x2="74" y2="22" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"/>
      <line x1="22" y1="38" x2="74" y2="38" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"/>
      <line x1="22" y1="54" x2="74" y2="54" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"/>
      <rect x="20" y="72" width="56" height="11" rx="1.5" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.1"/>
      <rect x="20" y="87" width="56" height="11" rx="1.5" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.1"/>
      <rect x="20" y="102" width="56" height="11" rx="1.5" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.1"/>
      <text x="76" y="78" font-family="JetBrains Mono" font-size="7" fill="#6B4A2B" stroke="none" text-anchor="middle">❄</text>
      <rect x="78" y="14" width="2.5" height="40" rx="1" fill="#6B4A2B"/>
      <rect x="78" y="70" width="2.5" height="46" rx="1" fill="#6B4A2B"/>
    </svg>
  `,

  fridge_bi_colcold: `
    <svg viewBox="0 0 96 128">
      <rect x="20" y="2" width="56" height="124" rx="4" fill="none" stroke="#6B4A2B" stroke-width="1.1" stroke-dasharray="3 3" opacity="0.45"/>
      <rect x="32" y="12" width="40" height="112" rx="4" fill="#6B4A2B" opacity="0.1"/>
      <rect x="28" y="8" width="40" height="112" rx="4" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="28" y="8" width="40" height="112" rx="4" fill="url(#g-sheen)"/>
      <line x1="34" y1="22" x2="62" y2="22" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.5"/>
      <line x1="34" y1="38" x2="62" y2="38" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.5"/>
      <line x1="34" y1="54" x2="62" y2="54" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.5"/>
      <line x1="34" y1="70" x2="62" y2="70" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.5"/>
      <line x1="34" y1="86" x2="62" y2="86" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.5"/>
      <line x1="34" y1="102" x2="62" y2="102" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.5"/>
      <rect x="62.5" y="16" width="2.5" height="96" rx="1" fill="#6B4A2B"/>
    </svg>
  `,

  fridge_bi_colfreeze: `
    <svg viewBox="0 0 96 128">
      <rect x="20" y="2" width="56" height="124" rx="4" fill="none" stroke="#6B4A2B" stroke-width="1.1" stroke-dasharray="3 3" opacity="0.45"/>
      <rect x="32" y="12" width="40" height="112" rx="4" fill="#6B4A2B" opacity="0.1"/>
      <rect x="28" y="8" width="40" height="112" rx="4" fill="url(#g-freeze)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="28" y="8" width="40" height="112" rx="4" fill="url(#g-sheen)"/>
      <text x="48" y="24" font-family="JetBrains Mono" font-size="9" fill="#6B4A2B" stroke="none" text-anchor="middle">❄</text>
      <rect x="34" y="30" width="28" height="12" rx="1.5" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.1"/>
      <rect x="34" y="46" width="28" height="12" rx="1.5" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.1"/>
      <rect x="34" y="62" width="28" height="12" rx="1.5" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.1"/>
      <rect x="34" y="78" width="28" height="12" rx="1.5" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.1"/>
      <rect x="34" y="94" width="28" height="12" rx="1.5" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.1"/>
      <rect x="62.5" y="28" width="2.5" height="84" rx="1" fill="#6B4A2B"/>
    </svg>
  `,

  fridge_bi_colpair: `
    <svg viewBox="0 0 96 128">
      <rect x="2" y="2" width="92" height="124" rx="4" fill="none" stroke="#6B4A2B" stroke-width="1.1" stroke-dasharray="3 3" opacity="0.45"/>
      <rect x="10" y="12" width="36" height="112" rx="3" fill="#6B4A2B" opacity="0.1"/>
      <rect x="50" y="12" width="36" height="112" rx="3" fill="#6B4A2B" opacity="0.1"/>
      <rect x="6" y="8" width="36" height="112" rx="3" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.4"/>
      <rect x="6" y="8" width="36" height="112" rx="3" fill="url(#g-sheen)"/>
      <line x1="10" y1="20" x2="38" y2="20" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <line x1="10" y1="36" x2="38" y2="36" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <line x1="10" y1="52" x2="38" y2="52" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <line x1="10" y1="68" x2="38" y2="68" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <line x1="10" y1="84" x2="38" y2="84" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <line x1="10" y1="100" x2="38" y2="100" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <rect x="36.5" y="14" width="2" height="100" rx="0.8" fill="#6B4A2B"/>
      <rect x="46" y="8" width="36" height="112" rx="3" fill="url(#g-freeze)" stroke="#6B4A2B" stroke-width="1.4"/>
      <rect x="46" y="8" width="36" height="112" rx="3" fill="url(#g-sheen)"/>
      <text x="64" y="20" font-family="JetBrains Mono" font-size="7" fill="#6B4A2B" stroke="none" text-anchor="middle">❄</text>
      <rect x="51" y="26" width="26" height="10" rx="1" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1"/>
      <rect x="51" y="40" width="26" height="10" rx="1" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1"/>
      <rect x="51" y="54" width="26" height="10" rx="1" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1"/>
      <rect x="51" y="68" width="26" height="10" rx="1" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1"/>
      <rect x="51" y="82" width="26" height="10" rx="1" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1"/>
      <rect x="51" y="96" width="26" height="10" rx="1" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1"/>
      <rect x="45.5" y="14" width="2" height="100" rx="0.8" fill="#6B4A2B"/>
    </svg>
  `,

  /* ===== Холодильник · отдельностоящий · тип камеры ===== */

  fridge_fs_single: `
    <svg viewBox="0 0 96 128">
      <rect x="18" y="12" width="68" height="108" rx="6" fill="#6B4A2B" opacity="0.1"/>
      <rect x="14" y="8" width="68" height="108" rx="6" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="8" width="68" height="108" rx="6" fill="url(#g-sheen)"/>
      <line x1="22" y1="30" x2="74" y2="30" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"/>
      <line x1="22" y1="50" x2="74" y2="50" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"/>
      <line x1="22" y1="70" x2="74" y2="70" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"/>
      <line x1="22" y1="90" x2="74" y2="90" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"/>
      <rect x="76" y="16" width="3" height="92" rx="1.5" fill="#6B4A2B"/>
      <rect x="22" y="116" width="6" height="6" rx="1" fill="#6B4A2B"/>
      <rect x="68" y="116" width="6" height="6" rx="1" fill="#6B4A2B"/>
      <line x1="6" y1="124" x2="90" y2="124" stroke="#6B4A2B" stroke-width="0.8" opacity="0.35"/>
    </svg>
  `,

  fridge_fs_two: `
    <svg viewBox="0 0 96 128">
      <rect x="18" y="12" width="68" height="108" rx="6" fill="#6B4A2B" opacity="0.1"/>
      <rect x="14" y="8" width="68" height="108" rx="6" fill="url(#g-twoch)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="8" width="68" height="108" rx="6" fill="url(#g-sheen)"/>
      <line x1="14" y1="62" x2="82" y2="62" stroke="#6B4A2B" stroke-width="1.4"/>
      <line x1="22" y1="22" x2="74" y2="22" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"/>
      <line x1="22" y1="38" x2="74" y2="38" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"/>
      <line x1="22" y1="54" x2="74" y2="54" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 3" opacity="0.45"/>
      <rect x="20" y="70" width="56" height="12" rx="1.5" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.1"/>
      <rect x="20" y="86" width="56" height="12" rx="1.5" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.1"/>
      <rect x="20" y="102" width="56" height="11" rx="1.5" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.1"/>
      <text x="76" y="78" font-family="JetBrains Mono" font-size="7" fill="#6B4A2B" stroke="none" text-anchor="middle">❄</text>
      <rect x="78" y="14" width="2.5" height="40" rx="1" fill="#6B4A2B"/>
      <rect x="78" y="68" width="2.5" height="42" rx="1" fill="#6B4A2B"/>
      <rect x="22" y="116" width="6" height="6" rx="1" fill="#6B4A2B"/>
      <rect x="68" y="116" width="6" height="6" rx="1" fill="#6B4A2B"/>
      <line x1="6" y1="124" x2="90" y2="124" stroke="#6B4A2B" stroke-width="0.8" opacity="0.35"/>
    </svg>
  `,

  fridge_fs_sbs: `
    <svg viewBox="0 0 96 128">
      <rect x="14" y="12" width="76" height="108" rx="6" fill="#6B4A2B" opacity="0.1"/>
      <rect x="10" y="8" width="76" height="108" rx="6" fill="url(#g-sbs)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="10" y="8" width="76" height="108" rx="6" fill="url(#g-sheen)"/>
      <line x1="48" y1="8" x2="48" y2="116" stroke="#6B4A2B" stroke-width="1.4"/>
      <text x="29" y="22" font-family="JetBrains Mono" font-size="7" fill="#6B4A2B" stroke="none" text-anchor="middle">❄</text>
      <rect x="16" y="28" width="28" height="11" rx="1" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1"/>
      <rect x="16" y="42" width="28" height="11" rx="1" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1"/>
      <rect x="16" y="56" width="28" height="11" rx="1" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1"/>
      <rect x="16" y="70" width="28" height="11" rx="1" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1"/>
      <rect x="16" y="84" width="28" height="11" rx="1" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1"/>
      <rect x="16" y="98" width="28" height="10" rx="1" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1"/>
      <line x1="52" y1="22" x2="82" y2="22" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <line x1="52" y1="38" x2="82" y2="38" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <line x1="52" y1="54" x2="82" y2="54" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <line x1="52" y1="70" x2="82" y2="70" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <line x1="52" y1="86" x2="82" y2="86" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <line x1="52" y1="102" x2="82" y2="102" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <rect x="42" y="16" width="2.5" height="92" rx="1" fill="#6B4A2B"/>
      <rect x="51.5" y="16" width="2.5" height="92" rx="1" fill="#6B4A2B"/>
      <rect x="18" y="116" width="6" height="6" rx="1" fill="#6B4A2B"/>
      <rect x="72" y="116" width="6" height="6" rx="1" fill="#6B4A2B"/>
      <line x1="6" y1="124" x2="90" y2="124" stroke="#6B4A2B" stroke-width="0.8" opacity="0.35"/>
    </svg>
  `,

  fridge_fs_french: `
    <svg viewBox="0 0 96 128">
      <rect x="14" y="12" width="76" height="108" rx="6" fill="#6B4A2B" opacity="0.1"/>
      <rect x="10" y="8" width="76" height="108" rx="6" fill="url(#g-twoch)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="10" y="8" width="76" height="108" rx="6" fill="url(#g-sheen)"/>
      <line x1="10" y1="68" x2="86" y2="68" stroke="#6B4A2B" stroke-width="1.4"/>
      <line x1="48" y1="8" x2="48" y2="68" stroke="#6B4A2B" stroke-width="1.4"/>
      <line x1="16" y1="24" x2="42" y2="24" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <line x1="54" y1="24" x2="80" y2="24" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <line x1="16" y1="40" x2="42" y2="40" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <line x1="54" y1="40" x2="80" y2="40" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <line x1="16" y1="56" x2="42" y2="56" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <line x1="54" y1="56" x2="80" y2="56" stroke="#6B4A2B" stroke-width="0.9" stroke-dasharray="2 2" opacity="0.5"/>
      <rect x="42" y="16" width="2.5" height="44" rx="1" fill="#6B4A2B"/>
      <rect x="51.5" y="16" width="2.5" height="44" rx="1" fill="#6B4A2B"/>
      <rect x="16" y="76" width="64" height="32" rx="1.5" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.1"/>
      <text x="48" y="96" font-family="JetBrains Mono" font-size="9" fill="#6B4A2B" stroke="none" text-anchor="middle">❄</text>
      <rect x="18" y="116" width="6" height="6" rx="1" fill="#6B4A2B"/>
      <rect x="72" y="116" width="6" height="6" rx="1" fill="#6B4A2B"/>
      <line x1="6" y1="124" x2="90" y2="124" stroke="#6B4A2B" stroke-width="0.8" opacity="0.35"/>
    </svg>
  `,

  fridge_fs_freezer: `
    <svg viewBox="0 0 96 128">
      <rect x="18" y="12" width="68" height="108" rx="6" fill="#6B4A2B" opacity="0.1"/>
      <rect x="14" y="8" width="68" height="108" rx="6" fill="url(#g-freeze)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="8" width="68" height="108" rx="6" fill="url(#g-sheen)"/>
      <text x="48" y="24" font-family="JetBrains Mono" font-size="11" fill="#6B4A2B" stroke="none" text-anchor="middle">❄</text>
      <rect x="20" y="32" width="56" height="14" rx="1.5" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.1"/>
      <rect x="20" y="50" width="56" height="14" rx="1.5" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.1"/>
      <rect x="20" y="68" width="56" height="14" rx="1.5" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.1"/>
      <rect x="20" y="86" width="56" height="14" rx="1.5" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.1"/>
      <rect x="20" y="104" width="56" height="8" rx="1.5" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.1"/>
      <rect x="22" y="116" width="6" height="6" rx="1" fill="#6B4A2B"/>
      <rect x="68" y="116" width="6" height="6" rx="1" fill="#6B4A2B"/>
      <line x1="6" y1="124" x2="90" y2="124" stroke="#6B4A2B" stroke-width="0.8" opacity="0.35"/>
    </svg>
  `,
};
