# Global Instructions

## Plan Mode Default

- Enter plan mode for any non-trivial task (3+ steps, architectural decisions, or non-trivial bugfixes)
- For non-trivial bugfixes: investigate root cause in plan mode, then delegate the fix to the appropriate engineer agent
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

## Self-Improvement Loop

- After ANY correction: update `tasks/lessons.md` in the current project with the pattern
- Write rules that prevent the same mistake from recurring
- Review `tasks/lessons.md` at the start of each project session if it exists

## Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

## Git Workflow

- This project's workflow does not involve git — do not run git commands or create commits.

## Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant solution?"
- If a fix feels hacky: step back and implement the elegant solution instead
- Skip for simple, obvious fixes — do not over-engineer
- Challenge your own work before presenting it

## Skills

- Use skills for any task that matches a defined capability
- Skills live in `.claude/skills/` (project) or `~/.claude/skills/` (global)
- Invoke with natural language; each skill is one independent capability

## Sub-agents — Prefer Over Main Context

**Default to delegating** — if a specialist agent exists for the task, use it instead of handling it in the main context. The main context is for orchestration, not implementation.

- Check your agents directory before starting any non-trivial task — `.claude/agents/` (project) or
  `~/.claude/agents/` (global) for Claude Code; `.opencode/agents/` (project) or
  `~/.config/opencode/agents/` (global) for OpenCode
- If the task matches an agent's domain, delegate — do not implement it yourself
- One focused task per sub-agent invocation — do not overload a single agent
- The main context coordinates; agents implement

**When to delegate:**
- The task has a clear domain (backend, frontend, database, infra, security, docs)
- The work would pollute the main context with implementation detail
- A specialist would produce higher-quality output than generalist handling

**When to stay in main context:**
- Simple, cross-cutting tasks with no matching agent
- Coordination between multiple agents
- Short answers or lookups that don't warrant a full delegation

**Context cost rule — never read large files in the main loop:**
Every file read in the main context is re-sent as input tokens on *every subsequent turn* for the rest of the session. This accumulates fast, especially on Opus.
- **Never `Read` a file over ~100 lines directly in the main loop.** Delegate to an `Explore` or `general-purpose` subagent and keep only its conclusion.
- For multi-file exploration, always use the `Explore` subagent — never fan out `Read` calls in the main thread.
- Prefer `/clear` between unrelated tasks over `/compact`; compaction pays a full Opus pass, clear is free.

**Available agents:**

| Trigger | Agent |
|---|---|
| Frontend implementation or bugfix: Angular components, services, routing | `angular-engineer` |
| Frontend code review or pre-commit check | `angular-reviewer` |

## Core Principles

- **Simplicity First**: Every change should be as small and focused as possible
- **No Laziness**: Find root causes — no temporary fixes; senior developer standards
- **Ask First**: Ask before making major architecture decisions, project structure choices, or technology selections

## Project Defaults

These apply to all new projects unless the project context says otherwise.




### Project Identity

- Artifact/project name must match the parent directory name
- Semantic versioning: bump the PATCH segment for each new generated version


### Preferred Technology Defaults

These are defaults — suggest alternatives when a use case clearly calls for something better.

| Concern | Default |
|---|---|
| Frontend | Angular (TypeScript) |

### Testing

- Always write tests for generated code: both positive (happy path) and negative (error/edge cases) cases

### CI/CD

- Use **GitHub Actions** — generate workflows in `.github/workflows/`
- A standard pipeline: lint → test → build → (push image if applicable)



### Documentation

- Update `README.md` each time a new version is generated
- Keep README concise: description, prerequisites, local setup, test instructions, API reference link

### Reference Material

- When asked to use a URL as reference: fetch the page and save it to `reference/<descriptive-name>.md` in the current project
- Reference the local file in subsequent work instead of re-fetching

### Code Volume

- Minimize the amount of generated code — prefer concise, idiomatic code over verbose boilerplate
