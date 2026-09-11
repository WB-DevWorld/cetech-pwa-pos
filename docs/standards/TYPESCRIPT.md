# Typescript standard

CP-05 verifies and pins actual supported TypeScript/Node/Next versions; no version guessed from old memory. Use strict, noUncheckedIndexedAccess and verbatimModuleSyntax. Next frontend module resolution follows its supported bundler configuration; backend-only Node packages use a verified Node module mode if introduced. No any to bypass contracts; unknown inputs require runtime schema validation. Generated schema types are imported/reexported, never copied. Run full typecheck and Next build; native type stripping is not typechecking. Decimal quantity and safe integer money rules in DOMAIN-CONTRACTS apply.

Owner: WS3. Controlling contracts/ADRs outrank generic examples. Done = evidence.
