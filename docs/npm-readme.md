<h1 align="center">
  <span><img src="https://skillicons.dev/icons?i=ts" alt="TypeScript" width="72" valign="middle"></span>
  <span style="font-size: x-large;">&nbsp;pathsift</span>
</h1>

<div align="center">
  Inspect, filter, copy, and archive project trees with Git-style ignore rules.
</div>

<p align="center">
  <a href="https://github.com/JeongHan-Bae/pathsift/actions/workflows/ci.yml"><img src="https://github.com/JeongHan-Bae/pathsift/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/JeongHan-Bae/pathsift/blob/main/LICENSE"><img src="https://img.shields.io/github/license/JeongHan-Bae/pathsift" alt="License"></a>
</p>

<div align="center">
  <h2>Install pathsift</h2>
  <pre style="font-size: 1.35em;"><code>npm install --global pathsift</code></pre>
</div>

Requires Node.js 22.12 or later. Run `pathsift --help` after installation.

For a project-local installation, run `npm install pathsift` and invoke `npx pathsift` from that project.

## Commands

For `[directory]`, the default is the current directory. Paths passed to commands must be absolute or stay within the current directory unless `--force` is given.

| Command | Arguments | Result |
| --- | --- | --- |
| `tree` | `[directory]` | Draw the visible tree; directories appear before files at each level. |
| `ls` | `[directory]` | List visible entries directly under the root. |
| `find` | `[directory]` | List visible paths; optionally filter by type, name, depth, size, and time. |
| `where` | `[directory] <query>` | List visible regular files matching a case-sensitive filename query. |
| `count` | `[directory]` | Count visible directories and regular files and sum file bytes. |
| `du` | `[directory]` | Sum logical bytes of visible regular files. |
| `hash` | `[directory]` | Hash visible file names and contents, then combine file hashes into a tree hash. |
| `manifest` | `[directory]` | Write a JSON manifest to stdout. |
| `cp` | `<source-directory> <destination-directory>` | Copy visible entries to a missing or empty directory. |
| `archive` | `<source-directory> <output.zip\|.tar\|.tar.gz\|.tgz>` | Archive visible entries to a missing or empty file. |
| `nano` | None | Edit the installed package's `global.ignore` in a TTY. |
| `config` | None | Show the installed package's config and global ignore paths. |
| `help` | None | Show command and option help. |

The scan commands (`tree`, `ls`, `find`, `where`, `count`, `du`, `hash`, `manifest`, `cp`, `archive`) accept these options:

| Option | Meaning |
| --- | --- |
| `--ignore-file <filename>` | Use this ignore filename; repeat to select multiple files. |
| `--parent [directory]` | Read selected ignore files from this ancestor through the target. A bare option or empty value uses the current directory. |
| `--no-global-ignore` | Skip the package's global ignore rules. |
| `--no-ignore` | Disable all ignore filtering. |
| `--force` | Permit a relative path containing `..`; destination safety checks still apply. |

`pathsift --help` lists commands; `pathsift <command> --help` shows that command's options. `-h` is equivalent. After `--`, help-looking strings are literal arguments. `nano`, `config`, and `help` take no scan options or positional arguments.

Without `--parent`, ignore collection starts at the selected directory. A supplied parent must contain the selected directory; paths in command output and file hashes stay relative to that selected directory. Only ignore files along the parent-to-target path are read. Relative parent paths containing `..` require `--force`.

Bare `--parent` works at the end of a command, before `--`, and before another option. For a directory name starting with `-`, use `--parent=<directory>`.

`where [directory] <query>` uses the current directory when only the query is supplied. With two positionals, the directory comes first. It matches visible regular-file basenames, not full paths, and writes relative paths in `find` order. Exact matching (`--exact`, `-e`) is the default; `--contains`, `-c` matches a literal substring; `--glob`, `-g` supports whole-filename `*`, `?`, `[abc]`, and `[a-z]`. Modes are case-sensitive and mutually exclusive. Queries must be nonempty filenames without `/` or `\`; use `--` before a query beginning with `-`, and quote shell glob patterns. No match succeeds with empty output.

`find` is a Gitignore-aware filter for project trees, not a POSIX `find` replacement. It writes matching relative paths one per line and combines filters with AND. Its options are `--type file|dir|symlink|text|binary` (`f|d|l` aliases), `--name <glob>`, `--min-depth <n>`, `--max-depth <n>`, `--min-size <size>`, `--max-size <size>`, `--modified-within <duration>`, `--modified-older-than <duration>`, and `--modified-before <YYYY-MM-DD>`. Name matching is a case-sensitive basename glob. Depth 0 is the unreported root; maximum depth stops recursion. Size filters use inclusive regular-file byte thresholds and B, KiB, MiB, GiB, or TiB units. Time filters use entry mtime, `s/m/h/d/w` durations, and UTC midnight for dates. Single-value filters cannot be repeated.

`--type file` checks filesystem metadata. `--type text|binary` classifies regular-file content; directories and symlinks are neither. The [content-type rules](https://github.com/JeongHan-Bae/pathsift/blob/main/docs/content-types.md) describe the MIME, charset, and sampling policy and are included in the installed package.

`find` has no command execution, output actions such as `-print0`, permission or ownership predicates, full-path matching, or Boolean expressions. Ignore rules exclude subtrees; `--max-depth` limits recursion. Use `where` for quick filename lookup.

`tree`, `ls`, `find`, `where`, `hash`, and `manifest` write results while scanning; `count` and `du` print totals afterward. The [architecture document](https://github.com/JeongHan-Bae/pathsift/blob/main/docs/architecture.md) describes buffering and error behavior.

```sh
pathsift tree ./project
pathsift find ./project --ignore-file .gitignore --ignore-file .deployignore
pathsift find ./project --type file --name '*.ts' --max-depth 3
pathsift where ./project config.ts
pathsift where ./project config --contains
pathsift where ./project '*.ts' -g
pathsift find ./project/sub --parent ./project
pathsift manifest ./project > manifest.json
pathsift cp ./project ./backup
pathsift archive ./project ./project.tar.gz
pathsift tree ../another-project --force
pathsift config
```

## Ignore and output behavior

Ignore files use Git-style matching regardless of their filename. A selected `.dockerignore` is therefore parsed with Git-style rules, which can differ from Docker's build-context rules. The package's `global.ignore` has the lowest priority; nested selected files can override it. Symlinked directories are listed but never traversed, and copy/archive preserve links.

On success, `manifest` writes valid, unstyled JSON. A later scan error can leave an incomplete JSON prefix on stdout; the error goes to stderr. Other read commands write text without TTY styling when redirected. `hash` uses paths relative to the selected directory; the [hash format](https://github.com/JeongHan-Bae/pathsift/blob/main/docs/hash.md) owns the exact calculation.

`cp` and `archive` refuse nonempty destinations. They accept missing or existing empty outputs, including an empty output within the scanned source, and roll back handled write failures. `nano` edits the installed package's `global.ignore`, so that installation directory must be writable. A global reinstall may replace local edits to that file.

For project design, development, and release checks, see the [source README](https://github.com/JeongHan-Bae/pathsift#readme).
