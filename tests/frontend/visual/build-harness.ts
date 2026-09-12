import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell } from "../../../apps/pos-web/src/ui/shell/AppShell";
import { LoginScreen } from "../../../apps/pos-web/src/features/auth/LoginScreen";
import { OpenRegisterForm } from "../../../apps/pos-web/src/features/register/OpenRegisterForm";

export function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(resolve(dir, "apps/pos-web/src/ui/tokens.css"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error(`Unable to locate repository root from ${process.cwd()}`);
}

const repoRoot = findRepoRoot();

function css(relative: string): string {
  return readFileSync(resolve(repoRoot, relative), "utf8");
}

function documentFor(title: string, body: string): string {
  const styles = [
    css("apps/pos-web/src/ui/tokens.css"),
    css("apps/pos-web/src/ui/shell/shell.css"),
    css("apps/pos-web/src/features/auth/auth.css"),
    css("apps/pos-web/src/features/register/register.css"),
  ].join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>${styles}</style>
</head>
<body>${body}</body>
</html>`;
}

const registers = [
  { id: "reg-main", name: "Front Counter 1", locationLabel: "Main store" },
];

export function buildShellHarnessHtml(): string {
  const body = renderToStaticMarkup(
    createElement(AppShell, {
      activeRoute: "sell",
      registerName: "Front Counter 1",
      cashierDisplayName: "Staff member",
      shiftOpen: true,
      online: true,
      attentionCount: 1,
      children: createElement(
        "div",
        { className: "page-head" },
        createElement(
          "div",
          null,
          createElement("h1", null, "Sell"),
          createElement("p", null, "FE-02 shell harness — catalog and cart belong to later tasks."),
        ),
      ),
    }),
  );
  return documentFor("CETECH POS shell", body);
}

export function buildLoginHarnessHtml(): string {
  const body = renderToStaticMarkup(
    createElement(LoginScreen, { onSignIn: () => undefined }),
  );
  return documentFor("CETECH POS login", body);
}

export function buildRegisterHarnessHtml(): string {
  const body = renderToStaticMarkup(
    createElement(OpenRegisterForm, {
      registers,
      online: true,
      onSubmit: () => undefined,
    }),
  );
  return documentFor("CETECH POS open register", body);
}
