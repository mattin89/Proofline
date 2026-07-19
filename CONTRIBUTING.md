# Contributing

Thank you for helping improve Proofline.

## Development setup

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm start
```

Live provider keys are optional for most deterministic tests. Never include populated environment files or provider responses containing sensitive data in a commit.

## Before opening a pull request

```bash
pnpm run check
pnpm test
```

Keep changes evidence-first:

- Preserve source URLs, provenance, capture method, review state, and independence groups.
- Treat missing data as unknown rather than zero or adverse evidence.
- Do not introduce protected traits, prestige, popularity, or opaque caller-supplied weights into scoring.
- Keep research, scoring, policy, check approval, and outreach as separate layers.
- Add deterministic tests for domain and trust-boundary changes.

## Licensing

By submitting a contribution, you agree that it may be distributed under the project's [MIT License](LICENSE).
