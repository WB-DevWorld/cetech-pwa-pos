"use client";

import type { StaffAccessRecord } from "../../server/admin/staff-access-directory";

export function StaffAccessPanel({
  rows,
  loading,
  errorMessage,
}: {
  readonly rows: readonly StaffAccessRecord[];
  readonly loading?: boolean;
  readonly errorMessage?: string;
}) {
  if (loading) {
    return <section className="card card-pad"><p>Loading staff access…</p></section>;
  }
  if (errorMessage) {
    return <section className="card card-pad"><div className="banner danger">{errorMessage}</div></section>;
  }
  if (rows.length === 0) {
    return <section className="card card-pad"><p>No staff records are visible in your management scope.</p></section>;
  }

  return (
    <div className="management-staff-list">
      {rows.map((row) => (
        <section className="card card-pad stack management-staff-card" key={row.actorId}>
          <div className="management-staff-head">
            <div>
              <h2>{row.displayName}</h2>
              <p className="muted">{row.email ?? row.actorId}</p>
            </div>
            <span className={row.authStatus === "active" ? "status-pill success" : "status-pill warning"}>
              {row.authStatus === "active" ? "Active" : "Disabled"}
            </span>
          </div>
          <div className="management-meta-grid">
            <div>
              <span className="label">Actor</span>
              <strong>{row.actorId}</strong>
            </div>
            <div>
              <span className="label">Control role</span>
              <strong>{row.controlRole ?? "Operational staff"}</strong>
            </div>
          </div>
          <div className="stack">
            <strong>Operational assignments</strong>
            {row.locations.length === 0 ? (
              <p className="muted">No location assignment.</p>
            ) : (
              row.locations.map((location) => (
                <div className="management-assignment-row" key={location.locationId}>
                  <div>
                    <strong>{location.locationId}</strong>
                    <span>{location.role}</span>
                  </div>
                  <div>
                    {location.registerIds.length > 0
                      ? location.registerIds.join(", ")
                      : "No register assignment"}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
