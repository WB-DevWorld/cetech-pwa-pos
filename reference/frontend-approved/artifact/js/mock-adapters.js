(function () {
  'use strict';

  const data = window.CetechMockData;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function uuid(prefix) {
    if (window.crypto && window.crypto.randomUUID) return (prefix || '') + window.crypto.randomUUID();
    return (prefix || '') + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function profileUnitMinor(profiles, pricingKey, qty) {
    const list = (profiles && profiles[pricingKey]) || (profiles && profiles.walkin) || [];
    let chosen = list[0] || { min: 1, unitMinor: 0 };
    list.forEach((entry) => {
      if (qty >= entry.min && entry.min >= chosen.min) chosen = entry;
    });
    return chosen.unitMinor;
  }

  function sellableFromLine(line) {
    const product = data.products.find((item) => item.id === line.productId);
    if (!product) return null;
    if (line.variationId && product.variations) {
      const variation = product.variations.find((item) => item.id === line.variationId);
      if (!variation) return null;
      return {
        product: product,
        item: variation,
        id: variation.id,
        name: product.name,
        label: variation.name,
        sku: variation.sku,
        barcode: variation.barcode,
        displayPriceMinor: variation.displayPriceMinor,
        stockQty: variation.stockQty,
        stockStatus: variation.stockStatus,
        quoteProfiles: variation.quoteProfiles
      };
    }
    return {
      product: product,
      item: product,
      id: product.id,
      name: product.name,
      label: '',
      sku: product.sku,
      barcode: product.barcode,
      displayPriceMinor: product.displayPriceMinor,
      stockQty: product.stockQty,
      stockStatus: product.stockStatus,
      quoteProfiles: product.quoteProfiles
    };
  }

  const runtime = {
    services: {
      online: true,
      commerce: true,
      pricing: true,
      payments: true,
      catalogFresh: true,
      localDb: true,
      supportedVersion: true
    },
    faults: {
      nextPrepare: 'normal',
      nextPayment: 'success',
      nextRefund: 'success',
      priceChangeDeltaMinor: 0,
      forceOldQuote: false,
      responseLoss: false,
      printFailure: false
    },
    orderCounter: 24110,
    receiptCounter: 120,
    currentPayment: null
  };

  const CatalogPort = {
    async search(query) {
      const q = String(query || '').trim().toLowerCase();
      await delay(20);
      if (!q) return clone(data.products.filter((p) => p.stockStatus !== 'out_of_stock').slice(0, 10));
      return clone(data.products.filter((p) => {
        const variationText = (p.variations || []).map((v) => [v.name, v.sku, v.barcode].join(' ')).join(' ');
        return [p.name, p.shortName, p.sku, p.barcode, p.category, variationText].join(' ').toLowerCase().includes(q);
      }));
    },
    async findByBarcode(barcode) {
      const exact = String(barcode || '').trim();
      await delay(15);
      const matches = [];
      data.products.forEach((product) => {
        if (product.barcode === exact || product.sku === exact) {
          matches.push({ productId: product.id, variationId: null, product: clone(product) });
        }
        (product.variations || []).forEach((variation) => {
          if (variation.barcode === exact || variation.sku === exact) {
            matches.push({ productId: product.id, variationId: variation.id, product: clone(product), variation: clone(variation) });
          }
        });
      });
      return matches;
    },
    async getProduct(id) {
      await delay(15);
      return clone(data.products.find((p) => p.id === id) || null);
    }
  };

  const PricingPort = {
    async quote(request) {
      if (!runtime.services.online || !runtime.services.pricing || !runtime.services.commerce) {
        await delay(220);
        const error = new Error('Pricing unavailable');
        error.code = 'PRICING_UNAVAILABLE';
        throw error;
      }
      let wait = 260 + Math.floor(Math.random() * 340);
      if (runtime.faults.forceOldQuote) {
        runtime.faults.forceOldQuote = false;
        wait = 1150;
      }
      await delay(wait);
      const customer = data.customers.find((c) => c.id === request.customer.id) || data.customers[0];
      let subtotal = 0;
      let discount = 0;
      let tax = 0;
      let total = 0;
      let hasUnavailable = false;
      const lines = request.lines.map((line) => {
        const sellable = sellableFromLine(line);
        if (!sellable) {
          hasUnavailable = true;
          return {
            lineId: line.id,
            productId: line.productId,
            variationId: line.variationId || null,
            quantity: line.quantity,
            unitPriceMinor: 0,
            regularUnitPriceMinor: 0,
            lineSubtotalMinor: 0,
            discountMinor: 0,
            taxMinor: 0,
            totalMinor: 0,
            purchasable: false,
            stockStatus: 'unavailable',
            pricingLabel: 'Product unavailable'
          };
        }
        const qty = Math.max(1, Number(line.quantity) || 1);
        const regularUnit = sellable.displayPriceMinor;
        let effectiveUnit = profileUnitMinor(sellable.quoteProfiles, customer.pricingKey, qty);
        if (runtime.faults.priceChangeDeltaMinor) {
          effectiveUnit = Math.max(0, effectiveUnit + runtime.faults.priceChangeDeltaMinor);
        }
        const lineSubtotal = regularUnit * qty;
        const lineTotal = effectiveUnit * qty;
        const lineDiscount = Math.max(0, lineSubtotal - lineTotal);
        const available = sellable.stockQty;
        const purchasable = sellable.stockStatus !== 'out_of_stock' && qty <= available;
        if (!purchasable) hasUnavailable = true;
        let pricingLabel = '';
        if (customer.type === 'b2b' && effectiveUnit < regularUnit) pricingLabel = 'Wholesale pricing applied';
        else if (effectiveUnit < regularUnit) pricingLabel = 'Quantity pricing applied';
        subtotal += lineSubtotal;
        discount += lineDiscount;
        total += lineTotal;
        return {
          lineId: line.id,
          productId: line.productId,
          variationId: line.variationId || null,
          quantity: qty,
          unitPriceMinor: effectiveUnit,
          regularUnitPriceMinor: regularUnit,
          lineSubtotalMinor: lineSubtotal,
          discountMinor: lineDiscount,
          taxMinor: 0,
          totalMinor: lineTotal,
          purchasable: purchasable,
          availableQuantity: available,
          stockStatus: sellable.stockStatus,
          pricingLabel: pricingLabel
        };
      });
      const changedByFault = runtime.faults.priceChangeDeltaMinor !== 0;
      runtime.faults.priceChangeDeltaMinor = 0;
      const canonical = JSON.stringify({ c: customer.id, r: request.cartRevision, l: lines.map((l) => [l.productId, l.variationId, l.quantity, l.unitPriceMinor, l.totalMinor]), t: total });
      let fingerprint = 2166136261;
      for (let i = 0; i < canonical.length; i += 1) {
        fingerprint ^= canonical.charCodeAt(i);
        fingerprint = Math.imul(fingerprint, 16777619);
      }
      return {
        quoteId: uuid('q-'),
        fingerprint: 'demo-' + (fingerprint >>> 0).toString(16),
        cartRevision: request.cartRevision,
        customerContext: { id: customer.id, type: customer.type },
        currency: 'GHS',
        lines: lines,
        subtotalMinor: subtotal,
        discountMinor: discount,
        taxMinor: tax,
        totalMinor: total,
        calculatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + data.config.quoteTtlMs).toISOString(),
        priceChanged: changedByFault,
        purchasable: !hasUnavailable
      };
    }
  };

  const CustomerPort = {
    async search(query) {
      await delay(180);
      if (!runtime.services.online) {
        const error = new Error('Customer search unavailable offline');
        error.code = 'OFFLINE';
        throw error;
      }
      const q = String(query || '').trim().toLowerCase();
      if (!q) return clone(data.customers);
      return clone(data.customers.filter((c) => [c.displayName, c.company, c.groupLabel, c.phoneMasked].join(' ').toLowerCase().includes(q)));
    },
    async get(id) {
      await delay(50);
      return clone(data.customers.find((c) => c.id === id) || null);
    }
  };

  const SalesPort = {
    async prepare(input) {
      if (!runtime.services.online || !runtime.services.commerce) {
        await delay(300);
        const error = new Error('Checkout unavailable');
        error.code = 'INTEGRATION_UNAVAILABLE';
        throw error;
      }
      await delay(650);
      if (runtime.faults.nextPrepare === 'quote_changed') {
        runtime.faults.nextPrepare = 'normal';
        const error = new Error('Quote changed');
        error.code = 'QUOTE_CHANGED';
        error.newTotalMinor = input.totalMinor + 1500;
        throw error;
      }
      if (runtime.faults.nextPrepare === 'stock_changed') {
        runtime.faults.nextPrepare = 'normal';
        const line = input.lines[0];
        const error = new Error('Stock changed');
        error.code = 'STOCK_CHANGED';
        error.productId = line && line.productId;
        error.availableQuantity = Math.max(0, (line && line.quantity || 1) - 2);
        throw error;
      }
      if (runtime.faults.nextPrepare === 'needs_attention') {
        runtime.faults.nextPrepare = 'normal';
        const error = new Error('Preparation result ambiguous');
        error.code = 'REQUIRES_ATTENTION';
        throw error;
      }
      runtime.orderCounter += 1;
      const prepared = {
        transactionId: input.transactionId,
        providerOrderId: String(runtime.orderCounter),
        orderRef: '#' + runtime.orderCounter,
        totalMinor: input.totalMinor,
        currency: 'GHS',
        status: 'reserved',
        preparedAt: new Date().toISOString(),
        customer: clone(input.customer),
        lines: clone(input.lines),
        quote: clone(input.quote)
      };
      if (runtime.faults.responseLoss) {
        runtime.faults.responseLoss = false;
        runtime._recoverablePrepared = prepared;
        const error = new Error('Response lost after preparation');
        error.code = 'RESPONSE_UNKNOWN';
        throw error;
      }
      runtime._recoverablePrepared = prepared;
      return prepared;
    },
    async resolve(transactionId) {
      await delay(720);
      if (runtime._recoverablePrepared && runtime._recoverablePrepared.transactionId === transactionId) {
        return { status: 'reserved', preparedSale: clone(runtime._recoverablePrepared) };
      }
      return { status: 'not_found' };
    },
    async cancel(transactionId) {
      await delay(350);
      if (runtime._recoverablePrepared && runtime._recoverablePrepared.transactionId === transactionId) {
        runtime._recoverablePrepared.status = 'cancelled';
      }
      return { status: 'cancelled', transactionId: transactionId };
    }
  };

  const PaymentPort = {
    async begin(input) {
      if (!runtime.services.online || !runtime.services.payments) {
        await delay(280);
        const error = new Error('Payment service unavailable');
        error.code = 'PAYMENT_UNAVAILABLE';
        throw error;
      }
      await delay(380);
      const attempt = {
        paymentId: uuid('pay-'),
        transactionId: input.transactionId,
        method: input.method,
        status: input.method === 'cash' ? 'awaiting_cash' : 'awaiting_customer',
        providerReference: input.method === 'cash' ? null : 'CTPOS-DEMO-' + Math.floor(100000 + Math.random() * 900000),
        amountMinor: input.amountMinor,
        createdAt: new Date().toISOString()
      };
      runtime.currentPayment = attempt;
      return clone(attempt);
    },
    async confirmCash(input) {
      await delay(420);
      const payment = runtime.currentPayment || { paymentId: uuid('pay-'), transactionId: input.transactionId, method: 'cash', amountMinor: input.amountMinor };
      payment.status = 'verified';
      payment.cashReceivedMinor = input.cashReceivedMinor;
      payment.changeMinor = input.cashReceivedMinor - input.amountMinor;
      runtime.currentPayment = payment;
      return clone(payment);
    },
    async resolveElectronic(input) {
      if (!runtime.services.online || !runtime.services.payments) {
        const error = new Error('Payment verification unavailable');
        error.code = 'PAYMENT_UNAVAILABLE';
        throw error;
      }
      await delay(650);
      const outcome = input.outcome || runtime.faults.nextPayment || 'success';
      const payment = runtime.currentPayment || { paymentId: uuid('pay-'), transactionId: input.transactionId, method: input.method, amountMinor: input.amountMinor };
      if (outcome === 'pending') payment.status = 'pending';
      else if (outcome === 'failure') payment.status = 'failed';
      else if (outcome === 'cancel') payment.status = 'cancelled';
      else if (outcome === 'timeout') payment.status = 'response_unknown';
      else payment.status = 'verified';
      runtime.currentPayment = payment;
      return clone(payment);
    },
    async finalize(input) {
      await delay(420);
      if (!runtime.services.commerce && input.method !== 'cash') {
        return { status: 'requires_attention', reason: 'Payment received but order finalization is pending.' };
      }
      return { status: 'completed', transactionId: input.transactionId };
    }
  };

  const RegisterPort = {
    async openShift(input) {
      if (!runtime.services.online) {
        const error = new Error('Connection required to open register');
        error.code = 'OFFLINE';
        throw error;
      }
      await delay(330);
      return {
        id: uuid('shift-'),
        registerId: input.registerId,
        staffId: input.staffId,
        status: 'open',
        openingFloatMinor: input.openingFloatMinor,
        openedAt: new Date().toISOString(),
        movements: [{ id: uuid('mov-'), type: 'opening_float', amountMinor: input.openingFloatMinor, createdAt: new Date().toISOString(), note: 'Opening float' }]
      };
    },
    async recordCashMovement(shift, movement) {
      if (!runtime.services.online) {
        const error = new Error('Connection required for authoritative cash movement');
        error.code = 'OFFLINE';
        throw error;
      }
      await delay(220);
      return Object.assign({ id: uuid('mov-'), createdAt: new Date().toISOString() }, movement);
    },
    async closeShift(input) {
      if (!runtime.services.online) {
        const error = new Error('Connection required to close register');
        error.code = 'OFFLINE';
        throw error;
      }
      await delay(520);
      return {
        id: uuid('z-'),
        shiftId: input.shift.id,
        expectedCashMinor: input.expectedCashMinor,
        countedCashMinor: input.countedCashMinor,
        varianceMinor: input.countedCashMinor - input.expectedCashMinor,
        approvedBy: input.approvedBy || null,
        closedAt: new Date().toISOString(),
        movements: clone(input.shift.movements || [])
      };
    }
  };

  const ReceiptPort = {
    create(input) {
      runtime.receiptCounter += 1;
      const receiptNumber = 'CT-PREVIEW-' + String(runtime.receiptCounter).padStart(5, '0');
      return Object.assign({
        receiptNumber: receiptNumber,
        issuedAt: new Date().toISOString(),
        location: data.config.locationName,
        disclaimer: data.config.receiptDisclaimer
      }, clone(input));
    }
  };

  const ReturnPort = {
    async preview(order, items) {
      if (!runtime.services.online || !runtime.services.commerce) {
        const error = new Error('Connection required for returns');
        error.code = 'OFFLINE';
        throw error;
      }
      await delay(440);
      const lines = items.map((selection) => {
        const source = order.lines.find((l) => l.lineId === selection.lineId);
        const refundable = Math.max(0, source.quantity - (source.returnedQty || 0));
        const quantity = Math.min(refundable, Math.max(0, Number(selection.quantity) || 0));
        return {
          lineId: source.lineId,
          name: source.name,
          quantity: quantity,
          maxRefundableQuantity: refundable,
          unitPriceMinor: source.unitPriceMinor,
          refundMinor: source.unitPriceMinor * quantity,
          condition: selection.condition,
          reason: selection.reason
        };
      });
      return { lines: lines, totalMinor: lines.reduce((sum, line) => sum + line.refundMinor, 0), currency: 'GHS' };
    },
    async execute(input) {
      await delay(650);
      const outcome = runtime.faults.nextRefund || 'success';
      runtime.faults.nextRefund = 'success';
      if (outcome === 'pending') return { status: 'pending', refundRef: uuid('ref-') };
      if (outcome === 'attention') return { status: 'requires_attention', refundRef: uuid('ref-') };
      return { status: 'completed', refundRef: uuid('ref-') };
    }
  };

  const HealthPort = {
    async getHealth() {
      await delay(40);
      return clone(runtime.services);
    }
  };

  const SyncPort = {
    async rebuildCatalog() {
      await delay(900);
      runtime.services.catalogFresh = true;
      return { status: 'completed', completedAt: new Date().toISOString() };
    }
  };

  const IdentityPort = {
    async login(staffId) {
      await delay(180);
      return clone(data.staff.find((s) => s.id === staffId) || null);
    },
    can(user, capability) {
      return !!user && user.capabilities.indexOf(capability) >= 0;
    }
  };

  window.CetechAdapters = {
    runtime: runtime,
    CatalogPort: CatalogPort,
    PricingPort: PricingPort,
    CustomerPort: CustomerPort,
    SalesPort: SalesPort,
    PaymentPort: PaymentPort,
    RegisterPort: RegisterPort,
    ReceiptPort: ReceiptPort,
    ReturnPort: ReturnPort,
    HealthPort: HealthPort,
    SyncPort: SyncPort,
    IdentityPort: IdentityPort,
    helpers: { uuid: uuid, sellableFromLine: sellableFromLine }
  };
}());
