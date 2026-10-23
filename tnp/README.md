# TnP-слой форка Stremio Web

Ветка `tnp` = апстримный `development` + правки только в UI. Ядро (`@stremio/stremio-core-web`)
не трогаем: связь с `api.strem.io` и синк остаются штатными. План и решения —
`TnP/docs/web-player.md` (приватный репо TnP).

- `brand/` — `symbol.svg`, `logo.svg` и `build-assets.py`: перерисовывает ассеты апстрима поверх
  (те же имена и размеры). После каждого мержа апстрима запускать снова.
- `build.sh` — сборка в контейнере Node 22 + pnpm 11 (lint + build), результат в `build/`.

Обновление: `git fetch upstream && git merge upstream/development` в `tnp`, затем `tnp/build.sh`.
Правки в `src/` помечены комментарием `TnP:` там, где меняется поведение.
