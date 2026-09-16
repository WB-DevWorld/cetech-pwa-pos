import { readServerEnv } from "../../config/env";
import { readReleasePolicy } from "../../config/release-policy";
import { PosApp } from "../pos-app";

export default function HealthPage() {
  const env = readServerEnv();
  const releasePolicy = readReleasePolicy(process.env, env.buildId);
  return <PosApp route="health" buildId={env.buildId} releasePolicy={releasePolicy} />;
}
