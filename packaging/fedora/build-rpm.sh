#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"
topdir="${RPM_TOPDIR:-${repo_root}/packaging/fedora/rpmbuild}"
tmppath="${RPM_TMPPATH:-/tmp}"
specdir="${repo_root}/packaging/fedora/SPECS"
sourcedir="${topdir}/SOURCES"
spec_target_dir="${topdir}/SPECS"
archive_version="$(node -p "require('${repo_root}/package.json').version")"
archive_name="multi-cli-studio-${archive_version}"
archive_path="${sourcedir}/${archive_name}.tar.gz"

mkdir -p \
  "${topdir}/BUILD" \
  "${topdir}/BUILDROOT" \
  "${topdir}/RPMS" \
  "${topdir}/SOURCES" \
  "${topdir}/SPECS" \
  "${topdir}/SRPMS"

cp "${specdir}/multi-cli-studio.spec" "${spec_target_dir}/"
cp "${repo_root}/packaging/fedora/SOURCES/multi-cli-studio.desktop" "${sourcedir}/"

tar \
  --exclude-vcs \
  --exclude='./node_modules' \
  --exclude='./dist' \
  --exclude='./src-tauri/target' \
  --exclude='./packaging/fedora/rpmbuild' \
  --exclude='./.codex' \
  --transform "s,^\.,${archive_name}," \
  -czf "${archive_path}" \
  -C "${repo_root}" .

TMPDIR="${tmppath}" rpmbuild -ba "${spec_target_dir}/multi-cli-studio.spec" \
  --define "_topdir ${topdir}" \
  --define "_tmppath ${tmppath}" \
  --define "_sourcedir ${sourcedir}" \
  --define "_specdir ${spec_target_dir}"

echo
echo "Built RPM artifacts under:"
echo "  ${topdir}/RPMS"
echo "  ${topdir}/SRPMS"
