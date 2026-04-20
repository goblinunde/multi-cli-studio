# Fedora RPM build

This directory contains a native Fedora RPM recipe for building `multi-cli-studio`
from the current source tree.

## Host requirements

Install the Fedora build dependencies first:

```bash
sudo dnf install \
  cargo \
  rust \
  gcc-c++ \
  make \
  nodejs \
  webkit2gtk4.1-devel \
  openssl-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel \
  libxdo-devel \
  desktop-file-utils
```

The build also needs access to npm and Cargo dependencies. If the host is not
already warm-cached, keep internet access enabled for the first build.

This project can use a lot of memory during the Rust release build. On a 16 GB
machine, start with a single Cargo job and lighter release codegen settings:

```bash
CARGO_BUILD_JOBS=1
CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16
CARGO_PROFILE_RELEASE_DEBUG=0
```

## Build

From the repository root:

```bash
RPM_TOPDIR=/tmp/multi-cli-studio-rpmbuild \
RPM_TMPPATH=/tmp \
CARGO_BUILD_JOBS=1 \
CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16 \
CARGO_PROFILE_RELEASE_DEBUG=0 \
sh packaging/fedora/build-rpm.sh
```

Artifacts land under:

```text
/tmp/multi-cli-studio-rpmbuild/RPMS
/tmp/multi-cli-studio-rpmbuild/SRPMS
```
