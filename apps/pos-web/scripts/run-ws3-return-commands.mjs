/**
 * Load the same WS3 command builders executeReturn uses, via the pos-web Vite
 * graph so JSON contract imports resolve. Consumed by the PHP WS2 producer test.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const metaPath = process.argv[2];
const outDir = process.argv[3];
if (!metaPath || !outDir) {
  throw new Error("usage: run-ws3-return-commands.mjs <meta.json> <outdir>");
}

const server = await createServer({
  configFile: join(appRoot, "vitest.config.mts"),
  root: appRoot,
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
});

try {
  const generatorPath = resolve(appRoot, "../../tests/integration/returns/generate-ws3-bridge-commands.ts");
  const mod = await server.ssrLoadModule(generatorPath);
  const meta = JSON.parse(readFileSync(metaPath, "utf8").replace(/^\uFEFF/, ""));
  const commands = await mod.generateWs3BridgeCommands(meta);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "commercial-partial-1.json"), `${JSON.stringify(commands.partial1, null, 2)}\n`);
  writeFileSync(join(outDir, "commercial-partial-2.json"), `${JSON.stringify(commands.partial2, null, 2)}\n`);
  writeFileSync(join(outDir, "stock-disposition.json"), `${JSON.stringify(commands.stock, null, 2)}\n`);
  writeFileSync(
    join(outDir, "manifest.json"),
    `${JSON.stringify(
      {
        previewEconomicsVersion: commands.previewEconomicsVersion,
        firstRefundMinor: commands.firstRefundMinor,
        secondRefundMinor: commands.secondRefundMinor,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await server.close();
}
