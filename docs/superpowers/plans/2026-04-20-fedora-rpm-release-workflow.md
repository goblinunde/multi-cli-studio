# Fedora RPM Release Workflow Plan

## File Responsibilities

- `.github/workflows/release-desktop.yml`: add a Fedora RPM build job, upload the RPM artifacts, include them in the release job, and publish the RPM to the GitHub Release.
- `scripts/sync-version.mjs`: keep `packaging/fedora/SPECS/multi-cli-studio.spec` aligned with the requested release version so the RPM source tarball name and `.spec` metadata stay consistent.

## Implementation Steps

- [ ] Verify the current workflow shape and confirm the Fedora RPM path is `packaging/fedora/build-rpm.sh`.
- [ ] Add a failing consistency check by extending `scripts/sync-version.mjs --check` expectations to include `packaging/fedora/SPECS/multi-cli-studio.spec`.
- [ ] Verify the check fails when the Fedora `.spec` version does not match the requested release version.
- [ ] Implement minimal version sync support for `packaging/fedora/SPECS/multi-cli-studio.spec`.
- [ ] Verify the sync script updates `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, and `packaging/fedora/SPECS/multi-cli-studio.spec` to the same version.
- [ ] Add a Fedora job to `.github/workflows/release-desktop.yml` that installs Fedora build dependencies, runs `node ./scripts/sync-version.mjs ${{ inputs.version }}`, builds the RPM with `sh packaging/fedora/build-rpm.sh`, and uploads both `RPMS` and `SRPMS` artifacts.
- [ ] Verify the release job downloads the Fedora artifacts and uploads the generated `.rpm` and `.src.rpm` files to the GitHub Release without changing `latest.json`.
- [ ] Run targeted verification commands for the modified files and inspect the resulting diffs.
- [ ] Prepare a scoped commit and push command for only the intended files.
