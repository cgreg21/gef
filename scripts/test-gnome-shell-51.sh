#!/usr/bin/env bash
set -euo pipefail

for command in node unzip realpath gnome-shell gnome-extensions gjs dbus-run-session xvfb-run gdbus pipewire; do
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
runtime_dir="$(mktemp -d)"
chmod 700 "$runtime_dir"
trap 'rm -rf "$data_home" "$runtime_dir"' EXIT
export XDG_DATA_HOME="$data_home"
export XDG_RUNTIME_DIR="$runtime_dir"
export LIBGL_ALWAYS_SOFTWARE=1
for typelib in /usr/lib64/gnome-shell/St-51.typelib /usr/lib64/mutter-51/Meta-51.typelib /usr/lib64/mutter-51/Clutter-51.typelib; do
  if [[ ! -f "$typelib" ]]; then
    echo "Missing GNOME Shell 51 runtime typelib: $typelib" >&2
    exit 2
  fi
done
export GI_TYPELIB_PATH="/usr/lib64/gnome-shell:/usr/lib64/mutter-51${GI_TYPELIB_PATH:+:$GI_TYPELIB_PATH}"
export LD_LIBRARY_PATH="/usr/lib64/gnome-shell:/usr/lib64/mutter-51${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

dbus-run-session -- xvfb-run -a bash -euo pipefail -c '
  archive="$1"
  uuid="$2"
  pipewire >/tmp/gef-pipewire.log 2>&1 &
  pipewire_pid=$!
  gnome-shell --wayland --devkit &
  shell_pid=$!
  cleanup() {
    kill "$shell_pid" "$pipewire_pid" 2>/dev/null || true
    wait "$shell_pid" "$pipewire_pid" 2>/dev/null || true
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
