# Contributing

This document owns the commit-message format, pull-request summary, review expectations, and final handoff evidence for pathsift. Read [AGENTS.md](AGENTS.md) for behavior and architecture boundaries, [test/AGENTS.md](test/AGENTS.md) for test coverage, [docs/development.md](docs/development.md) for local commands and CI, [docs/build.md](docs/build.md) for package contents, and [docs/release.md](docs/release.md) for publication. Keep implementation, tests, and owning documentation for one contract in the same change.

## Development flow

1. Use Node.js 22.12 or later, including Node 23, and install from the lockfile with `npm ci`. The checkout launcher uses compiled JavaScript on Node 22–23 and native TypeScript on Node 24+.
2. Add a focused TDD case for a rule or regression. For CLI behavior, update that command's `.feature` and `.test.mjs` BDD files; keep the five ignore cases crossed with three parent modes intact.
3. Implement through the owning TypeScript layer. Keep the boot entry small, the application independent of adapters, and TypeScript syntax erasable by Node's native loader.
4. Run focused checks while developing. Run the final contribution gate after the last file change.

## Final verification

Run this mandatory gate after the final file change and before every commit:

```sh
npm run verify:precommit
```

It runs static checks, TDD, source and compiled BDD, installed-package BDD, separate runtime and full dependency audits, exact package-content validation, release staging, and staged and unstaged Git whitespace checks. [docs/development.md](docs/development.md) documents the commands and CI matrix. A focused command or an earlier run does not substitute for the final gate. Do not bypass a failed gate or weaken an assertion to make it pass.

If the environment prevents a required check from running, report the exact command, error, and remaining risk. Do not describe an unavailable check as passed.

## Change hygiene

Inspect both `git diff` and `git diff --cached`, then stage only the files belonging to the change. Do not commit `node_modules`, `dist`, IDE state, local npm configuration, logs, caches, temporary fixtures, package archives, or generated `release-preview/` copies. Update `package-lock.json` through npm when manifest or dependency metadata changes, and inspect its generated diff.

## Commit messages

Every commit message uses this format:

```text
behavior(domain, domain): one-line summary

Detailed description paragraph.

* One-level bullet point.
* Another one-level bullet point.
```

The first line is required. Use a lowercase change kind such as `init`, `fix`, `refactor`, `test`, or `docs`; put one or more affected domains in parentheses, separated by an English comma and a space; follow the closing parenthesis with an English colon and one space; finish with a concise one-line summary. For example:

```text
init(project): scaffold pathsift CLI
fix(cli, output): correct tree branch ordering
refactor(adapters, core): preserve the dependency direction
docs(contributing): define commit and pull request rules
```

The body is optional. When present, write plain paragraphs and one-level `*` bullets only. Do not put headings, tables, links, fenced code blocks, blockquotes, emphasis, checkboxes, numbered lists, or nested bullets in a commit body. Put the reason for a non-obvious change there; the pull request owns the fuller summary and check evidence.

## Pull requests

A pull-request description must state what changed and why, which architecture boundary owns it, whether public CLI or JSON behavior changed, which final and focused project checks passed, whether the owning documentation matches the implementation, and any unavailable check with its exact error and remaining risk. Use this structure:

```markdown
## Summary

Describe what changed and name the owning boundary.

## Reason

Explain why the change is necessary and whether public CLI or JSON behavior changes.

## Breaking API Updates

State `None` or describe the breaking change.

## Checks

- `npm run verify:precommit`
- Other relevant focused or environment-specific project checks
```

Do not list a focused check as a replacement for the final gate. Markdown headings and links belong in the pull-request description, not the commit message.

## Review and handoff

Before handoff, report the changed files and contracts, the exact final gate result, useful focused checks, unavailable checks and their risk, and intentionally uncommitted work. Reviewers should be able to identify the owning contract, the tests proving it, and the documentation describing it. Publishing is a separate manual step governed by [docs/release.md](docs/release.md).
