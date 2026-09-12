import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  buildLoginHarnessHtml,
  buildRegisterHarnessHtml,
  buildShellHarnessHtml,
} from "./visual/build-harness";

const evidenceDir = resolve(dirname(fileURLToPath(import.meta.url)), "evidence");

describe("FE-02 isolated visual harness markup", () => {
  test("writes shell, login, and register HTML evidence without Demo FAB or demo staff", () => {
    mkdirSync(evidenceDir, { recursive: true });
    const shell = buildShellHarnessHtml();
    const login = buildLoginHarnessHtml();
    const register = buildRegisterHarnessHtml();
    writeFileSync(resolve(evidenceDir, "shell-desktop.html"), shell);
    writeFileSync(resolve(evidenceDir, "login-desktop.html"), login);
    writeFileSync(resolve(evidenceDir, "register-desktop.html"), register);

    expect(shell).toContain("Skip to main content");
    expect(shell).toContain("data-href=\"/sell\"");
    expect(login).toContain("Sign in");
    expect(register).toContain('id="opening-float"');
    expect(`${shell}${login}${register}`).not.toContain("Demo controls");
    expect(`${shell}${login}${register}`).not.toContain("Ama Mensah");
  });
});
