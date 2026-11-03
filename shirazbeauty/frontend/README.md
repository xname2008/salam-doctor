# Shiraz Beauty — Frontend

Next.js 16 (App Router, TypeScript) + Tailwind CSS 3.4, RTL Persian.

Architecture, design tokens and the roadmap live in [../MASTER_PLAN.md](../MASTER_PLAN.md).

## Running

Normally started through the stack at the repository root:

```bash
cd .. && docker compose -p shirazbeauty-app up -d --build
```

The host has no local Node install, so one-off tooling runs in a container:

```bash
docker run --rm -u $(id -u):$(id -g) -e HOME=/tmp \
  -v "$PWD":/w -w /w node:22-alpine npx next build
```

## Conventions

- RTL-first: use logical utilities (`ps-*`, `pe-*`, `ms-*`, `me-*`, `start-*`,
  `end-*`) — never `pl-*`/`pr-*`/`left-*`/`right-*`.
- Colours come from the tokens in `src/app/globals.css`; never hard-code a hex.
- User-facing numbers go through `toPersianDigits()` / `formatToman()`.
- UI primitives in `src/components/ui` follow the shadcn contract, so
  `npx shadcn@latest add <component>` keeps working.
