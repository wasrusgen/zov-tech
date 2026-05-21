// dispatcher_dashboard.js v=20260521a
const DispatcherDashboard = (function () {
  "use strict";

  const STATUS_LABEL = {
    created:     "Новая",
    shipped:     "В пути",
    arrived:     "На складе",
    scheduled:   "Назначена",
    in_progress: "В работе",
    completed:   "Завершена",
  };
  const STATUS_COLOR = {
    created:     "#FFF3CD",
    shipped:     "#CCE5FF",
    arrived:     "#D4EDDA",
    scheduled:   "#E2D9F3",
    in_progress: "#FFE0B2",
    completed:   "#E8F5E9",
  };
  const STATUS_TEXT_COLOR = {
    created:     "#856404",
    shipped:     "#004085",
    arrived:     "#155724",
    scheduled:   "#4A235A",
    in_progress: "#E65100",
    completed:   "#1B5E20",
  };

  function fmt(iso) {
    if (!iso) return "—";
    const d = iso.slice(0, 10).split("-");
    return d[2] + "." + d[1] + "." + d[0];
  }

  function el(html) {
    const t = document.createElement("div");
    t.innerHTML = html.trim();
    return t.firstChild;
  }

  function badge(status) {
    return `<span style="background:${STATUS_COLOR[status] || "#eee"};color:${STATUS_TEXT_COLOR[status] || "#333"};padding:2px 8px;border-radius:6px;font-size:12px;font-weight:600">${STATUS_LABEL[status] || status}</span>`;
  }

  function showError(container, msg) {
    container.innerHTML = `<div style="padding:32px;text-align:center;color:var(--danger)">${msg}</div>`;
  }

  // ─── MAIN LIST ────────────────────────────────────────────────
  async function mount(container) {
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:16px;background:var(--surface);border-bottom:1px solid #eee;position:sticky;top:0;z-index:10">
        <button onclick="location.hash='#/'" style="background:none;border:none;font-size:22px;cursor:pointer;padding:0;line-height:1">←</button>
        <span style="font-size:18px;font-weight:700">📦 Диспетчер</span>
      </div>
      <div id="disp-body" style="padding:12px"></div>`;

    const body = container.querySelector("#disp-body");
    body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">Загрузка…</div>`;

    let data;
    try {
      data = await _api("/api/dispatcher_inbox", {});
    } catch (e) {
      showError(body, "Ошибка сети: " + e.message);
      return;
    }
    if (data.error) { showError(body, data.error); return; }

    const items = data.assemblies || [];
    if (!items.length) {
      body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">Нет сборок</div>`;
      return;
    }

    // Group by status
    const GROUPS = ["created","shipped","arrived","scheduled","in_progress","completed"];
    const grouped = {};
    GROUPS.forEach(s => { grouped[s] = []; });
    items.forEach(a => { (grouped[a.status] || (grouped["created"])).push(a); });

    body.innerHTML = "";
    GROUPS.forEach(status => {
      const list = grouped[status];
      if (!list.length) return;
      const section = el(`<div style="margin-bottom:20px">
        <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;padding:4px 0 8px">${STATUS_LABEL[status]} (${list.length})</div>
      </div>`);
      list.forEach(a => section.appendChild(_card(a, container)));
      body.appendChild(section);
    });
  }

  function _card(a, container) {
    const card = el(`<div style="background:var(--surface);border-radius:var(--radius);padding:14px 16px;margin-bottom:8px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.07)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <span style="font-weight:600;font-size:15px">${a.client_name || "—"}</span>
        ${badge(a.status)}
      </div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:4px">📍 ${a.address || "—"}</div>
      ${a.shipment_date ? `<div style="font-size:12px;color:var(--muted)">🚚 Отгружено: ${fmt(a.shipment_date)} · ${a.packages_count || "?"} уп.</div>` : ""}
      ${a.arrival_date  ? `<div style="font-size:12px;color:var(--muted)">🏭 Принято: ${fmt(a.arrival_date)} · ${a.arrival_packages_count || "?"} уп.</div>` : ""}
      ${a.scheduled_at  ? `<div style="font-size:12px;color:var(--muted)">📅 Назначено: ${fmt(a.scheduled_at)}</div>` : ""}
    </div>`);
    card.addEventListener("click", () => mountDetail(container, a));
    return card;
  }

  // ─── DETAIL / EDIT ────────────────────────────────────────────
  async function mountDetail(container, a) {
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:16px;background:var(--surface);border-bottom:1px solid #eee;position:sticky;top:0;z-index:10">
        <button id="back-btn" style="background:none;border:none;font-size:22px;cursor:pointer;padding:0;line-height:1">←</button>
        <span style="font-size:17px;font-weight:700;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.client_name}</span>
        ${badge(a.status)}
      </div>
      <div style="padding:16px" id="detail-body"></div>`;

    container.querySelector("#back-btn").addEventListener("click", () => mount(container));
    const body = container.querySelector("#detail-body");

    // Info block
    body.appendChild(el(`<div style="background:var(--surface);border-radius:var(--radius);padding:14px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.07)">
      <div style="font-size:13px;color:var(--muted);margin-bottom:4px">📍 ${a.address || "—"}</div>
      ${a.scope_of_work ? `<div style="font-size:13px;margin-bottom:4px">📝 ${a.scope_of_work}</div>` : ""}
      ${a.client_phone  ? `<div style="font-size:13px;color:var(--muted)">📞 ${a.client_phone}</div>` : ""}
      ${a.manager_note  ? `<div style="font-size:13px;color:var(--muted);margin-top:4px">💬 ${a.manager_note}</div>` : ""}
    </div>`));

    // Step 1: Shipment
    body.appendChild(_stepShipment(a, container));
    // Step 2: Arrival
    body.appendChild(_stepArrival(a, container));
    // Step 3: Dispatch
    body.appendChild(_stepDispatch(a, container));
  }

  // ─── STEP 1: ОТГРУЗКА ─────────────────────────────────────────
  function _stepShipment(a, container) {
    const done = !!a.shipment_date;
    const wrap = el(`<div style="background:var(--surface);border-radius:var(--radius);padding:14px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,.07)">
      <div style="font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <span style="font-size:18px">${done ? "✅" : "1️⃣"}</span>
        <span>Отгрузка с фабрики</span>
      </div>
      ${done ? `<div style="font-size:13px;color:var(--muted)">Дата: ${fmt(a.shipment_date)} · Упаковок: ${a.packages_count || "—"}</div>` : ""}
    </div>`);

    if (!done) {
      const form = el(`<div>
        <div style="margin-bottom:8px">
          <label style="font-size:13px;color:var(--muted);display:block;margin-bottom:4px">Дата отгрузки</label>
          <input type="date" id="ship-date" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:15px;box-sizing:border-box">
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:13px;color:var(--muted);display:block;margin-bottom:4px">Кол-во упаковок</label>
          <input type="number" id="ship-count" min="1" placeholder="0" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:15px;box-sizing:border-box">
        </div>
        <button id="ship-save" style="width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">Сохранить отгрузку</button>
      </div>`);
      form.querySelector("#ship-save").addEventListener("click", async () => {
        const date  = form.querySelector("#ship-date").value;
        const count = form.querySelector("#ship-count").value;
        if (!date) { alert("Укажите дату отгрузки"); return; }
        haptic && haptic("impact");
        const btn = form.querySelector("#ship-save");
        btn.disabled = true; btn.textContent = "Сохраняем…";
        const res = await _api("/api/assembly_set_shipment", {
          assembly_id: a.id, shipment_date: date, packages_count: count
        });
        if (res.ok) {
          a.shipment_date = date; a.packages_count = count; a.status = "shipped";
          mountDetail(container, a);
        } else {
          alert(res.error || "Ошибка"); btn.disabled = false; btn.textContent = "Сохранить отгрузку";
        }
      });
      wrap.appendChild(form);
    }
    return wrap;
  }

  // ─── STEP 2: ПРИЁМКА НА СКЛАД ─────────────────────────────────
  function _stepArrival(a, container) {
    const done    = !!a.arrival_date;
    const enabled = !!a.shipment_date;
    const wrap = el(`<div style="background:var(--surface);border-radius:var(--radius);padding:14px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,.07);opacity:${enabled ? 1 : .45}">
      <div style="font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <span style="font-size:18px">${done ? "✅" : "2️⃣"}</span>
        <span>Приёмка на склад</span>
      </div>
      ${done ? `<div style="font-size:13px;color:var(--muted)">Дата: ${fmt(a.arrival_date)} · Принято: ${a.arrival_packages_count || "—"} уп.</div>` : ""}
    </div>`);

    if (enabled && !done) {
      const form = el(`<div>
        <div style="margin-bottom:8px">
          <label style="font-size:13px;color:var(--muted);display:block;margin-bottom:4px">Дата приёмки</label>
          <input type="date" id="arr-date" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:15px;box-sizing:border-box">
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:13px;color:var(--muted);display:block;margin-bottom:4px">Фактически принято упаковок</label>
          <input type="number" id="arr-count" min="0" placeholder="${a.packages_count || '0'}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:15px;box-sizing:border-box">
        </div>
        <button id="arr-save" style="width:100%;padding:12px;background:#2e7d32;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">Подтвердить приёмку</button>
      </div>`);
      form.querySelector("#arr-save").addEventListener("click", async () => {
        const date  = form.querySelector("#arr-date").value;
        const count = form.querySelector("#arr-count").value;
        if (!date) { alert("Укажите дату приёмки"); return; }
        haptic && haptic("impact");
        const btn = form.querySelector("#arr-save");
        btn.disabled = true; btn.textContent = "Сохраняем…";
        const res = await _api("/api/assembly_set_arrival", {
          assembly_id: a.id, arrival_date: date, arrival_packages_count: count
        });
        if (res.ok) {
          a.arrival_date = date; a.arrival_packages_count = count; a.status = "arrived";
          mountDetail(container, a);
        } else {
          alert(res.error || "Ошибка"); btn.disabled = false; btn.textContent = "Подтвердить приёмку";
        }
      });
      wrap.appendChild(form);
    }
    return wrap;
  }

  // ─── STEP 3: НАЗНАЧИТЬ ЭКСПЕДИТОРА И ДАТУ ─────────────────────
  function _stepDispatch(a, container) {
    const done    = a.status === "scheduled" || a.status === "in_progress" || a.status === "completed";
    const enabled = !!a.arrival_date;
    const wrap = el(`<div style="background:var(--surface);border-radius:var(--radius);padding:14px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,.07);opacity:${enabled ? 1 : .45}">
      <div style="font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <span style="font-size:18px">${done ? "✅" : "3️⃣"}</span>
        <span>Назначить дату и экспедитора</span>
      </div>
      ${done ? `<div style="font-size:13px;color:var(--muted)">Дата: ${fmt(a.scheduled_at)}${a.expeditor_tg_id ? " · Экспедитор: tg:" + a.expeditor_tg_id : ""}</div>` : ""}
    </div>`);

    if (enabled && !done) {
      const form = el(`<div>
        <div style="margin-bottom:8px">
          <label style="font-size:13px;color:var(--muted);display:block;margin-bottom:4px">Дата сборки у клиента</label>
          <input type="date" id="disp-date" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:15px;box-sizing:border-box">
        </div>
        <div id="exp-picker" style="margin-bottom:12px">
          <label style="font-size:13px;color:var(--muted);display:block;margin-bottom:4px">Экспедитор</label>
          <div style="font-size:13px;color:var(--muted)">Загрузка…</div>
        </div>
        <button id="disp-save" style="width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">Назначить</button>
      </div>`);

      // Load expeditors list
      _loadExpeditors(form.querySelector("#exp-picker"));

      form.querySelector("#disp-save").addEventListener("click", async () => {
        const date = form.querySelector("#disp-date").value;
        const sel  = form.querySelector("#exp-select");
        const expId = sel ? sel.value : "";
        if (!date) { alert("Укажите дату сборки"); return; }
        haptic && haptic("impact");
        const btn = form.querySelector("#disp-save");
        btn.disabled = true; btn.textContent = "Назначаем…";
        const res = await _api("/api/assembly_assign_dispatch", {
          assembly_id: a.id, scheduled_at: date, expeditor_tg_id: expId
        });
        if (res.ok) {
          a.scheduled_at = date; a.expeditor_tg_id = expId; a.status = "scheduled";
          mountDetail(container, a);
        } else {
          alert(res.error || "Ошибка"); btn.disabled = false; btn.textContent = "Назначить";
        }
      });
      wrap.appendChild(form);
    }
    return wrap;
  }

  async function _loadExpeditors(container) {
    try {
      const res = await _api("/api/staff_list", { role: "expeditor" });
      const users = res.users || res.staff || [];
      if (!users.length) {
        container.innerHTML = `<label style="font-size:13px;color:var(--muted);display:block;margin-bottom:4px">Экспедитор</label><div style="font-size:13px;color:var(--muted)">Нет экспедиторов</div>`;
        return;
      }
      const opts = users.map(u => `<option value="${u.tg_id}">${u.name || u.first_name || u.tg_id}</option>`).join("");
      container.innerHTML = `<label style="font-size:13px;color:var(--muted);display:block;margin-bottom:4px">Экспедитор</label>
        <select id="exp-select" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:15px;background:#fff;box-sizing:border-box">
          <option value="">— не назначен —</option>${opts}
        </select>`;
    } catch (e) {
      container.innerHTML = `<label style="font-size:13px;color:var(--muted);display:block;margin-bottom:4px">Экспедитор</label>
        <input id="exp-select" placeholder="Telegram ID" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:15px;box-sizing:border-box">`;
    }
  }

  return { mount, mountDetail };
})();
