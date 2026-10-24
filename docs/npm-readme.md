# pathsift

Inspect, copy, and archive directory trees locally with Git-style ignore rules.

## Install

Use Node.js 22.12 or later. Install the published alpha channel globally:

```sh
npm install --global pathsift@alpha
pathsift --help
```

For a project-local installation, run `npm install pathsift@alpha` and invoke `npx pathsift` from that project. npm's `alpha` is a dist-tag; it is separate from the package version number.

## Commands

For `[directory]`, the default is the current directory. Paths passed to commands must be absolute or stay within the current directory unless `--force` is given.

| Command | Arguments | Result |
| --- | --- | --- |
| `tree` | `[directory]` | Draw the visible tree; directories appear before files at each level. |
| `ls` | `[directory]` | List visible entries directly under the root. |
| `find` | `[directory]` | List every visible relative path recursively. |
| `count` | `[directory]` | Count visible directories and regular files and sum file bytes. |
| `du` | `[directory]` | Sum logical bytes of visible regular files. |
| `hash` | `[directory]` | Hash visible file names and contents, then combine file hashes into a tree hash. |
| `manifest` | `[directory]` | Write a JSON manifest to stdout. |
| `cp` | `<source-directory> <destination-directory>` | Copy visible entries to a missing or empty directory. |
| `archive` | `<source-directory> <output.zip\|.tar\|.tar.gz\|.tgz>` | Archive visible entries to a missing or empty file. |
| `nano` | None | Edit the installed package's `global.ignore` in a TTY. |
| `config` | None | Show the installed package's config and global ignore paths. |
| `help` | None | Show command and option help. |

The scan commands (`tree`, `ls`, `find`, `count`, `du`, `hash`, `manifest`, `cp`, `archive`) accept these options:

| Option | Meaning |
| --- | --- |
| `--ignore-file <filename>` | Use this ignore filename; repeat to select multiple files. |
| `--parent [directory]` | Read selected ignore files from this ancestor through the target. A bare option or empty value uses the current directory. |
| `--no-global-ignore` | Skip the package's global ignore rules. |
| `--no-ignore` | Disable all ignore filtering. |
| `--force` | Permit a relative path containing `..`; destination safety checks still apply. |

`--help` and `-h` print help. `nano`, `config`, and `help` do not accept scan options or positional arguments.

Without `--parent`, ignore collection starts at the selected directory. A supplied parent must contain the selected directory; paths in command output and file hashes stay relative to that selected directory. Only ignore files along the parent-to-target path are read. Relative parent paths containing `..` require `--force`.

Bare `--parent` works at the end of a command, before `--`, and before another option. For a directory name starting with `-`, use `--parent=<directory>`.

The omitted, empty, and explicit parent modes work whether the scan finds zero, one, or multiple ignore files. `--no-ignore` bypasses ancestor rules; `--no-global-ignore` keeps them.

```sh
pathsift tree ./project
pathsift find ./project --ignore-file .gitignore --ignore-file .deployignore
pathsift find ./project/sub --parent ./project
pathsift manifest ./project > manifest.json
pathsift cp ./project ./backup
pathsift archive ./project ./project.tar.gz
pathsift tree ../another-project --force
pathsift config
```

## Ignore and output behavior

Ignore files use Git-style matching regardless of their filename. A selected `.dockerignore` is therefore parsed with Git-style rules, which can differ from Docker's build-context rules. The package's `global.ignore` has the lowest priority; nested selected files can override it. Symlinked directories are listed but never traversed, and copy/archive preserve links.

`manifest` writes JSON to stdout and errors to stderr. Other read commands write terminal text; TTY styling is omitted when output is redirected. `hash` uses file paths relative to the directory you selected, so moving an unchanged tree under a different parent preserves its tree digest. See the [hash format](https://github.com/JeongHan-Bae/pathsift/blob/main/docs/hash.md) for the exact calculation.

`cp` and `archive` refuse nonempty destinations. They accept missing or existing empty outputs, including an empty output within the scanned source, and roll back handled write failures. `nano` edits the installed package's `global.ignore`, so that installation directory must be writable. A global reinstall may replace local edits to that file.

For project design, development, and release checks, see the [source README](https://github.com/JeongHan-Bae/pathsift#readme).
