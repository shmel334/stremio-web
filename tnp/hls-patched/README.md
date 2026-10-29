# tnp/hls-patched — hls.js 1.5.4-patch2 (Stremio) с одной правкой

Копия `node_modules/hls.js/dist/hls.js` (ту же сборку тянет `@stremio/stremio-video`), подключается в
webpack через `resolve.alias['hls.js$']`. Правка — `BufferController.onBufferCodecs`, метка `TnP (25.10)`:
повторный BUFFER_CODECS той же дорожки не уменьшает счётчик ожидаемых событий.

Почему: при продолжении просмотра (Stremio ставит `currentTime` до `attachMedia`) сегмент 0 видео
разбирается дважды; два события «кодек video» съедали ожидание звука, hls.js создавал один видеобуфер,
и первая запись звука падала «Attempting to append to the audio SourceBuffer, but it does not exist»
(хронология web_player_events id 35, 25.10). От кодека звука не зависит — тот же отказ в обычном /watch.

При обновлении hls.js в апстриме: перенести правку или проверить, что баг закрыт у них.
