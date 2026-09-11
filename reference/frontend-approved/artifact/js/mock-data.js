(function () {
  'use strict';

  const moneyProfiles = function (retail, qtyTiers, groupA, groupB, negotiated) {
    return {
      walkin: [{ min: 1, unitMinor: retail }].concat(qtyTiers || []),
      retail: [{ min: 1, unitMinor: retail }].concat(qtyTiers || []),
      b2bA: groupA || [{ min: 1, unitMinor: retail }],
      b2bB: groupB || [{ min: 1, unitMinor: retail }],
      negotiated: negotiated || groupA || [{ min: 1, unitMinor: retail }]
    };
  };

  const products = [
    {
      id: 'p-hi-q-hardener',
      name: 'HiQ Urethane Hardener 1L',
      shortName: 'HiQ Hardener 1L',
      sku: 'HQ-CCH230-1L',
      barcode: '0012345678901',
      type: 'simple',
      category: 'Automotive Refinish',
      displayPriceMinor: 15500,
      regularPriceMinor: 15500,
      salePriceMinor: null,
      stockQty: 42,
      stockStatus: 'in_stock',
      badges: ['Demo quantity price'],
      quoteProfiles: moneyProfiles(
        15500,
        [{ min: 5, unitMinor: 14900 }, { min: 10, unitMinor: 14200 }],
        [{ min: 1, unitMinor: 13800 }, { min: 12, unitMinor: 12900 }],
        [{ min: 1, unitMinor: 13400 }, { min: 24, unitMinor: 12300 }],
        [{ min: 1, unitMinor: 12100 }]
      )
    },
    {
      id: 'p-impact-drill',
      name: '650W Professional Impact Drill',
      shortName: '650W Impact Drill',
      sku: 'PWR-DRILL-650',
      barcode: '5901234567890',
      type: 'simple',
      category: 'Power Tools',
      displayPriceMinor: 42500,
      regularPriceMinor: 47500,
      salePriceMinor: 42500,
      stockQty: 18,
      stockStatus: 'in_stock',
      badges: ['Sale price'],
      quoteProfiles: moneyProfiles(
        42500,
        [],
        [{ min: 1, unitMinor: 38900 }, { min: 6, unitMinor: 37200 }],
        [{ min: 1, unitMinor: 38200 }, { min: 6, unitMinor: 36500 }],
        [{ min: 1, unitMinor: 34900 }]
      )
    },
    {
      id: 'p-emulsion-paint',
      name: 'Premium Interior Emulsion Paint 20L',
      shortName: 'Emulsion Paint 20L',
      sku: 'PNT-INT-20L',
      barcode: '5012345678902',
      type: 'simple',
      category: 'Paint & Finishes',
      displayPriceMinor: 69000,
      regularPriceMinor: 69000,
      salePriceMinor: null,
      stockQty: 65,
      stockStatus: 'in_stock',
      badges: ['Quantity price', 'Wholesale'],
      quoteProfiles: moneyProfiles(
        69000,
        [{ min: 5, unitMinor: 65500 }, { min: 10, unitMinor: 62500 }],
        [{ min: 1, unitMinor: 61000 }, { min: 10, unitMinor: 57500 }],
        [{ min: 1, unitMinor: 59500 }, { min: 20, unitMinor: 54800 }],
        [{ min: 1, unitMinor: 53500 }]
      )
    },
    {
      id: 'p-pvc-conduit',
      name: 'PVC Electrical Conduit 20mm × 3m',
      shortName: 'PVC Conduit 20mm',
      sku: 'ELEC-PVC20-3M',
      barcode: '0067890123456',
      type: 'simple',
      category: 'Electrical',
      displayPriceMinor: 1800,
      regularPriceMinor: 1800,
      salePriceMinor: null,
      stockQty: 468,
      stockStatus: 'in_stock',
      badges: ['High stock'],
      quoteProfiles: moneyProfiles(
        1800,
        [{ min: 20, unitMinor: 1650 }, { min: 100, unitMinor: 1500 }],
        [{ min: 1, unitMinor: 1580 }, { min: 100, unitMinor: 1420 }],
        [{ min: 1, unitMinor: 1520 }, { min: 100, unitMinor: 1380 }],
        [{ min: 1, unitMinor: 1350 }]
      )
    },
    {
      id: 'p-safety-gloves',
      name: 'Nitrile-Coated Safety Gloves — Pair',
      shortName: 'Safety Gloves',
      sku: 'PPE-GLOVE-NIT',
      barcode: '8901234500071',
      type: 'simple',
      category: 'Safety',
      displayPriceMinor: 3200,
      regularPriceMinor: 3200,
      salePriceMinor: null,
      stockQty: 3,
      stockStatus: 'low_stock',
      badges: ['Low stock'],
      quoteProfiles: moneyProfiles(
        3200,
        [],
        [{ min: 1, unitMinor: 2900 }, { min: 12, unitMinor: 2700 }],
        [{ min: 1, unitMinor: 2850 }, { min: 24, unitMinor: 2600 }],
        [{ min: 1, unitMinor: 2500 }]
      )
    },
    {
      id: 'p-contactor',
      name: '3-Pole Industrial Contactor 32A',
      shortName: 'Industrial Contactor 32A',
      sku: 'ELEC-CON-32A',
      barcode: '4001234500032',
      type: 'simple',
      category: 'Electrical',
      displayPriceMinor: 23500,
      regularPriceMinor: 23500,
      salePriceMinor: null,
      stockQty: 0,
      stockStatus: 'out_of_stock',
      badges: ['Out of stock'],
      quoteProfiles: moneyProfiles(23500, [], [{ min: 1, unitMinor: 21200 }], [{ min: 1, unitMinor: 20500 }], [{ min: 1, unitMinor: 19800 }])
    },
    {
      id: 'p-flex-cable',
      name: 'Flexible Copper Cable 1.5mm² — 100m',
      shortName: 'Copper Cable 1.5mm²',
      sku: 'CAB-FLEX-15',
      barcode: null,
      type: 'variable',
      category: 'Electrical',
      displayPriceMinor: 48500,
      regularPriceMinor: 48500,
      salePriceMinor: null,
      stockQty: 36,
      stockStatus: 'in_stock',
      badges: ['Variable product', 'Wholesale'],
      variations: [
        {
          id: 'v-flex-red',
          name: 'Red · 100m',
          sku: 'CAB-FLEX-15-RED',
          barcode: '0001112223334',
          attributes: { Colour: 'Red', Length: '100m' },
          displayPriceMinor: 48500,
          stockQty: 12,
          stockStatus: 'in_stock',
          quoteProfiles: moneyProfiles(48500, [{ min: 5, unitMinor: 46200 }], [{ min: 1, unitMinor: 43800 }, { min: 6, unitMinor: 41900 }], [{ min: 1, unitMinor: 42900 }], [{ min: 1, unitMinor: 39900 }])
        },
        {
          id: 'v-flex-black',
          name: 'Black · 100m',
          sku: 'CAB-FLEX-15-BLK',
          barcode: '0001112223341',
          attributes: { Colour: 'Black', Length: '100m' },
          displayPriceMinor: 48500,
          stockQty: 16,
          stockStatus: 'in_stock',
          quoteProfiles: moneyProfiles(48500, [{ min: 5, unitMinor: 46200 }], [{ min: 1, unitMinor: 43800 }, { min: 6, unitMinor: 41900 }], [{ min: 1, unitMinor: 42900 }], [{ min: 1, unitMinor: 39900 }])
        },
        {
          id: 'v-flex-blue',
          name: 'Blue · 100m',
          sku: 'CAB-FLEX-15-BLU',
          barcode: '0001112223358',
          attributes: { Colour: 'Blue', Length: '100m' },
          displayPriceMinor: 49500,
          stockQty: 8,
          stockStatus: 'in_stock',
          quoteProfiles: moneyProfiles(49500, [{ min: 5, unitMinor: 47000 }], [{ min: 1, unitMinor: 44500 }, { min: 6, unitMinor: 42600 }], [{ min: 1, unitMinor: 43500 }], [{ min: 1, unitMinor: 40500 }])
        }
      ]
    },
    {
      id: 'p-led-panel',
      name: '36W LED Panel Light 600×600mm',
      shortName: '36W LED Panel',
      sku: 'LED-PNL-6060-36',
      barcode: '6971234560036',
      type: 'simple',
      category: 'Lighting',
      displayPriceMinor: 21500,
      regularPriceMinor: 21500,
      salePriceMinor: null,
      stockQty: 92,
      stockStatus: 'in_stock',
      badges: ['Wholesale example'],
      quoteProfiles: moneyProfiles(21500, [{ min: 10, unitMinor: 20500 }], [{ min: 1, unitMinor: 18800 }, { min: 12, unitMinor: 17600 }], [{ min: 1, unitMinor: 18100 }, { min: 24, unitMinor: 16800 }], [{ min: 1, unitMinor: 15900 }])
    },
    {
      id: 'p-distribution-board',
      name: '12-Way Metal Distribution Board',
      shortName: '12-Way Distribution Board',
      sku: 'ELEC-DB-12M',
      barcode: '8807654300012',
      type: 'simple',
      category: 'Electrical',
      displayPriceMinor: 38500,
      regularPriceMinor: 38500,
      salePriceMinor: null,
      stockQty: 28,
      stockStatus: 'in_stock',
      badges: ['B2B Group B demo'],
      quoteProfiles: moneyProfiles(38500, [], [{ min: 1, unitMinor: 35400 }], [{ min: 1, unitMinor: 33500 }, { min: 10, unitMinor: 31500 }], [{ min: 1, unitMinor: 30500 }])
    },
    {
      id: 'p-generator',
      name: '6.5kVA Petrol Generator',
      shortName: '6.5kVA Generator',
      sku: 'PWR-GEN-65KVA',
      barcode: '7100006500007',
      type: 'simple',
      category: 'Power Equipment',
      displayPriceMinor: 895000,
      regularPriceMinor: 895000,
      salePriceMinor: null,
      stockQty: 7,
      stockStatus: 'in_stock',
      badges: ['Negotiated-price demo'],
      quoteProfiles: moneyProfiles(895000, [], [{ min: 1, unitMinor: 842000 }], [{ min: 1, unitMinor: 825000 }], [{ min: 1, unitMinor: 779000 }])
    },
    {
      id: 'p-thinner',
      name: 'Automotive Refinish Thinner 4L',
      shortName: 'Refinish Thinner 4L',
      sku: 'AUTO-THIN-4L',
      barcode: '0012345678994',
      type: 'simple',
      category: 'Automotive Refinish',
      displayPriceMinor: 21000,
      regularPriceMinor: 21000,
      salePriceMinor: null,
      stockQty: 31,
      stockStatus: 'in_stock',
      badges: [],
      quoteProfiles: moneyProfiles(21000, [{ min: 6, unitMinor: 19800 }], [{ min: 1, unitMinor: 18500 }], [{ min: 1, unitMinor: 18100 }], [{ min: 1, unitMinor: 17400 }])
    }
  ];

  const customers = [
    { id: 'walkin', displayName: 'Walk-in', company: '', type: 'walkin', pricingKey: 'walkin', phoneMasked: '' },
    { id: 'cust-retail', displayName: 'Adwoa Mensah', company: '', type: 'retail', pricingKey: 'retail', phoneMasked: '024 *** 0182' },
    { id: 'cust-b2ba', displayName: 'Accra Buildworks Ltd', company: 'Accra Buildworks Ltd', type: 'b2b', groupLabel: 'Wholesale · Group A', pricingKey: 'b2bA', phoneMasked: '020 *** 4410' },
    { id: 'cust-b2bb', displayName: 'Tema Trade Supplies Ltd', company: 'Tema Trade Supplies Ltd', type: 'b2b', groupLabel: 'Wholesale · Group B', pricingKey: 'b2bB', phoneMasked: '055 *** 2705' },
    { id: 'cust-negotiated', displayName: 'Northstar Projects Ltd', company: 'Northstar Projects Ltd', type: 'b2b', groupLabel: 'Wholesale · Negotiated', pricingKey: 'negotiated', phoneMasked: '027 *** 6021' }
  ];

  const staff = [
    { id: 'staff-ama', name: 'Ama Mensah', role: 'Cashier', capabilities: ['pos.sell', 'orders.view', 'register.open', 'register.close'] },
    { id: 'staff-kofi', name: 'Kofi Asare', role: 'Manager', capabilities: ['pos.sell', 'orders.view', 'pos.refund', 'register.open', 'register.close', 'cash.adjust', 'sync.resolve', 'settings.manage'] }
  ];

  const registers = [
    { id: 'reg-main', name: 'Front Counter 1', code: 'FC-01', location: 'CETECH Main Store', status: 'active', currency: 'GHS' },
    { id: 'reg-spare', name: 'Spare Counter', code: 'SC-02', location: 'CETECH Main Store', status: 'active', currency: 'GHS' }
  ];

  const seedOrders = [
    {
      id: 'ord-24091', orderRef: '#24091', receiptNumber: 'CT-DEMO-00091', transactionRef: 'TX-DEMO-A91', createdAt: '2026-09-10T15:12:00Z',
      customer: customers[2], cashier: 'Ama Mensah', register: 'Front Counter 1', status: 'completed', paymentStatus: 'verified', paymentMethod: 'Mobile Money',
      subtotalMinor: 122000, discountMinor: 7000, taxMinor: 0, totalMinor: 115000,
      lines: [
        { lineId: 'l-1', productId: 'p-emulsion-paint', name: 'Premium Interior Emulsion Paint 20L', variationLabel: '', quantity: 2, unitPriceMinor: 57500, totalMinor: 115000, returnedQty: 0 }
      ]
    },
    {
      id: 'ord-24088', orderRef: '#24088', receiptNumber: 'CT-DEMO-00088', transactionRef: 'TX-DEMO-R88', createdAt: '2026-09-10T12:08:00Z',
      customer: customers[1], cashier: 'Ama Mensah', register: 'Front Counter 1', status: 'completed', paymentStatus: 'verified', paymentMethod: 'Cash', cashReceivedMinor: 50000, changeMinor: 7500,
      subtotalMinor: 42500, discountMinor: 0, taxMinor: 0, totalMinor: 42500,
      lines: [
        { lineId: 'l-2', productId: 'p-impact-drill', name: '650W Professional Impact Drill', variationLabel: '', quantity: 1, unitPriceMinor: 42500, totalMinor: 42500, returnedQty: 0 }
      ]
    }
  ];

  const seedAttention = [
    {
      id: 'attn-demo-payment',
      type: 'payment',
      severity: 'medium',
      title: 'Demo payment awaiting verification',
      summary: 'A sample electronic payment is pending. Do not charge the customer again until it is resolved.',
      transactionRef: 'TX-DEMO-PENDING',
      status: 'open'
    }
  ];

  const config = {
    currency: 'GHS',
    organizationName: 'CETECH',
    locationName: 'CETECH Main Store',
    buildId: 'preview-2026.09.11',
    appVersion: 'Frontend Preview 1.0',
    apiContractVersion: '1',
    localSchemaVersion: 'preview-1',
    quoteTtlMs: 120000,
    quoteDebounceMs: 320,
    managerVarianceApprovalMinor: 1000,
    receiptDisclaimer: 'Operational POS receipt — preview only. Not a statutory Ghana VAT/E-VAT invoice.'
  };

  window.CetechMockData = {
    products: products,
    customers: customers,
    staff: staff,
    registers: registers,
    seedOrders: seedOrders,
    seedAttention: seedAttention,
    config: config
  };
}());
