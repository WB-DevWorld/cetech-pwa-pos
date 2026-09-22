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
              <p>{register.devices.length} location device{register.devices.length === 1 ? "" : "s"}</p>
            </section>
          )),
        )}
      </div>
    );
  }

  const deviceMap = new Map<string, { location: ManagementLocation; label: string; status: string }>();
  for (const location of rows) {
    for (const register of location.registers) {
      for (const device of register.devices) {
        deviceMap.set(device.id, { location, label: device.label, status: device.status });
      }
    }
  }
  return (
    <div className="management-grid">
      {[...deviceMap.entries()].map(([id, item]) => (
        <section className="card card-pad stack" key={id}>
          <div className="management-staff-head">
            <div>
              <h2>{item.label}</h2>
              <p className="muted">{item.location.name} · {id}</p>
            </div>
            <span className={item.status === "active" ? "status-pill success" : "status-pill warning"}>
              {item.status}
            </span>
          </div>
          <p className="muted">Current schema binds devices to locations; no false register binding is shown.</p>
        </section>
      ))}
    </div>
  );
}
