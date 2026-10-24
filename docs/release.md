# Release readiness and publication

## Current state

The unscoped public package `pathsift@0.0.1` has already been published with the npm `alpha` dist-tag. The repository's current version is `0.1.0`, pending publication. `alpha` is a registry dist-tag, separate from the version number. The source manifest's `publishConfig` fixes the registry to `https://registry.npmjs.org/` and selects `alpha`; the generated production manifest retains those settings. CI verifies the package, while publication is a manual step.

`pathsift.config.json` and `global.ignore` are package-local. `nano` requires a user-writable installation directory; users installing under a system-owned prefix can use the read commands but may be unable to edit the global ignore file. A reinstall may replace edits to the installed `global.ignore`. The source template keeps `.git/` commented out, even if a local installation enables it.

## Manual release procedure

1. Set `VERSION` to the intended unique release version. Confirm the license in `package.json` and the package's `LICENSE` file, and confirm the npm account can publish the unscoped `pathsift` package. Check `npm whoami` and `npm view "pathsift@${VERSION}" version --registry=https://registry.npmjs.org/`; a 404 is consistent with an unused version, but only the registry's publish response establishes availability.
2. Run `npm ci` from the lockfile and `npm run verify:release` with registry access. This runs static checks, TDD, source/compiled/installed-package BDD, separate runtime/full dependency audits at moderate severity, exact package-content validation, and staging. An unavailable audit is unverified.
3. Review `release-preview/package/`, `release-preview/pack-metadata.json`, and the `release-preview/pathsift-${VERSION}.tgz` tarball. Confirm compiled `dist/boot/cli-main.js`, its imported modules, package data, the short npm usage `README.md`, architecture and hash documents, and license are present, with no GitHub project README, TypeScript source, tests, CI, or local files. `npm run check:package` validates the generated package's exact file list and README source.
4. Review CI on Node 22.12, 23, 24, and 26. Automatic CI runs only for changes under `bin/`, `scripts/`, `src/`, `test/`, or the CI workflow itself; use `workflow_dispatch` for a release containing only documentation or manifest changes. The checkout launcher uses compiled JavaScript on Node 22–23 and native TypeScript on Node 24+; the npm package always uses compiled JavaScript.
5. When publication is intended, publish the reviewed artifact with `npm publish "./release-preview/pathsift-${VERSION}.tgz" --tag alpha --access public --registry=https://registry.npmjs.org/`. Complete any npm authentication or two-factor prompt on the host. The leading `./` is required so npm treats this as a local tarball rather than a Git shorthand. Do not publish from a different path after review: the staging tarball is the artifact checked in step 3.
6. Verify `npm view "pathsift@${VERSION}" version dist-tags --json --registry=https://registry.npmjs.org/` and `npm dist-tag ls pathsift`. `alpha` must point to the published version. A successful upload without that verification is not a completed alpha release.

The source root is private, and its `prepack` and `prepublishOnly` hooks reject direct packaging or publication. Publishing the reviewed `.tgz` uses the release gate completed in step 2 and the exact tarball it produced. Keep the `publishConfig` tag and explicit command tag aligned.

## Dependency separation

`ignore`, `archiver`, `ink`, and `react` are runtime dependencies of the compiled CLI. `typescript`, Node/React type definitions, and `node-pty` are development dependencies. `npm audit --omit=dev --audit-level=moderate` checks the installed runtime graph; full `npm audit --audit-level=moderate` checks development tools as well. Both must pass before release.
