"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiResult } from "../../../../docs/contracts/ports";
import type { ManagementContext, ManagementSection } from "../server/admin/management-context";
import { ManagementScreen } from "../features/admin/ManagementScreen";

export function ManagementRuntime({ fetchImpl = fetch }: { readonly fetchImpl?: typeof fetch }) {
  const router = useRouter();
  const [result, setResult] = useState<ApiResult<ManagementContext> | null>(null);
  const [section, setSection] = useState<ManagementSection>("overview");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const correlationId = crypto.randomUUID();
      try {
        const response = await fetchImpl("/api/pos/v1/admin/context", {
          method: "GET",
          credentials: "include",
          headers: { "x-correlation-id": correlationId },
        });
        const body = (await response.json()) as ApiResult<ManagementContext>;
        if (!cancelled) setResult(body);
      } catch {
        if (!cancelled) {
          setResult({
            ok: false,
            error: {
              code: "INTEGRATION_UNAVAILABLE",
              message: "Management could not be loaded.",
              retryable: true,
              nextAction: "resolve",
            },
            correlationId,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchImpl]);

  if (!result) {
    return (
      <main className="management-standalone-state">
        <div className="card card-pad">
          <h1>Management</h1>
          <p>Loading authorized management workspace…</p>
        </div>
      </main>
    );
  }

  if (!result.ok) {
    return (
      <main className="management-standalone-state">
        <div className="card card-pad stack">
          <h1>Management</h1>
          <div className="banner danger" role="alert">
            {result.error.code === "FORBIDDEN"
              ? "This staff account is not authorized for management."
              : result.error.code === "AUTH_REQUIRED"
                ? "Sign in to the POS before opening Management."
                : "Management is temporarily unavailable."}
          </div>
          <button className="btn" type="button" onClick={() => router.push("/sell")}>
            Back to POS
          </button>
        </div>
      </main>
    );
  }

  const allowedSection = result.data.sections.includes(section)
    ? section
    : result.data.sections[0] ?? "overview";

  return (
    <ManagementScreen
      context={result.data}
      activeSection={allowedSection}
      onSelectSection={setSection}
      onBackToPos={() => router.push("/sell")}
    />
  );
}
