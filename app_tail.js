;
  // Keep duplicated views (categoría/lista) in sync
  function syncCardViews(cardId, sourceEl) {
    const peers = qsa(`.card[data-card-id="${CSS.escape(cardId)}"]`);
    // Discover current state from source
    const srcAmount = qs('.amount-input', sourceEl)?.value ?? '';
    const srcPaid = qs('.paid-checkbox', sourceEl)?.checked ?? false;
    for (const el of peers) {
      if (el === sourceEl) continue;
      const amt = qs('.amount-input', el);
      const chk = qs('.paid-checkbox', el);
      if (amt) amt.value = srcAmount;
      if (chk) chk.checked = srcPaid;
      if (srcPaid) el.style.outline = '1px solid rgba(52,211,153,0.45)'; else el.style.outline = '';
    }
  }

