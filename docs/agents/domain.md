# Domain docs

## Layout

This repo uses a single context: a root `CONTEXT.md` glossary and `docs/adr/` for architecture decisions when needed. The separate sibling `storypage/` repository does not imply a monorepo or multiple contexts here.

## Consumer rules

- Read root `CONTEXT.md` if it exists and ADRs relevant to the work before exploring or changing behavior.
- If a `CONTEXT-MAP.md` is introduced later, follow its pointers to the relevant contexts.
- Use the glossary's canonical terms in discussion, specs, tickets, code, and tests. Flag conflicting definitions instead of silently changing terminology.
- Treat `CONTEXT.md` as a domain glossary only, not a product spec or implementation notebook.
- Flag any proposed decision that contradicts an existing ADR and ask before overriding it.

## Creation rules

- Missing domain files do not block exploration. Create `CONTEXT.md` lazily when terms are resolved and the user has approved writing that file.
- Create an ADR only for a real trade-off that is costly to reverse and would otherwise surprise a future reader; obtain the user's approval of the proposed file first.
- Reuse the source documents listed in `AGENTS.md`. Keep product requirements in the single approved feature spec rather than duplicating them in domain docs.
