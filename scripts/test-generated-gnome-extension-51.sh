#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
for command in node npm zip gnome-extensions; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 2
  fi
done

temporary_root="$(mktemp -d)"
trap 'rm -rf "$temporary_root"' EXIT
project="$temporary_root/generated-extension"

node "$root/dist/cli/src/index.js" new gef-generated-smoke "$project" --type extension
mkdir -p "$project/node_modules/.bin"
ln -s "$root" "$project/node_modules/gnome-extension-framework"
ln -s "$root/node_modules/typescript" "$project/node_modules/typescript"
cat > "$project/node_modules/.bin/gef" <<EOF
#!/usr/bin/env bash
exec node "$root/dist/cli/src/index.js" "\$@"
EOF
chmod +x "$project/node_modules/.bin/gef"
ln -s "$root/node_modules/typescript/bin/tsc" "$project/node_modules/.bin/tsc"

(
  cd "$project"
  npm run package
)

archive="$(find "$project" -maxdepth 1 -type f -name '*.shell-extension.zip' -print -quit)"
if [[ -z "$archive" ]]; then
  echo "The generated project did not produce a GNOME Shell extension archive." >&2
  exit 1
fi

bash "$root/scripts/test-gnome-shell-51.sh" "$archive"
