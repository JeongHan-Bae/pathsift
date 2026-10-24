# Directory hash contract

`pathsift hash` creates a two-level SHA-256 fingerprint of **visible regular files**. The format is `hashVersion: 1` in the package's `pathsift.config.json`; the CLI rejects any other value. This is the first format of the development-stage CLI. It creates a path-sensitive snapshot using pathsift's own encoding.

For each file, let `p` be its UTF-8 relative path from the directory supplied to `pathsift hash [directory]` (or the current working directory when omitted) and `bytes` be its raw contents:

```text
name_hash    = SHA-256(UTF-8(p))
content_hash = SHA-256(bytes)
file_hash    = SHA-256(UTF-8("pathsift-file-v1:") || hex(name_hash) || hex(content_hash))
```

Each hex digest is exactly 64 lowercase ASCII characters, so the pair of inputs to `file_hash` has an unambiguous boundary. The `v1` domain tag comes from that configured format version and distinguishes this level from the tree level.

Sort visible files by the UTF-8 bytes of `p`. Let their file hashes in that order be `F1` through `Fn`:

```text
tree_hash = SHA-256(UTF-8("pathsift-tree-v1:" || n || ":") || hex(F1) || ... || hex(Fn))
```

The file count and fixed-length hashes make this sequence encoding unambiguous. Sorting makes the result independent of filesystem enumeration order. The selected scan root defines the relative-path base. The absolute scanned root path is printed for context but is not hashed, so copying an unchanged visible tree to another location preserves its digest.

## Why structural edits change the input

- Renaming `p` changes `name_hash` and therefore `file_hash`; the tree sequence contains the new file hash even if that file keeps the same sorted position.
- Moving a file from `dir_1/b` to `b` changes `p`. Thus `a, dir_1(b,c,d)` and `a, b, dir_1(c,d)` have different file hashes for `b` and different tree inputs, while the bytes of `b` stay the same.
- Moving bytes from the end of file `a` to the start of file `b` changes at least one content digest. This remains true when the concatenation of both files' bytes and their combined byte count stay unchanged.
- Adding or removing a visible file changes the file count and the sequence of file hashes. Equal bytes under different filenames produce different name hashes.

These are distinct SHA-256 **inputs**. Their outputs are expected to differ under SHA-256's collision resistance; no fixed-length hash can provide a mathematical guarantee that every distinct input has a distinct digest. The BDD suite checks these representative transformations, including the `dir_1/b → b` case.

Only entries selected by the active ignore rules participate. Changing an ignored file does not change the digest. Empty directories and symlinks are outside this file-only contract; a directory rename affects the digest when it changes a visible file's relative path. The snapshot is not atomic if files change during the scan. Selecting a different scan root changes the relative names, even when the CLI executable is the same. Conversely, `hash a/` while in `x/` and `hash ./` while in `x/a/` select the same root and produce the same hash.
