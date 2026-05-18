/* ============================================================
   Клиентский кабинет — #/c/cabinet
   Доступен только роли client.
   ============================================================ */

const CabinetScreen = (function () {

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    } catch { return iso.slice(0, 10); }
  }

  async function _api(path, body = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(`${BACKEND_URL}/api/${path}`, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: tg?.initData || "", initDataUnsafe: tg?.initDataUnsafe || null, ...body }),
      });
      return await res.json();
    } catch (e) {
      if (e.name === "AbortError") throw new Error("Сервер не отвечает");
      throw e;
    } finally { clearTimeout(t); }
  }

  const STATUS_LABELS = {
    draft:       "📝 Черновик",
    sent:        "📨 Отправлен",
    reviewed:    "✅ Просмотрен",
    approved:    "🎉 Принят",
    rejected:    "❌ Отклонён",
    created:     "🆕 Создана",
    scheduled:   "📅 Запланирована",
    in_progress: "🔨 В работе",
    done:        "✅ Завершена",
    cancelled:   "❌ Отменена",
  };

  function statusChip(status) {
    const label = STATUS_LABELS[status] || status || "—";
    return `<span style="font-size:12px;color:var(--muted);">${escHtml(label)}</span>`;
  }

  // ── Блок «Менеджер» ──────────────────────────────────────────────────────
  function renderManagerBlock(mgr) {
    if (!mgr?.full_name) return "";
    const tgLink = mgr.tg_id ? `<a href="https://t.me/${escHtml(mgr.username || '')}" style="color:var(--accent);text-decoration:none;" target="_blank">📩 Написать</a>` : "";
    return `
      <div class="block" style="margin:12px 16px 0;">
        <div class="block-head">Мой менеджер</div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;">
          <div>
            <div style="font-weight:600;color:var(--ink);">${escHtml(mgr.full_name)}</div>
            ${mgr.salon ? `<div style="font-size:12px;color:var(--muted);">${escHtml(mgr.salon)}</div>` : ""}
          </div>
          ${tgLink}
        </div>
      </div>`;
  }

  // ── Блок «Подборы» ───────────────────────────────────────────────────────
  function renderProposalsBlock(proposals) {
    if (!proposals?.length) {
      return `
        <div class="block" style="margin:12px 16px 0;">
          <div class="block-head">Мои подборы</div>
          <div style="padding:12px 0;color:var(--muted);font-size:13px;">Подборов пока нет</div>
          <button class="btn-primary btn-sm" data-href="#/c/proposal" style="margin-top:4px;">🛒 Запросить подбор</button>
        </div>`;
    }
    const items = proposals.slice(0, 3).map(p => `
      <div class="assembly-card" style="cursor:pointer;" data-href="#/c/proposal/${escHtml(p.id)}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--ink);">Подбор от ${escHtml(fmtDate(p.created_at))}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">${p.n_categories || 0} категор. · ${p.n_variants || 0} вар.</div>
          </div>
          ${statusChip(p.status)}
        </div>
      </div>`).join("");
    return `
      <div class="block" style="margin:12px 16px 0;">
        <div class="block-head" style="display:flex;justify-content:space-between;">
          <span>Мои подборы</span>
          ${proposals.length > 3 ? `<span style="font-size:12px;color:var(--accent);cursor:pointer;" data-href="#/c/proposal">Все ${proposals.length}</span>` : ""}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;padding-top:4px;">${items}</div>
        <button class="btn-secondary btn-sm" data-href="#/c/proposal" style="margin-top:10px;">🛒 Новый подбор</button>
      </div>`;
  }

  // ── Блок «Сборки» ────────────────────────────────────────────────────────
  function renderAssembliesBlock(assemblies) {
    if (!assemblies?.length) {
      return `
        <div class="block" style="margin:12px 16px 0;">
          <div class="block-head">Мои сборки</div>
          <div style="padding:12px 0;color:var(--muted);font-size:13px;">Сборок пока нет</div>
        </div>`;
    }
    const items = assemblies.slice(0, 3).map(a => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--ink);">${escHtml(a.address || "Адрес не указан")}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">${escHtml(fmtDate(a.scheduled_at || a.ts))}</div>
        </div>
        ${statusChip(a.status)}
      </div>`).join("");
    return `
      <div class="block" style="margin:12px 16px 0;">
        <div class="block-head">Мои сборки</div>
        <div>${items}</div>
        ${assemblies.length > 3 ? `<div style="font-size:12px;color:var(--muted);padding-top:8px;">+${assemblies.length - 3} ещё</div>` : ""}
      </div>`;
  }

  async function mount(container) {
    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    const oldNav = document.getElementById("bottom-nav");
    if (oldNav) oldNav.remove();

    // Header
    const h = document.createElement("header");
    h.className = "podbor-header";
    h.innerHTML = `
      <button class="podbor-back" aria-label="Назад">${(window.ICONS || {}).arrow_left || "‹"}</button>
      <div class="podbor-title">Мой кабинет</div>
      <div style="width:36px"></div>
    `;
    h.querySelector(".podbor-back").addEventListener("click", () => {
      haptic && haptic("impact");
      history.back();
    });
    container.appendChild(h);

    const screen = document.createElement("div");
    screen.className = "podbor-screen";
    screen.innerHTML = `<div class="loader-inline"><div class="spinner"></div></div>`;
    container.appendChild(screen);

    try {
      // Параллельно грузим профиль + подборы + сборки
      const [me, proposalsData, assembliesData] = await Promise.all([
        _api("me"),
        _api("proposal_list").catch(() => ({ proposals: [] })),
        _api("assembly_list").catch(() => ({ assemblies: [] })),
      ]);

      screen.innerHTML = "";

      if (me.error) {
        screen.innerHTML = `<div class="error" style="margin:16px;">${escHtml(me.error)}</div>`;
        return;
      }

      const u = me.user || {};
      const initial = u.avatar_initial || (u.full_name || "К")[0].toUpperCase();

      // Аватар + имя
      screen.innerHTML = `
        <div style="display:flex;align-items:center;gap:14px;padding:20px 16px 8px;">
          <div style="width:52px;height:52px;border-radius:50%;background:var(--accent);
                      display:flex;align-items:center;justify-content:center;
                      font-size:22px;font-weight:700;color:#fff;flex-shrink:0;">
            ${escHtml(initial)}
          </div>
          <div>
            <div style="font-weight:600;font-size:16px;color:var(--ink);">${escHtml(u.full_name || "Клиент")}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">Личный кабинет</div>
          </div>
        </div>
        ${renderManagerBlock(me.manager)}
        ${renderProposalsBlock(proposalsData.proposals || [])}
        ${renderAssembliesBlock(assembliesData.assemblies || [])}
        <div style="height:32px;"></div>
      `;

      // Навигация по data-href
      screen.querySelectorAll("[data-href]").forEach(el => {
        el.addEventListener("click", () => {
          haptic && haptic("impact");
          location.hash = el.dataset.href;
        });
      });

    } catch (e) {
      screen.innerHTML = `<div class="error" style="margin:16px;">Ошибка: ${escHtml(e.message)}</div>`;
    }
  }

  return { mount };
})();
