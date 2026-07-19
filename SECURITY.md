# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's **Report a vulnerability** / private security advisory flow for this repository. Do not open a public issue containing exploit details, credentials, private data, or sensitive provider responses.

Include:

- A concise description and affected version.
- Reproduction steps or a minimal proof of concept.
- Expected and observed behavior.
- Impact and any suggested mitigation.

## Secret handling

- Never commit `.env`, `.env.txt`, API keys, tokens, cookies, or credentials.
- Use `.env.example` only as a blank configuration template.
- If a secret is exposed, revoke/rotate it immediately and remove it from Git history before further use.
- Use a least-privilege GitHub token only when higher repository-search limits are needed.

## Supported version

Security fixes target the latest `main` branch and the latest published release. This repository is local-first and binds the application server to `127.0.0.1`.

## Security boundaries

Proofline validates Host/Origin values, rejects unsafe public URLs, bounds provider/parser work, keeps provider secrets server-side, and never authorizes or transfers funds. These controls reduce risk but do not make untrusted documents or public-web evidence inherently safe or correct.
