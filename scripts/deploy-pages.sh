#!/usr/bin/env bash
# Sync site/ to the existing GitHub Pages branch without rewriting its history.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
REMOTE="$(git remote get-url origin)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ -n "${GITHUB_TOKEN:-}" ]; then
  ASKPASS="$TMP/askpass"
  printf '%s\n' '#!/bin/sh' 'case "$1" in *sername*) printf "%s\\n" x-access-token ;; *) printf "%s\\n" "$GITHUB_TOKEN" ;; esac' > "$ASKPASS"
  chmod 700 "$ASKPASS"
  export GIT_ASKPASS="$ASKPASS" GIT_TERMINAL_PROMPT=0
fi
git init -q "$TMP/pages"
git -C "$TMP/pages" remote add origin "$REMOTE"
git -C "$TMP/pages" fetch -q --depth=1 origin gh-pages
git -C "$TMP/pages" checkout -q -b gh-pages FETCH_HEAD
find "$TMP/pages" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r site/. "$TMP/pages/"
BUILD="$(date +%s)-$(git rev-parse --short HEAD)-$(node -e 'console.log(require("crypto").randomBytes(4).toString("hex"))')"
printf '{"v":"%s","at":"%s"}\n' "$BUILD" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$TMP/pages/version.json"
BUILD="$BUILD" node -e 'const fs=require("fs"), p=process.argv[1], s=fs.readFileSync(p,"utf8"), marker="<head>"; if (!s.includes(marker)) throw Error("index.html head not found"); fs.writeFileSync(p,s.replace(marker,marker+"<meta name=\"pc-build\" content=\""+process.env.BUILD+"\">"));' "$TMP/pages/index.html"
git -C "$TMP/pages" add -A
git -C "$TMP/pages" -c user.name="$(git config user.name || echo deploy)" \
  -c user.email="$(git config user.email || echo deploy@local)" \
  commit -q -m "deploy: $BUILD"
git -C "$TMP/pages" push origin gh-pages
echo "已发布 $BUILD：https://nmyo.github.io/DigiAFK/"
