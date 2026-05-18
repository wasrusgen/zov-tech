/* ============================================================
   Подбор техники — цикл согласования (Proposals)
   Клиент: brief → просмотр вариантов → голосование
   Менеджер: создание → добавление вариантов → отправка
   ============================================================ */

const Proposals = (function () {

  // ── Internal helpers ──────────────────────────────────────

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escAttr(s) { return escHtml(s); }

  function authBody() {
    return { initData: tg?.initData || "", initDataUnsafe: tg?.initDataUnsafe || null };
  }

  async function apiFetch(path, extra = {}, timeoutMs = 15000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${BACKEND_URL}/api/${path}`, {
        method: "POST",
        signal: ctrl.signal,
        body: JSON.stringify({ ...authBody(), ...extra }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    } catch (e) {
      if (e.name === "AbortError") throw new Error("Сервер не отвечает — попробуйте ещё раз");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Constants ─────────────────────────────────────────────

  const CAT_LABELS = {
    hob:         "Варочная панель",
    oven:        "Духовой шкаф",
    dishwasher:  "Посудомойка",
    hood:        "Вытяжка",
    fridge:      "Холодильник",
    microwave:   "Микроволновка",
    other:       "Другое",
  };

  const STATUS_LABELS = {
    brief:    "Анкета принята",
    draft:    "Подборка готовится",
    sent:     "Ожидает вашего ответа",
    reviewed: "Ответ отправлен",
    done:     "Завершено",
  };

  const STATUS_LABELS_MGR = {
    brief:    "📋 Анкета клиента",
    draft:    "✏️ Черновик",
    sent:     "📨 Отправлено клиенту",
    reviewed: "📬 Клиент ответил",
    done:     "✅ Завершено",
  };

  const MANAGER_CATEGORIES = [
    { key: "hob",        label: "Варочная панель" },
    { key: "oven",       label: "Духовой шкаф" },
    { key: "dishwasher", label: "Посудомойка" },
    { key: "hood",       label: "Вытяжка" },
    { key: "fridge",     label: "Холодильник" },
    { key: "microwave",  label: "Микроволновка" },
    { key: "other",      label: "Другое" },
  ];

  // ── Plural helper ─────────────────────────────────────────

  function pluralVariants(n) {
    if (n % 10 === 1 && n % 100 !== 11) return "вариант";
    if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return "варианта";
    return "вариантов";
  }

  // ── Radio chips ───────────────────────────────────────────

  function radioChips(name, opts, selected) {
    return opts.map(o => {
      const [val, lbl] = o.split(":");
      return `<button class="prop-chip ${val === selected ? "on" : ""}" data-name="${escAttr(name)}" data-val="${escAttr(val)}" type="button">${escHtml(lbl)}</button>`;
    }).join("");
  }

  function setupRadioChips(container) {
    container.querySelectorAll(".prop-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.name;
        container.querySelectorAll(`.prop-chip[data-name="${name}"]`).forEach(b => b.classList.remove("on"));
        btn.classList.add("on");
        haptic && haptic("selection");
      });
    });
  }

  function getRadio(container, name) {
    const active = container.querySelector(`.prop-chip[data-name="${name}"].on`);
    return active ? active.dataset.val : null;
  }

  // ── Brief summary renderer (for manager view) ─────────────

  function renderBriefSummary(brief) {
    const hobMap  = { induction: "Индукция", gas: "Газ", electric: "Электро", none: "Не нужна" };
    const hoodMap = { builtin: "Встройка", dome: "Купол", none: "Не нужна" };
    const rows = [];
    if (brief.hob) rows.push(["Варочная", hobMap[brief.hob] || brief.hob]);
    if (brief.oven === "yes") rows.push(["Духовка", "Нужна"]);
    if (brief.dishwasher && brief.dishwasher !== "none") rows.push(["Посудомойка", brief.dishwasher + " см"]);
    if (brief.hood && brief.hood !== "none") rows.push(["Вытяжка", hoodMap[brief.hood] || brief.hood]);
    if (brief.fridge === "yes") rows.push(["Холодильник", "Нужен"]);
    if (brief.microwave === "yes") rows.push(["Микроволновка", "Нужна"]);
    if (brief.budget) rows.push(["Бюджет", Number(brief.budget).toLocaleString("ru-RU") + " ₽"]);
    if (brief.notes) rows.push(["Пожелания", brief.notes]);
    if (!rows.length) return `<p class="prop-muted">Анкета пустая</p>`;
    return `<div class="brief-rows">${rows.map(([k, v]) =>
      `<div class="brief-row"><span class="brief-key">${escHtml(k)}</span><span class="brief-val">${escHtml(String(v))}</span></div>`
    ).join("")}</div>`;
  }

  // ── Votes summary for manager ─────────────────────────────

  function renderVotesSummary(positions) {
    const yes = [], no = [];
    for (const cat of (positions || [])) {
      for (const v of (cat.variants || [])) {
        const label = `${cat.label || CAT_LABELS[cat.category] || cat.category}: ${v.model || "—"}`;
        if (v.client_vote === "yes") yes.push(label);
        else if (v.client_vote === "no") no.push(label);
      }
    }
    if (!yes.length && !no.length) return `<p class="prop-muted">Клиент ещё не голосовал</p>`;
    let html = "";
    if (yes.length) html += `<div class="vote-group"><div class="vote-group-head yes">✅ Нравится (${yes.length})</div>${yes.map(l => `<div class="vote-item">${escHtml(l)}</div>`).join("")}</div>`;
    if (no.length)  html += `<div class="vote-group"><div class="vote-group-head no">❌ Не подходит (${no.length})</div>${no.map(l => `<div class="vote-item">${escHtml(l)}</div>`).join("")}</div>`;
    return html;
  }

  // ── Source badge ──────────────────────────────────────────

  const SOURCE_LABELS = { dns: "DNS", wb: "WB", ozon: "Ozon", citilink: "Ситилинк", yamarket: "Яндекс" };

  function sourceBadge(src) {
    if (!src) return "";
    return `<span class="prop-source-badge ${escAttr(src)}">${escHtml(SOURCE_LABELS[src] || src.toUpperCase())}</span>`;
  }

  // ══════════════════════════════════════════════════════════
  // CLIENT FLOW
  // ══════════════════════════════════════════════════════════

  async function mountClient(container) {
    container.innerHTML = `<div class="loader-inline"><div class="spinner"></div></div>`;
    try {
      const data = await apiFetch("proposal_list");
      const proposals = (data.proposals || []);
      const active = proposals.find(p =>
        ["brief", "draft", "sent", "reviewed"].includes(p.status)
      );
      if (!active) {
        showClientBriefForm(container, null);
        return;
      }
      if (active.status === "brief" || active.status === "draft") {
        showClientWaiting(container, active);
        return;
      }
      // sent or reviewed — load full detail
      const detail = await apiFetch("proposal_detail", { proposal_id: active.id });
      if (detail.ok) {
        showClientProposal(container, detail.proposal);
      } else {
        showClientWaiting(container, active);
      }
    } catch (e) {
      container.innerHTML = `<div class="error">Не удалось загрузить: ${escHtml(e.message)}</div>`;
    }
  }

  // ── Client: brief form ────────────────────────────────────

  function showClientBriefForm(container, prefill) {
    const p = prefill || {};
    container.innerHTML = "";

    container.appendChild(el(`
      <header class="podbor-header">
        <button class="podbor-back" aria-label="Назад">${(typeof ICONS !== "undefined" && ICONS.arrow_left) || "‹"}</button>
        <div class="podbor-title">ПОДБОР ТЕХНИКИ</div>
        <div style="width:28px"></div>
      </header>
    `));
    container.querySelector(".podbor-back").addEventListener("click", () => {
      history.back();
    });

    const form = el(`
      <section class="podbor-step">
        <h2 class="display-title">Расскажите,<br><span class="accent">что нужно?</span></h2>
        <p class="lede">Ответьте — менеджер подберёт технику под ваш бюджет и кухню.</p>

        <div class="prop-field-group">
          <div class="prop-field-label">Варочная панель</div>
          <div class="prop-chips-row">
            ${radioChips("hob", ["none:Не нужна","induction:Индукция","gas:Газ","electric:Электро"], p.hob || "none")}
          </div>
        </div>

        <div class="prop-field-group">
          <div class="prop-field-label">Духовой шкаф</div>
          <div class="prop-chips-row">
            ${radioChips("oven", ["no:Не нужен","yes:Нужен"], p.oven || "no")}
          </div>
        </div>

        <div class="prop-field-group">
          <div class="prop-field-label">Посудомойка</div>
          <div class="prop-chips-row">
            ${radioChips("dw", ["none:Не нужна","45:45 см","60:60 см"], p.dishwasher || "none")}
          </div>
        </div>

        <div class="prop-field-group">
          <div class="prop-field-label">Вытяжка</div>
          <div class="prop-chips-row">
            ${radioChips("hood", ["none:Не нужна","builtin:Встройка","dome:Купол"], p.hood || "none")}
          </div>
        </div>

        <div class="prop-field-group">
          <div class="prop-field-label">Холодильник</div>
          <div class="prop-chips-row">
            ${radioChips("fridge_need", ["no:Не нужен","yes:Нужен"], p.fridge || "no")}
          </div>
        </div>

        <div class="prop-field-group">
          <div class="prop-field-label">Микроволновка</div>
          <div class="prop-chips-row">
            ${radioChips("micro_need", ["no:Не нужна","yes:Нужна"], p.microwave || "no")}
          </div>
        </div>

        <div class="prop-field-group">
          <div class="prop-field-label">Бюджет на технику</div>
          <label class="field">
            <input type="number" id="bf_budget" placeholder="например 120 000" inputmode="numeric"
                   min="0" step="1000" value="${escAttr(String(p.budget || ""))}">
            <span class="field-hint">Необязательно — только ориентир для менеджера</span>
          </label>
        </div>

        <div class="prop-field-group">
          <div class="prop-field-label">Пожелания</div>
          <label class="field">
            <textarea id="bf_notes" rows="3" placeholder="Любим Bosch, хотелось бы паровой режим, потолок низкий…">${escHtml(p.notes || "")}</textarea>
          </label>
        </div>

        <div class="podbor-cta-row" style="margin-top:24px;">
          <button class="btn-primary" id="bf_submit" type="button">Отправить менеджеру</button>
        </div>
        <div id="bf_result" class="submit-result"></div>
      </section>
    `);
    container.appendChild(form);
    setupRadioChips(container);

    container.querySelector("#bf_submit").addEventListener("click", async () => {
      const btn    = container.querySelector("#bf_submit");
      const result = container.querySelector("#bf_result");
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-inline"></span>Отправляем…`;

      try {
        const data = await apiFetch("proposal_brief", {
          hob:        getRadio(container, "hob") || "none",
          oven:       getRadio(container, "oven") || "no",
          dishwasher: getRadio(container, "dw") || "none",
          hood:       getRadio(container, "hood") || "none",
          fridge:     getRadio(container, "fridge_need") || "no",
          microwave:  getRadio(container, "micro_need") || "no",
          budget:     container.querySelector("#bf_budget")?.value || "",
          notes:      container.querySelector("#bf_notes")?.value || "",
        });
        if (data.error) {
          result.innerHTML = `<div class="error">Ошибка: ${escHtml(data.error)}</div>`;
          btn.disabled = false; btn.textContent = "Отправить менеджеру";
          return;
        }
        haptic && haptic("success");
        showClientWaiting(container, { status: "brief" });
      } catch (e) {
        result.innerHTML = `<div class="error">Сеть: ${escHtml(e.message)}</div>`;
        btn.disabled = false; btn.textContent = "Отправить менеджеру";
      }
    });
  }

  // ── Client: waiting screen ────────────────────────────────

  function showClientWaiting(container, proposal) {
    container.innerHTML = "";
    container.appendChild(el(`
      <div class="prop-waiting">
        <div class="prop-waiting-icon">📋</div>
        <h2 class="prop-waiting-title">Анкета принята!</h2>
        <p class="prop-waiting-text">
          Менеджер подбирает варианты техники.<br>
          Как только подборка будет готова — придёт уведомление в бот.
        </p>
        <div class="prop-status-badge ${escAttr(proposal?.status || "")}">${escHtml(STATUS_LABELS[proposal?.status] || "В работе")}</div>
        <button class="btn-secondary" id="editBriefBtn" type="button" style="margin-top:20px;max-width:240px;">
          Изменить анкету
        </button>
      </div>
    `));
    container.querySelector("#editBriefBtn")?.addEventListener("click", () => {
      showClientBriefForm(container, null);
    });
  }

  // ── Client: proposal view (voting) ───────────────────────

  function showClientProposal(container, proposal) {
    container.innerHTML = "";
    const positions  = proposal.positions || [];
    const isReviewed = proposal.status === "reviewed";

    container.appendChild(el(`
      <header class="podbor-header">
        <div style="width:28px"></div>
        <div class="podbor-title">ПОДБОР ТЕХНИКИ</div>
        <span class="prop-status-chip ${escAttr(proposal.status)}">${escHtml(STATUS_LABELS[proposal.status] || proposal.status)}</span>
      </header>
    `));

    if (!positions.length) {
      container.appendChild(el(`<div class="empty">Вариантов пока нет.</div>`));
      return;
    }

    const catsWrap = el(`<div class="prop-cats"></div>`);
    for (const cat of positions) {
      catsWrap.appendChild(renderClientCategoryBlock(cat, proposal.id, isReviewed));
    }
    container.appendChild(catsWrap);

    if (!isReviewed) {
      const submitSection = el(`
        <section class="podbor-step" style="margin-top:24px;">
          <h3 class="display-title" style="font-size:20px;">Оставьте<br><span class="accent">комментарий</span></h3>
          <p class="lede">Нажмите ✅/❌ на каждый вариант и напишите, что понравилось — или нет.</p>
          <label class="field">
            <textarea id="cl_comment" rows="3" placeholder="Нравится вариант 1, хотелось бы посмотреть ещё что-нибудь в этом бюджете…"></textarea>
          </label>
          <div class="podbor-cta-row" style="margin-top:12px;">
            <button class="btn-primary" id="cl_submit" type="button">Отправить ответ менеджеру</button>
          </div>
          <div id="cl_result" class="submit-result"></div>
        </section>
      `);
      container.appendChild(submitSection);

      container.querySelector("#cl_submit")?.addEventListener("click", async () => {
        const btn    = container.querySelector("#cl_submit");
        const result = container.querySelector("#cl_result");
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-inline"></span>Отправляем…`;
        try {
          const data = await apiFetch("proposal_client_submit", {
            proposal_id: proposal.id,
            comment: container.querySelector("#cl_comment")?.value || "",
          });
          if (data.error) {
            result.innerHTML = `<div class="error">Ошибка: ${escHtml(data.error)}</div>`;
            btn.disabled = false; btn.textContent = "Отправить ответ менеджеру";
            return;
          }
          haptic && haptic("success");
          result.innerHTML = `
            <div class="success">
              <div class="success-icon">✓</div>
              <div>
                <div class="success-title">Ответ отправлен!</div>
                <div class="success-sub">Менеджер получил уведомление</div>
              </div>
            </div>`;
          submitSection.querySelector("textarea, .podbor-cta-row")?.remove();
          const statusChip = container.querySelector(".prop-status-chip");
          if (statusChip) { statusChip.textContent = STATUS_LABELS.reviewed; statusChip.className = "prop-status-chip reviewed"; }
        } catch (e) {
          result.innerHTML = `<div class="error">Сеть: ${escHtml(e.message)}</div>`;
          btn.disabled = false; btn.textContent = "Отправить ответ менеджеру";
        }
      });
    } else {
      container.appendChild(el(`
        <div class="prop-reviewed-note">
          ✅ Вы уже отправили ответ менеджеру. Ожидайте подтверждения.
          ${proposal.client_comment ? `<div class="prop-reviewed-comment">«${escHtml(proposal.client_comment)}»</div>` : ""}
        </div>
      `));
    }
  }

  // ── Client: category block ────────────────────────────────

  function renderClientCategoryBlock(cat, proposalId, isReviewed) {
    const label    = cat.label || CAT_LABELS[cat.category] || cat.category;
    const variants = cat.variants || [];
    const block = el(`
      <div class="prop-cat-block">
        <div class="prop-cat-head">
          <span class="prop-cat-label">${escHtml(label)}</span>
          <span class="prop-cat-count">${variants.length} ${pluralVariants(variants.length)}</span>
        </div>
        <div class="prop-variants-list"></div>
      </div>
    `);
    const varList = block.querySelector(".prop-variants-list");
    variants.forEach(v => varList.appendChild(renderClientVariantCard(v, proposalId, cat.category, isReviewed)));
    return block;
  }

  // ── Client: variant card ──────────────────────────────────

  function renderClientVariantCard(v, proposalId, category, isReviewed) {
    const priceStr = v.price ? `${Number(v.price).toLocaleString("ru-RU")} ₽` : "";
    const vote     = v.client_vote;
    const card = el(`
      <div class="prop-variant-card ${vote === "yes" ? "voted-yes" : vote === "no" ? "voted-no" : ""}">
        ${v.image_url
          ? `<div class="prop-variant-img"><img src="${escAttr(v.image_url)}" alt="" loading="lazy"></div>`
          : `<div class="prop-variant-img placeholder"></div>`}
        <div class="prop-variant-body">
          <div class="prop-variant-name">${escHtml(v.model || "—")}</div>
          ${priceStr     ? `<div class="prop-variant-price">${escHtml(priceStr)}</div>` : ""}
          ${sourceBadge(v.source)}
          ${v.manager_comment ? `<div class="prop-variant-mgr-note">💬 ${escHtml(v.manager_comment)}</div>` : ""}
          ${v.url ? `<a class="prop-variant-link" href="${escAttr(v.url)}" target="_blank" rel="noopener noreferrer">Смотреть →</a>` : ""}
          ${isReviewed
            ? `<div class="prop-vote-result">${vote === "yes" ? "✅ Выбрано" : vote === "no" ? "❌ Отклонено" : "— Без оценки"}</div>`
            : `<div class="prop-vote-row">
                 <button class="prop-vote-btn yes ${vote === "yes" ? "active" : ""}" data-vote="yes" type="button">✅ Нравится</button>
                 <button class="prop-vote-btn no  ${vote === "no"  ? "active" : ""}" data-vote="no"  type="button">❌ Не то</button>
               </div>`
          }
        </div>
      </div>
    `);

    if (!isReviewed) {
      card.querySelectorAll(".prop-vote-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const newVote   = btn.dataset.vote;
          const finalVote = (v.client_vote === newVote) ? null : newVote;
          try {
            const data = await apiFetch("proposal_vote", {
              proposal_id: proposalId, category, variant_id: v.id, vote: finalVote,
            });
            if (data.ok) {
              haptic && haptic("impact");
              v.client_vote = finalVote;
              card.className = `prop-variant-card ${finalVote === "yes" ? "voted-yes" : finalVote === "no" ? "voted-no" : ""}`;
              card.querySelectorAll(".prop-vote-btn").forEach(b => b.classList.remove("active"));
              if (finalVote) card.querySelector(`.prop-vote-btn[data-vote="${finalVote}"]`)?.classList.add("active");
            }
          } catch (_) {}
        });
      });
    }
    return card;
  }

  // ══════════════════════════════════════════════════════════
  // MANAGER FLOW
  // ══════════════════════════════════════════════════════════

  async function mountManager(container, clientKey, clientTgId) {
    container.innerHTML = `<div class="loader-inline"><div class="spinner"></div></div>`;
    try {
      const data = await apiFetch("proposal_list");
      const proposals = (data.proposals || []).filter(p => p.client_key === clientKey);
      const active = proposals.find(p =>
        ["brief", "draft", "sent", "reviewed"].includes(p.status)
      );

      if (!active) {
        renderManagerEmpty(container, clientKey, clientTgId);
        return;
      }
      const detail = await apiFetch("proposal_detail", { proposal_id: active.id });
      if (detail.ok) {
        renderManagerEditor(container, detail.proposal, clientKey);
      } else {
        renderManagerEmpty(container, clientKey, clientTgId);
      }
    } catch (e) {
      container.innerHTML = `<div class="error">Ошибка: ${escHtml(e.message)}</div>`;
    }
  }

  // ── Manager: empty state ──────────────────────────────────

  function renderManagerEmpty(container, clientKey, clientTgId) {
    container.innerHTML = "";
    container.appendChild(el(`
      <div class="prop-mgr-empty">
        <p class="lede">Подборки для этого клиента ещё нет.</p>
        <button class="btn-primary" id="mgrCreate" type="button" style="max-width:240px;">
          Создать подборку
        </button>
        <div id="mgrCreateResult" class="submit-result"></div>
      </div>
    `));

    container.querySelector("#mgrCreate")?.addEventListener("click", async () => {
      const btn    = container.querySelector("#mgrCreate");
      const result = container.querySelector("#mgrCreateResult");
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-inline"></span>Создаём…`;
      try {
        const data = await apiFetch("proposal_create", {
          client_key: clientKey,
          client_tg_id: clientTgId || "",
        });
        if (data.error) {
          result.innerHTML = `<div class="error">${escHtml(data.error)}</div>`;
          btn.disabled = false; btn.textContent = "Создать подборку";
          return;
        }
        await mountManager(container, clientKey, clientTgId);
      } catch (e) {
        result.innerHTML = `<div class="error">Сеть: ${escHtml(e.message)}</div>`;
        btn.disabled = false; btn.textContent = "Создать подборку";
      }
    });
  }

  // ── Manager: main editor ──────────────────────────────────

  function renderManagerEditor(container, proposal, clientKey) {
    container.innerHTML = "";
    const positions = proposal.positions || [];
    const canEdit   = ["brief", "draft", "reviewed"].includes(proposal.status);
    const canSend   = proposal.status === "draft" && positions.some(p => p.variants?.length);
    const statusLbl = STATUS_LABELS_MGR[proposal.status] || proposal.status;

    // Status bar
    container.appendChild(el(`
      <div class="prop-mgr-status-bar">
        <span class="prop-mgr-status-label ${escAttr(proposal.status)}">${escHtml(statusLbl)}</span>
        ${proposal.sent_at ? `<span class="prop-mgr-ts">Отправлено: ${escHtml(proposal.sent_at.slice(0,10))}</span>` : ""}
        ${proposal.reviewed_at ? `<span class="prop-mgr-ts">Ответ: ${escHtml(proposal.reviewed_at.slice(0,10))}</span>` : ""}
      </div>
    `));

    // Client feedback (reviewed state)
    if (proposal.status === "reviewed") {
      const fb = el(`
        <div class="prop-client-feedback">
          <div class="prop-feedback-head">📬 Ответ клиента</div>
          ${renderVotesSummary(positions)}
          ${proposal.client_comment
            ? `<div class="prop-client-comment-block">💬 ${escHtml(proposal.client_comment)}</div>`
            : ""}
        </div>
      `);
      container.appendChild(fb);
    }

    // Brief summary (collapsible)
    if (proposal.brief && Object.keys(proposal.brief).some(k => proposal.brief[k] && proposal.brief[k] !== "none" && proposal.brief[k] !== "no")) {
      const det = el(`
        <details class="prop-brief-details">
          <summary class="prop-brief-toggle">📋 Анкета клиента</summary>
          <div class="prop-brief-content">${renderBriefSummary(proposal.brief)}</div>
        </details>
      `);
      container.appendChild(det);
    }

    // Categories
    if (positions.length) {
      const catsWrap = el(`<div class="prop-mgr-cats"></div>`);
      positions.forEach(cat => {
        catsWrap.appendChild(renderManagerCategoryBlock(cat, proposal, canEdit, () =>
          mountManager(container, clientKey, proposal.client_tg_id)
        ));
      });
      container.appendChild(catsWrap);
    } else {
      container.appendChild(el(`
        <div class="prop-mgr-hint">Категорий пока нет. Добавьте первую позицию ниже.</div>
      `));
    }

    // Add variant form
    if (canEdit) {
      container.appendChild(
        renderAddVariantForm(proposal.id, clientKey, proposal.client_tg_id, container)
      );
    }

    // Send button
    if (canSend) {
      const sendWrap = el(`
        <div class="podbor-cta-row" style="margin-top:20px;">
          <button class="btn-primary" id="mgrSend" type="button">📨 Отправить клиенту</button>
        </div>
        <div id="mgrSendResult" class="submit-result"></div>
      `);
      container.appendChild(sendWrap);
      container.querySelector("#mgrSend")?.addEventListener("click", async () => {
        const btn    = container.querySelector("#mgrSend");
        const result = container.querySelector("#mgrSendResult");
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-inline"></span>Отправляем…`;
        try {
          const data = await apiFetch("proposal_send", { proposal_id: proposal.id });
          if (data.error) {
            result.innerHTML = `<div class="error">${escHtml(data.error)}</div>`;
            btn.disabled = false; btn.textContent = "📨 Отправить клиенту";
            return;
          }
          haptic && haptic("success");
          await mountManager(container, clientKey, proposal.client_tg_id);
        } catch (e) {
          result.innerHTML = `<div class="error">Сеть: ${escHtml(e.message)}</div>`;
          btn.disabled = false; btn.textContent = "📨 Отправить клиенту";
        }
      });
    }
  }

  // ── Manager: category block ───────────────────────────────

  function renderManagerCategoryBlock(cat, proposal, canEdit, onRefresh) {
    const label    = cat.label || CAT_LABELS[cat.category] || cat.category;
    const variants = cat.variants || [];
    const block = el(`
      <div class="prop-mgr-cat">
        <div class="prop-mgr-cat-head">
          <span class="prop-cat-label">${escHtml(label)}</span>
          <span class="prop-cat-count">${variants.length} ${pluralVariants(variants.length)}</span>
          ${canEdit ? `<button class="prop-cat-del-btn" type="button" title="Удалить категорию">✕</button>` : ""}
        </div>
        <div class="prop-mgr-variants"></div>
      </div>
    `);

    if (canEdit) {
      block.querySelector(".prop-cat-del-btn")?.addEventListener("click", async () => {
        if (!confirm(`Удалить «${label}» со всеми вариантами?`)) return;
        try {
          await apiFetch("proposal_remove_variant", { proposal_id: proposal.id, category: cat.category });
          await onRefresh();
        } catch (_) {}
      });
    }

    const varWrap = block.querySelector(".prop-mgr-variants");
    variants.forEach(v => varWrap.appendChild(
      renderManagerVariantRow(v, proposal, cat.category, canEdit, onRefresh)
    ));
    return block;
  }

  // ── Manager: variant row ──────────────────────────────────

  function renderManagerVariantRow(v, proposal, category, canEdit, onRefresh) {
    const priceStr = v.price ? `${Number(v.price).toLocaleString("ru-RU")} ₽` : "";
    const voteIcon = v.client_vote === "yes" ? " ✅" : v.client_vote === "no" ? " ❌" : "";
    const row = el(`
      <div class="prop-mgr-variant-row">
        <div class="prop-mgr-variant-name">${escHtml(v.model || "—")}${voteIcon}</div>
        <div class="prop-mgr-variant-meta">
          ${priceStr ? `<span class="prop-mgr-price">${escHtml(priceStr)}</span>` : ""}
          ${sourceBadge(v.source)}
        </div>
        ${v.manager_comment ? `<div class="prop-mgr-variant-comment">${escHtml(v.manager_comment)}</div>` : ""}
        ${v.url ? `<a class="prop-variant-link" href="${escAttr(v.url)}" target="_blank" rel="noopener noreferrer">Открыть →</a>` : ""}
        ${canEdit ? `<button class="prop-variant-del-btn" type="button">Удалить</button>` : ""}
      </div>
    `);

    if (canEdit) {
      row.querySelector(".prop-variant-del-btn")?.addEventListener("click", async () => {
        try {
          await apiFetch("proposal_remove_variant", {
            proposal_id: proposal.id, category, variant_id: v.id,
          });
          await onRefresh();
        } catch (_) {}
      });
    }
    return row;
  }

  // ── Manager: add variant form ─────────────────────────────

  function renderAddVariantForm(proposalId, clientKey, clientTgId, container) {
    const wrap = el(`
      <details class="prop-add-form">
        <summary class="prop-add-summary">＋ Добавить позицию</summary>
        <div class="prop-add-body">

          <div class="prop-field-group">
            <div class="prop-field-label">Категория</div>
            <select id="av_cat" class="prop-select">
              ${MANAGER_CATEGORIES.map(c =>
                `<option value="${escAttr(c.key)}">${escHtml(c.label)}</option>`
              ).join("")}
            </select>
          </div>

          <div class="prop-field-group">
            <div class="prop-field-label">Модель *</div>
            <input type="text" id="av_model" placeholder="Bosch PXX875D67E" class="prop-input">
          </div>

          <div class="prop-field-group">
            <div class="prop-field-label">Ссылка на товар</div>
            <input type="url" id="av_url" placeholder="https://dns-shop.ru/…" class="prop-input">
          </div>

          <div class="prop-field-group two-col-group">
            <div>
              <div class="prop-field-label">Цена, ₽</div>
              <input type="number" id="av_price" placeholder="45 990" inputmode="numeric" class="prop-input">
            </div>
            <div>
              <div class="prop-field-label">Магазин</div>
              <select id="av_source" class="prop-select">
                <option value="">—</option>
                <option value="dns">DNS</option>
                <option value="wb">Wildberries</option>
                <option value="ozon">Ozon</option>
                <option value="citilink">Ситилинк</option>
                <option value="yamarket">Яндекс Маркет</option>
              </select>
            </div>
          </div>

          <div class="prop-field-group">
            <div class="prop-field-label">Комментарий</div>
            <textarea id="av_mgr_comment" rows="2" class="prop-input"
                      placeholder="Топ-модель, 5 зон, авто-выкл, подходит под ширину 60 см…"></textarea>
          </div>

          <div class="podbor-cta-row">
            <button class="btn-primary" id="av_save" type="button">Добавить</button>
          </div>
          <div id="av_result" class="submit-result"></div>

        </div>
      </details>
    `);

    wrap.querySelector("#av_save")?.addEventListener("click", async () => {
      const btn    = wrap.querySelector("#av_save");
      const result = wrap.querySelector("#av_result");
      const model  = (wrap.querySelector("#av_model")?.value || "").trim();
      if (!model) {
        result.innerHTML = `<div class="error">Укажите название модели</div>`;
        return;
      }
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-inline"></span>Добавляем…`;

      const catKey   = wrap.querySelector("#av_cat")?.value || "";
      const catLabel = MANAGER_CATEGORIES.find(c => c.key === catKey)?.label || catKey;

      try {
        const data = await apiFetch("proposal_upsert_variant", {
          proposal_id:    proposalId,
          category:       catKey,
          category_label: catLabel,
          variant: {
            model,
            url:             (wrap.querySelector("#av_url")?.value || "").trim(),
            price:           wrap.querySelector("#av_price")?.value || "",
            source:          wrap.querySelector("#av_source")?.value || "",
            manager_comment: (wrap.querySelector("#av_mgr_comment")?.value || "").trim(),
          },
        });
        if (data.error) {
          result.innerHTML = `<div class="error">${escHtml(data.error)}</div>`;
          btn.disabled = false; btn.textContent = "Добавить";
          return;
        }
        haptic && haptic("success");
        // Clear fields
        ["av_model", "av_url", "av_price", "av_mgr_comment"].forEach(id => {
          const el2 = wrap.querySelector(`#${id}`);
          if (el2) el2.value = "";
        });
        result.innerHTML = `<div class="success"><div class="success-icon">✓</div><div><div class="success-title">Добавлено!</div></div></div>`;
        btn.disabled = false; btn.textContent = "Добавить";
        // Reload manager view
        await mountManager(container, clientKey, clientTgId);
      } catch (e) {
        result.innerHTML = `<div class="error">Сеть: ${escHtml(e.message)}</div>`;
        btn.disabled = false; btn.textContent = "Добавить";
      }
    });

    return wrap;
  }

  // ══════════════════════════════════════════════════════════
  // CONTRACT REVIEW  (AI-анализ договора для клиента)
  // ══════════════════════════════════════════════════════════

  // Preset questions that appear as quick-tap chips
  const CONTRACT_PRESETS = [
    "Какие условия оплаты?",
    "Когда доставка и монтаж?",
    "Что будет если я откажусь?",
    "Есть ли штрафы?",
    "На что обратить внимание?",
  ];

  async function mountContractReview(container) {
    container.innerHTML = "";

    container.appendChild(el(`
      <header class="podbor-header">
        <button class="podbor-back" aria-label="Назад">${(typeof ICONS !== "undefined" && ICONS.arrow_left) || "‹"}</button>
        <div class="podbor-title">ПРОВЕРКА ДОГОВОРА</div>
        <div style="width:28px"></div>
      </header>
    `));
    container.querySelector(".podbor-back").addEventListener("click", () => history.back());

    container.appendChild(el(`
      <section class="podbor-step">
        <h2 class="display-title">Проверим<br><span class="accent">ваш договор</span></h2>
        <p class="lede">Вставьте текст договора — AI объяснит условия простым языком, найдёт риски и подскажет, что уточнить.</p>

        <div class="prop-field-group">
          <div class="prop-field-label">Текст договора *</div>
          <textarea id="cr_text" class="prop-input cr-textarea"
            rows="8"
            placeholder="Вставьте сюда текст договора или его ключевые разделы…&#10;&#10;Например: условия оплаты, сроки, ответственность сторон, гарантия."
          ></textarea>
          <div class="cr-chars" id="cr_chars">0 / 16 000 символов</div>
        </div>

        <div class="prop-field-group">
          <div class="prop-field-label">Конкретный вопрос (необязательно)</div>
          <div class="cr-presets" id="cr_presets">
            ${CONTRACT_PRESETS.map(q =>
              `<button class="prop-chip cr-preset" type="button">${escHtml(q)}</button>`
            ).join("")}
          </div>
          <input type="text" id="cr_question" class="prop-input" style="margin-top:8px;"
            placeholder="Или напишите свой вопрос…">
        </div>

        <div class="podbor-cta-row" style="margin-top:20px;">
          <button class="btn-primary" id="cr_submit" type="button">
            🤖 Анализировать
          </button>
        </div>
        <div id="cr_result" class="submit-result"></div>
      </section>
    `));

    // Char counter
    const textarea = container.querySelector("#cr_text");
    const charEl   = container.querySelector("#cr_chars");
    textarea.addEventListener("input", () => {
      const n = textarea.value.length;
      charEl.textContent = `${n.toLocaleString("ru-RU")} / 16 000 символов`;
      charEl.style.color = n > 14000 ? "#C0392B" : "var(--muted)";
    });

    // Preset chips → fill question input
    container.querySelectorAll(".cr-preset").forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelector("#cr_question").value = btn.textContent.trim();
        container.querySelectorAll(".cr-preset").forEach(b => b.classList.remove("on"));
        btn.classList.add("on");
        haptic && haptic("selection");
      });
    });

    // Submit
    container.querySelector("#cr_submit").addEventListener("click", async () => {
      const btn      = container.querySelector("#cr_submit");
      const result   = container.querySelector("#cr_result");
      const text     = textarea.value.trim();
      const question = (container.querySelector("#cr_question")?.value || "").trim();

      if (!text) {
        result.innerHTML = `<div class="error">Вставьте текст договора</div>`;
        return;
      }

      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-inline"></span>Анализируем…`;
      result.innerHTML = `
        <div class="cr-thinking">
          <div class="cr-thinking-icon">🤔</div>
          <div class="cr-thinking-text">AI читает договор…<br><span class="cr-thinking-sub">Обычно занимает 10–25 секунд</span></div>
        </div>`;

      try {
        const data = await apiFetch("contract_review", { text, question });
        if (data.error) {
          result.innerHTML = `<div class="error">Ошибка: ${escHtml(data.error)}</div>`;
          btn.disabled = false; btn.textContent = "🤖 Анализировать";
          return;
        }
        haptic && haptic("success");
        result.innerHTML = "";
        result.appendChild(renderContractAnalysis(data.analysis, data.raw_text, question));
        btn.disabled = false; btn.textContent = "🤖 Анализировать снова";
        // Scroll to result
        result.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (e) {
        result.innerHTML = `<div class="error">Сеть: ${escHtml(e.message)}</div>`;
        btn.disabled = false; btn.textContent = "🤖 Анализировать";
      }
    });
  }

  function renderContractAnalysis(analysis, rawText, question) {
    // If AI returned unstructured text (not JSON), show it plain
    if (!analysis || !Object.keys(analysis).length) {
      return el(`<div class="cr-raw">${escHtml(rawText || "AI не вернул анализ")}</div>`);
    }

    const wrap = el(`<div class="cr-analysis"></div>`);

    // Summary
    if (analysis.summary) {
      wrap.appendChild(el(`
        <div class="cr-block cr-summary-block">
          <div class="cr-block-head">📋 Резюме</div>
          <div class="cr-summary-text">${escHtml(analysis.summary)}</div>
        </div>
      `));
    }

    // Question answer (if specific question asked)
    if (question && analysis.question_answer) {
      wrap.appendChild(el(`
        <div class="cr-block cr-qa-block">
          <div class="cr-block-head">💬 ${escHtml(question)}</div>
          <div class="cr-qa-answer">${escHtml(analysis.question_answer)}</div>
        </div>
      `));
    }

    // Payment
    const pay = analysis.payment;
    if (pay && (pay.total || pay.schedule)) {
      const rows = [];
      if (pay.total)    rows.push(["Итого", pay.total]);
      if (pay.schedule) rows.push(["Схема оплаты", pay.schedule]);
      if (pay.prepayment_pct != null) rows.push(["Предоплата", `${pay.prepayment_pct}%`]);
      wrap.appendChild(el(`
        <div class="cr-block">
          <div class="cr-block-head">💰 Оплата</div>
          <div class="cr-kv-list">
            ${rows.map(([k, v]) => `
              <div class="cr-kv-row">
                <span class="cr-kv-label">${escHtml(k)}</span>
                <span class="cr-kv-val">${escHtml(String(v))}</span>
              </div>`).join("")}
          </div>
        </div>
      `));
    }

    // Deadlines
    const deadlines = analysis.deadlines || [];
    if (deadlines.length) {
      const rows = deadlines.map(d => `
        <div class="cr-deadline-row">
          <span class="cr-deadline-label">${escHtml(d.label || "")}</span>
          <span class="cr-deadline-val">${escHtml(d.value || "—")}</span>
          ${d.note ? `<span class="cr-deadline-note">${escHtml(d.note)}</span>` : ""}
        </div>`).join("");
      wrap.appendChild(el(`
        <div class="cr-block">
          <div class="cr-block-head">⏰ Сроки</div>
          <div class="cr-deadlines">${rows}</div>
        </div>
      `));
    }

    // Risks
    const risks = analysis.risks || [];
    if (risks.length) {
      const riskItems = risks.map(r => {
        const cls = r.level === "high" ? "high" : r.level === "medium" ? "medium" : "low";
        const icon = r.level === "high" ? "🔴" : r.level === "medium" ? "🟡" : "🟢";
        return `
          <div class="cr-risk cr-risk-${cls}">
            <div class="cr-risk-head">${icon} ${escHtml(r.title || "")}</div>
            <div class="cr-risk-desc">${escHtml(r.description || "")}</div>
          </div>`;
      }).join("");
      wrap.appendChild(el(`
        <div class="cr-block">
          <div class="cr-block-head">⚠️ Риски</div>
          <div class="cr-risks">${riskItems}</div>
        </div>
      `));
    }

    // Recommendations
    const recs = analysis.recommendations || [];
    if (recs.length) {
      wrap.appendChild(el(`
        <div class="cr-block">
          <div class="cr-block-head">✅ Рекомендации</div>
          <ul class="cr-rec-list">
            ${recs.map(r => `<li>${escHtml(r)}</li>`).join("")}
          </ul>
        </div>
      `));
    }

    // Missing clauses
    const missing = analysis.missing_clauses || [];
    if (missing.length) {
      wrap.appendChild(el(`
        <div class="cr-block cr-missing-block">
          <div class="cr-block-head">❓ Чего нет в договоре</div>
          <ul class="cr-rec-list cr-missing-list">
            ${missing.map(m => `<li>${escHtml(m)}</li>`).join("")}
          </ul>
        </div>
      `));
    }

    // Footer note
    wrap.appendChild(el(`
      <div class="cr-footer-note">
        ⚠ Это автоматический анализ — не юридическая консультация. \
Уточняйте спорные пункты у менеджера или юриста.
      </div>
    `));

    return wrap;
  }

  // ══════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════

  return { mountClient, mountManager, mountContractReview };

})();
