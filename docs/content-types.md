# Text and binary rules

`--type file` selects regular files from filesystem metadata. `pathsift find --type text|binary` first requires a visible regular file, then uses the replaceable `classifyFile` port for fast, best-effort content classification. A directory or symlink is neither text nor binary because it is not a regular file.

The current Node adapter implements that port with local `wasmagic`; another detector can replace it without changing the core discovery rules. Detection uses file content, not filenames or extensions. The adapter lowercases the detected MIME and charset, then applies these rules in order:

1. A MIME matching the **binary list** is binary, regardless of charset.
2. A MIME matching the **text list** is text, regardless of charset.
3. Otherwise, a charset in the **text encoding list** is text.
4. Everything else is binary, including unknown results.

The binary MIME list is:

- JSONB: `application/jsonb`, `application/x-jsonb`, `*+jsonb`.
- Archives: `application/zip`, `application/x-zip`, `application/x-zip-compressed`, `*+zip`, `application/gzip`, `application/x-gzip`, `application/x-bzip2`, `application/x-xz`, `application/zstd`, `application/x-zstd`, `application/x-7z-compressed`, `application/vnd.rar`, `application/x-rar-compressed`, `application/x-tar`, `application/java-archive`.
- Office and OpenDocument: `application/msword`, `application/vnd.ms-excel`, `application/vnd.ms-powerpoint`, `application/vnd.ms-office`, `application/vnd.openxmlformats-officedocument.*`, `application/vnd.ms-word.*`, `application/vnd.ms-excel.*`, `application/vnd.ms-powerpoint.*`, `application/vnd.oasis.opendocument.*`.

The text MIME list is:

- `text/*`, `application/x-empty`.
- JSON: `application/json`, `application/jsonl`, `application/jsonlines`, `application/x-jsonlines`, `application/x-ndjson`, `application/json-seq`, `*+json`, `*+json-seq`.
- Other text formats: `application/yaml`, `application/x-yaml`, `*+yaml`, `application/xml`, `*+xml`, `application/javascript`, `application/toml`, `application/sql`, `image/svg+xml`.

The text encoding list is `us-ascii`, `utf-8`, `utf-16`, `utf-16le`, `utf-16be`, `utf-32`, `utf-32le`, `utf-32be`. In a MIME pattern, `*+name` matches a suffix and a trailing `*` matches the rest of a prefix.

PDF is on neither MIME list. For example, `application/pdf; charset=us-ascii` is text, while `application/pdf; charset=binary` is binary. A `text/*` result with `charset=unknown-8bit` remains text; this can occur when a large UTF-8 file is sampled between multibyte characters.

For a stable file, walker-reported sizes up to 128 KiB cause a full read. Larger sizes use the first and last 64 KiB; if either sample is binary, the file is binary. Bounded reads keep per-file detection costs predictable, but a binary region only in the unsampled middle may be missed. Files can change during a scan, and MIME detection can misidentify content. These are pathsift's current classification rules, not a guarantee about every file.
