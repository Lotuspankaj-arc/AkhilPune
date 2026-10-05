---
description: "Diagnose and fix admin login failures in the PCMC application using the selected troubleshooting context and the actual auth implementation"
name: "Diagnose PCMC Admin Login"
argument-hint: "Optional: admin email and observed login error"
agent: "agent"
---
Diagnose the reported admin login problem in this workspace and fix it when the root cause is clear.

Inputs:
- Admin email and observed error, if provided: ${input:login_issue:email and observed login error}
- Selected editor content, if any: use it as initial troubleshooting context.

Workflow:
1. Start from the selected content, the reported symptom, and the nearest implementation. Inspect the real login route, password verification, account-status checks, admin-role lookup, token handling, database adapter, and relevant tests or diagnostic scripts.
2. Treat documentation as a hypothesis, not proof. Confirm endpoint paths, table and column names, boolean representations, password hashing behavior, and environment assumptions in the code and schema.
3. State one concrete root-cause hypothesis and one cheap check that could disconfirm it before editing.
4. Protect credentials and data. Never print passwords, tokens, cookies, connection strings, or full secrets. Do not reset or delete accounts, change production data, or weaken authentication as a diagnostic shortcut. Prefer read-only checks and existing tests. If a destructive or credential-changing step is genuinely required, explain the exact risk and ask for confirmation before doing it.
5. Make the smallest code or documentation change that addresses the confirmed cause. Preserve existing APIs and project conventions. Do not modify unrelated user changes.
6. Run the narrowest relevant validation available, such as the admin/login test, API test, or targeted syntax/type check. Report any unavailable prerequisites or unrelated failures separately.

Response format:
- Finding: the confirmed cause, with clickable workspace file references.
- Change: what was modified and why.
- Validation: commands/checks run and their outcome.
- Remaining risk: only unresolved issues or required user actions.

If the evidence is insufficient to safely change code, stop after the diagnosis and give the next read-only check needed. Do not invent successful test results.
