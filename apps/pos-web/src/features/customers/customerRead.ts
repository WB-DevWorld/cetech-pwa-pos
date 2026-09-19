import type { CustomerSummary } from "../../../../../docs/contracts/domain.generated";

export type CustomerReadItem = CustomerSummary & {
  readonly commercialContext?: string;
};
