import { NextResponse, type NextRequest } from "next/server";
import { readServerEnv } from "../../../../../config/env";
import { readReleasePolicy } from "../../../../../config/release-policy";
import { handleReleasePolicy } from "../../../../../server/release/handle-release-policy";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = readServerEnv();
  const result = handleReleasePolicy({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    policy: readReleasePolicy(process.env, env.buildId),
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}
