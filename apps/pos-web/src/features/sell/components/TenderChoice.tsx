import type { ElectronicTenderView } from "../../payments/electronicPaymentView";
import { formatMoneyDisplay } from "../state/quotePresentation";
import type { PreparedSaleView } from "../state/checkoutSession";

export type TenderChoiceId = "cash" | ElectronicTenderView;

export type TenderAvailabilityView = {
  readonly cash: true;
  readonly mobileMoney: boolean;
  readonly card: boolean;
  readonly externalElectronic: boolean;
};

export const DEFAULT_TENDER_AVAILABILITY: TenderAvailabilityView = {
  cash: true,
  mobileMoney: false,
  card: false,
  externalElectronic: false,
};

const METHODS: ReadonlyArray<{
  readonly id: TenderChoiceId;
  readonly title: string;
  readonly readyCopy: string;
  readonly unavailableCopy: string;
  readonly available: (availability: TenderAvailabilityView) => boolean;
}> = [
  {
    id: "cash",
    title: "Cash",
    readyCopy: "Cash received and change due",
    unavailableCopy: "Not available in this environment",
    available: () => true,
  },
  {
    id: "mobile_money",
    title: "Mobile Money",
    readyCopy: "Hosted / verified payment flow",
    unavailableCopy: "Not available in this environment",
    available: (availability) => availability.mobileMoney,
  },
  {
    id: "card",
    title: "Card",
    readyCopy: "Hosted / terminal flow",
    unavailableCopy: "Not available in this environment",
    available: (availability) => availability.card,
  },
  {
    id: "external_electronic",
    title: "External electronic",
    readyCopy: "Approved external / terminal flow",
    unavailableCopy: "Not available in this environment",
    available: (availability) => availability.externalElectronic,
  },
];

export function TenderChoice({
  prepared,
  availability,
  disabled,
  onSelect,
  onCancelPrepared,
}: {
  prepared: PreparedSaleView;
  availability: TenderAvailabilityView;
  disabled: boolean;
  onSelect: (id: TenderChoiceId) => void;
  onCancelPrepared: () => void;
}) {
  return (
    <div className="tender-choice">
      <div className="tender-choice-meta">
        <div>
          <div className="muted">Order</div>
          <strong data-prepared-order-reference="">{prepared.orderReference}</strong>
        </div>
        <div className="tender-choice-total">
          <div className="muted">Total</div>
          <strong data-prepared-total="">{formatMoneyDisplay(prepared.total)}</strong>
        </div>
      </div>
      <div className="tender-grid">
        {METHODS.map((method) => {
          const ready = method.available(availability);
          return (
            <button
              key={method.id}
              type="button"
              className="tender-card"
              disabled={disabled || !ready}
              data-tender={method.id}
              data-tender-available={ready ? "true" : "false"}
              aria-label={ready ? method.title : `${method.title}. ${method.unavailableCopy}`}
              onClick={() => {
                if (ready) onSelect(method.id);
              }}
            >
              <strong>{method.title}</strong>
              <span>{ready ? method.readyCopy : method.unavailableCopy}</span>
            </button>
          );
        })}
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn ghost" disabled={disabled} onClick={onCancelPrepared}>
          Cancel prepared sale
        </button>
      </div>
    </div>
  );
}
