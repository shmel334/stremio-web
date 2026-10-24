// TnP: «Відкрити з…» у строки файла — те же ссылки на внешние плееры, что строит ядро Stremio
// (форматы взяты из stremio-core-web: intent-пакеты Android, x-callback iOS, vlc://, mpv://, iina://, .m3u).
// Порядок: плеер из настройки Stremio «Зовнішній плеєр» (profile.settings.playerType) → иначе по платформе:
// Android — системный выбор приложения (там же «Завжди» = плеер по умолчанию), iOS — наш список плееров,
// ПК — файл .m3u: его открывает плеер, назначенный в системе по умолчанию.

const ANDROID_PACKAGES = {
    vlc: 'org.videolan.vlc',
    mxplayer: 'com.mxtech.videoplayer.ad',
    justplayer: 'com.brouken.player',
};

const intentLink = (url, pkg) => {
    const u = new URL(url);
    const scheme = u.protocol.replace(':', '');
    return `intent://${u.host}${u.pathname}${u.search}#Intent;${pkg ? `package=${pkg};type=video` : 'type=video/any'};scheme=${scheme};end`;
};

// плееры iOS / visionOS, которые знает ядро; без настройки клиент выбирает из этого списка
const IOS_PLAYERS = [
    { value: 'vlc', label: 'VLC', link: (url) => `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(url)}` },
    { value: 'infuse', label: 'Infuse', link: (url) => `infuse://x-callback-url/play?url=${encodeURIComponent(url)}` },
    { value: 'outplayer', label: 'Outplayer', link: (url) => `outplayer://${url}` },
    { value: 'vidhub', label: 'VidHub', link: (url) => `open-vidhub://x-callback-url/open?url=${encodeURIComponent(url)}` },
];

const DESKTOP_LINKS = {
    vlc: (url) => `vlc://${url}`,
    mpv: (url) => `mpv://${url}`,
    iina: (url) => `iina://weblink?url=${encodeURIComponent(url)}`,
};

const isIos = (platform) => platform === 'ios' || platform === 'visionos';

// ссылка на плеер из настройки Stremio; null — настройки нет (или «Дозволити вибір»)
const configuredLink = (url, platform, playerType) => {
    if (!playerType || playerType === 'choose') return null;
    if (platform === 'android') return ANDROID_PACKAGES[playerType] ? intentLink(url, ANDROID_PACKAGES[playerType]) : null;
    if (isIos(platform)) {
        const player = IOS_PLAYERS.find((p) => p.value === playerType);
        return player ? player.link(url) : null;
    }
    return DESKTOP_LINKS[playerType] ? DESKTOP_LINKS[playerType](url) : null;
};

const downloadM3u = (url, title) => {
    const body = `#EXTM3U\n#EXTINF:-1,${(title || 'TnP').replace(/[\r\n]+/g, ' ')}\n${url}\n`;
    const href = URL.createObjectURL(new Blob([body], { type: 'audio/x-mpegurl' }));
    const a = document.createElement('a');
    a.href = href;
    a.download = 'playlist.m3u';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10000);
};

const go = (link) => { window.location.href = link; };

module.exports = { IOS_PLAYERS, isIos, intentLink, configuredLink, downloadM3u, go };
