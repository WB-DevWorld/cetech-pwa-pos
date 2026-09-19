"use client";

export function SellToast({
  title,
  detail,
}: {
  readonly title: string;
  readonly detail: string;
}) {
  return (
    <div className="sell-toast" role="status" aria-live="polite" aria-atomic="true" data-sell-toast="unknown-barcode">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}
