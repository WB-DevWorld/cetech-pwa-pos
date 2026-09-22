"use client";

import type { ManagementLocation } from "../../server/admin/management-topology-directory";

export function TopologyPanel({
  rows,
  mode,
  loading,
  errorMessage,
}: {
  readonly rows: readonly ManagementLocation[];
  readonly mode: "locations" | "registers" | "devices";
  readonly loading?: boolean;
  readonly errorMessage?: string;
}) {
  if (loading) {
    return <section className="card card-pad"><p>Loading {mode}…</p></section>;
  }
  if (errorMessage) {
    return <section className="card card-pad"><div className="banner danger">{errorMessage}</div></section>;
  }
  if (rows.length === 0) {
    return <section className="card card-pad"><p>No {mode} are visible in your management scope.</p></section>;
  }

  if (mode === "locations") {
    return (
      <div className="management-grid">
        {rows.map((location) => (
          <section className="card card-pad stack" key={location.id}>
            <h2>{location.name}</h2>
            <p className="muted">{location.id}</p>
            <p>{location.registers.length} register{location.registers.length === 1 ? "" : "s"}</p>
          </section>
        ))}
      </div>
    );
  }

  if (mode === "registers") {
    return (
      <div className="management-grid">
        {rows.flatMap((location) =>
          location.registers.map((register) => (
            <section className="card card-pad stack" key={register.id}>
              <div className="management-staff-head">
                <div>
                  <h2>{register.name}</h2>
                  <p className="muted">{location.name} · {register.id}</p>
                </div>
                <span className={register.status === "active" ? "status-pill success" : "status-pill warning"}>
                  {register.status}
                </span>
              </div>
              <p>Currency: {register.currency}</p>
              <p>{location.devices.length} location device{location.devices.length === 1 ? "" : "s"}</p>
            </section>
          )),
        )}
      </div>
    );
  }

  const devices = rows.flatMap((location) =>
    location.devices.map((device) => ({ location, device })),
  );
  return (
    <div className="management-grid">
      {devices.map(({ location, device }) => (
        <section className="card card-pad stack" key={device.id}>
          <div className="management-staff-head">
            <div>
              <h2>{device.label}</h2>
              <p className="muted">{location.name} · {device.id}</p>
            </div>
            <span className={device.status === "active" ? "status-pill success" : "status-pill warning"}>
              {device.status}
            </span>
          </div>
          <p className="muted">Device is assigned to the location. No register binding is invented.</p>
        </section>
      ))}
    </div>
  );
}
