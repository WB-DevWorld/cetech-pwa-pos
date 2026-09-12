import { SERVER_ONLY_SECRET_NAMES } from "./secrets";

export type ServerEnv = {
  readonly appOrigin: string;
  readonly supabaseUrl: string | undefined;
  readonly bridgeBaseUrl: string | undefined;
  readonly buildId: string;
};

export function readServerEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ServerEnv {
  for (const name of SERVER_ONLY_SECRET_NAMES) {
    const publicKey = `NEXT_PUBLIC_${name}`;
    if (env[publicKey]) {
      throw new Error("privileged server secret must not be exposed as public environment");
    }
  }
  return {
    appOrigin: env.APP_ORIGIN ?? env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000",
    supabaseUrl: env.SUPABASE_URL,
    bridgeBaseUrl: env.BRIDGE_BASE_URL,
    buildId: env.BUILD_ID ?? "local-dev",
  };
}
