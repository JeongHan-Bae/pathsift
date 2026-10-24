# Development

## Setup and execution

Use Node.js `>=22.12.0`, including Node 23, and run `npm ci` at the package root. `npm run build` compiles TypeScript to `dist/`. Start the checkout CLI with `node bin/pathsift.cjs --help`: Node 22 and 23 select compiled JavaScript, while Node 24+ executes the TypeScript source natively. The npm package bin points directly to compiled JavaScript.

The checked-in `pathsift.config.json` and `global.ignore` become package-local files on installation. `bufferLimitBytes` defaults to 1073741824 (1 GiB) and is applied to visible regular-file bytes after one ignore-aware walk. `pathsift nano` writes the installed `global.ignore` and requires a TTY. The checked-in template has `.git/` commented out; local edits to an installed copy may be replaced on reinstall. Tests use isolated copies.

## Checks

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | TypeScript type and source syntax check |
| `npm run check:syntax` | Check JavaScript entrypoint, maintenance, and test syntax |
| `npm run check:platform` | Reject runtime platform/architecture branching APIs |
| `npm run check:boundaries` | Enforce layer direction and explicit TypeScript import extensions |
| `npm run check:static` | All preceding static checks |
| `npm run test:tdd` | Focused unit and regression tests, including launcher selection |
| `npm run test:source` | Per-command BDD through the checkout launcher |
| `npm run test:compiled` | The same BDD through `dist/boot/cli-main.js` |
| `npm run test:package` | Pack, install, and run the same BDD against the installed package |
| `npm test` | TDD plus source and compiled BDD |
| `npm run check:dependencies` | Separate runtime and full npm advisory audits |
| `npm run check:package` | Check exact production file list, npm README, and manifest fields |
| `npm run stage:release` | Build, pack the generated publishable directory, and unpack into ignored `release-preview/` |
| `npm run verify:release` | Static, all three behavior layers, audits, package contents, and release preview |
| `npm run verify:precommit` | Mandatory final contribution gate: release gate, then staged and unstaged Git whitespace checks |

`test/bdd/<command>.feature` records each command's scenarios; the matching `.test.mjs` file executes them with Node's test runner. Every path-processing command runs 15 combinations: the existing five ignore fixtures (0/1/2 ignore-file cases, plus disabled global rules and disabled all filtering) crossed with omitted, empty, and explicit `--parent`. Focused cases cover invalid parents, multi-level scopes, and `--force`. `node-pty` is a development dependency for interactive output and editor tests. The runtime dependency graph does not include test tools.

Each empty-parent matrix case also checks `--parent ""`, bare `--parent`, `--parent --`, and bare `--parent` before another option. The help BDD verifies that all three parent modes and these alternate spellings are documented.

## CI and environment limits

`.github/workflows/ci.yml` uses `actions/checkout@v5` and `actions/setup-node@v5`, installs with `npm ci`, then runs `npm run verify:precommit` on Ubuntu for Node 22.12, 23, 24, and 26. Node 22.12 proves the project floor; Node 23 exercises the compiled checkout path; Node 24 and 26 exercise native TypeScript. Every row also runs compiled and installed-package BDD. Additional macOS and Windows jobs run static checks, TDD, and package-content checks on Node 22.12 and 26. The full interactive and archive BDD matrix currently runs on Ubuntu; the portability jobs do not claim complete behavior coverage on those two hosts.

Automatic push and pull-request CI runs only when `bin/`, `scripts/`, `src/`, `test/`, or `.github/workflows/ci.yml` changes. `workflow_dispatch` remains available for a manual run. Documentation-only and manifest-only changes still require the local contribution gate before a commit.

Run `npm run verify:precommit` after the final file edit and before each commit. It runs the full release gate, then `git diff --check` and `git diff --cached --check`. Focused checks and an earlier gate run do not replace it. Stage only the intended files and inspect both diff views before committing. The exact commit-message and pull-request formats are in [CONTRIBUTING.md](../CONTRIBUTING.md).

`npm audit` and the package installation test need npm registry access. A network-restricted sandbox failure leaves those checks unverified; it does not establish a host DNS fault. Use a writable npm cache if the default cache is not writable. See [build.md](build.md) for artifact contents and [release.md](release.md) for publication readiness.
