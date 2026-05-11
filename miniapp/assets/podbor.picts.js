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

  /* ===== Варочная панель · источник нагрева (top-down вид) ===== */

  hob_src_elec: `
    <svg viewBox="0 0 96 128">
      <rect x="14" y="34" width="68" height="74" rx="3" fill="#6B4A2B" opacity="0.1"/>
      <rect x="10" y="30" width="68" height="74" rx="3" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="10" y="30" width="68" height="74" rx="3" fill="url(#g-sheen)"/>
      <!-- 4 индукционные зоны (концентрические круги) -->
      <circle cx="26" cy="48" r="9" fill="none" stroke="#6B4A2B" stroke-width="1.4"/>
      <circle cx="26" cy="48" r="6" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.5"/>
      <circle cx="62" cy="48" r="9" fill="none" stroke="#6B4A2B" stroke-width="1.4"/>
      <circle cx="62" cy="48" r="6" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.5"/>
      <circle cx="26" cy="80" r="9" fill="none" stroke="#6B4A2B" stroke-width="1.4"/>
      <circle cx="26" cy="80" r="6" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.5"/>
      <circle cx="62" cy="80" r="9" fill="none" stroke="#6B4A2B" stroke-width="1.4"/>
      <circle cx="62" cy="80" r="6" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.5"/>
      <!-- Сенсорная панель управления внизу -->
      <line x1="18" y1="98" x2="72" y2="98" stroke="#6B4A2B" stroke-width="0.8" opacity="0.4"/>
      <circle cx="24" cy="100" r="1.2" fill="#6B4A2B"/>
      <circle cx="32" cy="100" r="1.2" fill="#6B4A2B"/>
      <circle cx="44" cy="100" r="1.2" fill="#6B4A2B"/>
      <circle cx="56" cy="100" r="1.2" fill="#6B4A2B"/>
      <circle cx="64" cy="100" r="1.2" fill="#6B4A2B"/>
    </svg>
  `,

  hob_src_gas: `
    <svg viewBox="0 0 96 128">
      <rect x="14" y="34" width="68" height="74" rx="3" fill="#6B4A2B" opacity="0.1"/>
      <rect x="10" y="30" width="68" height="74" rx="3" fill="#F5EDDC" stroke="#6B4A2B" stroke-width="1.6"/>
      <!-- 4 газовые конфорки с решёткой (крестики) -->
      <g stroke="#6B4A2B" stroke-width="1.4" fill="#FBF7F0">
        <circle cx="26" cy="48" r="9"/>
        <circle cx="62" cy="48" r="9"/>
        <circle cx="26" cy="80" r="9"/>
        <circle cx="62" cy="80" r="9"/>
      </g>
      <g stroke="#6B4A2B" stroke-width="1" stroke-linecap="round">
        <!-- решётки крест-накрест -->
        <line x1="20" y1="48" x2="32" y2="48"/>
        <line x1="26" y1="42" x2="26" y2="54"/>
        <line x1="56" y1="48" x2="68" y2="48"/>
        <line x1="62" y1="42" x2="62" y2="54"/>
        <line x1="20" y1="80" x2="32" y2="80"/>
        <line x1="26" y1="74" x2="26" y2="86"/>
        <line x1="56" y1="80" x2="68" y2="80"/>
        <line x1="62" y1="74" x2="62" y2="86"/>
      </g>
      <!-- Центральная горелка маркером -->
      <circle cx="26" cy="48" r="2" fill="#6B4A2B"/>
      <circle cx="62" cy="48" r="2" fill="#6B4A2B"/>
      <circle cx="26" cy="80" r="2" fill="#6B4A2B"/>
      <circle cx="62" cy="80" r="2" fill="#6B4A2B"/>
      <!-- Ручки регулировки -->
      <circle cx="22" cy="98" r="2.5" fill="none" stroke="#6B4A2B" stroke-width="1.2"/>
      <circle cx="36" cy="98" r="2.5" fill="none" stroke="#6B4A2B" stroke-width="1.2"/>
      <circle cx="52" cy="98" r="2.5" fill="none" stroke="#6B4A2B" stroke-width="1.2"/>
      <circle cx="66" cy="98" r="2.5" fill="none" stroke="#6B4A2B" stroke-width="1.2"/>
    </svg>
  `,

  hob_src_combi: `
    <svg viewBox="0 0 96 128">
      <rect x="14" y="34" width="68" height="74" rx="3" fill="#6B4A2B" opacity="0.1"/>
      <!-- Левая половина: газ (тёплый фон) -->
      <rect x="10" y="30" width="34" height="74" rx="3" fill="#F5EDDC" stroke="#6B4A2B" stroke-width="1.6"/>
      <!-- Правая половина: электро (светлый фон) -->
      <rect x="44" y="30" width="34" height="74" rx="3" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="44" y="30" width="34" height="74" rx="3" fill="url(#g-sheen)"/>
      <!-- Газовые конфорки слева (с крестиками) -->
      <g stroke="#6B4A2B" stroke-width="1.4" fill="#FBF7F0">
        <circle cx="26" cy="48" r="8"/>
        <circle cx="26" cy="80" r="8"/>
      </g>
      <line x1="20" y1="48" x2="32" y2="48" stroke="#6B4A2B" stroke-width="0.9"/>
      <line x1="26" y1="42" x2="26" y2="54" stroke="#6B4A2B" stroke-width="0.9"/>
      <line x1="20" y1="80" x2="32" y2="80" stroke="#6B4A2B" stroke-width="0.9"/>
      <line x1="26" y1="74" x2="26" y2="86" stroke="#6B4A2B" stroke-width="0.9"/>
      <circle cx="26" cy="48" r="1.5" fill="#6B4A2B"/>
      <circle cx="26" cy="80" r="1.5" fill="#6B4A2B"/>
      <!-- Индукционные зоны справа (концентрические) -->
      <circle cx="62" cy="48" r="8" fill="none" stroke="#6B4A2B" stroke-width="1.4"/>
      <circle cx="62" cy="48" r="5" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.5"/>
      <circle cx="62" cy="80" r="8" fill="none" stroke="#6B4A2B" stroke-width="1.4"/>
      <circle cx="62" cy="80" r="5" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.5"/>
      <!-- Маркер «два мира» — разделительная линия -->
      <line x1="44" y1="30" x2="44" y2="104" stroke="#6B4A2B" stroke-width="0.8" stroke-dasharray="2 2" opacity="0.55"/>
    </svg>
  `,

  /* ===== Духовка · тип установки ===== */

  oven_install_builtin: `
    <svg viewBox="0 0 96 128">
      <rect x="4" y="2" width="88" height="124" rx="4" fill="none" stroke="#6B4A2B" stroke-width="1.1" stroke-dasharray="3 3" opacity="0.45"/>
      <rect x="18" y="12" width="68" height="112" rx="4" fill="#6B4A2B" opacity="0.1"/>
      <rect x="14" y="8" width="68" height="112" rx="4" fill="url(#g-twoch)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="8" width="68" height="112" rx="4" fill="url(#g-sheen)"/>
      <!-- Панель управления сверху -->
      <rect x="14" y="8" width="68" height="20" rx="4" fill="#6B4A2B" opacity="0.06"/>
      <line x1="14" y1="28" x2="82" y2="28" stroke="#6B4A2B" stroke-width="1.3"/>
      <!-- 4 ручки -->
      <circle cx="22" cy="18" r="2.5" fill="none" stroke="#6B4A2B" stroke-width="1.1"/>
      <circle cx="34" cy="18" r="2.5" fill="none" stroke="#6B4A2B" stroke-width="1.1"/>
      <circle cx="62" cy="18" r="2.5" fill="none" stroke="#6B4A2B" stroke-width="1.1"/>
      <circle cx="74" cy="18" r="2.5" fill="none" stroke="#6B4A2B" stroke-width="1.1"/>
      <!-- Дисплей -->
      <rect x="42" y="14" width="16" height="8" rx="1" fill="#1F1A14" opacity="0.7"/>
      <!-- Ручка дверцы -->
      <line x1="22" y1="36" x2="74" y2="36" stroke="#6B4A2B" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Стеклянное окошко -->
      <rect x="22" y="44" width="52" height="62" rx="2" fill="none" stroke="#6B4A2B" stroke-width="1.2"/>
      <rect x="24" y="46" width="48" height="58" rx="1" fill="url(#g-cold)" opacity="0.7"/>
      <!-- Внутренняя «решётка» -->
      <line x1="26" y1="62" x2="70" y2="62" stroke="#6B4A2B" stroke-width="0.8" stroke-dasharray="2 2" opacity="0.5"/>
      <line x1="26" y1="78" x2="70" y2="78" stroke="#6B4A2B" stroke-width="0.8" stroke-dasharray="2 2" opacity="0.5"/>
      <line x1="26" y1="94" x2="70" y2="94" stroke="#6B4A2B" stroke-width="0.8" stroke-dasharray="2 2" opacity="0.5"/>
      <!-- Нижняя кромка -->
      <line x1="14" y1="114" x2="82" y2="114" stroke="#6B4A2B" stroke-width="0.8" opacity="0.4"/>
    </svg>
  `,

  oven_install_stove: `
    <svg viewBox="0 0 96 128">
      <rect x="18" y="10" width="68" height="116" rx="4" fill="#6B4A2B" opacity="0.1"/>
      <!-- Корпус плиты (полный — варочная + духовка) -->
      <rect x="14" y="6" width="68" height="116" rx="4" fill="#F5EDDC" stroke="#6B4A2B" stroke-width="1.6"/>
      <!-- Верх — варочная панель -->
      <rect x="20" y="14" width="56" height="28" rx="2" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.2"/>
      <circle cx="32" cy="22" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9"/>
      <circle cx="32" cy="34" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9"/>
      <circle cx="64" cy="22" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9"/>
      <circle cx="64" cy="34" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9"/>
      <!-- Панель управления -->
      <rect x="14" y="44" width="68" height="14" rx="0" fill="#6B4A2B" opacity="0.08"/>
      <circle cx="22" cy="51" r="2" fill="none" stroke="#6B4A2B" stroke-width="1"/>
      <circle cx="34" cy="51" r="2" fill="none" stroke="#6B4A2B" stroke-width="1"/>
      <circle cx="62" cy="51" r="2" fill="none" stroke="#6B4A2B" stroke-width="1"/>
      <circle cx="74" cy="51" r="2" fill="none" stroke="#6B4A2B" stroke-width="1"/>
      <rect x="44" y="48" width="12" height="6" rx="0.5" fill="#1F1A14" opacity="0.7"/>
      <!-- Дверца духовки -->
      <line x1="22" y1="64" x2="74" y2="64" stroke="#6B4A2B" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="22" y="70" width="52" height="44" rx="2" fill="none" stroke="#6B4A2B" stroke-width="1.2"/>
      <rect x="24" y="72" width="48" height="40" rx="1" fill="url(#g-cold)" opacity="0.6"/>
      <!-- Ножки -->
      <rect x="22" y="118" width="5" height="6" rx="1" fill="#6B4A2B"/>
      <rect x="69" y="118" width="5" height="6" rx="1" fill="#6B4A2B"/>
    </svg>
  `,

  /* ===== ПММ · тип встройки ===== */

  dw_install_full: `
    <svg viewBox="0 0 96 128">
      <rect x="4" y="2" width="88" height="124" rx="4" fill="none" stroke="#6B4A2B" stroke-width="1.1" stroke-dasharray="3 3" opacity="0.45"/>
      <rect x="18" y="12" width="68" height="112" rx="4" fill="#6B4A2B" opacity="0.1"/>
      <!-- Фасад ЗОВ — полностью закрытый -->
      <rect x="14" y="8" width="68" height="112" rx="4" fill="url(#g-twoch)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="8" width="68" height="112" rx="4" fill="url(#g-sheen)"/>
      <!-- Ручка-планка по центру верха -->
      <rect x="30" y="14" width="36" height="3" rx="1.5" fill="#6B4A2B"/>
      <!-- Иконка «капля» в центре — что внутри ПММ -->
      <g transform="translate(48 64)" fill="none" stroke="#6B4A2B" stroke-width="1.4" opacity="0.4">
        <path d="M0 -12 C 6 -4, 6 2, 0 8 C -6 2, -6 -4, 0 -12 Z"/>
        <circle cx="0" cy="2" r="2" fill="#6B4A2B" stroke="none"/>
      </g>
      <!-- Текст «60 см» — стандарт -->
      <text x="48" y="100" text-anchor="middle" font-family="JetBrains Mono" font-size="8" fill="#6B4A2B" stroke="none" opacity="0.5">60 cm</text>
    </svg>
  `,

  dw_install_partial: `
    <svg viewBox="0 0 96 128">
      <rect x="4" y="2" width="88" height="124" rx="4" fill="none" stroke="#6B4A2B" stroke-width="1.1" stroke-dasharray="3 3" opacity="0.45"/>
      <rect x="18" y="12" width="68" height="112" rx="4" fill="#6B4A2B" opacity="0.1"/>
      <rect x="14" y="8" width="68" height="112" rx="4" fill="url(#g-twoch)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="8" width="68" height="112" rx="4" fill="url(#g-sheen)"/>
      <!-- Видимая панель управления вверху -->
      <rect x="14" y="8" width="68" height="18" rx="4" fill="#1F1A14" opacity="0.85"/>
      <circle cx="22" cy="17" r="1.6" fill="#FBF7F0"/>
      <circle cx="30" cy="17" r="1.6" fill="#FBF7F0"/>
      <rect x="40" y="13" width="20" height="8" rx="1" fill="#FBF7F0" opacity="0.4"/>
      <circle cx="66" cy="17" r="1.6" fill="#FBF7F0"/>
      <circle cx="74" cy="17" r="1.6" fill="#FBF7F0"/>
      <!-- Ручка-планка ниже панели -->
      <rect x="30" y="32" width="36" height="3" rx="1.5" fill="#6B4A2B"/>
      <!-- Фасад ниже -->
      <g transform="translate(48 78)" fill="none" stroke="#6B4A2B" stroke-width="1.4" opacity="0.4">
        <path d="M0 -12 C 6 -4, 6 2, 0 8 C -6 2, -6 -4, 0 -12 Z"/>
      </g>
    </svg>
  `,

  dw_install_freestanding: `
    <svg viewBox="0 0 96 128">
      <rect x="18" y="12" width="68" height="108" rx="6" fill="#6B4A2B" opacity="0.1"/>
      <rect x="14" y="8" width="68" height="108" rx="6" fill="url(#g-twoch)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="8" width="68" height="108" rx="6" fill="url(#g-sheen)"/>
      <!-- Полный фронт с панелью + дверцей -->
      <rect x="14" y="8" width="68" height="18" rx="6" fill="#1F1A14" opacity="0.85"/>
      <circle cx="22" cy="17" r="1.6" fill="#FBF7F0"/>
      <circle cx="30" cy="17" r="1.6" fill="#FBF7F0"/>
      <rect x="40" y="13" width="20" height="8" rx="1" fill="#FBF7F0" opacity="0.4"/>
      <circle cx="66" cy="17" r="1.6" fill="#FBF7F0"/>
      <circle cx="74" cy="17" r="1.6" fill="#FBF7F0"/>
      <!-- Ручка -->
      <rect x="30" y="30" width="36" height="3" rx="1.5" fill="#6B4A2B"/>
      <!-- Логотип-знак ПММ внутри -->
      <g transform="translate(48 70)" fill="none" stroke="#6B4A2B" stroke-width="1.4" opacity="0.4">
        <path d="M0 -10 C 5 -3, 5 1, 0 7 C -5 1, -5 -3, 0 -10 Z"/>
        <circle cx="0" cy="2" r="1.6" fill="#6B4A2B" stroke="none"/>
      </g>
      <!-- Ножки -->
      <rect x="22" y="116" width="5" height="6" rx="1" fill="#6B4A2B"/>
      <rect x="69" y="116" width="5" height="6" rx="1" fill="#6B4A2B"/>
      <line x1="6" y1="124" x2="90" y2="124" stroke="#6B4A2B" stroke-width="0.8" opacity="0.35"/>
    </svg>
  `,

  /* ===== Вытяжка · 7 форм-факторов ===== */

  hood_form_drawer: `
    <svg viewBox="0 0 96 128">
      <!-- Верхний шкаф (где скрыта вытяжка) -->
      <rect x="14" y="8" width="68" height="50" rx="3" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="8" width="68" height="50" rx="3" fill="url(#g-sheen)"/>
      <!-- Выдвинутая панель внизу шкафа -->
      <rect x="10" y="58" width="76" height="14" rx="1.5" fill="#F5EDDC" stroke="#6B4A2B" stroke-width="1.6"/>
      <line x1="34" y1="66" x2="62" y2="66" stroke="#6B4A2B" stroke-width="1" opacity="0.6"/>
      <!-- Стрелки выдвижения -->
      <path d="M 18 64 L 14 66 L 18 68" fill="none" stroke="#6B4A2B" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
      <path d="M 78 64 L 82 66 L 78 68" fill="none" stroke="#6B4A2B" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
      <!-- Варочная панель снизу как context -->
      <rect x="14" y="84" width="68" height="28" rx="3" fill="url(#g-twoch)" stroke="#6B4A2B" stroke-width="1.4" opacity="0.6"/>
      <circle cx="28" cy="98" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.6"/>
      <circle cx="48" cy="98" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.6"/>
      <circle cx="68" cy="98" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.6"/>
      <!-- Воздушный поток -->
      <line x1="30" y1="78" x2="30" y2="82" stroke="#6B4A2B" stroke-width="0.8" stroke-dasharray="1 2" opacity="0.4"/>
      <line x1="48" y1="78" x2="48" y2="82" stroke="#6B4A2B" stroke-width="0.8" stroke-dasharray="1 2" opacity="0.4"/>
      <line x1="66" y1="78" x2="66" y2="82" stroke="#6B4A2B" stroke-width="0.8" stroke-dasharray="1 2" opacity="0.4"/>
    </svg>
  `,

  hood_form_hidden: `
    <svg viewBox="0 0 96 128">
      <!-- Шкаф без панели — полностью скрытая -->
      <rect x="14" y="8" width="68" height="64" rx="3" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="8" width="68" height="64" rx="3" fill="url(#g-sheen)"/>
      <!-- Тонкая горизонтальная щель снизу шкафа -->
      <line x1="20" y1="68" x2="76" y2="68" stroke="#6B4A2B" stroke-width="0.8" stroke-dasharray="2 3" opacity="0.6"/>
      <text x="48" y="42" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="#6B4A2B" stroke="none" opacity="0.6">скрыта</text>
      <!-- Варочная панель -->
      <rect x="14" y="84" width="68" height="28" rx="3" fill="url(#g-twoch)" stroke="#6B4A2B" stroke-width="1.4" opacity="0.6"/>
      <circle cx="28" cy="98" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.6"/>
      <circle cx="48" cy="98" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.6"/>
      <circle cx="68" cy="98" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.6"/>
    </svg>
  `,

  hood_form_dome: `
    <svg viewBox="0 0 96 128">
      <!-- Купол — расширяется вниз -->
      <path d="M 30 8 L 66 8 L 76 50 L 20 50 Z" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <path d="M 30 8 L 66 8 L 76 50 L 20 50 Z" fill="url(#g-sheen)"/>
      <!-- Воздуховод сверху -->
      <rect x="38" y="0" width="20" height="10" rx="0" fill="#F5EDDC" stroke="#6B4A2B" stroke-width="1.4"/>
      <!-- Сетка фильтра -->
      <line x1="24" y1="46" x2="72" y2="46" stroke="#6B4A2B" stroke-width="1.2"/>
      <line x1="32" y1="40" x2="32" y2="50" stroke="#6B4A2B" stroke-width="0.7" opacity="0.5"/>
      <line x1="48" y1="36" x2="48" y2="50" stroke="#6B4A2B" stroke-width="0.7" opacity="0.5"/>
      <line x1="64" y1="40" x2="64" y2="50" stroke="#6B4A2B" stroke-width="0.7" opacity="0.5"/>
      <!-- Подсветка -->
      <circle cx="32" cy="52" r="1.5" fill="#6B4A2B"/>
      <circle cx="64" cy="52" r="1.5" fill="#6B4A2B"/>
      <!-- Варочная панель -->
      <rect x="14" y="84" width="68" height="28" rx="3" fill="url(#g-twoch)" stroke="#6B4A2B" stroke-width="1.4" opacity="0.6"/>
      <circle cx="28" cy="98" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.6"/>
      <circle cx="48" cy="98" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.6"/>
      <circle cx="68" cy="98" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.6"/>
    </svg>
  `,

  hood_form_inclined: `
    <svg viewBox="0 0 96 128">
      <!-- Наклонная панель — параллелограмм -->
      <path d="M 20 8 L 76 8 L 80 56 L 16 56 Z" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <path d="M 20 8 L 76 8 L 80 56 L 16 56 Z" fill="url(#g-sheen)"/>
      <!-- Воздуховод -->
      <rect x="40" y="0" width="16" height="10" rx="0" fill="#F5EDDC" stroke="#6B4A2B" stroke-width="1.4"/>
      <!-- Стекло-фронт под углом -->
      <line x1="20" y1="14" x2="76" y2="14" stroke="#6B4A2B" stroke-width="1" opacity="0.5"/>
      <!-- Подсветка снизу -->
      <line x1="22" y1="54" x2="38" y2="54" stroke="#FBF7F0" stroke-width="2"/>
      <line x1="58" y1="54" x2="74" y2="54" stroke="#FBF7F0" stroke-width="2"/>
      <line x1="22" y1="55" x2="38" y2="55" stroke="#6B4A2B" stroke-width="0.5" opacity="0.6"/>
      <line x1="58" y1="55" x2="74" y2="55" stroke="#6B4A2B" stroke-width="0.5" opacity="0.6"/>
      <!-- Угловые grid -->
      <line x1="40" y1="20" x2="42" y2="50" stroke="#6B4A2B" stroke-width="0.6" opacity="0.4"/>
      <line x1="56" y1="20" x2="58" y2="50" stroke="#6B4A2B" stroke-width="0.6" opacity="0.4"/>
      <!-- Варочная панель -->
      <rect x="14" y="84" width="68" height="28" rx="3" fill="url(#g-twoch)" stroke="#6B4A2B" stroke-width="1.4" opacity="0.6"/>
      <circle cx="28" cy="98" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.6"/>
      <circle cx="48" cy="98" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.6"/>
      <circle cx="68" cy="98" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.6"/>
    </svg>
  `,

  hood_form_island: `
    <svg viewBox="0 0 96 128">
      <!-- Потолочное крепление -->
      <line x1="0" y1="0" x2="96" y2="0" stroke="#6B4A2B" stroke-width="1.5" opacity="0.5"/>
      <!-- Воздуховоды от потолка -->
      <line x1="36" y1="0" x2="36" y2="22" stroke="#6B4A2B" stroke-width="2"/>
      <line x1="60" y1="0" x2="60" y2="22" stroke="#6B4A2B" stroke-width="2"/>
      <!-- Корпус вытяжки (островная — подвешена в воздухе) -->
      <rect x="22" y="22" width="52" height="36" rx="3" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="22" y="22" width="52" height="36" rx="3" fill="url(#g-sheen)"/>
      <!-- Сетка фильтра -->
      <line x1="26" y1="54" x2="70" y2="54" stroke="#6B4A2B" stroke-width="1.2"/>
      <line x1="36" y1="48" x2="36" y2="58" stroke="#6B4A2B" stroke-width="0.7" opacity="0.5"/>
      <line x1="48" y1="48" x2="48" y2="58" stroke="#6B4A2B" stroke-width="0.7" opacity="0.5"/>
      <line x1="60" y1="48" x2="60" y2="58" stroke="#6B4A2B" stroke-width="0.7" opacity="0.5"/>
      <!-- Подсветка -->
      <circle cx="32" cy="60" r="1.5" fill="#6B4A2B"/>
      <circle cx="64" cy="60" r="1.5" fill="#6B4A2B"/>
      <text x="48" y="40" text-anchor="middle" font-family="JetBrains Mono" font-size="6" fill="#6B4A2B" stroke="none" opacity="0.5">ISLAND</text>
      <!-- Остров (варочная) -->
      <rect x="14" y="86" width="68" height="26" rx="3" fill="url(#g-twoch)" stroke="#6B4A2B" stroke-width="1.4" opacity="0.6"/>
      <circle cx="28" cy="99" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.6"/>
      <circle cx="48" cy="99" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.6"/>
      <circle cx="68" cy="99" r="4" fill="none" stroke="#6B4A2B" stroke-width="0.9" opacity="0.6"/>
    </svg>
  `,

  hood_form_downdraft: `
    <svg viewBox="0 0 96 128">
      <!-- Варочная панель -->
      <rect x="10" y="60" width="76" height="34" rx="3" fill="url(#g-twoch)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="10" y="60" width="76" height="34" rx="3" fill="url(#g-sheen)"/>
      <!-- Конфорки слева -->
      <circle cx="22" cy="72" r="4" fill="none" stroke="#6B4A2B" stroke-width="1"/>
      <circle cx="22" cy="86" r="4" fill="none" stroke="#6B4A2B" stroke-width="1"/>
      <circle cx="36" cy="72" r="4" fill="none" stroke="#6B4A2B" stroke-width="1"/>
      <circle cx="36" cy="86" r="4" fill="none" stroke="#6B4A2B" stroke-width="1"/>
      <!-- Выдвижная панель downdraft (центр-справа) -->
      <rect x="48" y="42" width="34" height="22" rx="2" fill="#1F1A14" stroke="#6B4A2B" stroke-width="1.4" opacity="0.85"/>
      <!-- Решётка -->
      <line x1="52" y1="48" x2="78" y2="48" stroke="#FBF7F0" stroke-width="0.7" opacity="0.6"/>
      <line x1="52" y1="54" x2="78" y2="54" stroke="#FBF7F0" stroke-width="0.7" opacity="0.6"/>
      <line x1="52" y1="60" x2="78" y2="60" stroke="#FBF7F0" stroke-width="0.7" opacity="0.6"/>
      <!-- Стрелки потока — вниз -->
      <path d="M 56 32 L 56 40 M 53 37 L 56 40 L 59 37" fill="none" stroke="#6B4A2B" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M 65 32 L 65 40 M 62 37 L 65 40 L 68 37" fill="none" stroke="#6B4A2B" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M 74 32 L 74 40 M 71 37 L 74 40 L 77 37" fill="none" stroke="#6B4A2B" stroke-width="1.2" stroke-linecap="round"/>
      <!-- Подпись -->
      <text x="48" y="22" text-anchor="middle" font-family="JetBrains Mono" font-size="8" fill="#6B4A2B" stroke="none">из столешницы</text>
    </svg>
  `,

  hood_form_hob: `
    <svg viewBox="0 0 96 128">
      <text x="48" y="20" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="#6B4A2B" stroke="none" opacity="0.7">2-в-1</text>
      <!-- Объединённый блок — варочная с вытяжкой внутри -->
      <rect x="14" y="32" width="68" height="64" rx="3" fill="#6B4A2B" opacity="0.1"/>
      <rect x="10" y="28" width="68" height="64" rx="3" fill="url(#g-twoch)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="10" y="28" width="68" height="64" rx="3" fill="url(#g-sheen)"/>
      <!-- Конфорки по углам — 4 шт -->
      <circle cx="22" cy="44" r="6" fill="none" stroke="#6B4A2B" stroke-width="1.2"/>
      <circle cx="22" cy="44" r="3" fill="none" stroke="#6B4A2B" stroke-width="0.8" opacity="0.5"/>
      <circle cx="66" cy="44" r="6" fill="none" stroke="#6B4A2B" stroke-width="1.2"/>
      <circle cx="66" cy="44" r="3" fill="none" stroke="#6B4A2B" stroke-width="0.8" opacity="0.5"/>
      <circle cx="22" cy="76" r="6" fill="none" stroke="#6B4A2B" stroke-width="1.2"/>
      <circle cx="22" cy="76" r="3" fill="none" stroke="#6B4A2B" stroke-width="0.8" opacity="0.5"/>
      <circle cx="66" cy="76" r="6" fill="none" stroke="#6B4A2B" stroke-width="1.2"/>
      <circle cx="66" cy="76" r="3" fill="none" stroke="#6B4A2B" stroke-width="0.8" opacity="0.5"/>
      <!-- Центральная щель вытяжки -->
      <rect x="40" y="40" width="8" height="40" rx="2" fill="#1F1A14" opacity="0.85"/>
      <line x1="42" y1="46" x2="46" y2="46" stroke="#FBF7F0" stroke-width="0.6" opacity="0.7"/>
      <line x1="42" y1="52" x2="46" y2="52" stroke="#FBF7F0" stroke-width="0.6" opacity="0.7"/>
      <line x1="42" y1="58" x2="46" y2="58" stroke="#FBF7F0" stroke-width="0.6" opacity="0.7"/>
      <line x1="42" y1="64" x2="46" y2="64" stroke="#FBF7F0" stroke-width="0.6" opacity="0.7"/>
      <line x1="42" y1="70" x2="46" y2="70" stroke="#FBF7F0" stroke-width="0.6" opacity="0.7"/>
      <!-- Подпись Hood-in-hob -->
      <text x="48" y="108" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="#6B4A2B" stroke="none">Hood-in-Hob</text>
    </svg>
  `,

  /* ===== СВЧ · тип установки ===== */

  microwave_install_builtin: `
    <svg viewBox="0 0 96 128">
      <rect x="4" y="20" width="88" height="92" rx="4" fill="none" stroke="#6B4A2B" stroke-width="1.1" stroke-dasharray="3 3" opacity="0.45"/>
      <rect x="18" y="34" width="68" height="68" rx="4" fill="#6B4A2B" opacity="0.1"/>
      <rect x="14" y="30" width="68" height="68" rx="4" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="30" width="68" height="68" rx="4" fill="url(#g-sheen)"/>
      <!-- Дверца с окном (левая часть) -->
      <rect x="20" y="38" width="38" height="50" rx="2" fill="#1F1A14" opacity="0.75"/>
      <rect x="22" y="40" width="34" height="46" rx="1" fill="url(#g-cold)" opacity="0.6"/>
      <!-- Внутри: тарелка -->
      <circle cx="39" cy="63" r="14" fill="none" stroke="#6B4A2B" stroke-width="0.8" opacity="0.5"/>
      <circle cx="39" cy="63" r="2" fill="#6B4A2B" opacity="0.4"/>
      <!-- Панель управления (правая) -->
      <rect x="62" y="38" width="16" height="50" rx="1" fill="#1F1A14" opacity="0.85"/>
      <rect x="64" y="40" width="12" height="6" rx="0.5" fill="#FBF7F0" opacity="0.4"/>
      <circle cx="66" cy="52" r="1.5" fill="#FBF7F0"/>
      <circle cx="73" cy="52" r="1.5" fill="#FBF7F0"/>
      <circle cx="66" cy="60" r="1.5" fill="#FBF7F0"/>
      <circle cx="73" cy="60" r="1.5" fill="#FBF7F0"/>
      <circle cx="66" cy="68" r="1.5" fill="#FBF7F0"/>
      <circle cx="73" cy="68" r="1.5" fill="#FBF7F0"/>
      <rect x="64" y="78" width="12" height="6" rx="0.5" fill="#FBF7F0" opacity="0.6"/>
    </svg>
  `,

  microwave_install_freestanding: `
    <svg viewBox="0 0 96 128">
      <rect x="14" y="38" width="68" height="58" rx="4" fill="#6B4A2B" opacity="0.1"/>
      <rect x="10" y="34" width="68" height="58" rx="4" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="10" y="34" width="68" height="58" rx="4" fill="url(#g-sheen)"/>
      <!-- Дверца с окном (большая, левая часть) -->
      <rect x="16" y="40" width="40" height="46" rx="2" fill="#1F1A14" opacity="0.75"/>
      <rect x="18" y="42" width="36" height="42" rx="1" fill="url(#g-cold)" opacity="0.6"/>
      <!-- Тарелка -->
      <circle cx="36" cy="63" r="13" fill="none" stroke="#6B4A2B" stroke-width="0.8" opacity="0.5"/>
      <circle cx="36" cy="63" r="2" fill="#6B4A2B" opacity="0.4"/>
      <!-- Панель управления справа -->
      <rect x="58" y="40" width="18" height="46" rx="1" fill="#1F1A14" opacity="0.85"/>
      <rect x="60" y="42" width="14" height="7" rx="0.5" fill="#FBF7F0" opacity="0.4"/>
      <circle cx="62" cy="54" r="1.5" fill="#FBF7F0"/>
      <circle cx="69" cy="54" r="1.5" fill="#FBF7F0"/>
      <circle cx="62" cy="62" r="1.5" fill="#FBF7F0"/>
      <circle cx="69" cy="62" r="1.5" fill="#FBF7F0"/>
      <circle cx="62" cy="70" r="1.5" fill="#FBF7F0"/>
      <circle cx="69" cy="70" r="1.5" fill="#FBF7F0"/>
      <rect x="60" y="78" width="14" height="6" rx="0.5" fill="#FBF7F0" opacity="0.6"/>
      <!-- Ножки -->
      <rect x="16" y="92" width="3" height="4" rx="0.5" fill="#6B4A2B"/>
      <rect x="69" y="92" width="3" height="4" rx="0.5" fill="#6B4A2B"/>
      <line x1="6" y1="98" x2="84" y2="98" stroke="#6B4A2B" stroke-width="0.8" opacity="0.35"/>
    </svg>
  `,

  /* ===== Кофемашина · 5 типов ===== */

  coffee_type_builtin: `
    <svg viewBox="0 0 96 128">
      <rect x="4" y="2" width="88" height="124" rx="4" fill="none" stroke="#6B4A2B" stroke-width="1.1" stroke-dasharray="3 3" opacity="0.45"/>
      <rect x="18" y="12" width="68" height="112" rx="4" fill="#6B4A2B" opacity="0.1"/>
      <rect x="14" y="8" width="68" height="112" rx="4" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="8" width="68" height="112" rx="4" fill="url(#g-sheen)"/>
      <!-- Дисплей сверху -->
      <rect x="20" y="16" width="56" height="14" rx="1" fill="#1F1A14" opacity="0.85"/>
      <text x="48" y="26" text-anchor="middle" font-family="JetBrains Mono" font-size="6" fill="#FBF7F0">ESPRESSO</text>
      <!-- Иконки кнопок -->
      <circle cx="24" cy="42" r="3" fill="none" stroke="#6B4A2B" stroke-width="1"/>
      <circle cx="36" cy="42" r="3" fill="none" stroke="#6B4A2B" stroke-width="1"/>
      <circle cx="48" cy="42" r="3" fill="none" stroke="#6B4A2B" stroke-width="1"/>
      <circle cx="60" cy="42" r="3" fill="none" stroke="#6B4A2B" stroke-width="1"/>
      <circle cx="72" cy="42" r="3" fill="none" stroke="#6B4A2B" stroke-width="1"/>
      <!-- Носик подачи кофе -->
      <rect x="40" y="60" width="16" height="10" rx="1" fill="#1F1A14" opacity="0.85"/>
      <rect x="44" y="68" width="2" height="6" fill="#6B4A2B"/>
      <rect x="50" y="68" width="2" height="6" fill="#6B4A2B"/>
      <!-- Чашка под носиком -->
      <path d="M 38 88 L 38 96 Q 38 100, 42 100 L 54 100 Q 58 100, 58 96 L 58 88 Z" fill="none" stroke="#6B4A2B" stroke-width="1.4"/>
      <path d="M 58 90 Q 64 90, 64 94 Q 64 98, 58 98" fill="none" stroke="#6B4A2B" stroke-width="1.4"/>
      <line x1="42" y1="92" x2="54" y2="92" stroke="#6B4A2B" stroke-width="0.8" opacity="0.5"/>
      <!-- Поддон капель -->
      <rect x="34" y="108" width="28" height="6" rx="1" fill="none" stroke="#6B4A2B" stroke-width="1.2"/>
    </svg>
  `,

  coffee_type_free_grinder: `
    <svg viewBox="0 0 96 128">
      <rect x="22" y="14" width="56" height="106" rx="4" fill="#6B4A2B" opacity="0.1"/>
      <rect x="18" y="10" width="56" height="106" rx="4" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="18" y="10" width="56" height="106" rx="4" fill="url(#g-sheen)"/>
      <!-- Бункер для зёрен наверху -->
      <rect x="28" y="14" width="36" height="20" rx="1" fill="#1F1A14" opacity="0.4"/>
      <circle cx="34" cy="22" r="1.5" fill="#6B4A2B"/>
      <circle cx="40" cy="20" r="1.5" fill="#6B4A2B"/>
      <circle cx="46" cy="24" r="1.5" fill="#6B4A2B"/>
      <circle cx="52" cy="20" r="1.5" fill="#6B4A2B"/>
      <circle cx="58" cy="22" r="1.5" fill="#6B4A2B"/>
      <!-- Дисплей -->
      <rect x="24" y="40" width="44" height="12" rx="1" fill="#1F1A14" opacity="0.85"/>
      <text x="46" y="49" text-anchor="middle" font-family="JetBrains Mono" font-size="5" fill="#FBF7F0">ESPRESSO</text>
      <!-- Кнопки -->
      <circle cx="28" cy="60" r="2.5" fill="none" stroke="#6B4A2B" stroke-width="1"/>
      <circle cx="38" cy="60" r="2.5" fill="none" stroke="#6B4A2B" stroke-width="1"/>
      <circle cx="54" cy="60" r="2.5" fill="none" stroke="#6B4A2B" stroke-width="1"/>
      <circle cx="64" cy="60" r="2.5" fill="none" stroke="#6B4A2B" stroke-width="1"/>
      <!-- Носик -->
      <rect x="40" y="74" width="12" height="8" rx="1" fill="#1F1A14" opacity="0.85"/>
      <rect x="43" y="80" width="2" height="4" fill="#6B4A2B"/>
      <rect x="47" y="80" width="2" height="4" fill="#6B4A2B"/>
      <!-- Чашка -->
      <path d="M 38 96 L 38 102 Q 38 105, 41 105 L 51 105 Q 54 105, 54 102 L 54 96 Z" fill="none" stroke="#6B4A2B" stroke-width="1.3"/>
      <!-- Ножки -->
      <rect x="22" y="116" width="4" height="4" rx="0.5" fill="#6B4A2B"/>
      <rect x="66" y="116" width="4" height="4" rx="0.5" fill="#6B4A2B"/>
      <line x1="6" y1="122" x2="82" y2="122" stroke="#6B4A2B" stroke-width="0.8" opacity="0.35"/>
    </svg>
  `,

  coffee_type_capsule: `
    <svg viewBox="0 0 96 128">
      <rect x="22" y="20" width="56" height="86" rx="4" fill="#6B4A2B" opacity="0.1"/>
      <rect x="18" y="16" width="56" height="86" rx="4" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="18" y="16" width="56" height="86" rx="4" fill="url(#g-sheen)"/>
      <!-- Откидной слот для капсулы -->
      <rect x="28" y="22" width="36" height="10" rx="2" fill="#1F1A14" opacity="0.75"/>
      <!-- Капсула пиктографически -->
      <path d="M 42 26 L 42 30 L 50 30 L 50 26 Z" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="0.8"/>
      <!-- 2 кнопки (эспрессо + лунго) -->
      <rect x="26" y="42" width="20" height="12" rx="1" fill="#1F1A14" opacity="0.85"/>
      <rect x="46" y="42" width="20" height="12" rx="1" fill="#1F1A14" opacity="0.85"/>
      <text x="36" y="51" text-anchor="middle" font-family="JetBrains Mono" font-size="5" fill="#FBF7F0">ESP</text>
      <text x="56" y="51" text-anchor="middle" font-family="JetBrains Mono" font-size="5" fill="#FBF7F0">LUNGO</text>
      <!-- Носик подачи -->
      <rect x="42" y="62" width="8" height="6" rx="0.5" fill="#1F1A14" opacity="0.85"/>
      <rect x="45" y="66" width="1.5" height="4" fill="#6B4A2B"/>
      <!-- Чашка -->
      <path d="M 40 82 L 40 90 Q 40 94, 44 94 L 50 94 Q 54 94, 54 90 L 54 82 Z" fill="none" stroke="#6B4A2B" stroke-width="1.3"/>
      <!-- Резервуар воды сзади -->
      <rect x="70" y="22" width="6" height="50" rx="1" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1" opacity="0.6"/>
      <line x1="70" y1="40" x2="76" y2="40" stroke="#6B4A2B" stroke-width="0.5" opacity="0.5"/>
      <line x1="70" y1="56" x2="76" y2="56" stroke="#6B4A2B" stroke-width="0.5" opacity="0.5"/>
      <!-- Подпись -->
      <text x="48" y="118" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="#6B4A2B" stroke="none">CAPSULE</text>
    </svg>
  `,

  coffee_type_manual: `
    <svg viewBox="0 0 96 128">
      <rect x="14" y="14" width="68" height="78" rx="4" fill="#6B4A2B" opacity="0.1"/>
      <rect x="10" y="10" width="68" height="78" rx="4" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="10" y="10" width="68" height="78" rx="4" fill="url(#g-sheen)"/>
      <!-- Дисплей в стиле «бариста» — манометр -->
      <circle cx="56" cy="28" r="10" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.4"/>
      <line x1="56" y1="28" x2="62" y2="22" stroke="#8A3E2A" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="56" cy="28" r="1.5" fill="#6B4A2B"/>
      <text x="56" y="42" text-anchor="middle" font-family="JetBrains Mono" font-size="4" fill="#6B4A2B">bar</text>
      <!-- Холдер (портафильтр) — рукоятка вылезает спереди -->
      <rect x="14" y="56" width="22" height="8" rx="2" fill="#1F1A14"/>
      <rect x="36" y="58" width="14" height="4" rx="0.5" fill="#6B4A2B"/>
      <circle cx="22" cy="60" r="4" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="0.8"/>
      <line x1="20" y1="58" x2="24" y2="62" stroke="#6B4A2B" stroke-width="0.5" opacity="0.5"/>
      <line x1="20" y1="62" x2="24" y2="58" stroke="#6B4A2B" stroke-width="0.5" opacity="0.5"/>
      <!-- Паровой кран -->
      <rect x="60" y="48" width="3" height="20" rx="1" fill="#6B4A2B"/>
      <circle cx="61.5" cy="48" r="2.5" fill="#6B4A2B"/>
      <!-- Кнопки -->
      <rect x="14" y="72" width="6" height="10" rx="1" fill="#1F1A14" opacity="0.85"/>
      <rect x="22" y="72" width="6" height="10" rx="1" fill="#1F1A14" opacity="0.85"/>
      <rect x="30" y="72" width="6" height="10" rx="1" fill="#1F1A14" opacity="0.85"/>
      <!-- Чашка под холдером -->
      <path d="M 14 92 L 14 98 Q 14 102, 18 102 L 30 102 Q 34 102, 34 98 L 34 92 Z" fill="none" stroke="#6B4A2B" stroke-width="1.4"/>
      <!-- Подпись BARISTA -->
      <text x="48" y="118" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="#6B4A2B" stroke="none">BARISTA</text>
    </svg>
  `,

  coffee_type_tap: `
    <svg viewBox="0 0 96 128">
      <!-- Столешница (горизонтальная линия) -->
      <rect x="0" y="68" width="96" height="4" fill="#6B4A2B" opacity="0.7"/>
      <!-- Кран снизу столешницы -->
      <rect x="36" y="56" width="24" height="14" rx="1" fill="#6B4A2B"/>
      <!-- Изогнутый носик -->
      <path d="M 48 70 Q 48 84, 62 84 L 62 94" fill="none" stroke="#6B4A2B" stroke-width="3" stroke-linecap="round"/>
      <!-- Ручка крана -->
      <rect x="44" y="48" width="8" height="10" rx="1" fill="#6B4A2B"/>
      <circle cx="48" cy="46" r="3" fill="#FBF7F0" stroke="#6B4A2B" stroke-width="1.4"/>
      <!-- Чашка -->
      <path d="M 56 100 L 56 110 Q 56 114, 60 114 L 68 114 Q 72 114, 72 110 L 72 100 Z" fill="none" stroke="#6B4A2B" stroke-width="1.4"/>
      <!-- Капля -->
      <ellipse cx="62" cy="98" rx="1.5" ry="2" fill="#8A3E2A"/>
      <!-- Под столешницей пунктир = скрытый бойлер -->
      <rect x="20" y="80" width="56" height="32" rx="2" fill="none" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="2 2" opacity="0.5"/>
      <text x="48" y="100" text-anchor="middle" font-family="JetBrains Mono" font-size="5" fill="#6B4A2B" stroke="none" opacity="0.6">бойлер скрыт</text>
      <!-- Подпись -->
      <text x="48" y="22" text-anchor="middle" font-family="JetBrains Mono" font-size="8" fill="#6B4A2B" stroke="none">КРАН-КОФЕМАШИНА</text>
    </svg>
  `,

  /* ===== Стиральная машина · 3 типа установки ===== */

  washer_install_builtin: `
    <svg viewBox="0 0 96 128">
      <rect x="4" y="2" width="88" height="124" rx="4" fill="none" stroke="#6B4A2B" stroke-width="1.1" stroke-dasharray="3 3" opacity="0.45"/>
      <rect x="18" y="12" width="68" height="112" rx="4" fill="#6B4A2B" opacity="0.1"/>
      <!-- Фасад ЗОВ — никаких видимых элементов -->
      <rect x="14" y="8" width="68" height="112" rx="4" fill="url(#g-twoch)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="8" width="68" height="112" rx="4" fill="url(#g-sheen)"/>
      <!-- Ручка-планка -->
      <rect x="30" y="14" width="36" height="3" rx="1.5" fill="#6B4A2B"/>
      <!-- Внутри (легко прорисовано) -->
      <circle cx="48" cy="62" r="20" fill="none" stroke="#6B4A2B" stroke-width="1" stroke-dasharray="3 2" opacity="0.35"/>
      <circle cx="48" cy="62" r="14" fill="none" stroke="#6B4A2B" stroke-width="0.7" opacity="0.25"/>
      <text x="48" y="104" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="#6B4A2B" stroke="none" opacity="0.5">встр · 45 см</text>
    </svg>
  `,

  washer_install_undertop: `
    <svg viewBox="0 0 96 128">
      <!-- Столешница -->
      <rect x="0" y="6" width="96" height="6" fill="#6B4A2B" opacity="0.7"/>
      <rect x="18" y="18" width="68" height="104" rx="4" fill="#6B4A2B" opacity="0.1"/>
      <!-- Корпус (под столешницей) -->
      <rect x="14" y="14" width="68" height="104" rx="4" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="14" width="68" height="104" rx="4" fill="url(#g-sheen)"/>
      <!-- Панель управления -->
      <rect x="14" y="14" width="68" height="16" rx="4" fill="#1F1A14" opacity="0.85"/>
      <rect x="20" y="18" width="20" height="8" rx="0.5" fill="#FBF7F0" opacity="0.4"/>
      <circle cx="48" cy="22" r="2" fill="#FBF7F0"/>
      <circle cx="56" cy="22" r="2" fill="none" stroke="#FBF7F0" stroke-width="1"/>
      <circle cx="68" cy="22" r="3" fill="none" stroke="#FBF7F0" stroke-width="1.2"/>
      <line x1="68" y1="19" x2="68" y2="25" stroke="#FBF7F0" stroke-width="1"/>
      <!-- Дверца — круглый люк -->
      <circle cx="48" cy="68" r="22" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <circle cx="48" cy="68" r="17" fill="none" stroke="#6B4A2B" stroke-width="1" opacity="0.5"/>
      <circle cx="48" cy="68" r="12" fill="#1F1A14" opacity="0.85"/>
      <circle cx="48" cy="68" r="2" fill="#FBF7F0" opacity="0.5"/>
      <!-- Логотип внизу -->
      <text x="48" y="108" text-anchor="middle" font-family="JetBrains Mono" font-size="8" fill="#6B4A2B" stroke="none" opacity="0.4">WASHER</text>
    </svg>
  `,

  washer_install_freestanding: `
    <svg viewBox="0 0 96 128">
      <rect x="18" y="12" width="68" height="108" rx="6" fill="#6B4A2B" opacity="0.1"/>
      <rect x="14" y="8" width="68" height="108" rx="6" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.6"/>
      <rect x="14" y="8" width="68" height="108" rx="6" fill="url(#g-sheen)"/>
      <!-- Панель управления -->
      <rect x="14" y="8" width="68" height="20" rx="6" fill="#1F1A14" opacity="0.85"/>
      <rect x="20" y="14" width="22" height="9" rx="0.5" fill="#FBF7F0" opacity="0.4"/>
      <circle cx="50" cy="18" r="1.5" fill="#FBF7F0"/>
      <circle cx="58" cy="18" r="1.5" fill="none" stroke="#FBF7F0" stroke-width="1"/>
      <circle cx="70" cy="18" r="4" fill="none" stroke="#FBF7F0" stroke-width="1.2"/>
      <line x1="70" y1="14" x2="70" y2="22" stroke="#FBF7F0" stroke-width="1"/>
      <!-- Большой круглый люк -->
      <circle cx="48" cy="66" r="26" fill="url(#g-cold)" stroke="#6B4A2B" stroke-width="1.8"/>
      <circle cx="48" cy="66" r="21" fill="none" stroke="#6B4A2B" stroke-width="1" opacity="0.5"/>
      <circle cx="48" cy="66" r="15" fill="#1F1A14" opacity="0.85"/>
      <!-- Внутри барабан -->
      <circle cx="48" cy="66" r="11" fill="none" stroke="#FBF7F0" stroke-width="0.6" opacity="0.4"/>
      <circle cx="48" cy="66" r="2.5" fill="#FBF7F0" opacity="0.5"/>
      <!-- Ёмкость для порошка -->
      <rect x="20" y="34" width="14" height="4" rx="1" fill="#6B4A2B" opacity="0.4"/>
      <!-- Ножки -->
      <rect x="22" y="116" width="6" height="6" rx="1" fill="#6B4A2B"/>
      <rect x="68" y="116" width="6" height="6" rx="1" fill="#6B4A2B"/>
      <line x1="6" y1="124" x2="90" y2="124" stroke="#6B4A2B" stroke-width="0.8" opacity="0.35"/>
    </svg>
  `,
};
