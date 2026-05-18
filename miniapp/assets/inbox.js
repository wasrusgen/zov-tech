/* ============================================================
   Входящие задачи менеджера — #/inbox
   Замеры завершены, решение по подбору не принято.
   ============================================================ */

const InboxScreen = (function () {

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

  async function _api(path, body) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(`${BACKEND_URL}/api/${path}`, {
        method: "POST", signal: ctrl.signal,
        body: JSON.stringify({ initData: tg?.initData || "", initDataUnsafe: tg?.initDataUnsafe || null, ...body }),
      });
      return await res.json();
    } catch (e) {
      if (e.name === "AbortError") throw new Error("Сервер не отвечает");
      throw e;
    } finally { clearTimeout(t); }
  }

  function renderCard(item, listEl) {
    const isLater = item.decision === "later";
    const card = document.createElement("article");
    card.className = "assembly-card";
    card.style.cssText = "position:relative;";
    card.innerHTML = `
      <div class="assembly-card-head">
        <span class="assembly-card-status">${isLater ? "🔁 Отложено" : "📐 Замер завершён"}</span>
        <span class="assembly-card-date">${escHtml(fmtDate(item.ts))}</span>
      </div>
      <div class="assembly-card-name">${escHtml(item.client_name || "Без имени")}</div>
      ${item.address ? `<div class="assembly-card-address">${escHtml(item.address)}</div>` : ""}
      <div class="inbox-card-actions" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
        <button class="btn-primary btn-sm" data-action="podbor">🛒 Начать подбор</button>
        <button class="btn-secondary btn-sm" data-action="later"  ${isLater ? "style='opacity:.4;pointer-events:none;'" : ""}>⏳ Отложить</button>
        <button class="btn-secondary btn-sm" data-action="skip">✗ Не нужен</button>
      </div>
      <div class="inbox-card-result" style="margin-top:6px;font-size:13px;"></div>
    `;

    const resultEl = card.querySelector(".inbox-card-result");

    async function decide(decision) {
      const btns = card.querySelectorAll("button");
      btns.forEach(b => { b.disabled = true; });
      resultEl.textContent = "Сохраняем…";
      try {
        const data = await _api("measurement_decision", { measurement_id: item.id, decision });
        if (data.error) {
          resultEl.textContent = "Ошибка: " + data.error;
          btns.forEach(b => { b.disabled = false; });
        } else {
          haptic && haptic("success");
          card.style.transition = "opacity .3s";
          card.style.opacity = "0";
          setTimeout(() => {
            card.remove();
            if (!listEl.querySelector("article")) {
              listEl.innerHTML = `<div class="empty" style="padding:32px;text-align:center;color:var(--muted);">Входящих задач нет 🎉</div>`;
            }
          }, 300);
        }
      } catch (e) {
        resultEl.textContent = e.message;
        btns.forEach(b => { b.disabled = false; });
      }
    }

    card.querySelector("[data-action='podbor']").addEventListener("click", async () => {
      haptic && haptic("impact");
      await decide("needed");
      sessionStorage.setItem("prefillClient", JSON.stringify({
        name: item.client_name,
        phone: item.client_phone,
        measurement_id: item.id,
      }));
      location.hash = "#/podbor";
    });

    card.querySelector("[data-action='later']").addEventListener("click", () => {
      haptic && haptic("impact");
      decide("later");
    });

    card.querySelector("[data-action='skip']").addEventListener("click", () => {
      haptic && haptic("impact");
      decide("not_needed");
    });

    return card;
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
      <div class="podbor-title">Входящие</div>
      <div style="width:36px"></div>
    `;
    h.querySelector(".podbor-back").addEventListener("click", () => {
      haptic && haptic("impact");
      history.back();
    });
    container.appendChild(h);

    const screen = document.createElement("div");
    screen.className = "podbor-screen";
    container.appendChild(screen);

    const loading = document.createElement("div");
    loading.className = "loader-inline";
    loading.innerHTML = `<div class="spinner"></div>`;
    screen.appendChild(loading);

    try {
      const data = await _api("manager_pending", {});
      loading.remove();

      if (data.error) {
        screen.innerHTML = `<div class="error" style="margin:16px;">${escHtml(data.error)}</div>`;
        return;
      }

      const items = data.pending || [];
      if (!items.length) {
        screen.innerHTML = `<div class="empty" style="padding:48px 16px;text-align:center;color:var(--muted);">Входящих задач нет 🎉</div>`;
        return;
      }

      const count = document.createElement("div");
      count.style.cssText = "padding:10px 16px 4px;font-size:13px;color:var(--muted);";
      count.textContent = `${items.length} ${items.length === 1 ? "задача" : items.length < 5 ? "задачи" : "задач"}`;
      screen.appendChild(count);

      const list = document.createElement("div");
      list.style.cssText = "padding:0 16px 24px;display:flex;flex-direction:column;gap:10px;";
      items.forEach(item => list.appendChild(renderCard(item, list)));
      screen.appendChild(list);

    } catch (e) {
      loading.remove();
      screen.innerHTML = `<div class="error" style="margin:16px;">Ошибка: ${escHtml(e.message)}</div>`;
    }
  }

  return { mount };
})();
