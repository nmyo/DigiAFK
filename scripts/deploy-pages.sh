#!/usr/bin/env bash
# 把 site/ 的内容同步到 gh-pages 分支（GitHub Pages 从这里发布）。
# 用法：bash scripts/deploy-pages.sh
# 需要本地已配置可推送 nmyo/DigiAFK 的 git 凭据；也可用 GITHUB_TOKEN 环境变量。
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
REMOTE="$(git remote get-url origin)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cp -r site/. "$TMP/"
# 热更新版本号：每次部署唯一，页面轮询 version.json 即可感知新构建
BUILD="$(date +%s)-$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo dev)"
printf '{"v":"%s","at":"%s"}\n' "$BUILD" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$TMP/version.json"
echo "build id: $BUILD"
cd "$TMP"

git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$ROOT" config user.name || echo deploy)" \
    -c user.email="$(git -C "$ROOT" config user.email || echo deploy@local)" \
    commit -q -m "deploy: $(date '+%Y-%m-%d %H:%M:%S')"

if [ -n "${GITHUB_TOKEN:-}" ]; then
  AUTH_REMOTE="$(printf '%s' "$REMOTE" | sed "s#https://#https://x-access-token:${GITHUB_TOKEN}@#")"
else
  AUTH_REMOTE="$REMOTE"
fi

git remote add origin "$AUTH_REMOTE"
git push --force origin gh-pages
echo "已发布：https://nmyo.github.io/DigiAFK/"
