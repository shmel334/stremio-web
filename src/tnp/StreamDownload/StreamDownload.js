// TnP: «Скачати» и «Скачати пак» в меню стрима (вместо «Copy video download link»).
// Скачивание — наш конвейер TnP (/api/traffic/download/web/*: Хаб называет файл по ссылке строки,
// дальше те же проверки трафика, нода и учёт, что из ЛК).
// Пак — серии с ТЕМ ЖЕ bingeGroup, что у этой строки: ровно та логика, по которой выдача и автоплей
// считают серии одним паком (пак-торрент, синтетика, CDN-группа, линия). Стримы соседних серий веб
// берёт у того же аддона, как сам Stremio; не больше двух запросов разом. Меню разворачивается на месте.

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { useCore } = require('stremio/core');
const { useToast } = require('stremio/common');
const { Button } = require('stremio/components');
const styles = require('./styles');

const CHECK_URL = '/api/traffic/download/web/check?u=';
const STREAM_URL = '/api/traffic/download/web/stream?u=';
const PARALLEL = 2;

const formatSize = (bytes) => {
    if (!bytes) return '';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(2)} ГБ` : `${Math.max(1, Math.round(bytes / (1024 * 1024)))} МБ`;
};

const startDownload = (url) => {
    // скрытый фрейм: файл приходит вложением, страница веба остаётся на месте
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    frame.src = STREAM_URL + encodeURIComponent(url);
    document.body.appendChild(frame);
    setTimeout(() => frame.remove(), 120000);
};

const checkDownload = (url) => fetch(CHECK_URL + encodeURIComponent(url), { credentials: 'same-origin', cache: 'no-store' })
    .then((response) => response.json().catch(() => ({})).then((data) => ({ ok: response.ok, data })))
    .catch(() => ({ ok: false, data: {} }));

// стримы серии у аддона; строка с тем же bingeGroup — серия этого пака
const loadEpisodeStream = (base, metaId, season, episode, bingeGroup) =>
    fetch(`${base}/stream/series/${encodeURIComponent(`${metaId}:${season}:${episode}`)}.json`)
        .then((response) => response.ok ? response.json() : { streams: [] })
        .catch(() => ({ streams: [] }))
        .then((data) => (Array.isArray(data.streams) ? data.streams : [])
            .find((s) => s && s.url && s.behaviorHints && s.behaviorHints.bingeGroup === bingeGroup) || null);

const StreamDownload = ({ stream, videoId, optionClassName, iconClassName, labelClassName, closeMenu }) => {
    const core = useCore();
    const toast = useToast();
    const url = stream && stream.url;
    const bingeGroup = stream && stream.behaviorHints ? stream.behaviorHints.bingeGroup : null;
    const idParts = typeof videoId === 'string' ? videoId.split(':') : [];
    const isEpisode = idParts.length >= 3;
    const metaId = isEpisode ? idParts.slice(0, idParts.length - 2).join(':') : null;
    const currentSeason = isEpisode ? Number(idParts[idParts.length - 2]) : null;
    const currentEpisode = isEpisode ? Number(idParts[idParts.length - 1]) : null;
    const base = stream && typeof stream.transportUrl === 'string' ? stream.transportUrl.replace(/\/manifest\.json.*$/, '') : null;
    const canPack = isEpisode && !!bingeGroup && !!base;

    const [packOpen, setPackOpen] = React.useState(false);
    const [seasons, setSeasons] = React.useState([]);
    const [season, setSeason] = React.useState(currentSeason);
    const [episodes, setEpisodes] = React.useState({});
    const [selected, setSelected] = React.useState({});
    const [busy, setBusy] = React.useState(false);

    const showError = React.useCallback((data) => {
        toast.show({ type: 'error', title: (data && data.message) || 'Не вдалося почати завантаження', timeout: 6000 });
    }, [toast]);

    const onDownload = React.useCallback((event) => {
        event.preventDefault();
        if (!url || busy) return;
        setBusy(true);
        checkDownload(url).then(({ ok, data }) => {
            setBusy(false);
            if (!ok) {
                showError(data);
                return;
            }
            startDownload(url);
            toast.show({ type: 'success', title: `Завантаження: ${data.filename || 'файл'}`, timeout: 4000 });
            closeMenu();
        });
    }, [url, busy, showError, toast, closeMenu]);

    // серии сезона из меты тайтла (ядро уже загрузило её для этой страницы; читаем разово, без подписки)
    const loadSeason = React.useCallback((value) => {
        setSeason(value);
        if (episodes[value]) return;
        setEpisodes((prev) => ({ ...prev, [value]: { loading: true, items: [] } }));
        core.transport.getState('meta_details').then((state) => {
            const meta = state && state.metaItem && state.metaItem.content && state.metaItem.content.type === 'Ready' ? state.metaItem.content.content : null;
            const now = Date.now();
            const videos = (meta && Array.isArray(meta.videos) ? meta.videos : [])
                .filter((v) => v.season === value && typeof v.episode === 'number' && (!v.released || Date.parse(v.released) <= now))
                .sort((a, b) => a.episode - b.episode);
            const found = [];
            let next = 0;
            const worker = () => {
                if (next >= videos.length) return Promise.resolve();
                const v = videos[next++];
                const own = value === currentSeason && v.episode === currentEpisode;
                return (own ? Promise.resolve(stream) : loadEpisodeStream(base, metaId, value, v.episode, bingeGroup))
                    .then((s) => {
                        if (s) found.push({ episode: v.episode, title: v.title || v.name || '', url: s.url, size: s.behaviorHints && s.behaviorHints.videoSize });
                    })
                    .then(worker);
            };
            return Promise.all(Array.from({ length: PARALLEL }, worker)).then(() => {
                found.sort((a, b) => a.episode - b.episode);
                setEpisodes((prev) => ({ ...prev, [value]: { loading: false, items: found } }));
                setSelected((prev) => {
                    const nextSel = { ...prev };
                    found.forEach((item) => { nextSel[`${value}:${item.episode}`] = true; });
                    return nextSel;
                });
            });
        }).catch(() => {
            setEpisodes((prev) => ({ ...prev, [value]: { loading: false, items: [] } }));
        });
    }, [core, episodes, stream, base, metaId, bingeGroup, currentSeason, currentEpisode]);

    const onPackToggle = React.useCallback((event) => {
        event.preventDefault();
        if (packOpen) {
            setPackOpen(false);
            return;
        }
        setPackOpen(true);
        core.transport.getState('meta_details').then((state) => {
            const meta = state && state.metaItem && state.metaItem.content && state.metaItem.content.type === 'Ready' ? state.metaItem.content.content : null;
            const list = [...new Set((meta && Array.isArray(meta.videos) ? meta.videos : []).map((v) => v.season).filter((s) => typeof s === 'number' && s > 0))].sort((a, b) => a - b);
            setSeasons(list);
        }).catch(() => setSeasons([]));
        loadSeason(currentSeason);
    }, [packOpen, core, loadSeason, currentSeason]);

    const picked = React.useMemo(() => Object.keys(episodes).flatMap((s) => (episodes[s].items || [])
        .filter((item) => selected[`${s}:${item.episode}`])
        .map((item) => ({ ...item, season: Number(s) }))), [episodes, selected]);
    const pickedSize = picked.reduce((sum, item) => sum + (item.size || 0), 0);
    const sizeKnown = picked.every((item) => item.size);

    const onPackDownload = React.useCallback((event) => {
        event.preventDefault();
        if (!picked.length || busy) return;
        setBusy(true);
        // проверка по первому файлу: трафик, сервис; дальше файлы идут по очереди
        checkDownload(picked[0].url).then(({ ok, data }) => {
            setBusy(false);
            if (!ok) {
                showError(data);
                return;
            }
            picked.forEach((item, index) => setTimeout(() => startDownload(item.url), index * 1500));
            toast.show({ type: 'success', title: `Завантаження ${picked.length} сер.${sizeKnown && pickedSize ? ` · ${formatSize(pickedSize)}` : ''}`, timeout: 5000 });
            closeMenu();
        });
    }, [picked, busy, showError, toast, closeMenu, sizeKnown, pickedSize]);

    if (!url) return null;
    const current = episodes[season] || { loading: true, items: [] };
    return (
        <React.Fragment>
            <Button className={optionClassName} title={'Скачати'} onClick={onDownload}>
                <Icon className={iconClassName} name={'download'} />
                <div className={labelClassName}>{busy && !packOpen ? 'Перевіряю…' : 'Скачати'}</div>
            </Button>
            {
                canPack ?
                    <Button className={optionClassName} title={'Скачати пак'} onClick={onPackToggle}>
                        <Icon className={iconClassName} name={'download'} />
                        <div className={labelClassName}>Скачати пак</div>
                    </Button>
                    :
                    null
            }
            {
                canPack && packOpen ?
                    <div className={styles['pack']}>
                        {
                            seasons.length > 1 ?
                                <div className={styles['seasons']}>
                                    {seasons.map((s) => (
                                        <Button key={s} className={classnames(styles['season'], { [styles['active']]: s === season })} title={`Сезон ${s}`} onClick={(event) => { event.preventDefault(); loadSeason(s); }}>
                                            {`Сезон ${s}`}
                                        </Button>
                                    ))}
                                </div>
                                :
                                null
                        }
                        <div className={styles['episodes']}>
                            {
                                current.loading ?
                                    <div className={styles['note']}>Шукаю серії цього релізу…</div>
                                    :
                                    current.items.length === 0 ?
                                        <div className={styles['note']}>У цьому сезоні серій цього релізу немає</div>
                                        :
                                        current.items.map((item) => {
                                            const key = `${season}:${item.episode}`;
                                            return (
                                                <label key={key} className={styles['episode']}>
                                                    <input type={'checkbox'} checked={!!selected[key]} onChange={() => setSelected((prev) => ({ ...prev, [key]: !prev[key] }))} />
                                                    <span className={styles['episode-name']}>{`${item.episode}. ${item.title}`}</span>
                                                    <span className={styles['episode-size']}>{formatSize(item.size)}</span>
                                                </label>
                                            );
                                        })
                            }
                        </div>
                        <Button className={classnames(styles['pack-download'], { [styles['disabled']]: !picked.length || busy })} title={'Скачати вибране'} onClick={onPackDownload}>
                            {busy ? 'Перевіряю…' : `Скачати ${picked.length} сер.${pickedSize ? ` · ${sizeKnown ? '' : '≥ '}${formatSize(pickedSize)} трафіку` : ''}`}
                        </Button>
                    </div>
                    :
                    null
            }
        </React.Fragment>
    );
};

StreamDownload.propTypes = {
    stream: PropTypes.object,
    videoId: PropTypes.string,
    optionClassName: PropTypes.string,
    iconClassName: PropTypes.string,
    labelClassName: PropTypes.string,
    closeMenu: PropTypes.func
};

module.exports = StreamDownload;
