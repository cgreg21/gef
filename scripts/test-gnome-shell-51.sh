#!/usr/bin/env bash
set -euo pipefail

for command in gnome-shell gjs dbus-run-session xvfb-run gdbus; do
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

dbus-run-session -- xvfb-run -a bash -euo pipefail -c '
  gnome-shell --nested --wayland &
  shell_pid=$!
  cleanup() {
    kill "$shell_pid" 2>/dev/null || true
    wait "$shell_pid" 2>/dev/null || true
  }
  trap cleanup EXIT

  ready=0
  for attempt in $(seq 1 45); do
    if ! kill -0 "$shell_pid" 2>/dev/null; then
      echo "GNOME Shell exited before the session became ready." >&2
      wait "$shell_pid"
      exit 1
    fi
    if gdbus introspect --session --dest org.gnome.Shell --object-path /org/gnome/Shell >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "Timed out waiting for the GNOME Shell D-Bus session." >&2
    exit 1
  fi

  gjs -m tests/gnome-shell-51/smoke.js
'
