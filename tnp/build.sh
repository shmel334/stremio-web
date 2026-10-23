#!/bin/sh
# Сборка форка: Node 22 + pnpm 11 в контейнере (на хосте Node 20 — его держит TnP, не трогаем).
# Результат — build/. Ассеты бренда пересобираются до сборки.
set -e
cd "$(dirname "$0")/.."
python3 -I tnp/brand/build-assets.py
docker image inspect tnp-web-builder:22 >/dev/null 2>&1 || \
    printf 'FROM node:22-alpine\nRUN apk add --no-cache git && corepack enable\n' | docker build -q -t tnp-web-builder:22 -
nice -n 15 docker run --rm --memory=4g --cpus=4 -u "$(id -u):$(id -g)" -e HOME=/tmp -e COREPACK_HOME=/tmp/corepack \
    -v "$PWD":/src -w /src tnp-web-builder:22 \
    sh -c 'git config --global --add safe.directory /src && pnpm i --frozen-lockfile >/dev/null && pnpm lint && pnpm build'
