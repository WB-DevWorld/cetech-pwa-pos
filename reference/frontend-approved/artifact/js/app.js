(function () {
  'use strict';

  const data = window.CetechMockData;
  const adapters = window.CetechAdapters;
  const store = window.CetechState;
  const components = window.CetechComponents;
  const state = store.state;
  const appEl = document.getElementById('app');
  const toastRoot = document.getElementById('toast-root');

  let quoteTimer = null;
  let searchTimer = null;
  let scannerBuffer = '';
  let scannerLastKeyAt = 0;
  let toastTimer = null;
  let lastModalKey = '';
  let modalReturnFocus = null;

  function modalKey() {
    const modal = state.ui.modal;
    return modal ? [modal.type || 'dialog', modal.stage || '', modal.orderId || ''].join(':') : '';
  }

  function focusDialogIfNeeded(previousKey, nextKey) {
    if (nextKey && previousKey !== nextKey) {
      if (!previousKey && document.activeElement && document.activeElement !== document.body) modalReturnFocus = document.activeElement;
      requestAnimationFrame(() => {
        const modal = document.querySelector('.modal[role="dialog"]');
        if (!modal) return;
        const preferred = modal.querySelector('[autofocus], .modal-body input:not([disabled]), .modal-body select:not([disabled]), .modal-actions .primary:not([disabled]), .modal-body button:not([disabled]), .modal-actions button:not([disabled]), .modal-head button:not([disabled])');
        if (preferred) preferred.focus();
      });
    } else if (!nextKey && previousKey && modalReturnFocus && document.contains(modalReturnFocus)) {
      requestAnimationFrame(() => modalReturnFocus && modalReturnFocus.focus());
      modalReturnFocus = null;
    }
  }

  function render() {
    applyTheme();
    const previousModalKey = lastModalKey;
    appEl.innerHTML = components.render(state);
    lastModalKey = modalKey();
    focusDialogIfNeeded(previousModalKey, lastModalKey);
  }

  store.subscribe(render);

  function applyTheme() {
    let theme = state.settings.appearance || 'system';
    if (theme === 'system') {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
  }

  function toast(message) {
    if (!toastRoot) return;
    clearTimeout(toastTimer);
    toastRoot.innerHTML = '<div class="toast">' + components.helpers.escape(message) + '</div>';
    toastTimer = setTimeout(() => { toastRoot.innerHTML = ''; }, 3200);
  }

  function toMinor(value) {
    const clean = String(value || '').replace(/,/g, '').trim();
    if (!clean || Number.isNaN(Number(clean))) return 0;
    return Math.round(Number(clean) * 100);
  }

  function currentRegister() {
    return data.registers.find((r) => r.id === state.register.selectedId) || data.registers[0];
  }

  function newTransactionId() {
    return adapters.helpers.uuid('tx-');
  }

  function mutateCart(mutator, disclosure) {
    store.set((s) => {
      mutator(s.cart);
      s.cart.revision += 1;
      s.cart.updatedAt = store.nowIso();
      s.cart.quoteState = { status: s.services.online && s.services.pricing && s.services.commerce ? 'stale' : 'offline' };
      s.cart.priceDisclosure = disclosure || null;
    });
    scheduleQuote();
  }

  function scheduleQuote(immediate) {
    clearTimeout(quoteTimer);
    if (!state.cart.lines.length) {
      store.set((s) => { s.cart.quoteState = { status: 'missing' }; s.cart.lastConfirmedQuote = null; }, { persist: true });
      return;
    }
    if (!state.services.online || !state.services.pricing || !state.services.commerce) {
      store.set((s) => { s.cart.quoteState = { status: 'offline' }; }, { persist: true });
      return;
    }
    const wait = immediate ? 0 : data.config.quoteDebounceMs;
    const revision = state.cart.revision;
    quoteTimer = setTimeout(async () => {
      if (state.cart.revision !== revision) return;
      store.set((s) => { s.cart.quoteState = { status: 'quoting', revision: revision }; }, { persist: false });
      const previous = state.cart.lastConfirmedQuote;
      try {
        const quote = await adapters.PricingPort.quote({
          cartRevision: revision,
          customer: store.clone(state.cart.customer),
          lines: state.cart.lines.map((line) => ({ id: line.id, productId: line.productId, variationId: line.variationId, quantity: line.quantity }))
        });
        if (state.cart.revision !== quote.cartRevision) {
          toast('An older price response was ignored because the cart changed.');
          return;
        }
        let disclosure = state.cart.priceDisclosure;
        if (quote.priceChanged && previous && previous.totalMinor !== quote.totalMinor) {
          const diff = quote.totalMinor - previous.totalMinor;
          disclosure = 'Price updated — ' + (diff > 0 ? components.helpers.money(diff) + ' higher' : components.helpers.money(Math.abs(diff)) + ' lower');
        }
        store.set((s) => {
          s.cart.quoteState = { status: 'confirmed', revision: quote.cartRevision, quote: quote };
          s.cart.lastConfirmedQuote = quote;
          s.cart.priceDisclosure = disclosure;
        });
      } catch (error) {
        store.set((s) => { s.cart.quoteState = { status: s.services.online ? 'failed' : 'offline', revision: revision, error: error.code || 'PRICING_FAILED' }; });
      }
    }, wait);
  }

  async function refreshSearch(query) {
    const q = String(query || '');
    store.set((s) => { s.search.query = q; s.search.status = 'loading'; }, { persist: false });
    try {
      const results = await adapters.CatalogPort.search(q);
      if (state.search.query !== q) return;
      store.set((s) => { s.search.results = results; s.search.status = 'ready'; }, { persist: false });
    } catch (error) {
      store.set((s) => { s.search.status = 'error'; }, { persist: false });
    }
  }

  function addSellable(product, variation) {
    if (state.secondTabPassive) { toast('This window is passive. Use the active register window.'); return; }
    const sellable = variation || product;
    if (sellable.stockStatus === 'out_of_stock') { toast('Product is out of stock.'); return; }
    mutateCart((cart) => {
      const existing = cart.lines.find((line) => line.productId === product.id && (line.variationId || null) === (variation ? variation.id : null));
      if (existing) {
        existing.quantity += 1;
      } else {
        cart.lines.push({
          id: adapters.helpers.uuid('line-'),
          productId: product.id,
          variationId: variation ? variation.id : null,
          name: product.name,
          variationLabel: variation ? variation.name : '',
          sku: sellable.sku,
          barcode: sellable.barcode,
          quantity: 1,
          displayUnitPriceMinor: sellable.displayPriceMinor
        });
      }
    });
  }

  function addProduct(productId) {
    const product = data.products.find((p) => p.id === productId);
    if (!product) return;
    if (product.type === 'variable') {
      store.set((s) => { s.ui.modal = { type: 'variation', productId: product.id }; }, { persist: false });
      return;
    }
    addSellable(product, null);
  }

  async function scanBarcode(barcode) {
    const raw = String(barcode || '').trim();
    if (!raw) return;
    const matches = await adapters.CatalogPort.findByBarcode(raw);
    if (!matches.length) {
      toast('Product not found for barcode ' + raw);
      store.set((s) => { s.search.query = raw; }, { persist: false });
      refreshSearch(raw);
      return;
    }
    if (matches.length > 1) {
      store.set((s) => { s.ui.modal = { type: 'barcode-collision', barcode: raw }; }, { persist: false });
      return;
    }
    const match = matches[0];
    const product = data.products.find((p) => p.id === match.productId);
    const variation = match.variationId && product.variations ? product.variations.find((v) => v.id === match.variationId) : null;
    addSellable(product, variation);
  }

  async function prepareSale() {
    const eligibility = store.checkoutEligibility();
    if (!eligibility.allowed) { toast(eligibility.reason || 'Checkout is not ready.'); return; }
    const quote = store.confirmedQuote();
    const transactionId = newTransactionId();
    const operation = { id: adapters.helpers.uuid('op-'), transactionId: transactionId, type: 'sale.prepare', status: 'pending', createdAt: store.nowIso() };
    store.set((s) => {
      s.checkout = { stage: 'preparing', preparedSale: null, error: null, transactionId: transactionId, operation: operation };
      s.payment = { stage: 'idle', method: null, attempt: null, cashReceivedMinor: 0, message: null };
      s.ui.modal = { type: 'payment' };
    });
    const input = {
      transactionId: transactionId,
      totalMinor: quote.totalMinor,
      customer: store.clone(state.cart.customer),
      lines: store.clone(state.cart.lines),
      quote: store.clone(quote),
      quoteFingerprint: quote.fingerprint
    };
    try {
      const prepared = await adapters.SalesPort.prepare(input);
      store.set((s) => {
        s.checkout.stage = 'reserved';
        s.checkout.preparedSale = prepared;
        s.checkout.operation.status = 'completed';
        s.payment.stage = 'choose';
      });
    } catch (error) {
      if (error.code === 'RESPONSE_UNKNOWN') {
        store.set((s) => { s.checkout.stage = 'checking'; s.checkout.operation.status = 'response_unknown'; });
        const resolution = await adapters.SalesPort.resolve(transactionId);
        if (resolution.status === 'reserved') {
          store.set((s) => { s.checkout.stage = 'reserved'; s.checkout.preparedSale = resolution.preparedSale; s.checkout.operation.status = 'completed'; s.payment.stage = 'choose'; });
          toast('Prepared sale recovered — no duplicate order was created.');
          return;
        }
        addAttention('critical', 'Ambiguous prepared sale', 'Sale preparation could not be resolved. Do not take payment.', transactionId);
        store.set((s) => { s.checkout.stage = 'needs_attention'; });
        return;
      }
      if (error.code === 'QUOTE_CHANGED') {
        store.set((s) => { s.checkout.stage = 'quote_changed'; s.checkout.error = { code: error.code, newTotalMinor: error.newTotalMinor }; });
        return;
      }
      if (error.code === 'STOCK_CHANGED') {
        store.set((s) => { s.checkout.stage = 'stock_changed'; s.checkout.error = { code: error.code, productId: error.productId, availableQuantity: error.availableQuantity }; });
        return;
      }
      if (error.code === 'REQUIRES_ATTENTION') {
        addAttention('critical', 'Sale preparation needs attention', 'The server result is ambiguous. Do not take payment.', transactionId);
        store.set((s) => { s.checkout.stage = 'needs_attention'; });
        return;
      }
      store.set((s) => { s.checkout.stage = 'idle'; s.checkout.error = { code: error.code || 'PREPARE_FAILED' }; s.ui.modal = null; });
      toast('Sale could not be prepared. Your cart is saved.');
    }
  }

  function addAttention(severity, title, summary, transactionRef) {
    store.set((s) => {
      s.attention.unshift({ id: adapters.helpers.uuid('attn-'), type: 'transaction', severity: severity, title: title, summary: summary, transactionRef: transactionRef || '', status: 'open' });
    });
  }

  async function beginTender(method) {
    const prepared = state.checkout.preparedSale;
    if (!prepared) return;
    if (method === 'cash') {
      store.set((s) => { s.payment.stage = 'cash'; s.payment.method = 'cash'; s.payment.cashReceivedMinor = 0; }, { persist: false });
      return;
    }
    store.set((s) => { s.payment.stage = 'initializing'; s.payment.method = method; });
    try {
      const attempt = await adapters.PaymentPort.begin({ transactionId: prepared.transactionId, amountMinor: prepared.totalMinor, method: method });
      store.set((s) => { s.payment.attempt = attempt; s.payment.stage = 'awaiting_customer'; });
    } catch (error) {
      store.set((s) => { s.payment.stage = 'failed'; s.payment.message = 'Payment service unavailable.'; });
    }
  }

  async function confirmCash() {
    const prepared = state.checkout.preparedSale;
    if (!prepared) return;
    if (state.payment.cashReceivedMinor < prepared.totalMinor) { toast('Cash received is less than the total.'); return; }
    store.set((s) => { s.payment.stage = 'finalizing'; });
    const payment = await adapters.PaymentPort.confirmCash({ transactionId: prepared.transactionId, amountMinor: prepared.totalMinor, cashReceivedMinor: state.payment.cashReceivedMinor });
    await finalizeSale(payment);
  }

  async function electronicOutcome(outcome) {
    const prepared = state.checkout.preparedSale;
    if (!prepared) return;
    if (outcome === 'timeout') {
      store.set((s) => { s.payment.stage = 'reconciling'; });
      setTimeout(async () => {
        const payment = await adapters.PaymentPort.resolveElectronic({ transactionId: prepared.transactionId, amountMinor: prepared.totalMinor, method: state.payment.method, outcome: 'success' });
        store.set((s) => { s.payment.attempt = payment; s.payment.stage = 'finalizing'; });
        await finalizeSale(payment);
      }, 1100);
      return;
    }
    const payment = await adapters.PaymentPort.resolveElectronic({ transactionId: prepared.transactionId, amountMinor: prepared.totalMinor, method: state.payment.method, outcome: outcome });
    store.set((s) => { s.payment.attempt = payment; });
    if (payment.status === 'verified') {
      store.set((s) => { s.payment.stage = 'finalizing'; });
      await finalizeSale(payment);
    } else if (payment.status === 'pending' || payment.status === 'response_unknown') {
      store.set((s) => { s.payment.stage = 'pending'; });
    } else if (payment.status === 'cancelled') {
      store.set((s) => { s.payment.stage = 'cancelled'; });
    } else {
      store.set((s) => { s.payment.stage = 'failed'; });
    }
  }

  async function finalizeSale(payment) {
    const prepared = state.checkout.preparedSale;
    const quote = prepared.quote;
    const finalization = await adapters.PaymentPort.finalize({ transactionId: prepared.transactionId, method: state.payment.method });
    if (finalization.status === 'requires_attention') {
      addAttention('critical', 'Payment received — order finalization pending', 'Payment is verified but the commerce order still needs finalization. Do not charge again.', prepared.transactionId);
      store.set((s) => { s.payment.stage = 'pending'; s.payment.message = finalization.reason; });
      return;
    }
    const register = currentRegister();
    const receiptLines = prepared.lines.map((line) => {
      const qLine = quote.lines.find((ql) => ql.lineId === line.id);
      return {
        name: line.name,
        variationLabel: line.variationLabel,
        quantity: line.quantity,
        unitPriceMinor: qLine ? qLine.unitPriceMinor : line.displayUnitPriceMinor,
        totalMinor: qLine ? qLine.totalMinor : line.displayUnitPriceMinor * line.quantity
      };
    });
    const methodLabel = state.payment.method === 'cash' ? 'Cash' : (state.payment.method === 'mobile_money' ? 'Mobile Money' : (state.payment.method === 'card' ? 'Card' : 'External electronic'));
    const receipt = adapters.ReceiptPort.create({
      orderRef: prepared.orderRef,
      transactionRef: prepared.transactionId,
      register: register.name,
      cashier: state.auth.user.name,
      customer: store.clone(prepared.customer),
      lines: receiptLines,
      subtotalMinor: quote.subtotalMinor,
      discountMinor: quote.discountMinor,
      taxMinor: quote.taxMinor,
      totalMinor: quote.totalMinor,
      paymentMethod: methodLabel,
      paymentReference: payment.providerReference || null,
      cashReceivedMinor: state.payment.method === 'cash' ? payment.cashReceivedMinor : null,
      changeMinor: state.payment.method === 'cash' ? payment.changeMinor : null
    });
    const order = {
      id: adapters.helpers.uuid('ord-'),
      orderRef: prepared.orderRef,
      receiptNumber: receipt.receiptNumber,
      transactionRef: prepared.transactionId,
      createdAt: receipt.issuedAt,
      customer: store.clone(prepared.customer),
      cashier: state.auth.user.name,
      register: register.name,
      status: 'completed',
      paymentStatus: 'verified',
      paymentMethod: methodLabel,
      paymentReference: payment.providerReference || null,
      cashReceivedMinor: receipt.cashReceivedMinor,
      changeMinor: receipt.changeMinor,
      subtotalMinor: quote.subtotalMinor,
      discountMinor: quote.discountMinor,
      taxMinor: quote.taxMinor,
      totalMinor: quote.totalMinor,
      lines: receiptLines.map((line, index) => ({
        lineId: 'line-' + index + '-' + prepared.transactionId.slice(-5),
        productId: prepared.lines[index].productId,
        variationId: prepared.lines[index].variationId,
        name: line.name,
        variationLabel: line.variationLabel,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        totalMinor: line.totalMinor,
        returnedQty: 0
      })),
      receipt: receipt
    };
    store.set((s) => {
      s.payment.stage = 'completed';
      s.checkout.stage = 'complete';
      s.receipt = receipt;
      s.orders.unshift(order);
      if (s.payment.method === 'cash' && s.register.shift) {
        s.register.shift.movements.push({ id: adapters.helpers.uuid('mov-'), type: 'cash_sale', amountMinor: quote.totalMinor, createdAt: store.nowIso(), note: order.orderRef });
      }
      s.ui.modal = { type: 'receipt', receipt: receipt };
    });
  }

  function startNewSale() {
    store.set((s) => {
      s.cart = store.freshCart();
      s.checkout = { stage: 'idle', preparedSale: null, error: null };
      s.payment = { stage: 'idle', method: null, attempt: null, cashReceivedMinor: 0, message: null };
      s.receipt = null;
      s.ui.modal = null;
      s.mobileCartOpen = false;
      if (s.update.available) s.update.state = 'safe';
    });
    refreshSearch('');
    if (state.update.available) toast('Update is now safe to apply.');
  }

  async function executeRefund(method) {
    const draft = state.returnDraft;
    const order = state.orders.find((o) => o.id === draft.orderId);
    if (!draft || !draft.preview || !order) return;
    const result = await adapters.ReturnPort.execute({ orderId: order.id, preview: draft.preview, method: method });
    if (result.status === 'pending') {
      store.set((s) => { s.returnDraft.method = method; s.returnDraft.result = result; s.ui.modal = { type: 'return', orderId: order.id, stage: 'pending' }; });
      return;
    }
    if (result.status === 'requires_attention') {
      store.set((s) => { s.returnDraft.method = method; s.returnDraft.result = result; s.ui.modal = { type: 'return', orderId: order.id, stage: 'attention' }; });
      addAttention('critical', 'Refund needs attention', 'A refund attempt has an ambiguous provider/commercial state. Do not issue another refund.', result.refundRef || order.transactionRef);
      return;
    }
    completeRefund(order, method, result);
  }

  function completeRefund(order, method, result) {
    const draft = state.returnDraft;
    const returnCase = { id: result.refundRef || adapters.helpers.uuid('ref-'), orderId: order.id, orderRef: order.orderRef, totalMinor: draft.preview.totalMinor, method: method, status: 'completed', createdAt: store.nowIso(), lines: store.clone(draft.preview.lines) };
    store.set((s) => {
      s.returns.unshift(returnCase);
      const liveOrder = s.orders.find((o) => o.id === order.id);
      draft.preview.lines.forEach((rline) => {
        const source = liveOrder.lines.find((l) => l.lineId === rline.lineId);
        if (source) source.returnedQty = (source.returnedQty || 0) + rline.quantity;
      });
      liveOrder.status = liveOrder.lines.every((l) => (l.returnedQty || 0) >= l.quantity) ? 'refunded' : 'partially_refunded';
      if (method === 'Cash' && s.register.shift) {
        s.register.shift.movements.push({ id: adapters.helpers.uuid('mov-'), type: 'cash_refund', amountMinor: -draft.preview.totalMinor, createdAt: store.nowIso(), note: 'Refund ' + order.orderRef });
      }
      s.returnDraft.result = result;
      s.ui.modal = { type: 'return', orderId: order.id, stage: 'complete' };
    });
  }

  async function closeShift(countedMinor, approvedBy) {
    const expected = store.expectedCashMinor();
    const result = await adapters.RegisterPort.closeShift({ shift: state.register.shift, expectedCashMinor: expected, countedCashMinor: countedMinor, approvedBy: approvedBy || null });
    store.set((s) => { s.register.lastZ = result; s.register.shift = null; s.ui.modal = { type: 'z-report', report: result }; s.route = 'register'; });
  }

  function routeTo(route) {
    store.set((s) => { s.route = route; s.mobileCartOpen = false; }, { persist: false });
  }

  document.addEventListener('submit', async (event) => {
    if (event.target.id === 'open-register-form') {
      event.preventDefault();
      const registerId = document.getElementById('register-select').value;
      const openingFloatMinor = toMinor(document.getElementById('opening-float').value);
      try {
        const shift = await adapters.RegisterPort.openShift({ registerId: registerId, staffId: state.auth.user.id, openingFloatMinor: openingFloatMinor });
        store.set((s) => { s.register.selectedId = registerId; s.settings.registerId = registerId; s.register.shift = shift; s.route = 'sell'; });
        toast('Register opened.');
        scheduleQuote(true);
      } catch (error) { toast(error.message); }
    }
  });

  document.addEventListener('click', async (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    if (action === 'route') return routeTo(el.dataset.route);
    if (action === 'login') {
      const user = await adapters.IdentityPort.login(el.dataset.staffId);
      if (!user) return;
      store.set((s) => { s.auth = { status: 'active', user: user, message: null }; s.route = s.register.shift ? 'sell' : 'register'; });
      if (state.cart.lines.length) scheduleQuote(true);
      return;
    }
    if (action === 'lock') { store.set((s) => { s.auth.status = 'locked'; }); return; }
    if (action === 'focus-search') { const input = document.getElementById('product-search'); if (input) input.focus(); return; }
    if (action === 'add-product') { addProduct(el.dataset.productId); if (state.ui.modal && state.ui.modal.type === 'barcode-collision') store.set((s) => { s.ui.modal = null; }, { persist:false }); return; }
    if (action === 'select-variation') {
      const product = data.products.find((p) => p.id === el.dataset.productId);
      const variation = product && product.variations.find((v) => v.id === el.dataset.variationId);
      store.set((s) => { s.ui.modal = null; }, { persist: false });
      if (product && variation) addSellable(product, variation);
      return;
    }
    if (action === 'scan') return scanBarcode(el.dataset.barcode);
    if (action === 'scan-collision') { store.set((s) => { s.ui.modal = { type: 'barcode-collision' }; }, { persist:false }); return; }
    if (action === 'qty-inc' || action === 'qty-dec') {
      mutateCart((cart) => {
        const line = cart.lines.find((l) => l.id === el.dataset.lineId);
        if (!line) return;
        line.quantity = Math.max(1, line.quantity + (action === 'qty-inc' ? 1 : -1));
      });
      return;
    }
    if (action === 'remove-line') {
      mutateCart((cart) => { cart.lines = cart.lines.filter((l) => l.id !== el.dataset.lineId); });
      return;
    }
    if (action === 'clear-cart') {
      if (window.confirm('Clear the current cart?')) {
        store.set((s) => { s.cart = store.freshCart(); });
        scheduleQuote(true);
      }
      return;
    }
    if (action === 'open-customers') { store.set((s) => { s.ui.modal = { type: 'customers', query: '' }; }, { persist:false }); return; }
    if (action === 'choose-customer' || action === 'select-customer-direct') {
      const customer = data.customers.find((c) => c.id === el.dataset.customerId);
      if (!customer) return;
      if (action === 'select-customer-direct') routeTo('sell');
      mutateCart((cart) => { cart.customer = store.clone(customer); }, customer.type === 'b2b' ? 'Wholesale customer selected — price confirmed' : 'Customer changed — price confirmed');
      store.set((s) => { s.ui.modal = null; }, { persist:false });
      return;
    }
    if (action === 'pay') return prepareSale();
    if (action === 'choose-tender') return beginTender(el.dataset.method);
    if (action === 'cash-quick') { store.set((s) => { s.payment.cashReceivedMinor = Number(el.dataset.minor); }, { persist:false }); return; }
    if (action === 'confirm-cash') return confirmCash();
    if (action === 'payment-outcome') return electronicOutcome(el.dataset.outcome);
    if (action === 'payment-resolve-success') { store.set((s) => { s.payment.stage = 'reconciling'; }); setTimeout(() => electronicOutcome('success'), 650); return; }
    if (action === 'payment-back') { store.set((s) => { s.payment.stage = 'choose'; s.payment.attempt = null; }, { persist:false }); return; }
    if (action === 'cancel-prepared') {
      if (!state.checkout.preparedSale) return;
      await adapters.SalesPort.cancel(state.checkout.preparedSale.transactionId);
      store.set((s) => { s.checkout = { stage:'idle', preparedSale:null, error:null }; s.payment = { stage:'idle', method:null, attempt:null, cashReceivedMinor:0, message:null }; s.ui.modal = null; });
      toast('Prepared sale cancelled. Cart returned to editable state and will requote.');
      mutateCart(() => {}, 'Sale cancelled — price reconfirmed');
      return;
    }
    if (action === 'accept-price-change') {
      store.set((s) => { s.checkout = { stage:'idle', preparedSale:null, error:null }; s.ui.modal = null; });
      mutateCart(() => {}, 'Price updated — review total');
      return;
    }
    if (action === 'accept-stock-change') {
      const error = state.checkout.error;
      store.set((s) => { s.checkout = { stage:'idle', preparedSale:null, error:null }; s.ui.modal = null; });
      if (error && error.productId) {
        mutateCart((cart) => {
          const line = cart.lines.find((l) => l.productId === error.productId);
          if (line) line.quantity = Math.max(1, error.availableQuantity);
        }, 'Stock changed — quantity updated');
      }
      return;
    }
    if (action === 'route-attention-close') { store.set((s) => { s.ui.modal = null; s.route = 'attention'; }, { persist:false }); return; }
    if (action === 'print-receipt') {
      if (adapters.runtime.faults.printFailure) {
        adapters.runtime.faults.printFailure = false;
        store.set((s) => { s.ui.modal = { type:'print-failure' }; }, { persist:false });
        return;
      }
      window.print();
      return;
    }
    if (action === 'return-to-receipt') { store.set((s) => { s.ui.modal = { type:'receipt', receipt:s.receipt }; }, { persist:false }); return; }
    if (action === 'retry-print') { store.set((s) => { s.ui.modal = { type:'receipt', receipt:s.receipt }; }, { persist:false }); setTimeout(() => window.print(), 0); return; }
    if (action === 'new-sale') return startNewSale();
    if (action === 'mobile-cart-open') { store.set((s) => { s.mobileCartOpen = true; }, { persist:false }); return; }
    if (action === 'mobile-cart-close') { store.set((s) => { s.mobileCartOpen = false; }, { persist:false }); return; }
    if (action === 'order-detail') { store.set((s) => { s.ui.modal = { type:'order', orderId: el.dataset.orderId }; }, { persist:false }); return; }
    if (action === 'reprint-order') {
      const order = state.orders.find((o) => o.id === el.dataset.orderId);
      if (order && order.receipt) store.set((s) => { s.ui.modal = { type:'receipt', receipt: order.receipt }; }, { persist:false });
      else toast('Seed order has no full receipt snapshot in this preview.');
      return;
    }
    if (action === 'start-return') {
      const orderId = el.dataset.orderId;
      store.set((s) => { s.returnDraft = { orderId: orderId, selections: {}, preview: null }; s.ui.modal = { type:'return', orderId: orderId, stage:'select' }; }, { persist:false });
      return;
    }
    if (action === 'preview-refund') {
      const modal = document.querySelector('.modal');
      if (!modal) return;
      const selections = [];
      modal.querySelectorAll('.return-qty').forEach((input) => {
        const lineId = input.dataset.lineId;
        const quantity = Number(input.value || 0);
        if (quantity > 0) {
          selections.push({ lineId: lineId, quantity: quantity, reason: modal.querySelector('.return-reason[data-line-id="' + lineId + '"]').value, condition: modal.querySelector('.return-condition[data-line-id="' + lineId + '"]').value });
        }
      });
      if (!selections.length) { toast('Select at least one item to return.'); return; }
      const order = state.orders.find((o) => o.id === state.returnDraft.orderId);
      try {
        const preview = await adapters.ReturnPort.preview(order, selections);
        store.set((s) => { s.returnDraft.selections = selections; s.returnDraft.preview = preview; s.ui.modal = { type:'return', orderId: order.id, stage:'preview' }; });
      } catch (error) { toast(error.message); }
      return;
    }
    if (action === 'return-back') { store.set((s) => { s.ui.modal = { type:'return', orderId: s.returnDraft.orderId, stage:'select' }; }, { persist:false }); return; }
    if (action === 'approve-refund') {
      const method = (document.getElementById('refund-method') || {}).value || 'Original method';
      return executeRefund(method);
    }
    if (action === 'resolve-refund') {
      const order = state.orders.find((o) => o.id === state.returnDraft.orderId);
      completeRefund(order, state.returnDraft.method || 'Original method', { status:'completed', refundRef: state.returnDraft.result.refundRef });
      return;
    }
    if (action === 'cash-movement') { store.set((s) => { s.ui.modal = { type:'cash-movement', movementType:el.dataset.type }; }, { persist:false }); return; }
    if (action === 'confirm-cash-movement') {
      const amount = toMinor((document.getElementById('movement-amount') || {}).value);
      const note = (document.getElementById('movement-note') || {}).value || '';
      if (!amount) { toast('Enter an amount.'); return; }
      const type = el.dataset.type;
      const signed = ['pay_out','cash_pickup'].includes(type) ? -Math.abs(amount) : Math.abs(amount);
      try {
        const movement = await adapters.RegisterPort.recordCashMovement(state.register.shift, { type:type, amountMinor:signed, note:note, createdBy:state.auth.user.id });
        store.set((s) => { s.register.shift.movements.push(movement); s.ui.modal = null; });
      } catch (error) { toast(error.message); }
      return;
    }
    if (action === 'x-report') { store.set((s) => { s.ui.modal = { type:'x-report' }; }, { persist:false }); return; }
    if (action === 'begin-close') { store.set((s) => { s.ui.modal = { type:'close-shift', stage:'count' }; }, { persist:false }); return; }
    if (action === 'review-close-shift') {
      const counted = toMinor((document.getElementById('closing-count') || {}).value);
      store.set((s) => { s.ui.modal = { type:'close-shift', stage:'variance', countedCashMinor:counted }; }, { persist:false });
      return;
    }
    if (action === 'close-shift-back') { store.set((s) => { s.ui.modal = { type:'close-shift', stage:'count' }; }, { persist:false }); return; }
    if (action === 'confirm-close-shift') {
      const counted = Number(el.dataset.counted || 0);
      const approval = el.dataset.approval === 'required' ? ((document.getElementById('manager-name') || {}).value || 'Manager') : null;
      return closeShift(counted, approval);
    }
    if (action === 'close-z-report') { store.set((s) => { s.ui.modal = null; }, { persist:false }); return; }
    if (action === 'resolve-attention') {
      const item = state.attention.find((a) => a.id === el.dataset.attentionId);
      if (!item) return;
      store.set((s) => { const live = s.attention.find((a) => a.id === item.id); live.summary = 'Checking transaction status…'; }, { persist:false });
      setTimeout(() => {
        store.set((s) => { const live = s.attention.find((a) => a.id === item.id); live.status = 'resolved'; live.summary = 'Recovered existing transaction safely. No duplicate operation was created.'; });
        toast('Transaction recovered.');
      }, 800);
      return;
    }
    if (action === 'ack-attention') { store.set((s) => { const item = s.attention.find((a) => a.id === el.dataset.attentionId); if (item) item.status = 'reviewed'; }); return; }
    if (action === 'sync-catalog') {
      store.set((s) => { s.services.catalogFresh = false; }, { persist:false });
      await adapters.SyncPort.rebuildCatalog();
      store.set((s) => { s.services.catalogFresh = true; if (s.ui.modal && s.ui.modal.type === 'fix-app') s.ui.modal = null; }, { persist:false });
      toast('Rebuildable catalog projection refreshed. Durable cart was preserved.');
      return;
    }
    if (action === 'toggle-demo') { store.set((s) => { s.ui.demoOpen = !s.ui.demoOpen; }, { persist:false }); return; }
    if (action === 'toggle-service') {
      const name = el.dataset.service;
      const value = !state.services[name];
      store.updateService(name, value);
      if (name === 'online') {
        if (value) { toast('Reconnected. Reconfirming current cart price.'); scheduleQuote(true); }
        else { store.set((s) => { if (s.cart.lines.length) s.cart.quoteState = { status:'offline' }; }, { persist:true }); }
      } else if ((name === 'pricing' || name === 'commerce') && value) scheduleQuote(true);
      return;
    }
    if (action === 'demo-price-change') {
      adapters.runtime.faults.priceChangeDeltaMinor = 1500;
      mutateCart(() => {}, null);
      toast('Next authoritative quote will simulate a price change.');
      return;
    }
    if (action === 'demo-stock-change') { adapters.runtime.faults.nextPrepare = 'stock_changed'; toast('Next Pay will simulate a stock change.'); return; }
    if (action === 'demo-quote-change') { adapters.runtime.faults.nextPrepare = 'quote_changed'; toast('Next Pay will simulate a quote change.'); return; }
    if (action === 'demo-response-loss') { adapters.runtime.faults.responseLoss = true; toast('Next Pay will simulate a lost prepare response and recovery.'); return; }
    if (action === 'demo-old-quote') { adapters.runtime.faults.forceOldQuote = true; mutateCart(() => {}, null); toast('A deliberately slow quote is in flight. Change quantity now to test stale-response protection.'); return; }
    if (action === 'demo-expire-quote') {
      if (!state.cart.lastConfirmedQuote) { toast('Add and price an item first.'); return; }
      store.set((s) => { s.cart.quoteState = { status:'expired', revision:s.cart.revision, quote:s.cart.lastConfirmedQuote }; }, { persist:false });
      toast('Current quote marked expired. Pay is blocked until the cart is requoted.');
      return;
    }
    if (action === 'demo-print-failure') { adapters.runtime.faults.printFailure = true; toast('Next receipt print will show the print-failure recovery state.'); return; }
    if (action === 'demo-refund-pending') { adapters.runtime.faults.nextRefund = 'pending'; toast('Next approved refund will remain pending.'); return; }
    if (action === 'demo-refund-attention') { adapters.runtime.faults.nextRefund = 'attention'; toast('Next approved refund will require manager attention.'); return; }
    if (action === 'demo-recovery') { addAttention('critical','Prepared transaction recovery','A demo order may already exist. Resolve it before taking another payment.','TX-DEMO-RECOVER'); routeTo('attention'); return; }
    if (action === 'demo-update' || action === 'open-update') { store.set((s) => { s.update.available = true; s.update.state = 'ready'; s.ui.modal = { type:'update' }; }, { persist:false }); return; }
    if (action === 'apply-update') { store.set((s) => { s.update.available = false; s.update.state = 'applied'; s.ui.modal = null; }, { persist:false }); toast('Update applied at a safe point. Preview business state was preserved.'); return; }
    if (action === 'open-fix-app') { store.set((s) => { s.ui.modal = { type:'fix-app' }; }, { persist:false }); return; }
    if (action === 'fix-health') { routeTo('health'); store.set((s) => { s.ui.modal = null; }, { persist:false }); return; }
    if (action === 'demo-migration') { store.set((s) => { s.migration.state='running'; s.ui.modal={type:'migration'}; }, { persist:false }); return; }
    if (action === 'migration-block') { store.set((s) => { s.migration.state='blocked'; }, { persist:false }); return; }
    if (action === 'migration-retry') { store.set((s) => { s.migration.state='running'; }, { persist:false }); toast('Other tab released the demo database lock.'); return; }
    if (action === 'migration-complete') { store.set((s) => { s.migration.state='complete'; }, { persist:false }); return; }
    if (action === 'demo-second-tab') { store.set((s) => { s.secondTabPassive = !s.secondTabPassive; }, { persist:false }); return; }
    if (action === 'demo-auth-state') { store.set((s) => { s.auth.status = el.dataset.auth; }, { persist:false }); return; }
    if (action === 'reset-preview') { if (window.confirm('Reset preview-only local data? This is a demo last-resort reset, not the production recovery model.')) store.resetPreview(); return; }
    if (action === 'close-modal') { store.set((s) => { s.ui.modal = null; }, { persist:false }); return; }
    if (action === 'modal-backdrop' && event.target === el) { store.set((s) => { s.ui.modal = null; }, { persist:false }); return; }
  });

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (target.id === 'product-search') {
      clearTimeout(searchTimer);
      const value = target.value;
      searchTimer = setTimeout(() => refreshSearch(value), 90);
      return;
    }
    if (target.matches('.qty-input')) {
      const lineId = target.dataset.lineId;
      const value = Math.max(1, Number(target.value || 1));
      clearTimeout(target._qtyTimer);
      target._qtyTimer = setTimeout(() => {
        mutateCart((cart) => { const line = cart.lines.find((l) => l.id === lineId); if (line) line.quantity = value; });
      }, 180);
      return;
    }
    if (target.id === 'cash-received') {
      state.payment.cashReceivedMinor = toMinor(target.value);
      const total = state.checkout.preparedSale ? state.checkout.preparedSale.totalMinor : 0;
      const change = Math.max(0, state.payment.cashReceivedMinor - total);
      const changeEl = document.getElementById('cash-change');
      const confirmEl = document.getElementById('confirm-cash-btn');
      if (changeEl) changeEl.textContent = components.helpers.money(change);
      if (confirmEl) confirmEl.disabled = state.payment.cashReceivedMinor < total;
      return;
    }
    if (target.id === 'order-search') {
      applyOrderFilters();
      return;
    }
    if (target.id === 'return-search') {
      const q = target.value.trim().toLowerCase();
      document.querySelectorAll('.return-order-card').forEach((card) => {
        card.style.display = !q || String(card.dataset.search || card.textContent).toLowerCase().includes(q) ? '' : 'none';
      });
      return;
    }
    if (target.id === 'customer-search' && state.ui.modal && state.ui.modal.type === 'customers') {
      const q = target.value.trim().toLowerCase();
      document.querySelectorAll('[data-action="choose-customer"]').forEach((button) => {
        button.style.display = !q || button.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    }
  });

  function applyOrderFilters() {
    const q = ((document.getElementById('order-search') || {}).value || '').trim().toLowerCase();
    const status = ((document.getElementById('order-status-filter') || {}).value || 'all');
    document.querySelectorAll('#order-table-body tr[data-order-id]').forEach((row) => {
      const order = state.orders.find((item) => item.id === row.dataset.orderId);
      const matchesText = !q || row.textContent.toLowerCase().includes(q) || (order && String(order.transactionRef || '').toLowerCase().includes(q));
      const matchesStatus = status === 'all' || (order && (order.status === status || order.paymentStatus === status));
      row.style.display = matchesText && matchesStatus ? '' : 'none';
    });
  }

  document.addEventListener('change', (event) => {
    if (event.target.id === 'appearance-select') {
      store.set((s) => { s.settings.appearance = event.target.value; });
      return;
    }
    if (event.target.id === 'order-status-filter') {
      applyOrderFilters();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab' && state.ui.modal) {
      const modal = document.querySelector('.modal[role="dialog"]');
      if (modal) {
        const focusable = Array.from(modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')).filter((node) => node.offsetParent !== null);
        if (focusable.length) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); return; }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); return; }
        }
      }
    }
    if (event.key === 'Escape') {
      if (state.ui.modal) store.set((s) => { s.ui.modal = null; }, { persist:false });
      else if (state.mobileCartOpen) store.set((s) => { s.mobileCartOpen = false; }, { persist:false });
      return;
    }
    if (event.key === 'F2' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) {
      event.preventDefault();
      routeTo('sell');
      setTimeout(() => { const input = document.getElementById('product-search'); if (input) input.focus(); }, 0);
      return;
    }
    if (event.key === 'F4') {
      event.preventDefault();
      if (state.auth.user) store.set((s) => { s.ui.modal = { type:'customers', query:'' }; }, { persist:false });
      return;
    }
    if (event.key === 'F8') {
      event.preventDefault();
      if (state.auth.user) prepareSale();
      return;
    }

    const tag = (event.target.tagName || '').toLowerCase();
    const typing = ['input','textarea','select'].includes(tag) || event.target.isContentEditable;
    if (typing) return;
    const now = Date.now();
    if (now - scannerLastKeyAt > 120) scannerBuffer = '';
    scannerLastKeyAt = now;
    if (event.key === 'Enter') {
      if (scannerBuffer.length >= 4) {
        const captured = scannerBuffer;
        scannerBuffer = '';
        event.preventDefault();
        scanBarcode(captured);
      }
      return;
    }
    if (event.key.length === 1 && /[0-9A-Za-z_-]/.test(event.key)) scannerBuffer += event.key;
  });

  // Expired restored quotes must be reconfirmed before checkout.
  if (state.auth.user && state.cart.lines.length) setTimeout(() => scheduleQuote(true), 80);
  render();
}());
