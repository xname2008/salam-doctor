# Do not use this folder for Prisma

The **only** Prisma project is at the repository root:

```
../prisma/
  schema.prisma
  migrations/0001_init/
  seed.js
```

Why this folder existed: an earlier draft schema lived here without migrations. Running `npx prisma migrate` from `backend/` created the “migration applied but missing locally” / wrong-schema confusion.

## Correct commands (from project root)

```bash
cd /path/to/new-folder   # project root — NOT backend/

npx prisma migrate deploy
# or on a disposable/dev DB:
npx prisma migrate reset --force
npx prisma db seed
```

Docker / Dockerfile already copies root `prisma/` and runs `prisma generate` from there.
