# ittikar self-service portal

Web form → GitHub Issue. Devs submit infra requests; the Issue lands in the target
infra repo. A separate TUI (run by the platform team, not in this repo yet) picks
up the issue, runs `claude -p` + `tofu plan`, and applies directly to `dev`.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind 4
- tRPC for typed RPC
- NextAuth v5 (GitHub OAuth) — restricted to the `ittikar` GitHub org
- Octokit (using the signed-in user's token) to open issues in infra repos

## One-time setup

### 1. GitHub OAuth App (for user sign-in AND issue creation)

Register at <https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**.

| Field | Value |
|---|---|
| Application name | ittikar self-service (local) |
| Homepage URL | `http://localhost:3000` |
| Authorization callback URL | `http://localhost:3000/api/auth/callback/github` |

Generate a client secret (shown once — copy it). Set in `.env.local`:

```
AUTH_GITHUB_ID=<client id>
AUTH_GITHUB_SECRET=<client secret>
AUTH_SECRET=$(openssl rand -base64 32)
ALLOWED_GITHUB_ORG=ittikar
```

On first sign-in, GitHub will ask each user to consent to scopes:
`read:user user:email read:org repo`. The `repo` scope is required because GitHub
doesn't have a finer-grained OAuth scope just for creating issues — but the token
is scoped to what the user can already do in GitHub.

For Vercel deployment: register a second OAuth App with
`https://<your-domain>/api/auth/callback/github` as the callback.

### 2. Run

```
cp .env.example .env.local        # then fill in the values above
npm run dev
```

Open <http://localhost:3000>, sign in with GitHub, submit a test S3 request
against `itti-docs-infra` (or any safe repo). It should open a real Issue.

## Project layout

```
src/
├── app/                     Next.js App Router pages
│   ├── api/auth/[...]       NextAuth handler
│   ├── api/trpc/[trpc]      tRPC handler
│   ├── new/                 New request form
│   ├── requests/            Status page
│   └── page.tsx             Landing
├── components/              UI components (forms, header)
├── lib/                     Static config (repo list, YAML helper)
├── server/                  Server-only code
│   ├── auth.ts              NextAuth config (persists access_token to session)
│   ├── github/              user.ts (per-request Octokit) + issue.ts
│   ├── schemas/             Zod schemas per resource type
│   └── trpc/                tRPC routers
└── trpc/                    Client-side tRPC provider
```

## Adding a new resource type

1. Add a Zod schema in `src/server/schemas/<resource>.ts`.
2. Register it in `src/server/schemas/index.ts` (`resourceSchemas` + `RESOURCE_CATALOG`).
3. Add a form component in `src/components/forms/<resource>-form.tsx`.
4. Render it conditionally in `src/app/new/page.tsx`.

The Issue body and YAML manifest are generated automatically from the schema.
