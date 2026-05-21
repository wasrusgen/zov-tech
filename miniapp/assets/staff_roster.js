/* ============================================================
   Обзор команды — #/admin/staff
   Доступен: менеджер.
   ============================================================ */

const StaffRoster = (function () {

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  async function _api(path, body = {}) {
    const res = await fetch(`${BACKEND_URL}/api/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: tg?.initData || "", initDataUnsafe: tg?.initDataUnsafe || null, ...body }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  const ROLE_LABELS = {
    assembler: "Сборщик",
    measurer:  "Замерщик",
    expeditor: "Экспедитор",
  };

  function mount(container) {
    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    const oldNav = document.getElementById("bottom-nav");
    if (oldNav) oldNav.remove();

    const h = document.createElement("header");
    h.className = "podbor-header";
    h.innerHTML = `
      <button class="podbor-back">${(window.ICONS || {}).arrow_left || "‹"}</button>
      <div class="podbor-title">Команда</div>
      <div style="width:36px"></div>
    `;
    h.querySelector(".podbor-back").addEventListener("click", () => {
      haptic && haptic("impact");
      history.back();
    });
    container.appendChild(h);

    const screen = document.createElement("div");
    screen.className = "podbor-screen";
    screen.style.padding = "0 0 32px";
    screen.innerHTML = `<div class="loader-inline"><div class="spinner"></div></div>`;
    container.appendChild(screen);

    _api("staff_roster").then(data => {
      if (data.error) {
        screen.innerHTML = `<div class="error" style="margin:16px;">${escHtml(data.error)}</div>`;
        return;
      }
      const staff = data.staff || [];
      if (!staff.length) {
        screen.innerHTML = `<div style="margin:32px 16px;text-align:center;color:var(--muted);font-size:14px;">Сотрудников пока нет</div>`;
        return;
      }

      screen.innerHTML = "";

      // Разбиваем по ролям для отображения
      const groups = [
        { key: "assembler", label: "🔨 Сборщики", items: staff.filter(s => s.roles.includes("assembler")) },
        { key: "measurer",  label: "📐 Замерщики", items: staff.filter(s => s.roles.includes("measurer") && !s.roles.includes("assembler")) },
        { key: "expeditor", label: "📦 Экспедиторы", items: staff.filter(s => s.roles.includes("expeditor") && !s.roles.includes("assembler") && !s.roles.includes("measurer")) },
      ].filter(g => g.items.length);

      for (const group of groups) {
        const headEl = document.createElement("div");
        headEl.className = "section-head";
        headEl.style.marginTop = "16px";
        headEl.innerHTML = `<span class="label">${group.label} <span class="count">· ${group.items.length}</span></span>`;
        screen.appendChild(headEl);

        for (const person of group.items) {
          const card = document.createElement("div");
          card.style.cssText = "margin:0 16px 8px;padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:12px;";

          // Статус-теги
          const tags = [];
          if (person.on_probation) tags.push(`<span style="font-size:11px;padding:2px 7px;border-radius:10px;background:#fff3cd;color:#856404;">Испытательный срок</span>`);
          if (person.equipment_ok === false) tags.push(`<span style="font-size:11px;padding:2px 7px;border-radius:10px;background:#f8d7da;color:#721c24;">⚠️ Не укомплектован</span>`);
          if (person.equipment_ok === true)  tags.push(`<span style="font-size:11px;padding:2px 7px;border-radius:10px;background:#d4edda;color:#155724;">✅ Оборудование OK</span>`);

          // Нагрузка
          const loadBits = [];
          if (person.active_assemblies > 0)
            loadBits.push(`🔨 ${person.active_assemblies} сборок`);
          if (person.month_measures > 0)
            loadBits.push(`📐 ${person.month_measures} замеров (мес.)`);

          const rolesStr = person.roles
            .filter(r => r !== "manager" && r !== "client")
            .map(r => ROLE_LABELS[r] || r)
            .join(", ");

          const starsEl = (person.avg_stars != null && typeof FeedbackModule !== "undefined")
            ? `<div style="margin-top:4px;line-height:1;">${FeedbackModule.starsHtml(person.avg_stars, 13)}
               <span style="font-size:11px;color:var(--muted);margin-left:3px;">${Number(person.avg_stars).toFixed(1)}</span></div>`
            : "";

          card.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <div style="flex:1;min-width:0;">
                <div style="font-size:14px;font-weight:700;color:var(--ink);">${escHtml(person.full_name)}</div>
                <div style="font-size:12px;color:var(--muted);margin-top:1px;">${escHtml(rolesStr)}${person.tg_username ? ` · @${escHtml(person.tg_username)}` : ""}</div>
                ${starsEl}
              </div>
              ${loadBits.length ? `<div style="text-align:right;font-size:12px;color:var(--accent);white-space:nowrap;">${loadBits.join("<br>")}</div>` : `<div style="font-size:12px;color:var(--muted);">Свободен</div>`}
            </div>
            ${tags.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">${tags.join("")}</div>` : ""}
          `;

          // Клик → действия (toggle испытательного срока)
          if (person.roles.includes("assembler")) {
            card.style.cursor = "pointer";
            card.addEventListener("click", () => _showPersonActions(person, card));
          }

          screen.appendChild(card);
        }
      }
    }).catch(e => {
      screen.innerHTML = `<div class="error" style="margin:16px;">Ошибка: ${escHtml(e.message)}</div>`;
    });
  }

  function _showPersonActions(person, card) {
    haptic && haptic("impact");
    // Inline toggle испытательного срока прямо на карточке
    const existing = card.querySelector(".roster-actions");
    if (existing) { existing.remove(); return; }

    const actEl = document.createElement("div");
    actEl.className = "roster-actions";
    actEl.style.cssText = "margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;";

    const probBtn = document.createElement("button");
    probBtn.className = person.on_probation ? "btn-primary" : "btn-secondary";
    probBtn.style.cssText = "font-size:12px;padding:7px 12px;";
    probBtn.textContent = person.on_probation ? "✅ Снять испытательный" : "📋 Назначить испытательный";

    probBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      probBtn.disabled = true;
      try {
        const res = await _api("assembler_set_probation", {
          assembler_tg_id: person.tg_id,
          on_probation: !person.on_probation,
        });
        if (res.ok) {
          person.on_probation = !person.on_probation;
          actEl.remove();
          // Перезапускаем экран
          mount(document.getElementById("app"));
        }
      } catch (e) { probBtn.disabled = false; }
    });

    actEl.appendChild(probBtn);

    if (person.tg_username) {
      const msgBtn = document.createElement("a");
      msgBtn.href = `https://t.me/${person.tg_username}`;
      msgBtn.target = "_blank";
      msgBtn.className = "btn-secondary";
      msgBtn.style.cssText = "font-size:12px;padding:7px 12px;text-decoration:none;display:inline-block;";
      msgBtn.textContent = "✉️ Написать";
      actEl.appendChild(msgBtn);
    }

    card.appendChild(actEl);
  }

  return { mount };
})();
