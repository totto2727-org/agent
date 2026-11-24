#!/usr/bin/env bash
# Inventory linked worktrees using local Git data. This helper does not fetch,
# query a forge, search conversations, remove files, or change refs.
set -euo pipefail
usage() { printf 'usage: worktree-audit.sh [-b|--base <ref>] [repo-path]\n'; }
base=''
case ${1:-} in
  -h|--help) usage; exit 0 ;;
  -b|--base) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; base=$2; shift 2 ;;
esac
[[ $# -le 1 && ${1:-} != -* ]] || { usage >&2; exit 2; }
cd -- "${1:-.}"
git rev-parse --git-dir >/dev/null
if [[ -z $base ]]; then
  for ref in origin/HEAD origin/main origin/master; do
    if git rev-parse --quiet --verify "$ref^{commit}" >/dev/null; then base=$ref; break; fi
  done
fi
[[ -n $base ]] || { echo 'No local remote base. Specify -b <ref>.' >&2; exit 1; }
base_sha=$(git rev-parse --verify --end-of-options "$base^{commit}")
printf '# Local base: %s (%s)\nSIZE\tANCESTOR\tSTATE\tBRANCH\tWORKTREE\n' "$base" "$base_sha"
first=true
while IFS= read -r -d '' field; do
  [[ $field == 'worktree '* ]] || continue
  wt=${field#worktree }
  if $first; then first=false; continue; fi
  if [[ ! -d $wt ]]; then printf '?\t?\tunavailable\t?\t%q\n' "$wt"; continue; fi
  size=$(du -sh "$wt" | cut -f1) || size='?'
  branch=$(git -C "$wt" symbolic-ref --quiet --short HEAD) || branch='(detached)'
  if git -C "$wt" merge-base --is-ancestor HEAD "$base_sha"; then merged=yes; else merged=no; fi
  if ! changes=$(GIT_OPTIONAL_LOCKS=0 git -C "$wt" status --porcelain --ignored --untracked-files=normal); then state=unknown
  elif [[ -n $changes ]]; then state=contains-local-files
  else state=clean; fi
  printf '%s\t%s\t%s\t%s\t%q\n' "$size" "$merged" "$state" "$branch" "$wt"
done < <(git worktree list --porcelain -z)
