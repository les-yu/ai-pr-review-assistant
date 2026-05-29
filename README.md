# AI PR Review Assistant

AI-powered Pull Request code review platform. Submit a GitHub PR URL and get automated analysis including risk detection, code review comments, and a visual dashboard.

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Next.js Route Handlers, TypeScript
- **Database**: PostgreSQL, Prisma ORM
- **AI**: DeepSeek API
- **Integration**: GitHub REST API
- **Deployment**: Docker, Vercel

## Architecture

Domain-driven design with clear separation of concerns:

```
src/
├── app/                    # Next.js pages + API Routes
├── components/             # UI (shadcn/ui + feature components)
├── domain/analysis/        # Core business logic (orchestration)
├── integrations/github/    # External API clients
├── ai/                     # AI analysis module
│   ├── engine.ts           # Single entry point
│   ├── strategies/         # Pluggable analysis strategies (Rule + LLM)
│   ├── prompts/            # Prompt templates (versionable)
│   ├── context/            # Context building from diffs
│   └── providers/          # LLM provider abstraction
├── infrastructure/         # DB, config, logging
└── types/                  # Shared type definitions
```

### Key Design Decisions

1. **Services split into `domain/` + `integrations/`**: External API calls (integrations) are isolated from core business logic (domain). The `analysis.service.ts` in domain is the orchestration heart that ties everything together.

2. **AI module with 5 internal layers**: `engine` (entry) → `strategies` (pluggable: Rule + LLM) → `prompts` (versionable templates) → `context` (diff processing) → `providers` (LLM abstraction). Adding a new analysis capability = new strategy + new prompt, no changes to existing code.

3. **Strategy pattern for analysis**: `CompositeAnalysisStrategy` runs Rule Engine (fast, deterministic) first, then LLM (slow, semantic), and merges results. LLM comments override rule comments on the same file+line.

4. **Comprehensive type system**: `types/` for shared types across modules, each module has its own `.types.ts` for local types. No `any` allowed.

5. **Rule Engine before LLM**: Rule engine needs no API key, can be tested independently, provides baseline detection before LLM integration.

### Analysis Flow

```
PR URL
  → integrations/github: fetch PR data (info, files, diff, commits)
  → ai/context: build multi-layer context (diff + surrounding + function)
  → ai/engine: run composite strategy
      → rule.strategy: static pattern matching
      → llm.strategy: semantic analysis via DeepSeek
      → composite: merge & deduplicate
  → domain/analysis: persist results to DB
  → Dashboard: visualize findings
```

## Getting Started

```bash
# Install dependencies
npm install

# Start PostgreSQL (requires Docker)
docker compose -f docker/docker-compose.yml up -d

# Run database migration
npx prisma migrate dev

# Start development server
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `GITHUB_TOKEN` | GitHub personal access token (optional, for higher rate limits) |
| `DEEPSEEK_API_KEY` | DeepSeek API key (required for LLM analysis) |

## Development Roadmap

| PR | Module | Status |
|---|---|---|
| #1 | Project scaffold + architecture | ✅ Done |
| #2 | GitHub integration | ✅ Done |
| #3 | AI context builder | ✅ Done |
| #4 | Rule engine | ✅ Done |
| #5 | LLM + prompts | ⬜ |
| #6 | AI engine composite | ⬜ |
| #7 | Analysis domain orchestration | ⬜ |
| #8 | Home + status pages | ⬜ |
| #9 | Dashboard UI | ⬜ |
| #10 | Integration + deployment | ⬜ |
