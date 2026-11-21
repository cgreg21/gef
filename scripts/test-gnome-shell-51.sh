#!/usr/bin/env bash
set -euo pipefail

for command in gnome-shell gjs dbus-run-session xvfb-run; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 2
  fi
done

version="$(gnome-shell --version)"
if [[ ! "$version" =~ GNOME\ Shell\ 51\. ]]; then
  echo "Expected GNOME Shell 51, found: $version" >&2
  exit 2
fi

dbus-run-session -- xvfb-run -a gjs -m tests/gnome-shell-51/smoke.js
