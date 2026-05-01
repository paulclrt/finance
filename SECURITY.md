# Security Policy

## Supported Versions

This project is under active development. Security fixes are applied to the latest code on the default branch and then promoted through the current monthly development branch when appropriate.

| Version | Supported |
| ------- | --------- |
| Latest default branch | Yes |
| Current `dev-*` branch | Yes |
| Older branches | No |

## Reporting a Vulnerability

If you discover a security vulnerability, do not open a public issue.

Use GitHub private vulnerability reporting when it is enabled for this repository. If private reporting is unavailable, contact the maintainers directly and include:

- a clear description of the issue
- the affected component, module, or file
- reproduction steps or a proof of concept
- the potential impact
- any suggested mitigation or fix

Please include enough detail for the issue to be reproduced and triaged quickly.

## Response Expectations

The maintainers will try to:

- acknowledge receipt of the report in a reasonable timeframe
- validate and scope the issue
- assess severity and impact
- prepare a fix or mitigation
- coordinate responsible disclosure

## Disclosure Policy

Please allow time for investigation and remediation before publicly disclosing a vulnerability.

Avoid publishing proof-of-concept details until a fix or mitigation is available.

## Scope

This policy applies to:

- the Electron desktop application
- preload and renderer code
- local credential storage
- Python fetch scripts
- bundled native helpers
- repository source and build assets

Third-party services, upstream APIs, and external data providers may have their own security processes and are outside the direct control of this project.

## Notes

This is a local-first desktop application. Reports involving credential handling, local storage, unsafe IPC exposure, subprocess execution, Electron sandboxing, packaging, or dependency-chain risks are especially valuable.
