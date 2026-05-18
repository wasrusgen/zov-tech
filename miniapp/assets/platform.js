/* ============================================================
   platform.js — адаптер платформы
   Telegram Phase 1 · VK Max Phase 2 (отдельно, не параллельно)

   Загружается ПЕРВЫМ из всех app-скриптов (после telegram-web-app.js).
   Определяет два глобальных:
     tg       — ссылка на WebApp (backward-совместимость модулей)
     Platform — единый API без привязки к Telegram SDK

   Миграция на VK Max: заменить этот файл, остальной код не трогать.
   ============================================================ */

/* global */ var tg = window.Telegram?.WebApp || null;  // eslint-disable-line no-var

const Platform = (function () {
  "use strict";
  const _tg = tg;

  return {
    // ── Auth ────────────────────────────────────────────────
    /** Подписанная строка initData — для HMAC-верификации на бэкенде */
    get initData()       { return _tg?.initData || ""; },
    /** Небезопасный объект (fallback для Telegram Desktop) */
    get initDataUnsafe() { return _tg?.initDataUnsafe || null; },
    /** Параметр ?startapp= / start_param от бота */
    get startParam()     { return _tg?.initDataUnsafe?.start_param || null; },

    // ── Тема ────────────────────────────────────────────────
    /** "light" | "dark" — берём из платформы или matchMedia */
    get colorScheme() {
      return _tg?.colorScheme
        || (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    },

    // ── Lifecycle ───────────────────────────────────────────
    /** Сигнал платформе: MiniApp готов к показу */
    ready() { try { _tg?.ready?.(); } catch (e) { /* не в Telegram → ок */ } },
    /** Развернуть на весь экран */
    expand() { try { _tg?.expand?.(); } catch (e) {} },
    /** Подтверждение при закрытии (предотвращает случайный свайп) */
    enableClosingConfirmation() { try { _tg?.enableClosingConfirmation?.(); } catch (e) {} },

    // ── События ─────────────────────────────────────────────
    /** Подписка на смену темы платформой */
    onThemeChange(cb) { try { _tg?.onEvent?.("themeChanged", cb); } catch (e) {} },

    // ── UI ──────────────────────────────────────────────────
    /** Нативный alert платформы (fallback → window.alert) */
    showAlert(msg) {
      if (_tg?.showAlert) { try { _tg.showAlert(msg); return; } catch (e) {} }
      alert(msg);
    },

    // ── Haptic ──────────────────────────────────────────────
    /**
     * Тактильный отклик.
     * @param {"impact"|"success"|"selection"} type
     */
    haptic(type = "selection") {
      try {
        const hf = _tg?.HapticFeedback;
        if (!hf) return;
        if (type === "impact")       hf.impactOccurred("light");
        else if (type === "success") hf.notificationOccurred("success");
        else                          hf.selectionChanged();
      } catch (e) {}
    },
  };
})();
