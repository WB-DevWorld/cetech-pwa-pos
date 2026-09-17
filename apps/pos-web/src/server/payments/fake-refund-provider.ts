import type {
  ElectronicRefundProvider,
  ProviderRefundCreateInput,
  ProviderRefundCreateResult,
  ProviderRefundResolveResult,
} from "./refund-provider";

export type FakeRefundScript =
  | "pending"
  | "completed"
  | "failed"
  | "requires_attention"
  | "lost_response"
  | "timeout"
  | "unavailable"
  | "unknown"
  | "amount_mismatch"
  | "currency_mismatch"
  | "transaction_mismatch";

export type FakeElectronicRefundProvider = ElectronicRefundProvider & {
  createCount: number;
  resolveCount: number;
  setCreateScript(refundId: string, script: FakeRefundScript): void;
  setDefaultCreate(script: FakeRefundScript): void;
  setResolveScript(refundId: string, script: FakeRefundScript): void;
  createdIds(): readonly string[];
};

export function createFakeElectronicRefundProvider(): FakeElectronicRefundProvider {
  const createById = new Map<string, FakeRefundScript>();
  const resolveById = new Map<string, FakeRefundScript>();
  const amounts = new Map<string, ProviderRefundCreateInput>();
  const created: string[] = [];
  let defaultCreate: FakeRefundScript = "completed";

  const provider: FakeElectronicRefundProvider = {
    id: "fake-refund",
    createCount: 0,
    resolveCount: 0,
    setCreateScript(refundId, script) {
      createById.set(refundId, script);
    },
    setDefaultCreate(script) {
      defaultCreate = script;
    },
    setResolveScript(refundId, script) {
      resolveById.set(refundId, script);
    },
    createdIds() {
      return [...created];
    },
    async createRefund(input) {
      provider.createCount += 1;
      amounts.set(input.refundId, input);
      created.push(input.refundId);
      const script = createById.get(input.refundId) ?? defaultCreate;
      return scriptToCreate(script, input);
    },
    async resolveRefund(input) {
      provider.resolveCount += 1;
      const original = amounts.get(input.refundId);
      const script = resolveById.get(input.refundId) ?? createById.get(input.refundId) ?? defaultCreate;
      if (!original && script === "unknown") {
        return { kind: "not_found" };
      }
      return scriptToResolve(script, original ?? {
        refundId: input.refundId,
        paymentId: "missing",
        amount: { minor: 0, currency: "GHS" },
        currency: "GHS",
      });
    },
  };
  return provider;
}

function scriptToCreate(script: FakeRefundScript, input: ProviderRefundCreateInput): ProviderRefundCreateResult {
  switch (script) {
    case "pending":
      return { kind: "pending", providerRefundReference: `pref_${input.refundId}` };
    case "failed":
      return { kind: "failed", message: "provider refund failed" };
    case "requires_attention":
      return { kind: "requires_attention", message: "provider refund requires attention" };
    case "lost_response":
      return { kind: "lost_response" };
    case "timeout":
      return { kind: "timeout" };
    case "unavailable":
      return { kind: "unavailable", retryable: true, message: "provider unavailable" };
    case "completed":
    default:
      return {
        kind: "completed",
        providerRefundReference: `pref_${input.refundId}`,
        providerTransactionId: input.providerTransactionId,
      };
  }
}

function scriptToResolve(
  script: FakeRefundScript,
  original: ProviderRefundCreateInput,
): ProviderRefundResolveResult {
  const reference = `pref_${original.refundId}`;
  switch (script) {
    case "pending":
      return { kind: "pending", providerRefundReference: reference, amount: original.amount, currency: original.currency };
    case "failed":
      return { kind: "failed", message: "provider refund failed" };
    case "requires_attention":
      return { kind: "requires_attention", message: "provider refund requires attention" };
    case "timeout":
      return { kind: "timeout" };
    case "unavailable":
      return { kind: "unavailable", retryable: true, message: "provider unavailable" };
    case "unknown":
      return { kind: "not_found" };
    case "amount_mismatch":
      return {
        kind: "completed",
        providerRefundReference: reference,
        amount: { minor: original.amount.minor + 1, currency: original.amount.currency },
        currency: original.currency,
        domain: "test",
      };
    case "currency_mismatch":
      return {
        kind: "completed",
        providerRefundReference: reference,
        amount: original.amount,
        currency: "USD",
        domain: "test",
      };
    case "transaction_mismatch":
      return {
        kind: "completed",
        providerRefundReference: reference,
        amount: original.amount,
        currency: original.currency,
        providerTransactionId: "other-transaction",
        domain: "test",
      };
    case "lost_response":
    case "completed":
    default:
      return {
        kind: "completed",
        providerRefundReference: reference,
        amount: original.amount,
        currency: original.currency,
        providerTransactionId: original.providerTransactionId,
        domain: "test",
      };
  }
}
