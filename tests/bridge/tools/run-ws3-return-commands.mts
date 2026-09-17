/**
 * Compatibility entry. The PHP WS2 producer spawns
 * apps/pos-web/scripts/run-ws3-return-commands.mjs so Vite can load the
 * same generateWs3BridgeCommands used by executeReturn.
 */
export { generateWs3BridgeCommands } from "../../integration/returns/generate-ws3-bridge-commands.ts";
