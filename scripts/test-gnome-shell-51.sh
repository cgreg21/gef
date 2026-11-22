#!/usr/bin/env bash
set -euo pipefail

for command in gnome-shell gnome-extensions gjs dbus-run-session xvfb-run gdbus; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 2
  fi
done

archive="${1:-}"
if [[ -z "$archive" || ! -f "$archive" ]]; then
  echo "Usage: $0 dist/<uuid>.shell-extension.zip" >&2
  exit 2
fi
archive="$(realpath "$archive")"
uuid="$(unzip -p "$archive" metadata.json | node -e 'let data=""; process.stdin.on("data", chunk => data += chunk); process.stdin.on("end", () => process.stdout.write(JSON.parse(data).uuid ?? ""));')"
if [[ -z "$uuid" ]]; then
  echo "The extension archive has no metadata UUID." >&2
  exit 2
fi

version="$(gnome-shell --version)"
if [[ ! "$version" =~ GNOME\ Shell\ 51\. ]]; then
  echo "Expected GNOME Shell 51, found: $version" >&2
  exit 2
fi

data_home="$(mktemp -d)"
trap 'rm -rf "$data_home"' EXIT
export XDG_DATA_HOME="$data_home"

dbus-run-session -- xvfb-run -a bash -euo pipefail -c '
  archive="$1"
  uuid="$2"
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
  gnome-extensions install --force "$archive"

  for cycle in 1 2; do
    gnome-extensions enable "$uuid"
    if ! gnome-extensions info "$uuid" | grep -q "State: ENABLED"; then
      echo "Generated extension failed to reach ENABLED state (cycle $cycle)." >&2
      gnome-extensions info "$uuid" >&2 || true
      exit 1
    fi

    gnome-extensions disable "$uuid"
    if ! gnome-extensions info "$uuid" | grep -q "State: DISABLED"; then
      echo "Generated extension failed to reach DISABLED state (cycle $cycle)." >&2
      gnome-extensions info "$uuid" >&2 || true
      exit 1
    fi
  done

  echo "Generated EGO archive installed and enabled/disabled successfully twice."
' _ "$archive" "$uuid"
