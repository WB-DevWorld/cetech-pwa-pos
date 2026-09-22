"use client";

import { useMemo, useState } from "react";
import type { StaffAssignmentRole } from "../../server/auth/roles";
import type { StaffAccessLocation, StaffAccessRecord } from "../../server/admin/staff-access-directory";
import type { ManagementLocation } from "../../server/admin/management-topology-directory";

export function StaffAccessPanel({
  rows,
  topology = [],
  canManage = false,
  loading,
  savingActorId,
  errorMessage,
  onSaveAssignment,
}: {
  readonly rows: readonly StaffAccessRecord[];
  readonly topology?: readonly ManagementLocation[];
  readonly canManage?: boolean;
  readonly loading?: boolean;
  readonly savingActorId?: string | null;
  readonly errorMessage?: string;
  readonly onSaveAssignment?: (input: {
    readonly actorId: string;
    readonly locationId: string;
    readonly role: StaffAssignmentRole;
    readonly registerIds: readonly string[];
  }) => void;
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
        <StaffCard
          key={row.actorId}
          row={row}
          topology={topology}
          canManage={canManage}
          saving={savingActorId === row.actorId}
          onSaveAssignment={onSaveAssignment}
        />
      ))}
    </div>
  );
}

function StaffCard({
  row,
  topology,
  canManage,
  saving,
  onSaveAssignment,
}: {
  readonly row: StaffAccessRecord;
  readonly topology: readonly ManagementLocation[];
  readonly canManage: boolean;
  readonly saving: boolean;
  readonly onSaveAssignment?: (input: {
    readonly actorId: string;
    readonly locationId: string;
    readonly role: StaffAssignmentRole;
    readonly registerIds: readonly string[];
  }) => void;
}) {
  const firstUnassigned = topology.find(
    (location) => !row.locations.some((assignment) => assignment.locationId === location.id),
  );
  return (
    <section className="card card-pad stack management-staff-card">
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
        {row.locations.length === 0 ? <p className="muted">No location assignment.</p> : null}
        {row.locations.map((assignment) => (
          <AssignmentEditor
            key={assignment.locationId}
            actorId={row.actorId}
            assignment={assignment}
            location={topology.find((item) => item.id === assignment.locationId)}
            canManage={canManage}
            saving={saving}
            onSave={onSaveAssignment}
          />
        ))}
        {canManage && firstUnassigned && onSaveAssignment ? (
          <NewAssignmentEditor
            actorId={row.actorId}
            topology={topology}
            initialLocationId={firstUnassigned.id}
            saving={saving}
            onSave={onSaveAssignment}
          />
        ) : null}
      </div>
    </section>
  );
}

function AssignmentEditor({
  actorId,
  assignment,
  location,
  canManage,
  saving,
  onSave,
}: {
  readonly actorId: string;
  readonly assignment: StaffAccessLocation;
  readonly location?: ManagementLocation;
  readonly canManage: boolean;
  readonly saving: boolean;
  readonly onSave?: (input: {
    readonly actorId: string;
    readonly locationId: string;
    readonly role: StaffAssignmentRole;
    readonly registerIds: readonly string[];
  }) => void;
}) {
  const [role, setRole] = useState<StaffAssignmentRole>(assignment.role);
  const [registerIds, setRegisterIds] = useState<readonly string[]>(assignment.registerIds);
  const choices = location?.registers ?? [];
  return (
    <div className="management-assignment-editor">
      <div className="management-assignment-title">
        <div>
          <strong>{location?.name ?? assignment.locationId}</strong>
          <span className="muted">{assignment.locationId}</span>
        </div>
        <select
          className="select"
          value={role}
          disabled={!canManage || saving}
          onChange={(event) => setRole(event.target.value as StaffAssignmentRole)}
        >
          <option value="cashier">Cashier</option>
          <option value="manager">Manager</option>
        </select>
      </div>
      <div className="management-register-checks">
        {choices.length === 0 ? (
          <span className="muted">No registers are available at this location.</span>
        ) : choices.map((register) => (
          <label key={register.id}>
            <input
              type="checkbox"
              checked={registerIds.includes(register.id)}
              disabled={!canManage || saving}
              onChange={(event) => {
                setRegisterIds((current) =>
                  event.target.checked
                    ? [...new Set([...current, register.id])]
                    : current.filter((id) => id !== register.id),
                );
              }}
            />
            <span>{register.name}</span>
          </label>
        ))}
      </div>
      {canManage && onSave ? (
        <button
          className="btn small"
          type="button"
          disabled={saving}
          onClick={() => onSave({ actorId, locationId: assignment.locationId, role, registerIds })}
        >
          {saving ? "Saving…" : "Save assignment"}
        </button>
      ) : null}
    </div>
  );
}

function NewAssignmentEditor({
  actorId,
  topology,
  initialLocationId,
  saving,
  onSave,
}: {
  readonly actorId: string;
  readonly topology: readonly ManagementLocation[];
  readonly initialLocationId: string;
  readonly saving: boolean;
  readonly onSave: (input: {
    readonly actorId: string;
    readonly locationId: string;
    readonly role: StaffAssignmentRole;
    readonly registerIds: readonly string[];
  }) => void;
}) {
  const [locationId, setLocationId] = useState(initialLocationId);
  const [role, setRole] = useState<StaffAssignmentRole>("cashier");
  const [registerIds, setRegisterIds] = useState<readonly string[]>([]);
  const location = useMemo(() => topology.find((item) => item.id === locationId), [locationId, topology]);
  return (
    <div className="management-assignment-editor new">
      <strong>Add location assignment</strong>
      <div className="management-assignment-title">
        <select
          className="select"
          value={locationId}
          disabled={saving}
          onChange={(event) => {
            setLocationId(event.target.value);
            setRegisterIds([]);
          }}
        >
          {topology.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select
          className="select"
          value={role}
          disabled={saving}
          onChange={(event) => setRole(event.target.value as StaffAssignmentRole)}
        >
          <option value="cashier">Cashier</option>
          <option value="manager">Manager</option>
        </select>
      </div>
      <div className="management-register-checks">
        {(location?.registers ?? []).map((register) => (
          <label key={register.id}>
            <input
              type="checkbox"
              checked={registerIds.includes(register.id)}
              disabled={saving}
              onChange={(event) => {
                setRegisterIds((current) =>
                  event.target.checked
                    ? [...new Set([...current, register.id])]
                    : current.filter((id) => id !== register.id),
                );
              }}
            />
            <span>{register.name}</span>
          </label>
        ))}
      </div>
      <button
        className="btn small primary"
        type="button"
        disabled={saving || !locationId}
        onClick={() => onSave({ actorId, locationId, role, registerIds })}
      >
        {saving ? "Saving…" : "Add assignment"}
      </button>
    </div>
  );
}
