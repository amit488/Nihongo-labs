#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-}"
DRY_RUN="${2:-}"

if [[ -z "$TARGET_DIR" ]]; then
  echo "Usage: bash $0 /absolute/path/to/nihongo-labs [--dry-run]"
  exit 2
fi
if [[ ! -d "$TARGET_DIR" || ! -f "$TARGET_DIR/package.json" ]]; then
  echo "Target must be an existing Next.js project containing package.json."
  exit 2
fi
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
if [[ "$DRY_RUN" != "" && "$DRY_RUN" != "--dry-run" ]]; then
  echo "Unknown option: $DRY_RUN"; exit 2
fi

CONFLICTS=0
ADDITIONS=0
SAME=0

copy_tree() {
  local from="$1" to="$2"
  while IFS= read -r -d '' file; do
    local rel dest
    rel="${file#"$from"/}"
    dest="$to/$rel"
    if [[ -e "$dest" ]]; then
      if cmp -s "$file" "$dest"; then
        printf 'SAME:     %s\n' "${dest#"$TARGET_DIR"/}"
        SAME=$((SAME + 1))
      else
        printf 'CONFLICT: %s (kept existing file; review manually)\n' "${dest#"$TARGET_DIR"/}"
        CONFLICTS=$((CONFLICTS + 1))
      fi
    else
      printf 'ADD:      %s\n' "${dest#"$TARGET_DIR"/}"
      if [[ "$DRY_RUN" != "--dry-run" ]]; then
        mkdir -p "$(dirname "$dest")"
        cp "$file" "$dest"
      fi
      ADDITIONS=$((ADDITIONS + 1))
    fi
  done < <(find "$from" -type f -print0)
}

copy_one() {
  local rel="$1" dest="$TARGET_DIR/$1"
  if [[ -e "$dest" ]]; then
    if cmp -s "$SOURCE_DIR/$rel" "$dest"; then
      printf 'SAME:     %s\n' "$rel"; SAME=$((SAME + 1))
    else
      printf 'CONFLICT: %s (kept existing file; review manually)\n' "$rel"; CONFLICTS=$((CONFLICTS + 1))
    fi
  else
    printf 'ADD:      %s\n' "$rel"
    if [[ "$DRY_RUN" != "--dry-run" ]]; then mkdir -p "$(dirname "$dest")"; cp "$SOURCE_DIR/$rel" "$dest"; fi
    ADDITIONS=$((ADDITIONS + 1))
  fi
}

# Application source, static assets, root-level tests and developer scripts.
copy_tree "$SOURCE_DIR/src" "$TARGET_DIR/src"
copy_tree "$SOURCE_DIR/public" "$TARGET_DIR/public"
copy_tree "$SOURCE_DIR/tests" "$TARGET_DIR/tests"
copy_tree "$SOURCE_DIR/scripts" "$TARGET_DIR/scripts"

# Keep database scripts separate from Supabase's migration folder. Nothing here runs SQL.
copy_tree "$SOURCE_DIR/sql" "$TARGET_DIR/nihongo-labs-backend/sql"
copy_tree "$SOURCE_DIR/docs" "$TARGET_DIR/nihongo-labs-backend/docs"

for file in .env.local.example package.backend-additions.json README_LOCAL.md; do copy_one "$file"; done

# Only add project config files if none exists. Existing project configuration is never replaced.
if [[ ! -e "$TARGET_DIR/next-env.d.ts" ]]; then copy_one "next-env.d.ts"; fi
if [[ ! -e "$TARGET_DIR/next.config.ts" && ! -e "$TARGET_DIR/next.config.js" && ! -e "$TARGET_DIR/next.config.mjs" ]]; then copy_one "next.config.ts"; else echo 'KEEP: existing next.config (merge any required settings manually).'; fi
if [[ ! -e "$TARGET_DIR/tsconfig.json" ]]; then copy_one "tsconfig.json"; else echo 'KEEP: existing tsconfig.json (verify @/* maps to ./src/*).'; fi

printf '\nSummary: %s additions, %s identical files, %s conflicts.\n' "$ADDITIONS" "$SAME" "$CONFLICTS"
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo 'Dry run only: no files were copied.'
else
  echo 'Existing files were never overwritten. SQL is in nihongo-labs-backend/sql and was NOT executed.'
fi
if (( CONFLICTS > 0 )); then
  echo 'Review each CONFLICT before running the app; the script kept your existing copy.'
fi
cat <<'MSG'

No Git commands, commits, pushes, migrations, database writes or deployments were performed.
Merge package.backend-additions.json into package.json manually; retain your lockfile.
MSG
