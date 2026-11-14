#!/bin/bash
# 补齐 1..151 的普通与异色精灵图；已存在且非空的跳过。
set -u
DIR="${1:?目标目录}"
# 使用游戏原站的 68×56 精灵图；PokeAPI 的 96×96 图片会破坏定位。
BASE="https://pokecatch-online.pages.dev/assets/pokemon"
mkdir -p "$DIR" "$DIR/shiny"

fetch() {
  local no="$1" kind="$2" out url i=0
  if [ "$kind" = "shiny" ]; then out="$DIR/shiny/$no.png"; url="$BASE/shiny/$no.png"
  else out="$DIR/$no.png"; url="$BASE/$no.png"; fi
  [ -s "$out" ] && return 0
  while [ $i -lt 3 ]; do
    if curl -sfL --max-time 25 -o "$out.part" "$url" && [ -s "$out.part" ]; then
      mv "$out.part" "$out"; return 0
    fi
    i=$((i+1)); sleep 1
  done
  rm -f "$out.part"; echo "FAIL $kind $no"
}
export -f fetch
export DIR BASE

for n in $(seq 1 151); do echo "$n normal"; echo "$n shiny"; done |
  xargs -P 6 -n 2 bash -c 'fetch "$0" "$1"'
printf 'normal: %s  shiny: %s\n' "$(ls "$DIR"/*.png 2>/dev/null | wc -l)" "$(ls "$DIR/shiny"/*.png 2>/dev/null | wc -l)"
