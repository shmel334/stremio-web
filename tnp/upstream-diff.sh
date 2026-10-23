#!/bin/sh
# Долг перед апстримом: какие ЧУЖИЕ файлы мы правим и насколько.
# Свои файлы (tnp/, src/routes/TnpLogin/ и прочие новые) мержу не мешают и здесь не считаются.
# Ассеты, которые перерисовывает tnp/brand/build-assets.py, считаются отдельно: при конфликте
# берём апстримную версию и перезапускаем скрипт.
set -e
cd "$(dirname "$0")/.."
git fetch -q upstream development
base=$(git merge-base HEAD upstream/development)
echo "база: $(git log -1 --format='%h %s' "$base")"
echo
echo "== правки в файлах апстрима (src, конфиги) =="
git diff --numstat --diff-filter=M "$base" -- . ':!assets' ':!tnp' | awk '{printf "  +%-4s -%-4s %s\n", $1, $2, $3; f++; a+=$1; d+=$2} END {printf "  итого: %d файлов, +%d -%d строк\n", f, a, d}'
echo
echo "== ассеты апстрима, перерисованные скриптом =="
git diff --name-only --diff-filter=M "$base" -- assets | wc -l | sed 's/^/  файлов: /'
echo
echo "== новые файлы TnP вне tnp/ =="
git diff --name-only --diff-filter=A "$base" -- . ':!tnp' | sed 's/^/  /'
