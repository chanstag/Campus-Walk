# Campus Walk

This is Web app that is intended for walking a school campus and record what is in every room. This is a fullstack app.

What to build:

- In the field: a way for the a user in the field to browse a Campus and to see it's buildings, floors, rooms and other items contained within. The primary ability to create assets and to move them, update them, and remove them and to attach other important data to them such as photos and notes. 

- In the Office: a way for an office user to see a summary of the above per campus with other useful summary metrics such as asset counts, items by condition level, and unassessed rooms. 

The data model is heirarchical Campus → Building → Floor → Room → Asset. 

# Data Model

    Campus: one-to-many with Building
    Building: 

```mermaid
  erDiagram
      CAMPUS ||--o{ BUILDING : contains
      BUILDING ||--o{ ASSESSMENT : "is assessed in"
      BUILDING ||--o{ ROOM : "Has Many"
      ASSESSOR ||--o{ ASSESSMENT : performs
      ASSESSMENT ||--o{ FINDING : records

      CAMPUS {
          int campus_id PK
          string name
          string address
      }
      BUILDING {
          int building_id PK
          int campus_id FK
          string name
          int year_built
      }
      ROOM {
        int room_id PK
        int building_id FK
        int condition
        VARCHAR quality_assessment_condition
      }
      ASSET {
        int asset_id PK

      }
      ASSESSMENT {
          int assessment_id PK
          int building_id FK
          int assessor_id FK
          date walk_date
      }
      FINDING {
          int finding_id PK
          int assessment_id FK
          string category
          string severity
          string notes
      }
      ASSESSOR {
          int assessor_id PK
          string name
      }
```




## Data Persistence 

For our Database, I'd like to use NeonDB. Honestly the Dev Experience is pretty awesome because it allows to "branch" off of a parent DB instance and this is pretty nice feature when you use worktrees for every feature you implement. And having a service manage your Postgres for you is just nice, no managing Postgres version updates, data protection and backup guarantees, and just general always available service. The less things to maintain and keep track of the better. Tradeoff is that our data is locked into Neon and data is very sticky and can be expensive to migrate off in-volume.

## User Roles

  field

  admin

### Permissions System

an ABAC (Attribute Based Access Control) permissions system is more powerful than normal RBAC (Role Based Access Control). RBAC only defines what actions are allowed for what roles. ABAC allows more granualar, contextual control over access which is powerful. I've used a hybrid model in the past which combines the ease of adminitration of RBAC with the fine-grain control of ABAC. 

 Enterpise level permissions abstraction can be used to control access, and thus what is usable and 'visible' to users on the front end. This abstraction will hide elements in the UI from user's who don't have access and simultaneously 

 I am going to be using BetterAuth for this project, I've rolled my own auth code in past and I've read that BetterAuth just offers alot of feature out of the box that are very helpful that you don't have to manage yourself. Just general user management with builtin authentication options and session management out of the box. 




## Tech Stack

TypeScript
Vite + Fastify Server
relational DB, for this app Postgres (NEON DB)
tRPC
BetterAuth


## Interesting Design/App questions

- what if a user takes a picture of every room and the app tells you if you forgot to notate something in that room?

- Maybe show the route the field user took through the campus/building

- transactional history, who touched what and when?


## Getting started

Monorepo managed with pnpm. `apps/api` is a Fastify server exposing a tRPC router backed by Drizzle and Neon Postgres. `apps/web` is a Vite + React SPA that calls the router through TanStack Query with end-to-end types.

```bash
pnpm install          # install both apps
pnpm db:setup         # one-time: sign in to Neon in the browser, create the "campus-walk" project, write apps/api/.env
pnpm --filter api db:migrate   # create the tables
pnpm db:seed          # load the sample district (truncates first)
pnpm dev              # API on http://localhost:3001, web on http://localhost:5173
```

Other commands:

```bash
pnpm typecheck                    # tsc for both apps
pnpm build                        # production build of both apps
pnpm --filter api db:generate     # drizzle-kit: generate a migration from src/db/schema.ts
pnpm --filter api db:migrate      # drizzle-kit: apply migrations
```

`pnpm db:setup` is idempotent: it exits early if `apps/api/.env` already has `DATABASE_URL`. Set `NEON_PROJECT_NAME` or `NEON_REGION` to override the defaults, `NEON_ORG_ID` if your account belongs to more than one Neon organization, or `NEON_API_KEY` to skip the browser login (CI).

Layout:

```
apps/api/src/router.ts    tRPC procedures; exports AppRouter type consumed by the web app
apps/api/src/db/schema.ts Drizzle schema: district → campus → building → floor → room → asset, + asset_type
apps/api/src/db/seed.ts   loads sample_data/campus_walk_sample_data (see CLAUDE.md "Data model" for the rules)
apps/web/src/trpc.ts      typed tRPC client + React hooks
apps/web/src/App.tsx      calls hello + health to prove the full stack
scripts/setup-neon.mjs    Neon provisioning
```



