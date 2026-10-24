# Architecture

pathsift is one CLI package with TypeScript source and a hexagonal dependency direction. It does not publish a separate core package.

```text
bin/pathsift.cjs (checkout launcher)
  ├─ Node 24+: src/boot/cli-main.ts
  └─ Node 22–23: dist/boot/cli-main.js

src/boot/cli-main.ts (composition root)
  ├─ src/application/run.ts ── src/core/{ports,output,tree,path-policy,tree-digest}.ts
  └─ src/adapters/
       ├─ node-filesystem.ts ── ignore-walker.ts
       ├─ config.ts and nano.ts
       └─ output/{cli-help,terminal-output}.ts
```

The application receives a `CommandPorts` object with path resolution, path checks, `walk`, destination prechecks, hashing, copy, and archive operations. It returns a `CommandOutput` value (`text` lines or a JSON value) rather than printing. The boot layer parses CLI arguments, constructs the Node adapter, and hands the result to the output adapter. Help uses a separate structured `HelpDocument`; its serializer and TTY renderer are CLI adapter responsibilities.

The output adapter checks stdout itself. A non-TTY receives plain text; `manifest` always receives plain JSON so pipelines can parse it. An interactive terminal with adequate width uses Ink/React for text and help. Errors go to stderr outside the JSON document. The `nano` adapter manages its own TTY and raw input separately.

The `hash` use case streams content SHA-256 through the Node port, hashes each relative filename separately, combines its digest with the content digest, then absorbs path-ordered file hashes into a tree digest. Only visible regular files participate. The exact encoding and the structural-change argument are in [the hash contract](hash.md).

The pure tree renderer groups children at each level into directories followed by files and symlinks, sorting names within each group. The walker keeps each directory's ignore scopes local. When a later rule rescues a directory ignored by an earlier scope, it creates a matcher for that subtree instead of changing a matcher shared with siblings. Symlinked directories are reported but not traversed. `src/core/path-policy.ts` flags parent-relative paths for explicit `--force` opt-in; the Node adapter checks that export targets are absent or empty before the walk. The walker skips an empty output path inside the source, avoiding self-inclusion. The adapter buffers exports in memory up to the configured visible-file byte threshold and otherwise writes directly; either path rolls back handled failures to the target's previous absent or empty state. Abrupt termination is outside that guarantee. Open directory handles do not create mandatory locks against unrelated processes.

Build emits only JavaScript under `dist/`, rewrites `.ts` imports to `.js`, and marks the compiled CLI entry executable. The package `bin` points directly at compiled JavaScript. The build and three-stage test contract is documented in the source checkout under `docs/build.md` and `docs/development.md`.
