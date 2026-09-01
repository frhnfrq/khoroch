# Khoroch

Khoroch is a personal money tracker for accounts, expenses, income, transfers, and monthly budgets. It is a full-stack Next.js application organized as a pnpm and Turborepo monorepo.

## Features

- **Accounts and transactions** - Track balances, expenses, income, and transfers
- **Monthly budgets** - Organize budget items and funding buckets
- **AI quick entry** - Turn natural-language notes into transaction drafts through Vercel AI Gateway
- **Authentication** - Clerk authentication with user-scoped financial data
- **Database** - PostgreSQL with Drizzle ORM and committed migrations
- **Shared UI** - shadcn/ui primitives and Tailwind CSS styles in `packages/ui`
- **Web app manifest** - Installable app metadata and icons
- **Tooling** - TypeScript, Oxlint, Oxfmt, pnpm, and Turborepo

## Prerequisites

- Node.js 20.9 or newer
- pnpm 10.26.2, as declared by the `packageManager` field in `package.json`
- A PostgreSQL database
- A [Clerk](https://clerk.com/) application
- Optional: a [Vercel AI Gateway API key](https://vercel.com/docs/ai-gateway/authentication-and-byok) for AI quick entry

If pnpm is not installed, install the declared version directly or enable it through Corepack where Corepack is available.

## Local Setup

Run all commands from the repository root.

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create the local environment file:

   ```bash
   cp apps/web/.env.example apps/web/.env
   ```

   `apps/web/.env` is ignored by Git. Replace the placeholder values before starting the application.

3. Configure these variables in `apps/web/.env`:

   | Variable                            | Required           | Purpose                                                                |
   | ----------------------------------- | ------------------ | ---------------------------------------------------------------------- |
   | `DATABASE_URL`                      | Yes                | PostgreSQL connection URL                                              |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes                | Clerk browser key                                                      |
   | `CLERK_SECRET_KEY`                  | Yes                | Clerk server key                                                       |
   | `CORS_ORIGIN`                       | Yes locally        | Browser origin; use `http://localhost:3001` for the default dev server |
   | `AI_GATEWAY_API_KEY`                | For AI quick entry | Server-side Vercel AI Gateway credential                               |
   | `AI_TRANSACTION_MODEL`              | No                 | Gateway model ID; defaults to `google/gemma-4-31b-it`                  |

4. Create an empty PostgreSQL database and apply the migrations:

   ```bash
   pnpm run db:migrate
   ```

5. Start the development server:

   ```bash
   pnpm run dev
   ```

6. Open [http://localhost:3001](http://localhost:3001), create a user through Clerk, and sign in.

### Clerk credentials

Clerk is already integrated into the application; do not rerun Clerk's framework installation steps. Create or select an application in the [Clerk Dashboard](https://dashboard.clerk.com/), then copy its publishable and secret keys into `apps/web/.env`.

### AI quick entry

The rest of the application works without AI configuration. To enable AI quick entry, create a key in Vercel AI Gateway and set `AI_GATEWAY_API_KEY`. `AI_TRANSACTION_MODEL` can be changed to another model ID supported by the gateway.

## Verification and Formatting

Run the unit tests:

```bash
pnpm run test
```

Check TypeScript across all workspaces:

```bash
pnpm run check-types
```

Lint and format the repository:

```bash
pnpm run check
```

`pnpm run check` runs Oxlint and then Oxfmt with `--write`, so it may modify files. The repository does not configure automatic Git hooks.

## Database Workflows

- `pnpm run db:migrate`: Apply committed migrations
- `pnpm run db:generate`: Generate a migration after changing the schema
- `pnpm run db:push`: Push the current schema without using migration history; reserve this for temporary schema prototyping
- `pnpm run db:studio`: Open Drizzle Studio

Vercel deployments run committed migrations automatically through `vercel.json`.

## UI Customization

React code shares shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust aliases or style configuration in `packages/ui/components.json` and `apps/web/components.json`

To add shared primitives from the repository root:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components through the package export:

```tsx
import { Button } from "@khoroch/ui/components/button";
```

Run the shadcn CLI from `apps/web` when adding an app-specific block instead of a shared primitive.

## Deployment

The full-stack Next.js application deploys as the `web` service configured in `vercel.json`.

1. Link the repository to a Vercel project:

   ```bash
   pnpm run deploy:setup
   ```

2. Sync `apps/web/.env` to the target environment before the first deployment:

   ```bash
   pnpm run env:preview
   pnpm run env:production
   ```

   The sync script excludes local `CORS_ORIGIN`; on Vercel, the application derives its origin from Vercel's deployment URL variables. Make sure `DATABASE_URL` is present before deploying because the install step runs database migrations.

3. Deploy:

   ```bash
   pnpm run deploy
   pnpm run deploy:prod
   ```

Useful deployment commands:

- `pnpm run dev:vercel`: Run the Vercel Services environment locally
- `pnpm run deploy:check`: Perform a dry-run deployment check without uploading
- `pnpm run env:production -- --scope your-team`: Forward Vercel CLI flags through the environment sync script

For platform details, see the Better-T-Stack guide to [deploying on Vercel](https://www.better-t-stack.dev/docs/guides/vercel).

## Project Structure

```text
khoroch/
├── apps/
│   └── web/          # Full-stack Next.js application and API routes
├── packages/
│   ├── config/       # Shared TypeScript configuration
│   ├── db/           # Drizzle schema, database client, and migrations
│   ├── env/          # Server and browser environment validation
│   └── ui/           # Shared UI components and global styles
├── scripts/          # Repository automation, including Vercel env sync
├── turbo.json        # Turborepo task configuration
└── vercel.json       # Vercel Services configuration
```

## Available Scripts

- `pnpm run dev`: Start all development tasks
- `pnpm run dev:web`: Start only the web application on port 3001
- `pnpm run build`: Build all workspaces
- `pnpm run test`: Run the TypeScript unit tests
- `pnpm run check-types`: Check TypeScript across all workspaces
- `pnpm run check`: Run Oxlint and format files with Oxfmt
- `pnpm run db:migrate`: Apply committed database migrations
- `pnpm run db:generate`: Generate database migrations
- `pnpm run db:push`: Push the schema directly without using migration history
- `pnpm run db:studio`: Open Drizzle Studio
- `pnpm run deploy:setup`: Link the repository to Vercel
- `pnpm run dev:vercel`: Run the local Vercel Services environment
- `pnpm run env:preview`: Sync local variables to the Vercel preview environment
- `pnpm run env:production`: Sync local variables to the Vercel production environment
- `pnpm run deploy:check`: Dry-run a Vercel deployment
- `pnpm run deploy`: Create a preview deployment
- `pnpm run deploy:prod`: Create a production deployment
