# Release readiness and publication

## Current state

`pathsift@0.0.1` was published on npm with the `alpha` dist-tag. The repository is at `0.1.0`, pending its first tag-driven formal release to `latest`. This is one CLI package: there is no separate Core or CLI publication. The source root is private; the generated tarball under `release-preview/` is the publishable package.

The installed config and global ignore file are package-local; [build.md](build.md) owns their installation and write-access behavior.

## Release tag and npm trust

`.github/workflows/release.yml` runs on a pushed `vX.Y.Z` tag. Its manual `workflow_dispatch` input also requires an existing tag. Validation confirms that the tag points to the checked-out commit, matches `package.json` and the root `package-lock.json` entry, targets this GitHub repository and the public npm registry, and names a version that has not already been published. Branch names, prerelease suffixes, and Core/CLI suffixes fail validation.

The npm trusted publisher must name GitHub owner `JeongHan-Bae`, repository `pathsift`, and workflow filename `release.yml` exactly, with direct `npm publish` allowed. The publish job receives `id-token: write`, uses a GitHub-hosted Ubuntu runner with Node 26 and a compatible npm CLI, and publishes through OIDC without a stored npm write token. npm automatically creates provenance when the repository and package are public. The first publish failed because the workflow was named `release.yaml` while npm trusted `release.yml`; the filename now matches. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for the current requirements.

## Pipeline

1. The validation job checks the tag, source manifest, lockfile, repository identity, npm runtime, and registry version availability.
2. The release job calls the full Ubuntu, macOS, and Windows CI matrix from the tagged commit. CI's normal push/pull-request path filters do not limit this explicit release call.
3. After CI succeeds, the publish job checks out the same tag, rechecks registry availability, runs `npm ci` and `npm run verify:release`, and validates the staged tarball's version, file inventory, production manifest, npm README, and SHA-512/SHA-1 digests.
4. The job publishes that exact `release-preview/pathsift-X.Y.Z.tgz` with the `latest` dist-tag and public access. GitHub Actions awaits `npm publish` with a ten-minute step timeout; the workflow does not poll npm for subsequent registry visibility.

The complete `verify:release` command and CI matrix are documented in [development.md](development.md). [build.md](build.md) owns the package inventory and staging layout. Review `release-preview/package/` and `release-preview/pack-metadata.json` before tagging; an unavailable audit remains unverified.

## Preparing a release

Update the one package version and lockfile through npm, keep the owning documents current, and run `npm run verify:precommit` after the final change. Review the generated tarball before tagging. Commit the release candidate, create an existing `vX.Y.Z` tag at that commit, and push the tag to run the workflow. Manual dispatch can rerun the workflow for that same existing tag; it cannot publish an untagged branch. The workflow checks npm version uniqueness, so retrying after a successful publish fails safely.

Direct `npm pack` or `npm publish` from the repository root is refused by its `prepack` and `prepublishOnly` hooks. The release workflow publishes the reviewed generated tarball.
