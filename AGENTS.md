# pathsift development instructions

## Purpose and authority

pathsift is a single-package CLI for inspecting and exporting directory trees with Git-style ignore rules. It does not edit scanned files, traverse symlinked directories, or provide `mv` or recursive `rm`. The interactive `nano` command edits only the package's `global.ignore` file. Copy and archive accept missing or existing empty destinations and restore that state after a failed write.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing the project. It owns contribution and handoff procedure. [docs/development.md](docs/development.md) owns local commands and CI, [docs/build.md](docs/build.md) owns compilation and package contents, [docs/hash.md](docs/hash.md) owns the two-level hash contract, and [docs/release.md](docs/release.md) owns release readiness. This file owns implementation boundaries and behavior that must stay true.

## Source and package shape

Use Node.js `>=22.12.0`. The archive dependency must support this continuous range, including Node 23. This is one ESM package with TypeScript source under `src/`. `npm run build` compiles it to `dist/` and rewrites relative `.ts` imports to `.js`. The repository root is private and its `README.md` is for GitHub. Packaging copies `docs/npm-readme.md` to the generated package root as `README.md` and emits a production manifest. The npm `pathsift` bin points only to `dist/boot/cli-main.js`; do not publish TypeScript source or the source launcher. `npm run stage:release` exposes the actual packed tarball and unpacked package tree under Git-ignored `release-preview/`; `dist/` remains only a compilation output.

`bin/pathsift.cjs` is a checkout launcher. On Node 24+ it runs the TypeScript entry directly through native type stripping. On Node 22 and 23 it runs the compiled JavaScript. Native execution must use erasable TypeScript syntax and explicit `.ts` imports; compiled execution must use `.js` imports. Keep `package.json` and `package-lock.json` synchronized through npm when dependency metadata changes.

## Dependency direction

```text
src/boot/cli-main.ts -> src/application/run.ts -> src/core/*
                     -> src/adapters/* -> Node APIs and runtime dependencies
```

- `src/core/` contains pure rules and result/port contracts. It must not import Node APIs, adapters, or the CLI entrypoint.
- `src/application/` coordinates commands through injected ports and returns a structured result. It may import core modules, but not adapters or Node APIs.
- `src/adapters/` owns filesystem traversal, ignore matching, hashing, archiving, config access, terminal editing, and output. The output adapter checks its own target stream for TTY support and uses Ink/React only for suitable interactive text output. JSON output stays plain. Adapters must not import application or boot modules.
- `src/boot/` parses arguments, composes adapters, and reports errors on stderr with a nonzero exit status. Help is a structured document produced by the CLI output adapter and then serialized for display.

Add a port only when the application needs an external capability. Keep path normalization in Node's `node:path` adapter. An open directory handle records active use but does not impose a cross-platform mandatory lock on other processes. See [docs/architecture.md](docs/architecture.md) for the current contracts.

## Behavior that must remain true

- `tree` presents directories before files and symlinks at every level, sorting names within each group without changing the walker order used by other commands.
- Root and nested ignore files apply in order; global rules have lowest priority. A negation that rescues one directory must not mutate ignore state shared with sibling directories.
- `--parent [directory]` on every path-processing command collects selected ignore files from that ancestor through the scanned source. Omission starts at the source; a bare option or empty value starts at the current directory, including before `--` or another option. The parent must contain the source. Ancestor collection reads only ignore files along that path, without walking siblings or changing the source-relative output base. A parent path containing a relative `..` segment requires `--force`.
- Symlinked directories are reported but never traversed. Copy and archive preserve links. Before a single ignore-aware walk, both export commands reject nonempty destinations. If an empty output lies inside the source, the walker skips that exact output entry. On handled export errors, rollback removes a newly created output or leaves a previously empty output empty; do not claim crash-safe filesystem transactions. `bufferLimitBytes` defaults to 1 GiB of visible regular-file bytes; smaller exports buffer data in memory, while larger exports write directly with rollback.
- Relative source or destination paths containing a `..` segment require `--force`. Absolute paths and current-directory descendants do not. Without `--force`, the CLI reports an error on stderr and exits nonzero. `--force` does not disable destination containment or overwrite checks.
- `manifest` writes valid JSON to stdout; errors stay on stderr. Other read commands use terminal text output. TTY styling must not appear in pipes or JSON.
- `pathsift.config.json` declares `hashVersion: 1`; reject missing or unsupported versions. Future formats need a deliberate implementation and tests.
- `hash` uses two levels: each visible regular file hash combines a filename SHA-256 and a content SHA-256; the tree hash combines those file hashes in stable filename order. A rename or transfer of bytes across visible files must change the relevant hashes, subject to SHA-256 collision resistance.
- `nano` requires an interactive TTY and must not write when TTY support is unavailable.

## Tests and maintenance checks

Follow [test/AGENTS.md](test/AGENTS.md) for per-command BDD ownership and the 15-combination ignore/parent matrix. User-visible changes require a matching scenario update. Do not weaken an assertion to accommodate a regression.

Run `npm run check:static` and `npm test` after code changes. The static gate checks TypeScript types, JavaScript syntax, platform-neutral runtime APIs, and layer imports. `npm test` runs TDD, source launcher BDD, and compiled BDD. `npm run test:package` packs and installs the production artifact, then runs the same BDD suite. `npm run verify:release` includes these checks, separate runtime/full dependency audits, an exact package-content check, and a local release preview. After the final file change and before every commit, run `npm run verify:precommit`; it adds staged and unstaged Git whitespace checks to the release gate. CI runs this pre-commit gate across the Ubuntu Node version matrix, plus static/TDD/package checks on macOS and Windows.

Keep the root `README.md`, `docs/npm-readme.md`, and `--help` aligned on CLI behavior. Update architecture docs when moving a boundary, and build/release docs when changing package scripts, Node support, CI, dependencies, or artifact contents. A failed or unavailable check remains unverified. Formal publication requires an existing `vX.Y.Z` tag and the trusted-publishing workflow in `.github/workflows/release.yml`; consult [docs/release.md](docs/release.md) before changing that contract.
