"use client";

export type AppToastView = {
  readonly title: string;
  readonly detail?: string;
};

export function AppToast({
  title,
  detail,
  open = true,
}: AppToastView & { readonly open?: boolean }) {
  if (!open) {
    return null;
  }
  return (
    <div className="app-toast" role="status" aria-live="polite" aria-atomic="true" data-app-toast="true">
      <strong>{title}</strong>
      {detail ? <span>{detail}</span> : null}
    </div>
  );
}
