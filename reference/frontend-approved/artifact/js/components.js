(function () {
  'use strict';

  const data = window.CetechMockData;
  const store = window.CetechState;

  function e(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function money(minor) {
    const value = Number(minor || 0) / 100;
    return 'GHS ' + value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function dateTime(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch (error) { return iso; }
  }

  function icon(name) {
    const map = {
      sell: '▦', orders: '▤', customers: '♙', returns: '↩', register: '▣', health: '●', settings: '⚙', attention: '!', more: '•••', search: '⌕', cart: '▥', close: '×', print: '▧', cash: '¤', momo: '◉', card: '▭', external: '↗', check: '✓', warning: '!', info: 'i'
    };
    return map[name] || '•';
  }

  function badge(text, tone) {
    return '<span class="badge ' + e(tone || '') + '">' + e(text) + '</span>';
  }

  function statusPill(ok, goodText, badText) {
    return '<span class="status-pill ' + (ok ? 'success' : 'danger') + '"><span class="dot"></span><span class="status-text">' + e(ok ? goodText : badText) + '</span></span>';
  }

  function navButton(route, label, glyph, active) {
    return '<button type="button" class="nav-btn ' + (active ? 'active' : '') + '" data-action="route" data-route="' + e(route) + '" aria-current="' + (active ? 'page' : 'false') + '"><span class="icon" aria-hidden="true">' + e(glyph) + '</span><span>' + e(label) + '</span></button>';
  }

  function LoginView(state) {
    const status = state.auth.status;
    let notice = '';
    if (status === 'expired') notice = '<div class="banner warning"><strong>Session expired.</strong><span>Sign in again to continue. Your local cart has been kept.</span></div>';
    if (status === 'unauthorized') notice = '<div class="banner danger"><strong>Access denied.</strong><span>This account is not authorized to operate this register.</span></div>';
    if (status === 'locked') notice = '<div class="banner info"><strong>Register locked.</strong><span>Choose a staff account to unlock the current shift.</span></div>';
    return '<main class="auth-screen" id="main-content">' +
      '<section class="card auth-card" aria-labelledby="login-title">' +
        '<div class="auth-logo" aria-hidden="true">CT</div>' +
        '<div class="eyebrow">Frontend preview</div>' +
        '<h1 id="login-title">CETECH POS</h1>' +
        '<p class="subtle">Scan → Sell → Pay → Print</p>' +
        notice +
        '<div class="demo-users" role="group" aria-label="Demo staff accounts">' +
          data.staff.map((staff) => '<button class="btn block" type="button" data-action="login" data-staff-id="' + e(staff.id) + '"><span style="text-align:left;flex:1"><strong>' + e(staff.name) + '</strong><br><span class="muted">' + e(staff.role) + '</span></span><span aria-hidden="true">→</span></button>').join('') +
        '</div>' +
        '<p class="muted" style="margin-top:16px">Demo accounts only. No production credentials are used or required.</p>' +
      '</section>' +
    '</main>';
  }

  function AppShell(state, content) {
    const route = state.route;
    const user = state.auth.user;
    const register = data.registers.find((r) => r.id === state.register.selectedId);
    const openShift = state.register.shift && state.register.shift.status === 'open';
    const attentionCount = state.attention.filter((item) => item.status === 'open').length;
    const online = state.services.online;
    return '<div class="app-shell">' +
      '<aside class="sidebar" aria-label="Primary navigation">' +
        '<div class="brand-mark" title="CETECH">CT</div>' +
        '<nav class="nav-list">' +
          navButton('sell', 'Sell', icon('sell'), route === 'sell') +
          navButton('orders', 'Orders', icon('orders'), route === 'orders') +
          navButton('customers', 'Customers', icon('customers'), route === 'customers') +
          navButton('returns', 'Returns', icon('returns'), route === 'returns') +
          navButton('register', 'Register', icon('register'), route === 'register') +
          navButton('health', 'Health', icon('health'), route === 'health') +
          navButton('attention', 'Attention' + (attentionCount ? ' ' + attentionCount : ''), icon('attention'), route === 'attention') +
        '</nav>' +
        '<div class="sidebar-bottom">' + navButton('settings', 'Settings', icon('settings'), route === 'settings') + '</div>' +
      '</aside>' +
      '<div class="app-main">' +
        '<header class="topbar">' +
          '<div class="topbar-left">' +
            '<span class="app-title">CETECH POS</span>' +
            '<span class="context-pill">' + e(register ? register.name : 'No register') + '</span>' +
            '<span class="context-pill secondary">' + e(user ? user.name : '') + '</span>' +
            (openShift ? '<span class="status-pill success"><span class="dot"></span>Shift open</span>' : '<span class="status-pill warning"><span class="dot"></span>No open shift</span>') +
          '</div>' +
          '<div class="topbar-right">' +
            statusPill(online, 'Online', 'Offline') +
            (state.update.available ? '<button class="btn small" data-action="open-update">Update ready</button>' : '') +
            '<button class="icon-btn" type="button" data-action="lock" title="Lock register" aria-label="Lock register">⌁</button>' +
          '</div>' +
        '</header>' +
        '<main class="content" id="main-content">' + content + '</main>' +
      '</div>' +
      DemoDrawer(state) +
      '<button class="demo-fab" data-action="toggle-demo" aria-label="Open demo controls">Demo controls</button>' +
      Modal(state) +
    '</div>';
  }

  function DemoDrawer(state) {
    const s = state.services;
    return '<section class="demo-drawer ' + (state.ui.demoOpen ? 'open' : '') + '" aria-label="Developer and demo controls">' +
      '<div class="demo-head"><div><strong>Demo controls</strong><div class="muted">Separate from cashier UX</div></div><button class="icon-btn" data-action="toggle-demo" aria-label="Close demo controls">×</button></div>' +
      '<div class="demo-body">' +
        '<div class="demo-group"><h3>Connectivity & services</h3><div class="demo-actions">' +
          '<button class="btn small" data-action="toggle-service" data-service="online">' + (s.online ? 'Go offline' : 'Go online') + '</button>' +
          '<button class="btn small" data-action="toggle-service" data-service="commerce">Commerce ' + (s.commerce ? '✓' : '✕') + '</button>' +
          '<button class="btn small" data-action="toggle-service" data-service="pricing">Pricing ' + (s.pricing ? '✓' : '✕') + '</button>' +
          '<button class="btn small" data-action="toggle-service" data-service="payments">Payments ' + (s.payments ? '✓' : '✕') + '</button>' +
        '</div></div>' +
        '<div class="demo-group"><h3>Sale edge cases</h3><div class="demo-actions">' +
          '<button class="btn small" data-action="demo-price-change">Next quote: price changed</button>' +
          '<button class="btn small" data-action="demo-stock-change">Next Pay: stock changed</button>' +
          '<button class="btn small" data-action="demo-quote-change">Next Pay: quote changed</button>' +
          '<button class="btn small" data-action="demo-response-loss">Next Pay: response loss</button>' +
          '<button class="btn small" data-action="demo-old-quote">Slow next quote</button>' +
          '<button class="btn small" data-action="demo-expire-quote">Expire current quote</button>' +
          '<button class="btn small" data-action="demo-recovery">Create recovery case</button>' +
        '</div></div>' +
        '<div class="demo-group"><h3>Receipt & refund states</h3><div class="demo-actions">' +
          '<button class="btn small" data-action="demo-print-failure">Next print: fail</button>' +
          '<button class="btn small" data-action="demo-refund-pending">Next refund: pending</button>' +
          '<button class="btn small" data-action="demo-refund-attention">Next refund: needs attention</button>' +
        '</div></div>' +
        '<div class="demo-group"><h3>PWA & browser states</h3><div class="demo-actions">' +
          '<button class="btn small" data-action="demo-update">Simulate Update Ready</button>' +
          '<button class="btn small" data-action="demo-migration">Data migration</button>' +
          '<button class="btn small" data-action="demo-second-tab">' + (state.secondTabPassive ? 'Exit passive tab' : 'Passive second tab') + '</button>' +
          '<button class="btn small" data-action="toggle-service" data-service="catalogFresh">Catalog ' + (s.catalogFresh ? 'fresh' : 'stale') + '</button>' +
          '<button class="btn small" data-action="toggle-service" data-service="localDb">Local DB ' + (s.localDb ? 'healthy' : 'warning') + '</button>' +
          '<button class="btn small" data-action="toggle-service" data-service="supportedVersion">Version ' + (s.supportedVersion ? 'supported' : 'unsupported') + '</button>' +
          '<button class="btn small" data-action="open-fix-app">Fix App</button>' +
        '</div></div>' +
        '<div class="demo-group"><h3>Authentication states</h3><div class="demo-actions">' +
          '<button class="btn small" data-action="demo-auth-state" data-auth="expired">Session expired</button>' +
          '<button class="btn small" data-action="demo-auth-state" data-auth="unauthorized">Unauthorized</button>' +
          '<button class="btn small" data-action="demo-auth-state" data-auth="locked">Locked register</button>' +
          '<button class="btn small" data-action="route" data-route="health">Store Health</button>' +
        '</div></div>' +
        '<div class="demo-group"><h3>Reset</h3><button class="btn danger small" data-action="reset-preview">Reset preview data</button></div>' +
      '</div>' +
    '</section>';
  }

  function SellView(state) {
    const results = state.search.results || [];
    const quote = state.cart.quoteState.status === 'confirmed' ? state.cart.quoteState.quote : null;
    const count = store.cartItemCount();
    const eligibility = store.checkoutEligibility();
    const total = quote ? quote.totalMinor : (state.cart.lastConfirmedQuote ? state.cart.lastConfirmedQuote.totalMinor : 0);
    const offlineBanner = !state.services.online ? '<div class="banner warning"><span aria-hidden="true">' + icon('warning') + '</span><div><strong>Offline</strong><div>Cached catalog and cart remain available. Connection is required to confirm pricing and complete this sale. Your cart is saved.</div></div></div>' : '';
    const passiveBanner = state.secondTabPassive ? '<div class="banner info"><span aria-hidden="true">i</span><div><strong>Passive window</strong><div>This register is active in another window. Selling is view-only here.</div></div></div>' : '';
    return offlineBanner + passiveBanner + '<div class="sell-layout">' +
      '<section class="sell-products" aria-label="Products">' +
        '<div class="product-toolbar">' +
          '<div class="search-box"><span class="search-icon" aria-hidden="true">' + icon('search') + '</span><label class="sr-only" for="product-search">Scan barcode or search products</label><input class="input" id="product-search" value="' + e(state.search.query) + '" placeholder="Scan barcode or search products, SKU…" autocomplete="off"></div>' +
          '<button class="btn desktop-only" data-action="focus-search" title="Shortcut: F2 / Ctrl+K">F2 Search</button>' +
        '</div>' +
        '<div class="demo-barcodes" aria-label="Mock barcode shortcuts">' +
          '<button class="demo-code" data-action="scan" data-barcode="0012345678901">Hardener · 0012345678901</button>' +
          '<button class="demo-code" data-action="scan" data-barcode="0001112223334">Cable Red variation</button>' +
          '<button class="demo-code" data-action="scan" data-barcode="9999999999999">Unknown barcode</button>' +
          '<button class="demo-code" data-action="scan-collision">Collision demo</button>' +
        '</div>' +
        '<div class="row between"><div><strong>Products</strong><span class="muted"> · ' + results.length + ' shown</span></div><span class="muted">Preview data</span></div>' +
        '<div class="product-results"><div class="product-grid">' + results.map(ProductCard).join('') + '</div></div>' +
      '</section>' +
      CartPanel(state) +
      '<div class="mobile-cart-bar"><div><strong>' + count + ' item' + (count === 1 ? '' : 's') + '</strong><div class="muted">' + (total ? money(total) : 'Price pending') + '</div></div><button class="btn primary" data-action="mobile-cart-open">View Cart / Pay</button></div>' +
    '</div>';
  }

  function ProductCard(product) {
    const stockClass = product.stockStatus === 'out_of_stock' ? 'out' : (product.stockStatus === 'low_stock' ? 'low' : '');
    const stockText = product.stockStatus === 'out_of_stock' ? 'Out of stock' : (product.stockStatus === 'low_stock' ? 'Low stock · ' + product.stockQty + ' left' : product.stockQty + ' available');
    const badges = (product.badges || []).slice(0, 2).map((b) => badge(b, b.toLowerCase().includes('stock') ? 'warning' : 'info')).join('');
    return '<button type="button" class="product-card" data-action="add-product" data-product-id="' + e(product.id) + '" ' + (product.stockStatus === 'out_of_stock' ? 'aria-describedby="out-' + e(product.id) + '"' : '') + '>' +
      '<div class="product-badges">' + badges + '</div>' +
      '<div class="product-name">' + e(product.name) + '</div>' +
      '<div class="muted">' + e(product.sku) + '</div>' +
      '<div class="stock-line ' + stockClass + '" id="out-' + e(product.id) + '">' + e(stockText) + '</div>' +
      '<div class="product-price">' + money(product.displayPriceMinor) + '</div>' +
    '</button>';
  }

  function CartPanel(state) {
    const quoteState = state.cart.quoteState;
    const quote = quoteState.status === 'confirmed' ? quoteState.quote : null;
    const customer = state.cart.customer;
    const eligibility = store.checkoutEligibility();
    const wholesale = customer && customer.type === 'b2b';
    return '<aside class="cart-panel ' + (state.mobileCartOpen ? 'mobile-open' : '') + '" aria-label="Current cart">' +
      '<div class="cart-head">' +
        '<div class="row between"><div><strong>Cart</strong><span class="muted"> · Rev ' + e(state.cart.revision) + '</span></div><div class="row"><button class="btn small ghost mobile-only" data-action="mobile-cart-close">Back</button>' + (state.cart.lines.length ? '<button class="btn small ghost" data-action="clear-cart">Clear</button>' : '') + '</div></div>' +
        '<button class="customer-chip ' + (wholesale ? 'wholesale' : '') + '" data-action="open-customers"><span><span class="eyebrow">Customer</span><br><span class="customer-name">' + e(customer.displayName) + '</span>' + (wholesale ? '<br><span class="badge info">WHOLESALE</span>' : '') + '</span><span aria-hidden="true">›</span></button>' +
        QuoteStatus(state) +
      '</div>' +
      '<div class="cart-lines">' + (state.cart.lines.length ? state.cart.lines.map((line) => CartLine(state, line, quote)).join('') : '<div class="empty-cart"><div><div style="font-size:36px" aria-hidden="true">' + icon('cart') + '</div><strong>Your cart is empty</strong><div>Scan a barcode or choose a product to start selling.</div></div></div>') + '</div>' +
      '<div class="cart-footer">' +
        '<div class="summary-row"><span>Subtotal</span><strong>' + money(quote ? quote.subtotalMinor : 0) + '</strong></div>' +
        '<div class="summary-row"><span>Discount</span><strong>' + money(quote ? quote.discountMinor : 0) + '</strong></div>' +
        '<div class="summary-row"><span>Tax</span><strong>' + money(quote ? quote.taxMinor : 0) + '</strong></div>' +
        '<div class="summary-row total"><span>Total</span><span>' + money(quote ? quote.totalMinor : 0) + '</span></div>' +
        '<button class="btn primary block pay-btn" data-action="pay" ' + (eligibility.allowed ? '' : 'disabled') + '>' + (eligibility.allowed ? 'Pay ' + money(quote.totalMinor) : 'Pay') + '</button>' +
        '<div class="pay-reason">' + e(eligibility.reason) + '</div>' +
      '</div>' +
    '</aside>';
  }

  function QuoteStatus(state) {
    const qs = state.cart.quoteState;
    if (!state.cart.lines.length) return '<div class="quote-status">Prices will be confirmed after an item is added.</div>';
    if (qs.status === 'quoting' || qs.status === 'stale') return '<div class="quote-status warning"><span class="dot"></span>Updating price…</div>';
    if (qs.status === 'confirmed') {
      const changed = state.cart.priceDisclosure;
      return '<div class="quote-status confirmed"><span aria-hidden="true">✓</span><span>' + (changed ? e(changed) : 'Price confirmed') + '</span></div>';
    }
    if (qs.status === 'offline') return '<div class="quote-status warning"><span aria-hidden="true">!</span>Connection required to confirm price</div>';
    if (qs.status === 'failed') return '<div class="quote-status danger"><span aria-hidden="true">!</span>Pricing unavailable — cart saved</div>';
    if (qs.status === 'expired') return '<div class="quote-status warning">Price expired — updating…</div>';
    return '<div class="quote-status">Price confirmation required</div>';
  }

  function CartLine(state, line, quote) {
    const qLine = quote && quote.lines.find((q) => q.lineId === line.id);
    const unit = qLine ? qLine.unitPriceMinor : line.displayUnitPriceMinor;
    const lineTotal = qLine ? qLine.totalMinor : (line.displayUnitPriceMinor * line.quantity);
    const note = qLine && qLine.pricingLabel ? '<div class="line-note">' + e(qLine.pricingLabel) + '</div>' : (state.cart.quoteState.status === 'quoting' ? '<div class="muted">Updating…</div>' : '');
    const stockWarning = qLine && !qLine.purchasable ? '<div class="line-warning">Only ' + e(qLine.availableQuantity) + ' available. Adjust quantity to continue.</div>' : '';
    return '<article class="cart-line" data-line-id="' + e(line.id) + '">' +
      '<div class="cart-line-title"><div><div class="cart-line-name">' + e(line.name) + '</div>' + (line.variationLabel ? '<div class="muted">' + e(line.variationLabel) + '</div>' : '') + '<div class="muted">' + e(line.sku || '') + '</div></div><div class="cart-line-total">' + money(lineTotal) + '</div></div>' +
      '<div class="qty-row"><div class="qty-control"><button class="btn small" data-action="qty-dec" data-line-id="' + e(line.id) + '" aria-label="Decrease quantity">−</button><label class="sr-only" for="qty-' + e(line.id) + '">Quantity</label><input id="qty-' + e(line.id) + '" class="qty-input" inputmode="numeric" value="' + e(line.quantity) + '" data-action="qty-input" data-line-id="' + e(line.id) + '"><button class="btn small" data-action="qty-inc" data-line-id="' + e(line.id) + '" aria-label="Increase quantity">+</button></div><div class="muted">' + money(unit) + ' each</div><button class="btn small ghost danger" data-action="remove-line" data-line-id="' + e(line.id) + '">Remove</button></div>' +
      note + stockWarning +
    '</article>';
  }

  function OrdersView(state) {
    const rows = state.orders.map((order) => '<tr class="clickable" data-action="order-detail" data-order-id="' + e(order.id) + '"><td><strong>' + e(order.orderRef) + '</strong><br><span class="muted">' + e(order.receiptNumber) + '</span></td><td>' + e(order.customer.displayName) + (order.customer.type === 'b2b' ? '<br>' + badge('Wholesale','info') : '') + '</td><td>' + e(dateTime(order.createdAt)) + '</td><td>' + e(order.paymentMethod) + '<br>' + badge(order.paymentStatus || 'verified', order.paymentStatus === 'pending' ? 'warning' : 'success') + '</td><td><strong>' + money(order.totalMinor) + '</strong></td><td>' + badge(order.status, order.status === 'completed' ? 'success' : (order.status === 'refunded' ? 'warning' : 'info')) + '</td></tr>').join('');
    return '<div class="page-head"><div><h1>Orders</h1><p>Find sales, reprint receipts, and start returns.</p></div><button class="btn" data-action="route" data-route="sell">New sale</button></div>' +
      '<div class="card card-pad" style="margin-bottom:14px"><div class="order-tools"><div class="search-box"><span class="search-icon" aria-hidden="true">⌕</span><input class="input" id="order-search" placeholder="Search order, receipt, customer or transaction…"></div><label class="field compact"><span>Status</span><select class="select" id="order-status-filter"><option value="all">All</option><option value="completed">Completed</option><option value="refunded">Refunded</option><option value="payment_pending">Payment pending</option><option value="needs_attention">Needs attention</option></select></label></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Payment</th><th>Total</th><th>Status</th></tr></thead><tbody id="order-table-body">' + (rows || '<tr><td colspan="6">No orders yet.</td></tr>') + '</tbody></table></div>';
  }

  function CustomersView() {
    return '<div class="page-head"><div><h1>Customers</h1><p>Retail and wholesale customer context. Customer records here are fictional demo data.</p></div></div>' +
      '<div class="grid-2">' + data.customers.filter((c) => c.id !== 'walkin').map((customer) => '<article class="card card-pad"><div class="row between"><div><strong>' + e(customer.displayName) + '</strong><div class="muted">' + e(customer.phoneMasked) + '</div></div>' + (customer.type === 'b2b' ? badge('WHOLESALE','info') : badge('Retail','')) + '</div>' + (customer.groupLabel ? '<p class="muted">' + e(customer.groupLabel) + '</p>' : '') + '<button class="btn small" data-action="select-customer-direct" data-customer-id="' + e(customer.id) + '">Use for next sale</button></article>').join('') + '</div>';
  }

  function ReturnsView(state) {
    const eligible = state.orders.filter((o) => o.status === 'completed' || o.status === 'partially_refunded');
    return '<div class="page-head"><div><h1>Returns</h1><p>Returns keep refund, payment and physical stock disposition separate.</p></div></div>' +
      (!state.services.online ? '<div class="banner warning" style="margin-bottom:14px"><strong>Connection required.</strong><span>Returns and refunds are online-required in the launch scope.</span></div>' : '') +
      '<div class="card card-pad" style="margin-bottom:14px"><div class="search-box"><span class="search-icon" aria-hidden="true">⌕</span><input class="input" id="return-search" placeholder="Find order, customer or receipt…"></div></div>' +
      '<div class="grid-2" id="return-order-grid">' + eligible.map((order) => '<article class="card card-pad return-order-card" data-search="' + e((order.orderRef + ' ' + order.receiptNumber + ' ' + order.customer.displayName + ' ' + order.transactionRef).toLowerCase()) + '"><div class="row between"><div><strong>' + e(order.orderRef) + '</strong><div class="muted">' + e(order.customer.displayName) + ' · ' + e(dateTime(order.createdAt)) + '</div></div><strong>' + money(order.totalMinor) + '</strong></div><p class="muted">' + order.lines.map((l) => e(l.quantity + ' × ' + l.name)).join('<br>') + '</p><button class="btn" data-action="start-return" data-order-id="' + e(order.id) + '" ' + (!state.services.online ? 'disabled' : '') + '>Return items</button></article>').join('') + '</div>' +
      (state.returns.length ? '<h2 style="margin-top:22px">Recent returns</h2><div class="table-wrap"><table><thead><tr><th>Return</th><th>Order</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead><tbody>' + state.returns.map((r) => '<tr><td>' + e(r.id) + '</td><td>' + e(r.orderRef) + '</td><td>' + money(r.totalMinor) + '</td><td>' + e(r.method) + '</td><td>' + badge(r.status, r.status === 'completed' ? 'success' : 'warning') + '</td></tr>').join('') + '</tbody></table></div>' : '');
  }

  function RegisterView(state) {
    const shift = state.register.shift;
    const register = data.registers.find((r) => r.id === state.register.selectedId);
    if (!shift || shift.status !== 'open') {
      return '<div class="page-head"><div><h1>Register</h1><p>Select a register and open a shift before taking payment.</p></div></div>' +
        '<section class="card card-pad" style="max-width:580px"><form id="open-register-form" class="stack">' +
          '<div class="field"><label for="register-select">Register</label><select class="select" id="register-select">' + data.registers.map((r) => '<option value="' + e(r.id) + '" ' + (r.id === state.register.selectedId ? 'selected' : '') + '>' + e(r.name + ' · ' + r.location) + '</option>').join('') + '</select></div>' +
          '<div class="field"><label for="opening-float">Opening cash</label><input class="input" id="opening-float" inputmode="decimal" value="500.00" aria-describedby="opening-help"><div class="muted" id="opening-help">Recorded as the opening float for the shift.</div></div>' +
          '<button class="btn primary" type="submit" ' + (!state.services.online ? 'disabled' : '') + '>Open register</button>' +
          (!state.services.online ? '<div class="banner warning">Connection required to open a register.</div>' : '') +
        '</form></section>';
    }
    const expected = store.expectedCashMinor();
    const cashSales = (shift.movements || []).filter((m) => m.type === 'cash_sale').reduce((sum, m) => sum + m.amountMinor, 0);
    const cashRefunds = Math.abs((shift.movements || []).filter((m) => m.type === 'cash_refund').reduce((sum, m) => sum + m.amountMinor, 0));
    return '<div class="page-head"><div><h1>' + e(register.name) + '</h1><p>Shift opened ' + e(dateTime(shift.openedAt)) + ' · ' + e(state.auth.user.name) + '</p></div>' + badge('OPEN','success') + '</div>' +
      '<div class="grid-4" style="margin-bottom:14px">' +
        '<div class="card metric"><div class="eyebrow">Opening float</div><div class="metric-value">' + money(shift.openingFloatMinor) + '</div></div>' +
        '<div class="card metric"><div class="eyebrow">Cash sales</div><div class="metric-value">' + money(cashSales) + '</div></div>' +
        '<div class="card metric"><div class="eyebrow">Cash refunds</div><div class="metric-value">' + money(cashRefunds) + '</div></div>' +
        '<div class="card metric"><div class="eyebrow">Expected drawer</div><div class="metric-value">' + money(expected) + '</div></div>' +
      '</div>' +
      '<section class="card card-pad"><div class="row wrap"><button class="btn" data-action="cash-movement" data-type="pay_in">Cash In</button><button class="btn" data-action="cash-movement" data-type="pay_out">Cash Out</button><button class="btn" data-action="cash-movement" data-type="cash_pickup">Cash Pickup</button><button class="btn" data-action="x-report">X Report</button><button class="btn danger" data-action="begin-close">Close register</button></div><div class="divider" style="margin:16px 0"></div><h2>Cash movement history</h2>' +
        '<div class="table-wrap"><table><thead><tr><th>Time</th><th>Type</th><th>Amount</th><th>Note</th></tr></thead><tbody>' + (shift.movements || []).slice().reverse().map((m) => '<tr><td>' + e(dateTime(m.createdAt)) + '</td><td>' + e(m.type.replace(/_/g,' ')) + '</td><td>' + money(m.amountMinor) + '</td><td>' + e(m.note || '') + '</td></tr>').join('') + '</tbody></table></div>' +
      '</section>' + (state.register.lastZ ? '<div class="banner success" style="margin-top:14px"><strong>Last Z report</strong><span>' + e(dateTime(state.register.lastZ.closedAt)) + ' · Variance ' + money(state.register.lastZ.varianceMinor) + '</span></div>' : '');
  }

  function HealthView(state) {
    const s = state.services;
    const rows = [
      ['Internet', s.online, s.online ? 'Connected' : 'Offline'],
      ['Commerce runtime', s.commerce, s.commerce ? 'Healthy' : 'Unavailable'],
      ['Authoritative pricing', s.pricing, s.pricing ? 'Available' : 'Unavailable'],
      ['Catalog projection', s.catalogFresh, s.catalogFresh ? 'Fresh · demo' : 'Stale'],
      ['Payments', s.payments, s.payments ? 'Available' : 'Unavailable'],
      ['Local data', s.localDb, s.localDb ? 'Healthy' : 'Warning'],
      ['App version', s.supportedVersion, s.supportedVersion ? 'Supported' : 'Unsupported']
    ];
    const pending = state.attention.filter((a) => a.status === 'open').length;
    const pendingOps = (['preparing','checking','reserved'].includes(state.checkout.stage) ? 1 : 0) + (['initializing','awaiting_customer','pending','reconciling','finalizing'].includes(state.payment.stage) ? 1 : 0) + (state.returnDraft && state.returnDraft.result && state.returnDraft.result.status === 'pending' ? 1 : 0) + (state.migration.state === 'running' ? 1 : 0);
    return '<div class="page-head"><div><h1>Store Health</h1><p>Operational status stays visible instead of hiding sync and recovery problems in Settings.</p></div><button class="btn" data-action="sync-catalog">Rebuild catalog demo</button></div>' +
      '<div class="grid-3" style="margin-bottom:14px"><div class="card metric"><div class="eyebrow">Pending operations</div><div class="metric-value">' + pendingOps + '</div></div><div class="card metric"><div class="eyebrow">Needs attention</div><div class="metric-value">' + pending + '</div></div><div class="card metric"><div class="eyebrow">Build</div><div class="metric-value" style="font-size:17px">' + e(data.config.buildId) + '</div></div></div>' +
      '<div class="health-list">' + rows.map((r) => '<div class="health-row"><div><div class="health-name">' + e(r[0]) + '</div><div class="muted">' + e(r[2]) + '</div></div>' + badge(r[1] ? 'OK' : 'Needs attention', r[1] ? 'success' : 'danger') + '</div>').join('') + '</div>' +
      '<div class="card card-pad" style="margin-top:14px"><h2>Version & recovery</h2><div class="grid-2"><div><div class="muted">Application</div><strong>' + e(data.config.appVersion) + '</strong></div><div><div class="muted">API contract</div><strong>' + e(data.config.apiContractVersion) + '</strong></div><div><div class="muted">Local schema</div><strong>' + e(data.config.localSchemaVersion) + '</strong></div><div><div class="muted">Device</div><strong>' + e(state.settings.deviceName) + '</strong></div></div><div class="row wrap" style="margin-top:14px"><button class="btn" data-action="open-fix-app">Fix App</button><button class="btn" data-action="demo-update">Simulate update ready</button></div></div>';
  }

  function AttentionView(state) {
    const openItems = state.attention.filter((item) => item.status === 'open');
    return '<div class="page-head"><div><h1>Needs attention</h1><p>Ambiguous financial and sync states are reviewed here rather than hidden behind generic errors.</p></div></div>' +
      (openItems.length ? '<div class="stack">' + openItems.map((item) => '<article class="card attention-item ' + e(item.severity || 'medium') + '"><div class="row between"><div><strong>' + e(item.title) + '</strong><div class="muted">' + e(item.type) + (item.transactionRef ? ' · ' + e(item.transactionRef) : '') + '</div></div>' + badge((item.severity || 'medium').toUpperCase(), item.severity === 'critical' ? 'danger' : 'warning') + '</div><p style="margin:0">' + e(item.summary) + '</p><div class="row wrap"><button class="btn" data-action="resolve-attention" data-attention-id="' + e(item.id) + '">Check / Recover</button><button class="btn ghost" data-action="ack-attention" data-attention-id="' + e(item.id) + '">Mark reviewed</button></div></article>').join('') + '</div>' : '<div class="card card-pad"><div class="banner success"><strong>All clear.</strong><span>No transactions currently need manager attention.</span></div></div>');
  }

  function SettingsView(state) {
    return '<div class="page-head"><div><h1>Settings</h1><p>Small operational settings surface — not a WordPress-style control panel.</p></div></div>' +
      '<div class="grid-2">' +
        '<section class="card card-pad stack"><h2>Device & register</h2><div class="field"><span class="label">Device</span><div>' + e(state.settings.deviceName) + '</div></div><div class="field"><span class="label">Register</span><div>' + e((data.registers.find((r) => r.id === state.settings.registerId) || {}).name || 'Unassigned') + '</div></div><div class="field"><span class="label">Scanner</span><div>' + e(state.settings.scanner) + '</div></div><div class="field"><span class="label">Printer</span><div>' + e(state.settings.printer) + '</div></div></section>' +
        '<section class="card card-pad stack"><h2>Appearance</h2><div class="field"><label for="appearance-select">Theme</label><select class="select" id="appearance-select"><option value="system" ' + (state.settings.appearance === 'system' ? 'selected' : '') + '>System</option><option value="light" ' + (state.settings.appearance === 'light' ? 'selected' : '') + '>Light</option><option value="dark" ' + (state.settings.appearance === 'dark' ? 'selected' : '') + '>Dark</option></select></div><div class="divider"></div><h2>Diagnostics</h2><div class="muted">Build</div><strong>' + e(data.config.buildId) + '</strong><div class="muted">Frontend contracts</div><strong>Provider-neutral preview</strong><button class="btn" data-action="route" data-route="health">Open Store Health</button></section>' +
      '</div>';
  }

  function pageForRoute(state) {
    if (state.route === 'sell') return SellView(state);
    if (state.route === 'orders') return OrdersView(state);
    if (state.route === 'customers') return CustomersView(state);
    if (state.route === 'returns') return ReturnsView(state);
    if (state.route === 'register') return RegisterView(state);
    if (state.route === 'health') return HealthView(state);
    if (state.route === 'attention') return AttentionView(state);
    if (state.route === 'settings') return SettingsView(state);
    return SellView(state);
  }

  function Modal(state) {
    const modal = state.ui.modal;
    if (!modal) return '';
    if (modal.type === 'variation') return VariationModal(modal);
    if (modal.type === 'customers') return CustomerModal(state, modal);
    if (modal.type === 'payment') return PaymentModal(state);
    if (modal.type === 'receipt') return ReceiptModal(state, modal.receipt || state.receipt);
    if (modal.type === 'order') return OrderModal(state, modal.orderId);
    if (modal.type === 'return') return ReturnModal(state, modal);
    if (modal.type === 'cash-movement') return CashMovementModal(modal);
    if (modal.type === 'x-report') return XReportModal(state);
    if (modal.type === 'close-shift') return CloseShiftModal(state, modal);
    if (modal.type === 'z-report') return ZReportModal(state, modal.report || state.register.lastZ);
    if (modal.type === 'update') return UpdateModal(state);
    if (modal.type === 'fix-app') return FixAppModal(state);
    if (modal.type === 'migration') return MigrationModal(state);
    if (modal.type === 'print-failure') return PrintFailureModal(state);
    if (modal.type === 'barcode-collision') return CollisionModal();
    return '';
  }

  function modalFrame(title, body, actions, cls) {
    return '<div class="modal-backdrop" data-action="modal-backdrop"><section class="modal ' + e(cls || '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">' + e(title) + '</h2><button class="icon-btn" data-action="close-modal" aria-label="Close dialog">×</button></div><div class="modal-body">' + body + '</div>' + (actions ? '<div class="modal-actions">' + actions + '</div>' : '') + '</section></div>';
  }

  function VariationModal(modal) {
    const product = data.products.find((p) => p.id === modal.productId);
    if (!product) return '';
    const body = '<p class="muted">Select the exact variation. Scanning a variation barcode bypasses this chooser.</p><div class="stack">' + (product.variations || []).map((v) => '<button class="btn block" data-action="select-variation" data-product-id="' + e(product.id) + '" data-variation-id="' + e(v.id) + '"><span style="text-align:left;flex:1"><strong>' + e(v.name) + '</strong><br><span class="muted">' + e(v.sku) + ' · ' + v.stockQty + ' available</span></span><strong>' + money(v.displayPriceMinor) + '</strong></button>').join('') + '</div>';
    return modalFrame('Choose variation', body, '<button class="btn" data-action="close-modal">Cancel</button>');
  }

  function CustomerModal(state, modal) {
    const q = modal.query || '';
    const matches = data.customers.filter((c) => !q || [c.displayName,c.company,c.groupLabel,c.phoneMasked].join(' ').toLowerCase().includes(q.toLowerCase()));
    const body = '<div class="search-box" style="margin-bottom:12px"><span class="search-icon">⌕</span><input id="customer-search" class="input" placeholder="Search name, company, phone…" value="' + e(q) + '"></div><div class="stack">' + matches.map((c) => '<button class="btn block" data-action="choose-customer" data-customer-id="' + e(c.id) + '"><span style="text-align:left;flex:1"><strong>' + e(c.displayName) + '</strong><br><span class="muted">' + e(c.type === 'b2b' ? (c.groupLabel || 'Wholesale') : (c.id === 'walkin' ? 'Default customer' : 'Retail')) + (c.phoneMasked ? ' · ' + e(c.phoneMasked) : '') + '</span></span>' + (c.type === 'b2b' ? badge('WHOLESALE','info') : '') + '</button>').join('') + '</div>';
    return modalFrame('Select customer', body, '<button class="btn" data-action="close-modal">Cancel</button>');
  }

  function PaymentModal(state) {
    const qs = store.confirmedQuote();
    const total = qs ? qs.totalMinor : (state.checkout.preparedSale ? state.checkout.preparedSale.totalMinor : 0);
    const checkoutStage = state.checkout.stage;
    const payStage = state.payment.stage;
    if (checkoutStage === 'preparing') return modalFrame('Preparing sale', '<div class="payment-stage"><div class="stage-icon">…</div><strong>Preparing order…</strong><div class="muted">Rechecking price and stock before money is accepted.</div></div>', '');
    if (checkoutStage === 'checking') return modalFrame('Checking sale status', '<div class="payment-stage warning"><div class="stage-icon">?</div><strong>Checking sale status…</strong><div>We are recovering the existing transaction. Do not create another sale.</div></div>', '');
    if (checkoutStage === 'quote_changed') return modalFrame('Price changed', '<div class="banner warning"><strong>Price updated.</strong><span>The authoritative total changed. Review the cart and confirm the new price before payment.</span></div>', '<button class="btn primary" data-action="accept-price-change">Review updated price</button>');
    if (checkoutStage === 'stock_changed') return modalFrame('Stock changed', '<div class="banner warning"><strong>Stock changed.</strong><span>Available quantity changed before checkout. Update the cart before taking payment.</span></div>', '<button class="btn primary" data-action="accept-stock-change">Adjust cart</button>');
    if (checkoutStage === 'needs_attention') return modalFrame('Needs manager attention', '<div class="banner danger"><strong>Sale status is ambiguous.</strong><span>Do not take payment. Resolve the existing transaction first.</span></div>', '<button class="btn" data-action="route-attention-close">Open Needs attention</button>');
    if (payStage === 'cash') {
      const received = state.payment.cashReceivedMinor || 0;
      const change = Math.max(0, received - total);
      return modalFrame('Cash payment', '<div class="stack"><div class="big-money">' + money(total) + '</div><div class="field"><label for="cash-received">Cash received</label><input id="cash-received" class="input" inputmode="decimal" value="' + (received ? (received/100).toFixed(2) : '') + '" placeholder="0.00"></div><div class="row between"><span>Change due</span><strong id="cash-change" style="font-size:24px">' + money(change) + '</strong></div><div class="row wrap"><button class="btn small" data-action="cash-quick" data-minor="' + total + '">Exact</button><button class="btn small" data-action="cash-quick" data-minor="' + (Math.ceil(total/5000)*5000) + '">' + money(Math.ceil(total/5000)*5000) + '</button><button class="btn small" data-action="cash-quick" data-minor="' + (Math.ceil(total/10000)*10000) + '">' + money(Math.ceil(total/10000)*10000) + '</button></div></div>', '<button class="btn" data-action="payment-back">Back</button><button id="confirm-cash-btn" class="btn primary" data-action="confirm-cash" ' + (received < total ? 'disabled' : '') + '>Confirm cash</button>');
    }
    if (payStage === 'initializing') return modalFrame('Payment', '<div class="payment-stage"><div class="stage-icon">…</div><strong>Initializing payment…</strong></div>', '');
    if (payStage === 'awaiting_customer') return modalFrame('Waiting for payment', '<div class="payment-stage"><div class="stage-icon">◉</div><strong>Waiting for customer…</strong><div class="muted">Demo hosted payment / terminal experience.</div></div><div class="banner info"><strong>Demo controls</strong><span>Choose the provider outcome below.</span></div>', '<button class="btn" data-action="payment-outcome" data-outcome="cancel">Cancel</button><button class="btn" data-action="payment-outcome" data-outcome="failure">Fail</button><button class="btn" data-action="payment-outcome" data-outcome="pending">Pending</button><button class="btn" data-action="payment-outcome" data-outcome="timeout">Timeout / recover</button><button class="btn primary" data-action="payment-outcome" data-outcome="success">Success</button>');
    if (payStage === 'pending') return modalFrame('Payment pending', '<div class="payment-stage warning"><div class="stage-icon">!</div><strong>Payment is still pending</strong><div>Do not charge the customer again.</div><div class="muted">Reference: ' + e(state.payment.attempt && state.payment.attempt.providerReference) + '</div></div>', '<button class="btn" data-action="payment-resolve-success">Check again — resolve success</button><button class="btn" data-action="route-attention-close">Manager review</button>');
    if (payStage === 'failed') return modalFrame('Payment failed', '<div class="payment-stage danger"><div class="stage-icon">×</div><strong>Payment failed</strong><div>No successful payment was recorded in this demo attempt.</div></div>', '<button class="btn" data-action="payment-back">Choose another tender</button>');
    if (payStage === 'cancelled') return modalFrame('Payment cancelled', '<div class="payment-stage"><div class="stage-icon">×</div><strong>Payment cancelled</strong><div>The prepared sale is still recoverable until safely cancelled.</div></div>', '<button class="btn" data-action="payment-back">Choose another tender</button>');
    if (payStage === 'reconciling') return modalFrame('Checking payment', '<div class="payment-stage warning"><div class="stage-icon">?</div><strong>Checking payment…</strong><div>Do not charge again while payment status is uncertain.</div></div>', '');
    if (payStage === 'finalizing') return modalFrame('Finalizing sale', '<div class="payment-stage"><div class="stage-icon">…</div><strong>Payment received</strong><div>Finalizing the sale…</div></div>', '');
    if (state.checkout.preparedSale) {
      return modalFrame('Choose payment', '<div class="row between" style="margin-bottom:14px"><div><div class="muted">Order</div><strong>' + e(state.checkout.preparedSale.orderRef) + '</strong></div><div><div class="muted">Total</div><strong style="font-size:24px">' + money(state.checkout.preparedSale.totalMinor) + '</strong></div></div><div class="tender-grid"><button class="tender-card" data-action="choose-tender" data-method="cash"><div class="tender-title">Cash</div><div class="muted">Cash received and change due</div></button><button class="tender-card" data-action="choose-tender" data-method="mobile_money"><div class="tender-title">Mobile Money</div><div class="muted">Simulated hosted / verified flow</div></button><button class="tender-card" data-action="choose-tender" data-method="card"><div class="tender-title">Card</div><div class="muted">Simulated hosted payment</div></button><button class="tender-card" data-action="choose-tender" data-method="external"><div class="tender-title">External electronic</div><div class="muted">Manual reference / terminal concept</div></button></div>', '<button class="btn" data-action="cancel-prepared">Cancel prepared sale</button>');
    }
    return modalFrame('Checkout', '<div class="muted">No prepared sale.</div>', '<button class="btn" data-action="close-modal">Close</button>');
  }

  function ReceiptPaper(receipt) {
    if (!receipt) return '<div>No receipt available.</div>';
    return '<article class="receipt-paper" id="receipt-paper"><h2>CETECH</h2><div class="center">' + e(receipt.location) + '</div><div class="center"><strong>OPERATIONAL POS RECEIPT</strong></div><hr><div class="r-row"><span>Receipt</span><span>' + e(receipt.receiptNumber) + '</span></div><div class="r-row"><span>Order</span><span>' + e(receipt.orderRef) + '</span></div><div class="r-row"><span>Date</span><span>' + e(dateTime(receipt.issuedAt)) + '</span></div><div class="r-row"><span>Register</span><span>' + e(receipt.register) + '</span></div><div class="r-row"><span>Cashier</span><span>' + e(receipt.cashier) + '</span></div><div class="r-row"><span>Customer</span><span>' + e(receipt.customer.displayName) + '</span></div><hr>' + receipt.lines.map((line) => '<div><strong>' + e(line.name) + '</strong>' + (line.variationLabel ? '<div>' + e(line.variationLabel) + '</div>' : '') + '<div class="r-row"><span>' + e(line.quantity) + ' × ' + money(line.unitPriceMinor) + '</span><span>' + money(line.totalMinor) + '</span></div></div>').join('') + '<hr><div class="r-row"><span>Subtotal</span><span>' + money(receipt.subtotalMinor) + '</span></div><div class="r-row"><span>Discount</span><span>' + money(receipt.discountMinor) + '</span></div><div class="r-row"><span>Tax</span><span>' + money(receipt.taxMinor) + '</span></div><div class="r-row r-total"><span>TOTAL</span><span>' + money(receipt.totalMinor) + '</span></div><hr><div class="r-row"><span>Payment</span><span>' + e(receipt.paymentMethod) + '</span></div>' + (receipt.cashReceivedMinor != null ? '<div class="r-row"><span>Cash received</span><span>' + money(receipt.cashReceivedMinor) + '</span></div><div class="r-row"><span>Change</span><span>' + money(receipt.changeMinor) + '</span></div>' : '') + (receipt.paymentReference ? '<div class="r-row"><span>Reference</span><span>' + e(receipt.paymentReference) + '</span></div>' : '') + '<div class="r-row"><span>Transaction</span><span>' + e(receipt.transactionRef) + '</span></div><hr><div class="center">Thank you.</div><p class="center" style="font-size:10px">' + e(receipt.disclaimer) + '</p></article>';
  }

  function ReceiptModal(state, receipt) {
    return modalFrame('Sale complete', '<div class="banner success" style="margin-bottom:14px"><strong>Payment received.</strong><span>The sale is complete.</span></div>' + ReceiptPaper(receipt), '<button class="btn" data-action="print-receipt">Print receipt</button><button class="btn primary" data-action="new-sale">New sale</button>', 'large');
  }

  function OrderModal(state, orderId) {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return '';
    const body = '<div class="grid-2"><div class="stack"><div><div class="eyebrow">Customer</div><strong>' + e(order.customer.displayName) + '</strong>' + (order.customer.type === 'b2b' ? '<div>' + badge('WHOLESALE','info') + '</div>' : '') + '</div><div><div class="eyebrow">Transaction reference</div><strong>' + e(order.transactionRef) + '</strong></div><div><div class="eyebrow">Payment</div><strong>' + e(order.paymentMethod) + '</strong> ' + badge(order.paymentStatus || 'verified', order.paymentStatus === 'pending' ? 'warning' : 'success') + '</div></div><div class="stack"><div><div class="eyebrow">Total</div><div class="big-money">' + money(order.totalMinor) + '</div></div><div><div class="eyebrow">Date</div><strong>' + e(dateTime(order.createdAt)) + '</strong></div><div><div class="eyebrow">Cashier / register</div><strong>' + e(order.cashier + ' · ' + order.register) + '</strong></div></div></div><div class="divider" style="margin:16px 0"></div><div class="stack">' + order.lines.map((l) => '<div class="row between"><span>' + e(l.quantity + ' × ' + l.name) + '</span><strong>' + money(l.totalMinor) + '</strong></div>').join('') + '</div>';
    return modalFrame(order.orderRef, body, '<button class="btn" data-action="reprint-order" data-order-id="' + e(order.id) + '">Reprint</button><button class="btn primary" data-action="start-return" data-order-id="' + e(order.id) + '">Return items</button>','large');
  }

  function ReturnModal(state, modal) {
    const order = state.orders.find((o) => o.id === modal.orderId);
    if (!order) return '';
    const draft = state.returnDraft || { selections: {} };
    if (modal.stage === 'preview' && draft.preview) {
      return modalFrame('Refund preview', '<div class="banner info"><strong>Historical transaction economics</strong><span>The demo refund starts from what was originally paid, not today\'s price.</span></div><div class="stack" style="margin-top:14px">' + draft.preview.lines.map((line) => '<div class="row between"><span>' + e(line.quantity + ' × ' + line.name) + '</span><strong>' + money(line.refundMinor) + '</strong></div>').join('') + '<div class="divider"></div><div class="row between"><strong>Refund total</strong><strong style="font-size:24px">' + money(draft.preview.totalMinor) + '</strong></div><div class="field"><label for="refund-method">Refund method</label><select id="refund-method" class="select"><option value="Original method">Original payment method</option><option value="Cash">Cash refund</option></select></div><div class="banner warning"><strong>Manager approval</strong><span>This preview requires explicit approval before money or stock state changes.</span></div></div>', '<button class="btn" data-action="return-back">Back</button><button class="btn primary" data-action="approve-refund">Approve refund</button>');
    }
    if (modal.stage === 'pending') return modalFrame('Refund pending', '<div class="payment-stage warning"><div class="stage-icon">!</div><strong>Refund submitted</strong><div>Do not issue another refund while provider status is pending.</div></div>', '<button class="btn" data-action="resolve-refund">Resolve demo refund</button>');
    if (modal.stage === 'attention') return modalFrame('Refund needs attention', '<div class="payment-stage danger"><div class="stage-icon">!</div><strong>Refund status is ambiguous</strong><div>Do not issue another refund. A manager must reconcile the original refund attempt.</div></div>', '<button class="btn primary" data-action="route-attention-close">Manager review</button>');
    if (modal.stage === 'complete') return modalFrame('Refund complete', '<div class="payment-stage success"><div class="stage-icon">✓</div><strong>Refund complete</strong><div>The original sale remains in history.</div></div>', '<button class="btn" data-action="close-modal">Done</button>');
    const body = '<div class="banner info" style="margin-bottom:14px"><strong>' + e(order.orderRef) + '</strong><span>Select returned quantities, reason and physical condition.</span></div><div class="stack">' + order.lines.map((line) => {
      const max = Math.max(0, line.quantity - (line.returnedQty || 0));
      const selection = draft.selections[line.lineId] || {};
      return '<div class="card card-pad"><div class="row between"><div><strong>' + e(line.name) + '</strong><div class="muted">Purchased ' + e(line.quantity) + ' · Available to return ' + e(max) + '</div></div><strong>' + money(line.unitPriceMinor) + '</strong></div><div class="grid-3" style="margin-top:12px"><div class="field"><label>Return qty</label><input class="input return-qty" data-line-id="' + e(line.lineId) + '" type="number" min="0" max="' + e(max) + '" value="' + e(selection.quantity || 0) + '"></div><div class="field"><label>Reason</label><select class="select return-reason" data-line-id="' + e(line.lineId) + '"><option>Wrong item</option><option>Changed mind</option><option>Defective</option><option>Damaged</option><option>Not as described</option></select></div><div class="field"><label>Condition</label><select class="select return-condition" data-line-id="' + e(line.lineId) + '"><option value="resellable">Resellable</option><option value="opened_resellable">Opened / resellable</option><option value="damaged">Damaged</option><option value="defective">Defective</option><option value="quarantine">Quarantine</option></select></div></div></div>';
    }).join('') + '</div>';
    return modalFrame('Return items', body, '<button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="preview-refund">Preview refund</button>','large');
  }

  function CashMovementModal(modal) {
    const labels = { pay_in:'Cash In', pay_out:'Cash Out', cash_pickup:'Cash Pickup' };
    return modalFrame(labels[modal.movementType] || 'Cash movement', '<div class="stack"><div class="field"><label for="movement-amount">Amount</label><input id="movement-amount" class="input" inputmode="decimal" placeholder="0.00"></div><div class="field"><label for="movement-note">Reason / note</label><input id="movement-note" class="input" placeholder="Reason"></div></div>', '<button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-cash-movement" data-type="' + e(modal.movementType) + '">Confirm</button>');
  }

  function shiftSummary(state) {
    const shift = state.register.shift;
    const movements = shift ? shift.movements || [] : [];
    const sum = (type) => movements.filter((m) => m.type === type).reduce((total,m) => total + m.amountMinor,0);
    return {
      opening: sum('opening_float'), cashSales: sum('cash_sale'), cashRefunds: Math.abs(sum('cash_refund')), payIn: sum('pay_in'), payOut: Math.abs(sum('pay_out')), pickup: Math.abs(sum('cash_pickup')), expected: store.expectedCashMinor()
    };
  }

  function XReportModal(state) {
    const s = shiftSummary(state);
    const body = '<div class="receipt-paper"><h2>CETECH</h2><div class="center"><strong>X REPORT — OPEN SHIFT</strong></div><hr><div class="r-row"><span>Opening float</span><span>' + money(s.opening) + '</span></div><div class="r-row"><span>Cash sales</span><span>' + money(s.cashSales) + '</span></div><div class="r-row"><span>Cash refunds</span><span>-' + money(s.cashRefunds) + '</span></div><div class="r-row"><span>Cash in</span><span>' + money(s.payIn) + '</span></div><div class="r-row"><span>Cash out</span><span>-' + money(s.payOut) + '</span></div><div class="r-row"><span>Pickups</span><span>-' + money(s.pickup) + '</span></div><hr><div class="r-row r-total"><span>EXPECTED</span><span>' + money(s.expected) + '</span></div><hr><div class="center">This report does not close the shift.</div></div>';
    return modalFrame('X report', body, '<button class="btn" data-action="print-receipt">Print</button><button class="btn" data-action="close-modal">Close</button>');
  }

  function CloseShiftModal(state, modal) {
    const expected = store.expectedCashMinor();
    if (modal.stage === 'variance') {
      const counted = modal.countedCashMinor;
      const variance = counted - expected;
      const needsApproval = Math.abs(variance) > data.config.managerVarianceApprovalMinor;
      return modalFrame('Review variance', '<div class="stack"><div class="grid-3"><div><div class="muted">Expected</div><strong>' + money(expected) + '</strong></div><div><div class="muted">Counted</div><strong>' + money(counted) + '</strong></div><div><div class="muted">Variance</div><strong style="color:' + (variance ? 'var(--color-warning)' : 'var(--color-success)') + '">' + money(variance) + '</strong></div></div>' + (needsApproval ? '<div class="banner warning"><strong>Manager approval required.</strong><span>This demo variance exceeds the configured threshold.</span></div><div class="field"><label for="manager-name">Manager approval</label><select id="manager-name" class="select"><option value="Kofi Asare">Kofi Asare — Manager</option></select></div>' : '<div class="banner success"><strong>Within threshold.</strong><span>Shift can close.</span></div>') + '</div>', '<button class="btn" data-action="close-shift-back">Back</button><button class="btn primary" data-action="confirm-close-shift" data-counted="' + e(counted) + '" data-approval="' + (needsApproval ? 'required' : 'not-required') + '">' + (needsApproval ? 'Approve & close' : 'Close shift') + '</button>');
    }
    return modalFrame('Close register', '<div class="stack"><div class="banner info"><strong>Blind cash count</strong><span>Count the drawer before seeing the expected amount.</span></div><div class="field"><label for="closing-count">Cash counted</label><input id="closing-count" class="input" inputmode="decimal" placeholder="0.00"></div><div class="muted">Pending payments/refunds would block an authoritative production close. This preview checks demo attention items separately.</div></div>', '<button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="review-close-shift">Continue</button>');
  }

  function ZReportModal(state, report) {
    if (!report) return '';
    const body = '<div class="receipt-paper"><h2>CETECH</h2><div class="center"><strong>Z / SHIFT CLOSE REPORT</strong></div><hr><div class="r-row"><span>Shift</span><span>' + e(report.shiftId) + '</span></div><div class="r-row"><span>Closed</span><span>' + e(dateTime(report.closedAt)) + '</span></div><hr><div class="r-row"><span>Expected cash</span><span>' + money(report.expectedCashMinor) + '</span></div><div class="r-row"><span>Counted cash</span><span>' + money(report.countedCashMinor) + '</span></div><div class="r-row r-total"><span>Variance</span><span>' + money(report.varianceMinor) + '</span></div><hr><div class="r-row"><span>Approved by</span><span>' + e(report.approvedBy || 'Policy threshold') + '</span></div><div class="center">Immutable preview close snapshot</div></div>';
    return modalFrame('Shift closed', '<div class="banner success" style="margin-bottom:14px"><strong>Shift closed.</strong><span>A new sale requires a new shift.</span></div>' + body, '<button class="btn" data-action="print-receipt">Print</button><button class="btn primary" data-action="close-z-report">Done</button>');
  }

  function UpdateModal(state) {
    const critical = ['preparing','checking'].includes(state.checkout.stage) || ['initializing','awaiting_customer','pending','reconciling','finalizing'].includes(state.payment.stage);
    const hasCart = state.cart.lines.length > 0;
    const safe = !critical && !hasCart;
    const body = critical ? '<div class="banner danger"><strong>Update blocked by active transaction.</strong><span>The new version will wait until payment/recovery reaches a safe point.</span></div>' : (hasCart ? '<div class="banner warning"><strong>Update deferred.</strong><span>Your active cart is saved. Finish or clear it before applying the update.</span></div>' : '<div class="banner success"><strong>Safe to update.</strong><span>No active transaction or cart will be interrupted.</span></div>');
    return modalFrame('Update ready', body + '<div class="stack" style="margin-top:14px"><div class="row between"><span>Current build</span><strong>' + e(data.config.buildId) + '</strong></div><div class="row between"><span>Local data</span><strong>Preserved</strong></div><div class="row between"><span>Catalog projection</span><strong>Rebuildable</strong></div></div>', '<button class="btn" data-action="close-modal">Update later</button><button class="btn primary" data-action="apply-update" ' + (safe ? '' : 'disabled') + '>Update now</button>');
  }

  function FixAppModal(state) {
    const critical = state.attention.some((a) => a.status === 'open' && a.severity === 'critical') || ['preparing','checking'].includes(state.checkout.stage) || ['pending','reconciling','finalizing'].includes(state.payment.stage);
    return modalFrame('Fix App', '<div class="stack"><div class="banner info"><strong>Non-destructive recovery first</strong><span>Critical local business state is kept separate from replaceable caches and rebuildable catalog data.</span></div><ol style="margin:0;padding-left:20px"><li>Check connection and service health</li><li>Repair replaceable app caches</li><li>Rebuild catalog / barcode projection</li><li>Repair preview metadata</li><li>Destructive local reset only as a last resort</li></ol>' + (critical ? '<div class="banner danger"><strong>Destructive reset blocked.</strong><span>A critical operation still needs resolution.</span></div>' : '') + '</div>', '<button class="btn" data-action="fix-health">Check health</button><button class="btn" data-action="sync-catalog">Rebuild catalog</button><button class="btn danger" data-action="reset-preview" ' + (critical ? 'disabled' : '') + '>Last-resort reset</button>');
  }

  function MigrationModal(state) {
    const m = state.migration.state;
    let body = '<div class="payment-stage"><div class="stage-icon">…</div><strong>Preparing local data…</strong><div>Your cart and transaction references are being preserved.</div></div>';
    let actions = '<button class="btn" data-action="migration-complete">Complete migration</button><button class="btn" data-action="migration-block">Simulate another tab blocking</button>';
    if (m === 'blocked') {
      body = '<div class="banner warning"><strong>Another POS window is blocking the data upgrade.</strong><span>Close the other window or let it release the local database. Data has not been deleted.</span></div>';
      actions = '<button class="btn" data-action="migration-retry">Check again</button>';
    }
    if (m === 'complete') {
      body = '<div class="banner success"><strong>Local data updated.</strong><span>Durable cart and critical operation records were preserved.</span></div>';
      actions = '<button class="btn primary" data-action="close-modal">Done</button>';
    }
    return modalFrame('Local data upgrade', body, actions);
  }

  function PrintFailureModal(state) {
    return modalFrame('Print failed', '<div class="banner warning"><strong>Receipt is still saved.</strong><span>The sale is complete; only printing failed. Reprint from the immutable receipt snapshot.</span></div><div class="stack" style="margin-top:14px"><div><div class="eyebrow">Receipt</div><strong>' + e(state.receipt && state.receipt.receiptNumber || 'Saved receipt') + '</strong></div></div>', '<button class="btn" data-action="return-to-receipt">Return to receipt</button><button class="btn primary" data-action="retry-print">Retry print</button>');
  }

  function CollisionModal() {
    return modalFrame('Duplicate barcode match', '<div class="banner warning"><strong>Barcode collision detected.</strong><span>More than one sellable item uses this demo barcode. Choose an item instead of guessing.</span></div><div class="stack" style="margin-top:14px"><button class="btn block" data-action="add-product" data-product-id="p-led-panel">36W LED Panel Light</button><button class="btn block" data-action="add-product" data-product-id="p-distribution-board">12-Way Distribution Board</button></div>', '<button class="btn" data-action="close-modal">Cancel</button>');
  }

  window.CetechComponents = {
    render(state) {
      if (!state.auth.user || ['signed_out','expired','unauthorized','locked'].includes(state.auth.status)) return LoginView(state);
      return AppShell(state, pageForRoute(state));
    },
    helpers: { escape: e, money: money, dateTime: dateTime, ReceiptPaper: ReceiptPaper }
  };
}());
