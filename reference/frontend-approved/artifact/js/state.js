(function () {
  'use strict';

  const data = window.CetechMockData;
  const adapters = window.CetechAdapters;
  const STORAGE_KEY = 'cetech-pos-preview-v1';

  function nowIso() { return new Date().toISOString(); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function freshCart() {
    return {
      id: adapters.helpers.uuid('cart-'),
      revision: 0,
      customer: clone(data.customers[0]),
      lines: [],
      quoteState: { status: 'missing' },
      lastConfirmedQuote: null,
      priceDisclosure: null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
  }

  function defaultState() {
    return {
      route: 'login',
      auth: { status: 'signed_out', user: null, message: null },
      register: {
        selectedId: data.registers[0].id,
        shift: null,
        lastZ: null,
        closeDraft: null,
        locked: false
      },
      cart: freshCart(),
      search: { query: '', results: clone(data.products.slice(0, 10)), status: 'ready' },
      mobileCartOpen: false,
      checkout: { stage: 'idle', preparedSale: null, error: null },
      payment: { stage: 'idle', method: null, attempt: null, cashReceivedMinor: 0, message: null },
      receipt: null,
      orders: clone(data.seedOrders),
      returns: [],
      returnDraft: null,
      attention: clone(data.seedAttention),
      services: clone(adapters.runtime.services),
      update: { available: false, state: 'none', message: null },
      migration: { state: 'idle' },
      secondTabPassive: false,
      settings: {
        appearance: 'system',
        printer: 'Browser print (80mm/A4)',
        scanner: 'Keyboard-wedge scanner',
        deviceName: 'Counter-01 Preview',
        registerId: data.registers[0].id
      },
      ui: { modal: null, demoOpen: false, toast: null },
      demo: { nextPayment: 'success', nextRefund: 'success' },
      lastActivityAt: nowIso()
    };
  }

  function loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.version === 1 ? parsed.state : null;
    } catch (error) {
      return null;
    }
  }

  const persisted = loadPersisted();
  const state = defaultState();
  if (persisted) {
    if (persisted.auth) state.auth = persisted.auth;
    if (persisted.register) state.register = persisted.register;
    if (persisted.cart) state.cart = persisted.cart;
    if (persisted.orders) state.orders = persisted.orders;
    if (persisted.returns) state.returns = persisted.returns;
    if (persisted.attention) state.attention = persisted.attention;
    if (persisted.settings) state.settings = Object.assign(state.settings, persisted.settings);
    if (persisted.receipt) state.receipt = persisted.receipt;
    if (state.auth.user) state.route = 'sell';
    state.cart.quoteState = { status: state.cart.lines.length ? 'stale' : 'missing' };
    state.cart.lastConfirmedQuote = null;
  }

  const listeners = [];
  function notify() { listeners.forEach((fn) => fn(state)); }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        state: {
          auth: state.auth,
          register: state.register,
          cart: state.cart,
          orders: state.orders,
          returns: state.returns,
          attention: state.attention,
          settings: state.settings,
          receipt: state.receipt
        }
      }));
    } catch (error) {
      state.services.localDb = false;
    }
  }

  function set(mutator, options) {
    mutator(state);
    state.lastActivityAt = nowIso();
    if (!options || options.persist !== false) persist();
    notify();
  }

  function replaceCart(cart) {
    set((s) => { s.cart = cart; });
  }

  function invalidateQuote(reason) {
    set((s) => {
      s.cart.revision += 1;
      s.cart.updatedAt = nowIso();
      s.cart.quoteState = { status: s.services.online && s.services.pricing ? 'stale' : 'offline' };
      s.cart.priceDisclosure = reason || null;
    });
  }

  function expectedCashMinor() {
    const shift = state.register.shift;
    if (!shift) return 0;
    return (shift.movements || []).reduce((sum, movement) => sum + movement.amountMinor, 0);
  }

  function cartItemCount() {
    return state.cart.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  }

  function confirmedQuote() {
    return state.cart.quoteState.status === 'confirmed' ? state.cart.quoteState.quote : null;
  }

  function checkoutEligibility() {
    if (state.secondTabPassive) return { allowed: false, reason: 'This window is in passive mode' };
    if (!state.register.shift || state.register.shift.status !== 'open') return { allowed: false, reason: 'Open register first' };
    if (!state.cart.lines.length) return { allowed: false, reason: 'Add a product' };
    if (!state.services.online) return { allowed: false, reason: 'Connection required' };
    if (!state.services.pricing || !state.services.commerce) return { allowed: false, reason: 'Pricing unavailable' };
    if (state.attention.some((item) => item.status === 'open' && item.severity === 'critical')) return { allowed: false, reason: 'Resolve previous transaction first' };
    if (state.checkout.stage !== 'idle' && state.checkout.stage !== 'complete') return { allowed: false, reason: 'Transaction in progress' };
    if (state.cart.quoteState.status === 'stale' || state.cart.quoteState.status === 'quoting') return { allowed: false, reason: 'Updating price…' };
    if (state.cart.quoteState.status === 'failed') return { allowed: false, reason: 'Pricing unavailable' };
    if (state.cart.quoteState.status === 'offline') return { allowed: false, reason: 'Connection required' };
    if (state.cart.quoteState.status === 'expired') return { allowed: false, reason: 'Price expired — updating…' };
    if (state.cart.quoteState.status !== 'confirmed') return { allowed: false, reason: 'Price confirmation required' };
    if (new Date(state.cart.quoteState.quote.expiresAt).getTime() <= Date.now()) return { allowed: false, reason: 'Price expired — updating…' };
    if (state.cart.quoteState.revision !== state.cart.revision) return { allowed: false, reason: 'Updating price…' };
    if (!state.cart.quoteState.quote.purchasable) return { allowed: false, reason: 'Resolve unavailable product' };
    return { allowed: true, reason: '' };
  }

  function updateService(name, value) {
    adapters.runtime.services[name] = value;
    set((s) => { s.services[name] = value; }, { persist: false });
  }

  function resetPreview() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) { /* no-op */ }
    const fresh = defaultState();
    Object.keys(state).forEach((key) => delete state[key]);
    Object.keys(fresh).forEach((key) => { state[key] = fresh[key]; });
    Object.keys(adapters.runtime.services).forEach((key) => { adapters.runtime.services[key] = true; });
    adapters.runtime.faults.nextPrepare = 'normal';
    adapters.runtime.faults.nextPayment = 'success';
    adapters.runtime.faults.nextRefund = 'success';
    adapters.runtime.faults.priceChangeDeltaMinor = 0;
    adapters.runtime.faults.forceOldQuote = false;
    adapters.runtime.faults.responseLoss = false;
    adapters.runtime.faults.printFailure = false;
    notify();
  }

  window.CetechState = {
    state: state,
    set: set,
    subscribe(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    persist: persist,
    freshCart: freshCart,
    replaceCart: replaceCart,
    invalidateQuote: invalidateQuote,
    expectedCashMinor: expectedCashMinor,
    cartItemCount: cartItemCount,
    confirmedQuote: confirmedQuote,
    checkoutEligibility: checkoutEligibility,
    updateService: updateService,
    resetPreview: resetPreview,
    nowIso: nowIso,
    clone: clone
  };
}());
