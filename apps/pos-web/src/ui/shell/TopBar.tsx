"use client";

export type TopBarProps = {
  registerName?: string;
  cashierDisplayName?: string;
  shiftOpen?: boolean;
  online?: boolean;
  updateReady?: boolean;
  onLock?: () => void;
  onOpenUpdate?: () => void;
  onOpenManagement?: () => void;
};

export function TopBar({
  registerName = "No register",
  cashierDisplayName,
  shiftOpen = false,
  online = true,
  updateReady = false,
  onLock,
  onOpenUpdate,
  onOpenManagement,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="app-title">CETECH POS</span>
        <span className="context-pill">{registerName}</span>
        {cashierDisplayName ? <span className="context-pill secondary">{cashierDisplayName}</span> : null}
        {shiftOpen ? (
          <span className="status-pill success shift-status" aria-label="Shift open">
            <span className="dot" aria-hidden="true" />
            <span className="status-text">Shift open</span>
          </span>
        ) : (
          <span className="status-pill warning shift-status" aria-label="No open shift">
            <span className="dot" aria-hidden="true" />
            <span className="status-text">No open shift</span>
          </span>
        )}
      </div>
      <div className="topbar-right">
        <span
          className={online ? "status-pill success" : "status-pill warning"}
          data-online={online ? "true" : "false"}
          aria-label={online ? "Online" : "Offline"}
        >
          <span className="dot" aria-hidden="true" />
          <span className="status-text">{online ? "Online" : "Offline"}</span>
        </span>
        {onOpenManagement ? (
          <button className="btn small" type="button" onClick={onOpenManagement}>
            Manage
          </button>
        ) : null}
        {updateReady ? (
          <button className="btn small" type="button" onClick={onOpenUpdate}>
            Update ready
          </button>
        ) : null}
        <button className="icon-btn" type="button" onClick={onLock} title="Lock register" aria-label="Lock register">
          ⌁
        </button>
      </div>
    </header>
  );
}
