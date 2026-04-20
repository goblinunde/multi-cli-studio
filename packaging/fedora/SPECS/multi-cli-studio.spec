Name:           multi-cli-studio
Version:        0.1.0
Release:        2%{?dist}
Summary:        Desktop orchestration shell for multiple AI coding CLIs

License:        MIT
URL:            https://github.com/Austin-Patrician/multi-cli-studio
Source0:        %{name}-%{version}.tar.gz
Source1:        %{name}.desktop

BuildRequires:  cargo
BuildRequires:  rust
BuildRequires:  gcc-c++
BuildRequires:  make
BuildRequires:  nodejs >= 20
BuildRequires:  webkit2gtk4.1-devel
BuildRequires:  openssl-devel
BuildRequires:  libappindicator-gtk3-devel
BuildRequires:  librsvg2-devel
BuildRequires:  libxdo-devel
BuildRequires:  desktop-file-utils

%global tauri_features custom-protocol
%global cargo_target_dir %{_builddir}/cargo-target
%global cargo_home %{_builddir}/cargo-home
%global npm_cache %{_builddir}/npm-cache
%global build_home %{_builddir}/home

%description
Multi CLI Studio is a Tauri desktop workspace for orchestrating Codex, Claude,
Gemini, and provider-backed model workflows from one local desktop shell.

This RPM builds the Linux desktop binary from source and installs the launcher,
desktop entry, and application icon using Fedora filesystem locations.

%prep
%autosetup -n %{name}-%{version}

%build
export HOME="%{build_home}"
export CARGO_HOME="%{cargo_home}"
export CARGO_TARGET_DIR="%{cargo_target_dir}"
export npm_config_cache="%{npm_cache}"
export CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-1}"
export CARGO_PROFILE_RELEASE_DEBUG="${CARGO_PROFILE_RELEASE_DEBUG:-0}"
export CARGO_PROFILE_RELEASE_CODEGEN_UNITS="${CARGO_PROFILE_RELEASE_CODEGEN_UNITS:-16}"
export CARGO_PROFILE_RELEASE_LTO="${CARGO_PROFILE_RELEASE_LTO:-false}"
export RUSTFLAGS="${RUSTFLAGS:-} -Cdebuginfo=0 -Ccodegen-units=${CARGO_PROFILE_RELEASE_CODEGEN_UNITS}"

mkdir -p "$HOME" "$CARGO_HOME" "$CARGO_TARGET_DIR" "$npm_config_cache"

npm ci --no-audit --no-fund --prefer-offline
npm run build
cargo build --release --manifest-path src-tauri/Cargo.toml --locked \
  --features "%{tauri_features}" \
  -j "${CARGO_BUILD_JOBS}"

%install
install -Dpm0755 \
  "%{cargo_target_dir}/release/%{name}" \
  "%{buildroot}%{_bindir}/%{name}"

install -Dpm0644 \
  "%{_sourcedir}/%{name}.desktop" \
  "%{buildroot}%{_datadir}/applications/%{name}.desktop"

install -Dpm0644 \
  "src-tauri/icons/icon.png" \
  "%{buildroot}%{_datadir}/icons/hicolor/512x512/apps/%{name}.png"

desktop-file-validate "%{buildroot}%{_datadir}/applications/%{name}.desktop"

%files
%license LICENSE
%doc README.md README.zh-CN.md
%{_bindir}/%{name}
%{_datadir}/applications/%{name}.desktop
%{_datadir}/icons/hicolor/512x512/apps/%{name}.png

%changelog
* Sun Apr 19 2026 Codex <codex@example.com> - 0.1.0-2
- Build the Linux binary with Tauri custom-protocol enabled for packaged runtime assets

* Sun Apr 19 2026 Codex <codex@example.com> - 0.1.0-1
- Initial Fedora RPM recipe for local source builds
