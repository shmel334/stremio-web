// TnP: режим «все файлы» для выдачи тайтла (оператор 25.10). Кнопка в ряду действий включает режим,
// список стримов на той же странице подменяет выдачу нашего аддона на ?purpose=files — без подстройки под
// устройство и без фильтра по каналу. Остальные аддоны и всё поведение строки (клик, меню по зажатию,
// «Скачати» с паком) — штатные. Режим держится за тайтл (#/detail/<type>/<id>) и гаснет на другом тайтле.

const React = require('react');

const FILES_PURPOSE = 'purpose=files';

const titleKey = () => {
    const match = /^#\/detail\/([^/]+)\/([^/?]+)/.exec(window.location.hash);
    return match ? `${match[1]}/${match[2]}` : null;
};

let activeTitle = null;
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());

const isActive = () => activeTitle !== null && activeTitle === titleKey();

const toggle = () => {
    activeTitle = isActive() ? null : titleKey();
    emit();
};

const useFilesMode = () => {
    const [, rerender] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => {
        listeners.add(rerender);
        window.addEventListener('hashchange', rerender);
        return () => {
            listeners.delete(rerender);
            window.removeEventListener('hashchange', rerender);
        };
    }, []);
    return isActive();
};

const isOwnAddon = (addon) => !!addon && typeof addon.transportUrl === 'string' &&
    (/stream\.tnp/.test(addon.transportUrl) || /TnP/i.test((addon.manifest && addon.manifest.name) || ''));

// ответы кешируются на время сессии страницы: повторное включение режима не ходит в Хаб заново
const cache = new Map();

const fetchFiles = (url) => {
    if (!cache.has(url)) {
        cache.set(url, fetch(url)
            .then((response) => response.ok ? response.json() : { streams: [] })
            .then((data) => (Array.isArray(data.streams) ? data.streams : []).filter((s) => s && typeof s.url === 'string'))
            .catch((error) => {
                cache.delete(url);
                throw error;
            }));
    }
    return cache.get(url);
};

// ссылка на плеер: тот же вид, что у ядра (#/player/<поток>/<аддон>/…), с нашим потоком во втором сегменте
const withPlayerLink = (template, encoded) => {
    const parts = template.split('/');
    parts[2] = encodeURIComponent(encoded);
    return parts.join('/');
};

// Подмена в списке стримов страницы: props.streams ядра → тот же массив, где у нашего аддона файлы в режиме «тул»
const useFilesStreams = (streams, core) => {
    const active = useFilesMode();
    const own = active && Array.isArray(streams) ? streams.find((entry) => entry && isOwnAddon(entry.addon)) : null;
    const path = own && own.request ? own.request.path : null;
    const url = path ? `${own.addon.transportUrl.replace(/\/manifest\.json.*$/, '')}/stream/${encodeURIComponent(path.type)}/${encodeURIComponent(path.id)}.json?${FILES_PURPOSE}` : null;
    const template = own && own.content && own.content.type === 'Ready' ?
        (own.content.content.find((s) => s.deepLinks && typeof s.deepLinks.player === 'string') || {}).deepLinks?.player || null
        :
        null;
    const [files, setFiles] = React.useState({ url: null, content: null });

    React.useEffect(() => {
        if (!url || !template) return;
        let cancelled = false;
        setFiles({ url, content: { type: 'Loading' } });
        fetchFiles(url)
            .then((items) => Promise.all(items.map((stream) => core.transport.encodeStream(stream)
                .then((encoded) => ({ ...stream, deepLinks: { player: withPlayerLink(template, encoded) } })))))
            .then((content) => !cancelled && setFiles({ url, content: { type: 'Ready', content } }))
            .catch(() => !cancelled && setFiles({ url, content: { type: 'Err', content: 'files' } }));
        return () => { cancelled = true; };
    }, [url, template, core]);

    return React.useMemo(() => {
        if (!own || files.url !== url || !files.content) return streams;
        return streams.map((entry) => entry === own ? { ...entry, content: files.content } : entry);
    }, [streams, own, url, files]);
};

module.exports = { useFilesMode, useFilesStreams, toggle };
