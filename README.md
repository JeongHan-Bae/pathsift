# pathsift — ignore-aware filesystem CLI

pathsift inspects, copies, and archives directory trees with one Git-style ignore engine.

This repository contains the TypeScript source, hexagonal CLI architecture, BDD/TDD suite, build scripts, and release checks. The npm package ships compiled JavaScript and a shorter [package usage README](docs/npm-readme.md). This root README covers the project contract and contributor workflow as well as the CLI behavior.

## Repository layout

| Path | Role |
| --- | --- |
| `src/core/` | Pure tree, path, hash, and port rules. |
| `src/application/` | Command coordination and structured results. |
| `src/adapters/` | Filesystem, config, terminal, and archive capabilities. |
| `src/boot/` | CLI argument parsing and composition. |
| `test/tdd/`, `test/bdd/` | Rule tests and per-command behavior scenarios. |
| `docs/npm-readme.md` | Usage guide copied into the generated npm package. |

The [architecture document](docs/architecture.md) explains the dependency direction. [Contributing](CONTRIBUTING.md) defines the required checks and commit format.

## Requirements and checkout use

- Node.js 22.12 or later (`>=22.12.0`).
- Run `npm ci` and `npm run build` in this directory. Use `npm run stage:release` to generate a visible preview of the actual npm package.
- Run `node bin/pathsift.cjs ...` from a checkout. Node 22 and 23 use compiled JavaScript; Node 24+ runs TypeScript
  source natively.
- `archiver` 8 supplies archive output and declares support for this continuous Node range. The npm package's `pathsift`
  bin points directly to compiled `dist/boot/cli-main.js`. `pathsift@0.0.1` has been published with the npm `alpha` dist-tag; this checkout is version `0.1.0`.

`pathsift.config.json` and `global.ignore` live beside the CLI package. `pathsift config` prints their absolute paths and the active hash version.
`pathsift nano` edits that package's `global.ignore`, so its installation directory must be writable for editing. Install under a user-writable npm prefix if you need `nano`. A global reinstall may replace edits to that installed file; the checked-in template still has `.git/` commented out.

## Command reference

For commands with `[directory]`, omitting it scans the current directory. In `tree`, each level shows directories first, then files and symlinks; names are sorted within each group. A source must be a directory. Paths in results
are relative to that source unless a command explicitly prints the absolute root. `pathsift` with no command prints
help.

| Command    | Parameters                                             | Result                                                                      | Accepted options       |
|------------|--------------------------------------------------------|-----------------------------------------------------------------------------|------------------------|
| `tree`     | `[directory]`                                          | Branch drawing with directories first at each level, then counts and regular-file bytes           | Scan options, `--help` |
| `ls`       | `[directory]`                                          | Visible entries immediately inside the root                                 | Scan options, `--help` |
| `find`     | `[directory]`                                          | Every visible relative path, recursively                                    | Scan options, `--help` |
| `count`    | `[directory]`                                          | Number of visible directories and regular files, plus their file bytes      | Scan options, `--help` |
| `du`       | `[directory]`                                          | Sum of visible regular-file logical bytes, then a tab and the absolute root | Scan options, `--help` |
| `hash`     | `[directory]`                                          | Two-level SHA-256: path-and-content file hashes, then a combined tree hash  | Scan options, `--help` |
| `manifest` | `[directory]`                                          | JSON with `root` and visible `entries` (`path`, `kind`, `size`) on stdout   | Scan options, `--help` |
| `cp`       | `<source-directory> <destination-directory>`           | Copy visible entries to a missing or empty directory; preserve links                   | Scan options, `--help` |
| `archive`  | `<source-directory> <output.zip\|.tar\|.tar.gz\|.tgz>` | Archive visible entries to a missing or empty file; preserve links                       | Scan options, `--help` |
| `nano`     | None                                                   | Edit the package's `global.ignore` in a TTY                                 | `--help` only          |
| `config`   | None                                                   | Print package config, global ignore path, and ignore filenames              | `--help` only          |
| `help`     | None                                                   | Print command and option help                                               | `--help` only          |

`nano`, `config`, and `help` reject positional arguments and scan options with a nonzero exit status and a message on
stderr. The global `--help` option takes precedence and prints help for any invocation. An unknown command or option
also fails on stderr.

### Scan options

These options apply to `tree`, `ls`, `find`, `count`, `du`, `hash`, `manifest`, `cp`, and `archive`:

| Option                     | Meaning                                                                                                                      |
|----------------------------|------------------------------------------------------------------------------------------------------------------------------|
| `--ignore-file <filename>` | Replace the configured ignore filename list. Repeat for two or more names; each value must be a simple filename, not a path. |
| `--parent [directory]`      | Collect selected ignore files along this ancestor-to-source path. Omit the option to start at the source; use bare `--parent` or `--parent ""` to start at the current directory. |
| `--no-global-ignore`       | Skip package `global.ignore` but still apply directory ignore files.                                                         |
| `--no-ignore`              | Disable all ignore filtering, including global and directory rules. This wins if combined with `--no-global-ignore`.         |
| `--force`                  | Allow a relative source or destination path containing a `..` segment. It does not bypass destination safety checks.         |

`--help` or `-h` is available with any invocation. Relative paths rooted in the current directory, such as `.` and
`./child`, and absolute paths do not require `--force`. Without `--force`, a parent-relative path fails on stderr before
traversal or export.

`--parent` must resolve to the source directory or one of its ancestors. It reads ignore files in those directories without scanning their other entries; command output and `hash` file names remain relative to the selected source. A relative `--parent` containing `..` also requires `--force`. `--no-ignore` disables these ancestor rules, while `--no-global-ignore` keeps them.

Bare `--parent` means the current directory at the end of a command, before `--`, or before another option such as `--no-ignore`. Use `--parent=<directory>` when a directory name itself begins with `-`.

The parent modes combine with the ignore-file rules: use no `--parent`, `--parent ""`, or an explicit ancestor regardless of how many matching ignore files exist. The BDD suite checks the five ignore cases crossed with all three parent modes for every path-processing command.

```sh
pathsift tree ./project
pathsift find ./project --ignore-file .gitignore --ignore-file .deployignore
pathsift tree ./project --no-global-ignore
pathsift tree ./project/sub --parent ./project
pathsift tree ./src --parent ""  # from this repository's root
pathsift tree ./src --parent --no-global-ignore
pathsift manifest ./project --no-ignore
pathsift cp ./project ./backup
pathsift archive ./project ./project.tar.gz
pathsift tree ../another-project --force
pathsift nano
pathsift config
```

## Ignore semantics

`pathsift.config.json` names ignore files to read in each scanned directory (`[".gitignore"]` by default), declares `hashVersion: 1`, and names a
package-level global file (`global.ignore` by default). Global rules have lowest priority. Rules from multiple files in
the same directory apply in option order; deeper directory files have higher priority. An ignore file inside an excluded
ancestor cannot rescue that ancestor.

Every selected ignore file uses the `ignore` library's Git-style rules, including a file named `.dockerignore`. For example, pathsift will apply a nested
`.dockerignore` when that filename is selected, whereas Docker's build-context rules are defined separately. Pathsift's
selected files can therefore produce a different set of paths from Docker's build context; review exclusions before
copying or archiving. Docker documents its own matching rules in
the [Docker build-context guide](https://docs.docker.com/build/concepts/context/).

Matching uses the `ignore` library and the selected filenames. Git repository settings such as `.git/info/exclude`,
`core.excludesFile`, ignore-case configuration, and submodules are outside this rule set. Symlinked directories are reported but never traversed.

## Hash format version in the package config

The checked-in `pathsift.config.json` declares the current hash format explicitly:

```json
{
  "ignoreFiles": [".gitignore"],
  "globalIgnore": "global.ignore",
  "hashVersion": 1,
  "bufferLimitBytes": 1073741824
}
```

The hash format starts at version **1**, independently of the npm package version. `hashVersion` selects the domain tags used by the two-level digest; the CLI supports only version 1 and rejects a missing or unsupported version rather than silently changing fingerprints. The ignore-file settings select which files enter the hash. `bufferLimitBytes` is a separate export setting: the default 1 GiB threshold is measured from visible regular-file bytes after ignore filtering.

## Names shared with Unix commands

`count`, `du`, and `hash` are pathsift commands with the exact behavior shown above. They are **not drop-in Unix
utilities**.

### `count`

`count` is pathsift's own visible-entry summary; symlinks are excluded from its file count and byte total.

### `du`

`du` adds `stat` sizes of visible regular files only. It excludes directory and symlink sizes, does not use allocated
blocks, and counts each visible file path. GNU `du` normally estimates allocated filesystem usage and includes
directory entries; its apparent-size mode is a separate option. See the [GNU
`du` manual](https://www.gnu.org/s/coreutils/manual/html_node/du-invocation.html).

### `hash`

`hash` combines each visible regular file's relative name and content digest, then combines file hashes in stable name order. Its output has `file-sha256  digest  relative/path` lines followed by `tree-sha256  digest  absolute/root`. A rename or moving bytes across files changes the digest, subject to SHA-256 collision resistance. The selected scan directory defines relative names; moving an unchanged tree under a different parent preserves its digest. `--parent` changes visibility while keeping that base.

[The hash contract](docs/hash.md) owns the exact encoding, structural examples, and limitations. Bash's `hash` builtin instead manages the shell's command lookup cache. See
the [Bash builtin manual](https://www.gnu.org/software/bash/manual/html_node/Bourne-Shell-Builtins.html).

## Output, export, and editor behavior

`manifest` writes only JSON on stdout; errors use stderr and a nonzero exit status. Other commands write text. An
interactive TTY uses Ink/React for text and help; redirected output remains plain, and JSON is never styled.

`cp` accepts a destination directory that is absent or empty. `archive` accepts a destination file that is absent or empty. A nonempty destination fails before the source walk. A destination inside the source is permitted: the verified empty target itself is skipped during the one ignore-aware traversal, so `cp c/ c/a/` and `archive c/ c/a.tar` cannot include their own output. Symlinks are copied or archived as links.

At or below `bufferLimitBytes` (1 GiB by default) of visible regular-file bytes, `cp` holds file content in memory and `archive` holds output chunks in an in-memory writable. Above that threshold, they write directly to the destination. If actual buffered data exceeds the cap, they switch to direct writing using the entries already selected by the single ignore-aware walk.

On handled write failures, pathsift rolls back: an absent destination is removed, an existing empty directory remains empty, and an existing empty archive file returns to zero bytes. Newly created empty parent directories are removed when possible. Abrupt process termination or OS cleanup failure cannot be rolled back reliably.

The source is read-only. During export, pathsift holds an open handle to the scanned root, and during `cp` also to the destination directory. These handles do not impose a mandatory lock on other processes and cannot prevent them from deleting or changing source files.

`nano` uses Node built-ins for key input and file writes. It requires a real TTY and supports arrows, Home/End,
PageUp/PageDown, insertion, Backspace/Delete, Enter, Ctrl+O/Ctrl+S to save, and Ctrl+X/Ctrl+C to quit. Unsaved changes
require a second quit key to discard. Double-width Unicode cursor positioning is not yet complete.

## Architecture and verification

This is one TypeScript CLI package with a pure core, an application use case, Node adapters, and a boot composition
root. See [Architecture](docs/architecture.md). Repository contributors should read `AGENTS.md`, `CONTRIBUTING.md`,
`docs/development.md`, `docs/build.md`, and `docs/release.md` in the source checkout.

```sh
npm run check:static
npm test                 # TDD, source launcher BDD, compiled BDD
npm run test:package     # real package install and the same BDD
npm run stage:release   # writes release-preview/ from a real npm tarball
npm run verify:release   # all checks, dependency audits, package contents
```

The generated, Git-ignored `release-preview/` contains `pathsift-<version>.tgz`, an extracted `package/` tree, and `pack-metadata.json`. `dist/` contains only compiled JavaScript; inspect `release-preview/package/` to see the actual files that npm would publish, including the short README from `docs/npm-readme.md`. The repository root is private, so publish the reviewed tarball rather than packing the root. Runtime dependencies are installed separately by npm and are not bundled in this tarball.

Formal releases use an existing `vX.Y.Z` tag. The [release workflow](.github/workflows/release.yaml) validates the tag and package, runs the full CI matrix, and publishes the staged tarball to npm `latest` through trusted publishing. See [release readiness](docs/release.md) for the tag and artifact contract.

Every path-processing command has its own BDD file covering the five ignore cases crossed with all three parent modes. CI runs the release gate on Node 22.12, 23, 24, and 26. Dependency audits and the package
installation check need npm registry access.
