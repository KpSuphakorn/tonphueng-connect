# Tonphueng Connect

## Sources and scope

- Before acting, read all applicable `AGENTS.md` files, `CONTEXT.md` if present, and referenced protocols relevant to the task.
- Read `../ref/README.md` to select sources. The system scope comes from `../ref/current/ต้นผึ้ง OA Specification.pdf`; `../ref/current/ผึ้งพาเดิน_compressed.pdf` supplies project context.
- The source Google Doc is https://docs.google.com/document/d/1I8fly6Lap6dkbdqK7-8VD4fHGYBjCT1yYFgoIcNrwQQ/edit. Flag conflicts between sources and ask before resolving them.
- Archive ideas are history, not requirements. Reuse existing documents and link to sources rather than copying them.
- `../storypage/` is a separate existing project. Changes to it require explicit authorization.

## Delivery and authorization

- The primary conversation is Manager and owns scope, authorization, task state, evidence, and the final report. Do not create another Manager agent.
- Default to Manager only for non-code work and Manager -> Coder for code work. Only Coder may edit source code or notebooks.
- Use Planner for unresolved architecture or consequential research; Tester for independent integration, remote, or experimental evidence; Reviewer when requested or justified by material risk. Avoid redundant role calls and parallel write-heavy work.
- Propose files to add or modify, with reasons, and obtain user confirmation before writing. Approval applies only to the proposed scope.
- Follow the requested stages: `grill-with-docs` -> `to-spec` -> `to-tickets` -> `implement` -> `code-review`. Wait for user confirmation of shared understanding, spec, and ticket breakdown before the next stage. If a required skill is unavailable, report it rather than claiming to use it.
- Coder makes the smallest change for the approved ticket and runs targeted behavioral checks. Use pre-agreed TDD seams where applicable. Reuse a completed applicable review instead of repeating it without new evidence.
- Reviewers are read-only and use fresh agent context for each review pass. After a failure, return to Coder for the smallest correction and rerun the affected checks.
- Never commit, push, create a GitHub repository, deploy, incur new costs, or write to an external system without explicit authorization, even if a skill instructs it.
- For complex or remote work, use `agent-runs/<task-id>/` only for applicable plan, ticket, test, review, and result artifacts. Do not duplicate the spec across handoffs.
- This setup authorizes workflow files only. Product scope, technology, and acceptance criteria remain subject to the staged confirmations above.

## Agent skills

### Issue tracker

Specs and tickets live in local Markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context glossary at `CONTEXT.md`, with ADRs under `docs/adr/` when needed. See `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
