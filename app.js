(() => {
  const qs = (sel, el = document) => el.querySelector(sel);
  const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const fileInput = qs('#fileInput');
  const dropZone = qs('#dropZone');
  const boardEl = qs('#board');
  const boardHeaderEl = qs('#boardHeader');
  const boardNameEl = qs('#boardName');
  const categoryHeaderEl = qs('#categoryHeader');
  const categoryBoardEl = qs('#categoryBoard');
  const listsCountEl = qs('#listsCount');
  const cardsCountEl = qs('#cardsCount');
  const paidTotalEl = qs('#paidTotal');
  const searchInput = qs('#searchInput');
  const autoLoadMsg = qs('#autoLoadMsg');
  const retryAutoLoadBtn = qs('#retryAutoLoad');
  const exportBtn = qs('#exportBtn');

  const columnTpl = qs('#columnTemplate');
  const cardTpl = qs('#cardTemplate');

  let currentBoard = null;
  let state = null;

  // Currency formatter (ARS fallback)
  const formatter = (() => {
    try { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }); } catch {}
    try { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }); } catch {}
    return { format: (n) => `$ ${Number(n || 0).toFixed(2)}` };
  })();

  const storageKeyForBoard = (boardId) => `trelloBoardState:${boardId}`;

  const loadState = (boardId) => {
    const raw = localStorage.getItem(storageKeyForBoard(boardId));
    if (!raw) return { boardId, cards: {} };
    try { return JSON.parse(raw); } catch { return { boardId, cards: {} }; }
  };

  const saveState = () => {
    if (!state) return;
    localStorage.setItem(storageKeyForBoard(state.boardId), JSON.stringify(state));
    updateTotals();
  };

  const parseAmount = (val) => {
    if (val == null) return 0;
    if (typeof val === 'number') return isFinite(val) ? val : 0;
    if (typeof val !== 'string') return 0;
    let s = val.trim();
    if (!s) return 0;
    // Remove currency symbols and spaces
    s = s.replace(/[^0-9.,\-]/g, '');
    const hasDot = s.includes('.');
    const hasComma = s.includes(',');
    if (hasDot && hasComma) {
      // Decide decimal by the last occurring separator
      const lastDot = s.lastIndexOf('.');
      const lastComma = s.lastIndexOf(',');
      if (lastComma > lastDot) {
        // comma is decimal -> remove dots
        s = s.replace(/\./g, '').replace(/,/g, '.');
      } else {
        // dot is decimal -> remove commas
        s = s.replace(/,/g, '');
      }
    } else if (hasComma) {
      // Only comma -> decimal
      s = s.replace(/,/g, '.');
    } else {
      // Only dot or digits -> already decimal or integer
      // nothing extra
    }
    const num = parseFloat(s);
    return isFinite(num) ? Math.round(num * 100) / 100 : 0;
  };

  const formatCurrency = (n) => formatter.format(Number(n || 0));

  const recalcCounts = () => {
    if (!currentBoard) return;
    const lists = (currentBoard.lists || []).filter(l => !l.closed);
    const cards = (currentBoard.cards || []).filter(c => !c.closed);
    listsCountEl.textContent = `${lists.length} ${lists.length === 1 ? 'lista' : 'listas'}`;
    cardsCountEl.textContent = `${cards.length} ${cards.length === 1 ? 'tarjeta' : 'tarjetas'}`;
  };

  const updateTotals = () => {
    if (!state) { paidTotalEl.textContent = formatCurrency(0); return; }
    const total = Object.values(state.cards).reduce((acc, v) => acc + (v?.paid ? parseAmount(v.amount) : 0), 0);
    paidTotalEl.textContent = formatCurrency(total);
  };

  const inferImporteFromCustomFields = (data) => {
    // Optional prefill from Trello Custom Fields named "Importe a Percibir"
    const fields = data?.customFields || [];
    if (!fields.length) return {};
    const targetField = fields.find(f => (f?.name || '').toLowerCase().includes('importe a percibir'));
    if (!targetField) return {};
    const fieldId = targetField.id;
    const items = data?.customFieldItems || [];
    const map = {};
    for (const it of items) {
      if (it.idCustomField !== fieldId) continue;
      const cid = it.idModel; // card id
      let amount = null;
      if (it?.value?.number != null) amount = parseAmount(String(it.value.number));
      else if (it?.value?.text != null) amount = parseAmount(String(it.value.text));
      if (amount != null && !isNaN(amount)) map[cid] = amount;
    }
    return map;
  };

  const renderBoard = (data) => {
    currentBoard = data || {};
    const boardId = currentBoard.id || 'board';
    const boardName = currentBoard.name || 'Tablero';
    state = loadState(boardId);
    // Prefill state amounts from custom fields if empty
    const prefill = inferImporteFromCustomFields(currentBoard);
    for (const [cardId, amount] of Object.entries(prefill)) {
      if (!state.cards[cardId]) state.cards[cardId] = { amount: amount, paid: false };
      else if (!state.cards[cardId].amount) state.cards[cardId].amount = amount;
    }
    saveState();

    boardNameEl.textContent = boardName;
    recalcCounts();

    const lists = (currentBoard.lists || []).filter(l => !l.closed).sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
    const cards = (currentBoard.cards || []).filter(c => !c.closed).sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));

    const byList = new Map();
    for (const l of lists) byList.set(l.id, []);
    for (const c of cards) {
      const arr = byList.get(c.idList);
      if (arr) arr.push(c);
    }

    // Clear UI
    boardEl.innerHTML = '';
    // Mantener ocultas las listas originales (no se usa toggle)
    boardHeaderEl.classList.add('hidden');
    boardEl.classList.add('hidden');
    dropZone.classList.add('hidden');

    // Render categories (extra columns)
    renderCategories();

    for (const list of lists) {
      const col = columnTpl.content.firstElementChild.cloneNode(true);
      qs('.column-title', col).textContent = list.name || 'Lista';
      const cardsWrap = qs('.cards', col);
      const cs = byList.get(list.id) || [];

      for (const card of cs) {
        const cardEl = cardTpl.content.firstElementChild.cloneNode(true);
        cardEl.setAttribute('data-card-id', card.id);
        qs('.card-title', cardEl).textContent = card.name || '—';

        const amountInput = qs('.amount-input', cardEl);
        const paidCheckbox = qs('.paid-checkbox', cardEl);

        const st = state.cards[card.id] || { amount: '', paid: false };
        if (st.amount !== undefined && st.amount !== null && st.amount !== '') {
          amountInput.value = String(st.amount);
        }
        paidCheckbox.checked = !!st.paid;

        const persist = () => {
          const amt = parseAmount(amountInput.value);
          const paid = !!paidCheckbox.checked;
          state.cards[card.id] = { amount: amt, paid };
          saveState();
          // Passive visual effect when paid
          if (paid) cardEl.style.outline = '1px solid rgba(52,211,153,0.45)'; else cardEl.style.outline = '';
          syncCardViews(card.id, cardEl);
          // Move card into COBRADO column if needed
          renderCategories();
        };

        amountInput.addEventListener('change', persist);
        amountInput.addEventListener('blur', persist);
        paidCheckbox.addEventListener('change', persist);

        // Initial outline
        if (paidCheckbox.checked) cardEl.style.outline = '1px solid rgba(52,211,153,0.45)';

        cardsWrap.appendChild(cardEl);
      }

      boardEl.appendChild(col);
    }

    updateTotals();
    applySearchFilter(searchInput.value || '');
  };

  const renderCategories = () => {
    const cards = (currentBoard?.cards || [])
      .filter(c => !c.closed)
      .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
    categoryBoardEl.innerHTML = '';
    const paidCol = [];
    const laborals = [];
    const civils = [];
    for (const c of cards) {
      const st = state?.cards?.[c.id];
      if (st?.paid) { paidCol.push(c); continue; }
      const name = (c.name || '').toLowerCase();
      if (name.includes('laboral')) laborals.push(c);
      else if (name.includes('civil') || name.includes('contencioso')) civils.push(c);
    }
    if (laborals.length === 0 && civils.length === 0 && paidCol.length === 0) {
      categoryHeaderEl.classList.add('hidden');
      categoryBoardEl.classList.add('hidden');
      return;
    }
    categoryHeaderEl.classList.remove('hidden');
    categoryBoardEl.classList.remove('hidden');

    const addColumn = (title, items) => {
      const col = columnTpl.content.firstElementChild.cloneNode(true);
      qs('.column-title', col).textContent = title;
      const cardsWrap = qs('.cards', col);
      for (const card of items) {
        const cardEl = cardTpl.content.firstElementChild.cloneNode(true);
        cardEl.setAttribute('data-card-id', card.id);
        qs('.card-title', cardEl).textContent = card.name || '—';
        const amountInput = qs('.amount-input', cardEl);
        const paidCheckbox = qs('.paid-checkbox', cardEl);
        const st = state.cards[card.id] || { amount: '', paid: false };
        if (st.amount !== undefined && st.amount !== null && st.amount !== '') {
          amountInput.value = String(st.amount);
        }
        paidCheckbox.checked = !!st.paid;
        const persist = () => {
          const amt = parseAmount(amountInput.value);
          const paid = !!paidCheckbox.checked;
          state.cards[card.id] = { amount: amt, paid };
          saveState();
          if (paid) cardEl.style.outline = '1px solid rgba(52,211,153,0.45)'; else cardEl.style.outline = '';
          syncCardViews(card.id, cardEl);
          // Move card between category columns by re-rendering
          renderCategories();
        };
        amountInput.addEventListener('change', persist);
        amountInput.addEventListener('blur', persist);
        paidCheckbox.addEventListener('change', persist);
        if (paidCheckbox.checked) cardEl.style.outline = '1px solid rgba(52,211,153,0.45)';
        cardsWrap.appendChild(cardEl);
      }
      categoryBoardEl.appendChild(col);
    };

    addColumn('LABORAL', laborals);
    addColumn('CIVIL / CONTENCIOSO ADM.', civils);
    addColumn('COBRADO', paidCol);
  };

  const readFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result)); } catch (e) { reject(new Error('El archivo no es un JSON válido.')); }
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsText(file);
  });

  const handleFiles = async (files) => {
    const file = files && files[0];
    if (!file) return;
    try {
      const data = await readFile(file);
      renderBoard(data);
    } catch (err) {
      alert(err?.message || 'Error al procesar el archivo.');
    }
  };

  // Drag and drop
  ['dragenter','dragover'].forEach(ev => dropZone.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('dragover'); }));
  ;['dragleave','drop'].forEach(ev => dropZone.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('dragover'); }));
  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    handleFiles(files);
  });

  // File input
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

  // Search filter
  const applySearchFilter = (q) => {
    const query = (q || '').toLowerCase();
    const cards = qsa('.card');
    if (!query) { cards.forEach(c => c.style.display = ''); return; }
    for (const c of cards) {
      const title = qs('.card-title', c)?.textContent?.toLowerCase() || '';
      c.style.display = title.includes(query) ? '' : 'none';
    }
  };
  searchInput.addEventListener('input', (e) => applySearchFilter(e.target.value));

  // Export to CSV
  exportBtn.addEventListener('click', () => {
    if (!currentBoard) { alert('Primero carga el JSON.'); return; }
    try { exportCSV(); } catch (e) { alert('No se pudo exportar el CSV.'); }
  });

  function exportCSV() {
    const lists = (currentBoard.lists || []);
    const listById = {};
    for (const l of lists) listById[l.id] = l;
    const cards = (currentBoard.cards || []).filter(c => !c.closed).sort((a,b) => (a.pos??0)-(b.pos??0));
    const delim = ';';
    const headers = ['Juicio', 'Importe a Percibir', 'Cobrado', 'Lista', 'Categoría'];
    const rows = [headers];
    const categoryOf = (card, st) => {
      if (st?.paid) return 'COBRADO';
      const name = (card.name || '').toLowerCase();
      if (name.includes('laboral')) return 'LABORAL';
      if (name.includes('civil') || name.includes('contencioso')) return 'CIVIL / CONTENCIOSO ADM.';
      return 'OTROS';
    };
    const normalizeAmountCsv = (amt) => {
      const n = parseAmount(amt);
      // Spanish Excel usually expects comma as decimal with ; delimiter
      return n.toFixed(2).replace('.', ',');
    };
    const esc = (v) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return (s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(delim)) ? `"${s}"` : s;
    };
    for (const c of cards) {
      const st = state.cards[c.id] || {};
      const line = [
        c.name || '',
        normalizeAmountCsv(st.amount || 0),
        st.paid ? 'SI' : 'NO',
        listById[c.idList]?.name || '',
        categoryOf(c, st)
      ];
      rows.push(line.map(esc));
    }
    const csv = rows.map(r => r.join(delim)).join('\n');
    const bom = '\ufeff';
    const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const boardName = (currentBoard.name || 'tablero').replace(/[^\p{L}\p{N} _.-]/gu, '').trim() || 'tablero';
    const ts = new Date();
    const pad = (x) => String(x).padStart(2, '0');
    const stamp = `${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}`;
    a.href = url;
    a.download = `export-${boardName}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Keep duplicated views (categoría/lista) in sync
  function syncCardViews(cardId, sourceEl) {
    const peers = qsa('.card').filter(el => el.dataset && el.dataset.cardId === String(cardId));
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

  // Attempt auto-load of default JSON from same folder
  const DEFAULT_JSON = 'Q7vCIwzd - guille.json';
  async function attemptAutoLoad() {
    autoLoadMsg.textContent = '';
    try {
      const url = new URL(DEFAULT_JSON, window.location.href);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      renderBoard(data);
    } catch (e) {
      autoLoadMsg.textContent = 'Auto-carga no disponible en este navegador o contexto. Usa “Cargar JSON” o arrastra el archivo.';
    }
  }
  retryAutoLoadBtn.addEventListener('click', attemptAutoLoad);
  // Try once on load
  attemptAutoLoad();

})();


