import { formatMoneyDisplay } from "../state/quotePresentation";
import type { ReceiptViewModel } from "../state/checkoutSession";

export function ReceiptPaper({ receipt }: { receipt: ReceiptViewModel }) {
  return (
    <article className="receipt-paper" data-receipt-source="receipt-port" data-receipt-id={receipt.id}>
      <h3>CETECH</h3>
      <div className="center">{receipt.locationName}</div>
      <div className="center">
        <strong>OPERATIONAL POS RECEIPT</strong>
      </div>
      <hr />
      <div className="r-row">
        <span>Receipt</span>
        <span>{receipt.receiptNumber}</span>
      </div>
      <div className="r-row">
        <span>Order</span>
        <span>{receipt.orderReference}</span>
      </div>
      <div className="r-row">
        <span>Date</span>
        <span>{receipt.issuedAt}</span>
      </div>
      <div className="r-row">
        <span>Register</span>
        <span>{receipt.registerName}</span>
      </div>
      <div className="r-row">
        <span>Cashier</span>
        <span>{receipt.cashierName}</span>
      </div>
      <div className="r-row">
        <span>Customer</span>
        <span>{receipt.customerLabel}</span>
      </div>
      <hr />
      {receipt.lines.map((line, index) => (
        <div key={`${line.name}-${index}`}>
          <strong>{line.name}</strong>
          {line.variationLabel ? <div>{line.variationLabel}</div> : null}
          <div className="r-row">
            <span>
              {line.quantity} × {formatMoneyDisplay(line.unitPrice)}
            </span>
            <span>{formatMoneyDisplay(line.total)}</span>
          </div>
        </div>
      ))}
      <hr />
      <div className="r-row">
        <span>Subtotal</span>
        <span>{formatMoneyDisplay(receipt.subtotal)}</span>
      </div>
      <div className="r-row">
        <span>Discount</span>
        <span>{formatMoneyDisplay(receipt.discount)}</span>
      </div>
      <div className="r-row">
        <span>Tax</span>
        <span>{formatMoneyDisplay(receipt.tax)}</span>
      </div>
      <div className="r-row r-total">
        <span>TOTAL</span>
        <span>{formatMoneyDisplay(receipt.total)}</span>
      </div>
      <hr />
      <div className="r-row">
        <span>Payment</span>
        <span>{receipt.tender}</span>
      </div>
      {receipt.cashReceived ? (
        <div className="r-row">
          <span>Cash received</span>
          <span>{formatMoneyDisplay(receipt.cashReceived)}</span>
        </div>
      ) : null}
      {receipt.changeDue ? (
        <div className="r-row">
          <span>Change due</span>
          <span>{formatMoneyDisplay(receipt.changeDue)}</span>
        </div>
      ) : null}
      <div className="r-row">
        <span>Transaction</span>
        <span>{receipt.transactionId}</span>
      </div>
      <hr />
      <p className="center muted">This is an operational POS receipt, not a reconstructed cart total.</p>
    </article>
  );
}
