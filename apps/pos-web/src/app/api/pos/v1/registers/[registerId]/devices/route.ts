import { NextResponse, type NextRequest } from "next/server";
import { staffAllowedOrigins } from "../../../../../../../config/env";
import { composeManagementTopologyDirectory } from "../../../../../../../server/admin/compose-management-topology-directory";
import { composePosCommandHandlers } from "../../../../../../../server/sales/compose-pos-command-runtime";
import { handleGetRegister } from "../../../../../../../server/sales/handle-get-register";
import { apiFailure } from "../../../../../../../server/http/api-failure";
import { httpStatusFor } from "../../../../../../../server/http/status";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ registerId: string }> },
): Promise<NextResponse> {
  const composed = composePosCommandHandlers(request);
  if (!composed.ok) {
    return composed.response;
  }

  const { registerId } = await context.params;
  const registerResult = await handleGetRegister({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    cookieHeader: request.headers.get("cookie") ?? undefined,
    csrfHeader: request.headers.get("x-csrf-token"),
    registerId,
    now: new Date(),
    sessionStore: composed.sessionStore,
    allowedOrigins: staffAllowedOrigins(),
    checkoutStore: composed.runtime.store,
    assignments: composed.assignments,
  });

  if (!registerResult.body.ok) {
    return NextResponse.json(registerResult.body, {
      status: registerResult.status,
      headers: registerResult.headers,
    });
  }

  const register = await composed.runtime.store.getRegister(registerId);
  if (!register) {
    const body = apiFailure("NOT_FOUND", "register is not available", registerResult.body.correlationId);
    return NextResponse.json(body, {
      status: httpStatusFor(body.error.code),
      headers: registerResult.headers,
    });
  }

  try {
    const topology = await composeManagementTopologyDirectory(process.env).listOrganization({
      organizationId: register.organizationId,
    });
    if (topology === "unavailable") {
      const body = apiFailure(
        "INTEGRATION_UNAVAILABLE",
        "device assignments are unavailable",
        registerResult.body.correlationId,
      );
      return NextResponse.json(body, {
        status: httpStatusFor(body.error.code),
        headers: registerResult.headers,
      });
    }

    const location = topology.find((row) => row.id === register.locationId && row.status !== "inactive");
    const data = (location?.devices ?? [])
      .filter((device) => device.status === "active")
      .map((device) => ({ id: device.id, label: device.label }));

    return NextResponse.json(
      { ok: true, data, correlationId: registerResult.body.correlationId },
      { status: 200, headers: registerResult.headers },
    );
  } catch {
    const body = apiFailure(
      "INTEGRATION_UNAVAILABLE",
      "device assignments are unavailable",
      registerResult.body.correlationId,
    );
    return NextResponse.json(body, {
      status: httpStatusFor(body.error.code),
      headers: registerResult.headers,
    });
  }
}
