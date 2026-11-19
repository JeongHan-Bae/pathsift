<h1 align="center">
  <span><img src="https://skillicons.dev/icons?i=ts" alt="TypeScript" width="72" valign="middle"></span>
  <span style="font-size: x-large;">&nbsp;pathsift</span>
</h1>

Inspect, filter, copy, and archive project directory trees using Git-style ignore rules. pathsift reports visible entries without following symlinked directories.

Requires Node.js 22.12 or later.

```sh
npm install --global pathsift
pathsift --help
```

For a project-local install, use `npm install pathsift` and run `npx pathsift`.

## Commands

Omitted `[directory]` means the current directory. Results use paths relative to the selected directory unless the command displays its absolute root.

| Command | Arguments | Purpose |
| --- | --- | --- |
| `tree` | `[directory]` | Draw directories first at each level, then files and counts. |
| `ls` | `[directory]` | List visible entries at the root. |
| `find` | `[directory]` | Filter visible entries by type, name, depth, size, and modification time. |
| `where` | `[directory] <query>` | Find visible regular files by case-sensitive basename. |
| `count` | `[directory]` | Count visible directories, files, and file bytes. |
| `du` | `[directory]` | Sum visible regular-file bytes. |
| `hash` | `[directory]` | Hash relative file names and contents, then combine the file hashes. |
| `manifest` | `[directory]` | Write visible entries as JSON. |
| `cp` | `<source-directory> <destination-directory>` | Copy visible entries to a missing or empty directory. |
| `archive` | `<source-directory> <output.zip\|.tar\|.tar.gz\|.tgz>` | Archive visible entries to a missing or empty file. |
| `nano` | None | Edit the installed package's `global.ignore` in a TTY. |
| `config` | None | Show package configuration and paths. |
| `help` | None | Show command help. |

`find` combines its filters with AND and follows pathsift's own CLI rules, not POSIX `find` semantics. `where` offers exact, substring, and glob filename matching. `find --type file` checks filesystem metadata; `--type text|binary` classifies regular-file content using the [documented MIME and charset rules](docs/content-types.md). The [usage guide](docs/npm-readme.md) lists every option and query rule; `pathsift <command> --help` shows command-specific help.

```sh
pathsift tree ./project
pathsift find ./project --type file --name '*.ts' --max-depth 3
pathsift find ./project --type text --modified-within 7d
pathsift where ./project 'README.*' --glob
pathsift manifest ./project > manifest.json
pathsift cp ./project ./backup
pathsift archive ./project ./project.tar.gz
```

## Ignore rules and paths

By default, pathsift reads `.gitignore` files within the selected tree and the package's `global.ignore`, which has the lowest priority. `--ignore-file` selects other Git-style ignore filenames; `--parent` includes ignore files from an ancestor through the selected directory. `--no-global-ignore` skips global rules, while `--no-ignore` disables filtering. A file named `.dockerignore` still uses pathsift's Git-style rules, which may differ from Docker's build-context rules.

Relative source or destination paths containing `..` require `--force`; absolute paths do not. `--force` does not bypass destination safety checks. The [usage guide](docs/npm-readme.md) covers option syntax and parent paths.

## Output and exports

`tree`, `ls`, `find`, `where`, `hash`, and `manifest` stream results while scanning; `count` and `du` print totals afterward. Successful `manifest` output is valid JSON. A later scan error can leave an incomplete JSON prefix on stdout and reports the error on stderr. Redirected output and JSON have no TTY styling. See [architecture](docs/architecture.md) for output buffering and tree rendering.

`cp` and `archive` accept missing or existing empty destinations, preserve symlinks, and roll back handled write failures. They skip their own verified empty output when it lies inside the source. See [architecture](docs/architecture.md) for the export boundary and [hash format](docs/hash.md) for the two-level digest contract.

`nano` requires an interactive terminal and writes only the installed package's `global.ignore`. The installation directory must be writable to edit that file; reinstalling the package can replace local edits.

## Source and development

This repository contains the TypeScript source; the npm package contains compiled JavaScript. See [architecture](docs/architecture.md) for the layers, [development](docs/development.md) for local checks, [build](docs/build.md) for package contents, [release](docs/release.md) for publication, and [contributing](CONTRIBUTING.md) for the contribution contract.
