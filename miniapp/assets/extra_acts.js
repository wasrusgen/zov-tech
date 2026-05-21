// extra_acts.js v=20260521a
const ExtraActs = (function () {
  "use strict";

  function fmt(n) { return Math.round(n||0).toLocaleString("ru-RU") + " ₽"; }
  function fmtDate(iso) { if(!iso) return "—"; const d=iso.slice(0,10).split("-"); return d[2]+"."+d[1]+"."+d[0]; }
  function el(html) { const t=document.createElement("div"); t.innerHTML=html.trim(); return t.firstChild; }
  function showErr(c,msg){ c.innerHTML=`<div style="padding:32px;text-align:center;color:var(--danger)">${msg}</div>`; }

  const STATUS = { draft:"Черновик", agreed:"Согласован", signed:"Подписан", cancelled:"Отменён" };
  const STATUS_BG = { draft:"#eee", agreed:"#CCE5FF", signed:"#D1E7DD", cancelled:"#f8d7da" };
  const STATUS_FG = { draft:"#555", agreed:"#004085", signed:"#0F5132", cancelled:"#721c24" };

  function badge(status) {
    return `<span style="background:${STATUS_BG[status]||'#eee'};color:${STATUS_FG[status]||'#333'};padding:2px 8px;border-radius:6px;font-size:12px;font-weight:600">${STATUS[status]||status}</span>`;
  }

  // ─── LIST ─────────────────────────────────────────────────────────
  async function mount(container, assemblyId) {
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:16px;background:var(--surface);border-bottom:1px solid #eee;position:sticky;top:0;z-index:10">
        <button onclick="history.back()" style="background:none;border:none;font-size:22px;cursor:pointer;padding:0">←</button>
        <span style="font-size:17px;font-weight:700;flex:1">📋 Доп. работы</span>
        <button id="new-act-btn" style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:14px;font-weight:600;cursor:pointer">+ Новый акт</button>
      </div>
      <div id="list-body" style="padding:12px"></div>`;

    container.querySelector("#new-act-btn").addEventListener("click", () => mountCreate(container, assemblyId));

    const body = container.querySelector("#list-body");
    body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">Загрузка…</div>`;

    let data;
    try { data = await _api("/api/extra_acts_list", { assembly_id: assemblyId }); }
    catch(e) { showErr(body, "Ошибка: "+e.message); return; }
    if (data.error) { showErr(body, data.error); return; }

    const acts = data.acts || [];
    if (!acts.length) {
      body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">Нет актов по этой сборке</div>`;
      return;
    }
    body.innerHTML = "";
    acts.forEach(a => {
      const card = el(`<div style="background:var(--surface);border-radius:var(--radius);padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,.07)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:600;font-size:15px">${fmt(parseFloat(a.total_amount||0))}</span>
          ${badge(a.status)}
        </div>
        <div style="font-size:13px;color:var(--muted)">${a.items_count} позиций · ${fmtDate(a.created_at)}</div>
        ${a.signed_by_name ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">Подписал: ${a.signed_by_name} · ${fmtDate(a.signed_at)}</div>` : ""}
        ${a.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:4px;font-style:italic">${a.notes}</div>` : ""}
      </div>`);
      body.appendChild(card);
    });
  }

  // ─── CREATE ───────────────────────────────────────────────────────
  async function mountCreate(container, assemblyId) {
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:16px;background:var(--surface);border-bottom:1px solid #eee;position:sticky;top:0;z-index:10">
        <button id="back-btn" style="background:none;border:none;font-size:22px;cursor:pointer;padding:0">←</button>
        <span style="font-size:17px;font-weight:700">➕ Новый акт</span>
      </div>
      <div id="catalog-body" style="padding:12px;padding-bottom:180px"></div>
      <div id="basket-panel" style="position:fixed;bottom:0;left:0;right:0;max-width:600px;margin:0 auto;background:var(--surface);border-top:2px solid var(--accent);padding:12px 16px;z-index:20;box-shadow:0 -2px 12px rgba(0,0,0,.1)"></div>`;

    container.querySelector("#back-btn").addEventListener("click", () => mount(container, assemblyId));

    const catalogBody = container.querySelector("#catalog-body");
    const basketPanel = container.querySelector("#basket-panel");

    // Basket state
    const basket = {}; // id -> {item, qty}
    const updateBasket = () => _renderBasket(basketPanel, basket, assemblyId, container);
    updateBasket();

    catalogBody.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">Загрузка каталога…</div>`;

    let pb;
    try { pb = await _api("/api/pricebook_list", {}); }
    catch(e) { showErr(catalogBody, "Ошибка: "+e.message); return; }
    if (pb.error) { showErr(catalogBody, pb.error); return; }

    catalogBody.innerHTML = "";
    _renderSection(catalogBody, "Прайс компании", pb.company||[], basket, updateBasket);
    _renderSection(catalogBody, "Мой прайс (ИП)", pb.personal||[], basket, updateBasket);
  }

  function _renderSection(parent, title, items, basket, updateBasket) {
    if (!items.length) return;

    const section = el(`<div style="margin-bottom:16px">
      <div style="font-size:14px;font-weight:700;color:var(--accent);padding:8px 0;border-bottom:2px solid var(--accent);margin-bottom:8px">${title}</div>
    </div>`);

    // Group by category
    const cats = {};
    items.forEach(it => { (cats[it.category] = cats[it.category]||[]).push(it); });

    Object.entries(cats).forEach(([cat, catItems]) => {
      const catWrap = el(`<div style="margin-bottom:8px">`);
      const catHead = el(`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#f0f4ff;border-radius:8px;cursor:pointer;margin-bottom:4px">
        <span style="font-size:13px;font-weight:600;color:var(--text)">${cat}</span>
        <span class="cat-arrow" style="font-size:14px;color:var(--muted)">▼</span>
      </div>`);
      const catList = el(`<div class="cat-list" style="display:none">`);

      catHead.addEventListener("click", () => {
        const shown = catList.style.display !== "none";
        catList.style.display = shown ? "none" : "block";
        catHead.querySelector(".cat-arrow").textContent = shown ? "▼" : "▲";
      });

      catItems.forEach(item => {
        const row = el(`<div style="display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid #f0f0f0">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;color:var(--text);line-height:1.3">${item.name}</div>
            <div style="font-size:11px;color:var(--muted)">${item.unit} · ${fmt(item.price)}</div>
          </div>
          <button data-id="${item.id}" style="background:var(--accent);color:#fff;border:none;border-radius:6px;width:30px;height:30px;font-size:18px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;line-height:1">+</button>
        </div>`);
        row.querySelector("button").addEventListener("click", () => {
          if (basket[item.id]) {
            basket[item.id].qty++;
          } else {
            basket[item.id] = { item, qty: 1 };
          }
          haptic && haptic("impact");
          // Flash button
          const btn = row.querySelector("button");
          btn.style.background = "#4CAF50";
          setTimeout(() => { btn.style.background = "var(--accent)"; }, 200);
          updateBasket();
        });
        catList.appendChild(row);
      });

      catWrap.appendChild(catHead);
      catWrap.appendChild(catList);
      section.appendChild(catWrap);
    });
    parent.appendChild(section);
  }

  function _renderBasket(panel, basket, assemblyId, container) {
    const entries = Object.values(basket).filter(e => e.qty > 0);
    const total = entries.reduce((s, e) => s + e.item.price * e.qty, 0);

    if (!entries.length) {
      panel.innerHTML = `<div style="color:var(--muted);font-size:13px;text-align:center;padding:4px 0">Добавьте позиции из каталога</div>`;
      return;
    }

    panel.innerHTML = "";

    // Items compact list (max 3 visible)
    const listWrap = el(`<div style="max-height:80px;overflow-y:auto;margin-bottom:8px">`);
    entries.forEach(({ item, qty }) => {
      const row = el(`<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:13px">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.name}</span>
        <button data-id="${item.id}" class="qty-minus" style="background:#eee;border:none;border-radius:4px;width:22px;height:22px;cursor:pointer;font-size:14px">−</button>
        <span style="min-width:16px;text-align:center">${qty}</span>
        <button data-id="${item.id}" class="qty-plus" style="background:#eee;border:none;border-radius:4px;width:22px;height:22px;cursor:pointer;font-size:14px">+</button>
        <span style="min-width:60px;text-align:right;color:var(--accent);font-weight:600">${fmt(item.price*qty)}</span>
        <button data-id="${item.id}" class="qty-del" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--muted)">×</button>
      </div>`);
      row.querySelector(".qty-minus").addEventListener("click", () => {
        basket[item.id].qty = Math.max(0, basket[item.id].qty - 1);
        if (basket[item.id].qty === 0) delete basket[item.id];
        _renderBasket(panel, basket, assemblyId, container);
      });
      row.querySelector(".qty-plus").addEventListener("click", () => {
        basket[item.id].qty++; _renderBasket(panel, basket, assemblyId, container);
      });
      row.querySelector(".qty-del").addEventListener("click", () => {
        delete basket[item.id]; _renderBasket(panel, basket, assemblyId, container);
      });
      listWrap.appendChild(row);
    });
    panel.appendChild(listWrap);

    // Textarea note
    const noteArea = el(`<textarea id="act-notes" placeholder="Примечание (необязательно)" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;font-size:13px;resize:none;height:40px;box-sizing:border-box;margin-bottom:8px;font-family:inherit"></textarea>`);
    panel.appendChild(noteArea);

    // Total + button
    const foot = el(`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
      <div style="font-size:16px;font-weight:700;color:var(--accent)">${fmt(total)}</div>
      <button id="act-submit" style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:15px;font-weight:600;cursor:pointer">Оформить акт →</button>
    </div>`);
    foot.querySelector("#act-submit").addEventListener("click", async () => {
      const notes = panel.querySelector("#act-notes")?.value || "";
      const items = Object.values(basket).map(({ item, qty }) => ({
        id: item.id, name: item.name, unit: item.unit,
        price: item.price, qty, total: item.price * qty,
        category: item.category, source: item.source
      }));
      haptic && haptic("impact");
      const btn = foot.querySelector("#act-submit");
      btn.disabled = true; btn.textContent = "Сохраняем…";
      let res;
      try { res = await _api("/api/extra_act_save", { assembly_id: assemblyId, items, notes }); }
      catch(e) { alert("Ошибка: "+e.message); btn.disabled=false; btn.textContent="Оформить акт →"; return; }
      if (res.error) { alert(res.error); btn.disabled=false; btn.textContent="Оформить акт →"; return; }
      _mountSign(container, res.act_id, assemblyId, res.total, items.length);
    });
    panel.appendChild(foot);
  }

  // ─── SIGN ─────────────────────────────────────────────────────────
  function _mountSign(container, actId, assemblyId, total, itemCount) {
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:16px;background:var(--surface);border-bottom:1px solid #eee;position:sticky;top:0;z-index:10">
        <button onclick="history.back()" style="background:none;border:none;font-size:22px;cursor:pointer;padding:0">←</button>
        <span style="font-size:17px;font-weight:700">Подписать акт</span>
      </div>
      <div style="padding:16px">
        <div style="background:var(--surface);border-radius:var(--radius);padding:20px;text-align:center;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.07)">
          <div style="font-size:13px;color:var(--muted);margin-bottom:4px">${itemCount} позиций</div>
          <div style="font-size:28px;font-weight:700;color:var(--accent)">${fmt(total)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">Акт № ${actId}</div>
        </div>

        <div style="display:flex;gap:0;margin-bottom:16px;border-radius:var(--radius);overflow:hidden;border:1px solid #ddd">
          <button id="tab-canvas" class="sign-tab" style="flex:1;padding:10px;background:var(--accent);color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer">✍️ Подпись</button>
          <button id="tab-draft" class="sign-tab" style="flex:1;padding:10px;background:var(--surface);color:var(--text);border:none;font-size:14px;cursor:pointer">💾 Черновик</button>
        </div>

        <div id="panel-canvas">
          <canvas id="sign-canvas" style="width:100%;height:160px;border:2px solid #ddd;border-radius:var(--radius);touch-action:none;background:#fff;display:block"></canvas>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button id="clear-btn" style="flex:1;padding:10px;background:#eee;border:none;border-radius:8px;font-size:14px;cursor:pointer">Очистить</button>
            <button id="sign-btn" style="flex:2;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">Подписать акт</button>
          </div>
        </div>

        <div id="panel-draft" style="display:none">
          <div style="color:var(--muted);font-size:13px;text-align:center;padding:16px">Акт будет сохранён как черновик. Подпись можно добавить позже.</div>
          <button id="draft-btn" style="width:100%;padding:12px;background:#eee;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">Сохранить черновик</button>
        </div>

        <div id="sign-result" style="display:none"></div>
      </div>`;

    // Tabs
    container.querySelector("#tab-canvas").addEventListener("click", () => {
      container.querySelector("#panel-canvas").style.display = "block";
      container.querySelector("#panel-draft").style.display  = "none";
      container.querySelector("#tab-canvas").style.background = "var(--accent)";
      container.querySelector("#tab-canvas").style.color = "#fff";
      container.querySelector("#tab-draft").style.background  = "var(--surface)";
      container.querySelector("#tab-draft").style.color = "var(--text)";
    });
    container.querySelector("#tab-draft").addEventListener("click", () => {
      container.querySelector("#panel-canvas").style.display = "none";
      container.querySelector("#panel-draft").style.display  = "block";
      container.querySelector("#tab-draft").style.background = "var(--accent)";
      container.querySelector("#tab-draft").style.color = "#fff";
      container.querySelector("#tab-canvas").style.background = "var(--surface)";
      container.querySelector("#tab-canvas").style.color = "var(--text)";
    });

    // Canvas setup
    const canvas = container.querySelector("#sign-canvas");
    const dpr = window.devicePixelRatio || 1;
    setTimeout(() => {
      const w = canvas.offsetWidth; const h = canvas.offsetHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = "#212121"; ctx.lineWidth = 2.5;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      let drawing = false;

      const pos = (e) => {
        const r = canvas.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return { x: (src.clientX - r.left), y: (src.clientY - r.top) };
      };
      canvas.addEventListener("pointerdown", e => { drawing=true; ctx.beginPath(); const p=pos(e); ctx.moveTo(p.x,p.y); e.preventDefault(); });
      canvas.addEventListener("pointermove", e => { if(!drawing) return; const p=pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); e.preventDefault(); });
      canvas.addEventListener("pointerup", () => { drawing=false; });
      canvas.addEventListener("pointerleave", () => { drawing=false; });
    }, 50);

    container.querySelector("#clear-btn").addEventListener("click", () => {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    const _doSign = async (via, b64) => {
      haptic && haptic("impact");
      let res;
      try { res = await _api("/api/extra_act_sign", { act_id: actId, signed_via: via, signature_b64: b64 }); }
      catch(e) { alert("Ошибка: "+e.message); return; }
      if (res.error) { alert(res.error); return; }
      _showSuccess(container, actId, assemblyId, total, via === "canvas");
    };

    container.querySelector("#sign-btn").addEventListener("click", () => {
      _doSign("canvas", canvas.toDataURL("image/png"));
    });
    container.querySelector("#draft-btn").addEventListener("click", () => {
      mount(container, assemblyId);
    });
  }

  function _showSuccess(container, actId, assemblyId, total, signed) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:32px;text-align:center">
        <div style="font-size:56px;margin-bottom:16px">${signed ? "✅" : "💾"}</div>
        <div style="font-size:20px;font-weight:700;margin-bottom:8px">${signed ? "Акт подписан" : "Черновик сохранён"}</div>
        <div style="font-size:24px;font-weight:700;color:var(--accent);margin-bottom:24px">${fmt(total)}</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:32px">Акт № ${actId}</div>
        <button onclick="history.back()" style="padding:14px 32px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer">← Назад</button>
      </div>`;
  }

  return { mount, mountCreate };
})();
