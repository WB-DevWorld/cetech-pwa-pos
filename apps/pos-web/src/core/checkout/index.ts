export type {
  CheckoutStore,
  PosSaleRecord,
  SeedPreparedSaleInput,
  StaffActor,
  StoredDevice,
  StoredRegister,
} from "./types";
export { createInMemoryCheckoutStore } from "./in-memory-store";
export { customerEqual, evidenceFromPayment, moneyEqual } from "./types";
