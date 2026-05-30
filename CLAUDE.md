# CLAUDE.md

Guidance for AI assistants (e.g. Claude Code) working in this repository.

## Project overview

`hello-world` is a personal starter repository belonging to Emsee
(pronounced "Émsee"), who is new to coding. As of this writing it contains
only a `README.md` — there is no application source, build system, tests,
or dependencies yet. Treat this as a learning sandbox that is expected to
grow over time.

## Current structure

```
.
├── README.md     # Personal introduction from the repo owner
└── CLAUDE.md     # This file
```

That's the entire repository. There is no `package.json`, build config,
CI pipeline, or language-specific tooling present.

## Working conventions

Because the owner is learning, optimize for clarity and teaching over
cleverness:

- **Explain as you go.** When adding code, prefer readable, well-commented
  examples over terse or advanced idioms. Briefly describe what changed and why.
- **Keep it small.** Make incremental, self-contained changes that are easy
  to follow. Avoid introducing heavy frameworks or tooling unless asked.
- **Don't invent structure.** Don't scaffold build systems, package managers,
  or directory layouts speculatively. Add them only when the task actually
  calls for it, and explain the choice.
- **Match what exists.** Once a language or style is established in the repo,
  follow it for consistency.

## Git workflow

- The default branch is `master`.
- Development for assistant-driven tasks happens on dedicated feature
  branches (e.g. `claude/<topic>`), not directly on `master`.
- Make focused commits with clear, descriptive messages.
- Pull requests merge into `master` (see PR #1, "readme-edits", for the
  established pattern of branch → PR → merge).
- Do not create a pull request unless explicitly asked.

## When the codebase grows

Update this file as the project evolves. In particular, document here once
they exist:

- The language(s) and runtime/version used.
- How to install dependencies, build, run, and test the project.
- Any linting/formatting commands and their configuration.
- The directory layout and where the main entry point lives.
