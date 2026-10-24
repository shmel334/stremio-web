// TnP: «Скачати» в меню стрима (вместо «Copy video download link»).
// Скачивание — наш конвейер TnP (/api/traffic/download/web/*: Хаб называет файл по ссылке строки,
// дальше те же проверки трафика, нода и учёт, что из ЛК).
// Пак-торрент (bingeGroup `|pack|<hash>|`, оператор 25.10): «Скачати» раскрывает серии пака — состав от Хаба
// (/download/web/pack → getPackFiles, тот же отбор, что у выдачи), отмечена текущая серия, «Усі» — весь пак.
// Перед стартом — проверка всей выборки против остатка трафика (POST /download/web/check), стартуют только
// прошедшие. Одиночная серия качается сразу. Отдельной кнопки «Скачати пак» и поиска серий по выдаче больше нет.

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { useToast } = require('stremio/common');
const { Button } = require('stremio/components');
const styles = require('./styles');

const CHECK_URL = '/api/traffic/download/web/check';
const STREAM_URL = '/api/traffic/download/web/stream?u=';
const PACK_URL = '/api/traffic/download/web/pack?u=';

const formatSize = (bytes) => {
    if (!bytes) return '';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(2)} ГБ` : `${Math.max(1, Math.round(bytes / (1024 * 1024)))} МБ`;
};

const startDownload = (url, fileIndex) => {
    // скрытый фрейм: файл приходит вложением, страница веба остаётся на месте
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    frame.src = STREAM_URL + encodeURIComponent(url) + (typeof fileIndex === 'number' ? `&fi=${fileIndex}` : '');
    document.body.appendChild(frame);
    setTimeout(() => frame.remove(), 120000);
};

const asResult = (response) => response.json().catch(() => ({})).then((data) => ({ ok: response.ok, data }));
const checkDownload = (url) => fetch(`${CHECK_URL}?u=${encodeURIComponent(url)}`, { credentials: 'same-origin', cache: 'no-store' })
    .then(asResult)
    .catch(() => ({ ok: false, data: {} }));
// вся выборка пака разом: сумма против остатка трафика, по каждой серии — можно ли
const checkPack = (items) => fetch(CHECK_URL, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: items.map((item) => ({ url: item.url, fileIndex: item.fileIndex })) })
}).then(asResult).catch(() => ({ ok: false, data: {} }));

const StreamDownload = ({ stream, videoId, optionClassName, iconClassName, labelClassName, closeMenu }) => {
    const toast = useToast();
    const url = stream && stream.url;
    const bingeGroup = stream && stream.behaviorHints ? stream.behaviorHints.bingeGroup : null;
    const idParts = typeof videoId === 'string' ? videoId.split(':') : [];
    const isEpisode = idParts.length >= 3;
    const currentSeason = isEpisode ? Number(idParts[idParts.length - 2]) : null;
    const currentEpisode = isEpisode ? Number(idParts[idParts.length - 1]) : null;
    const isPack = isEpisode && typeof bingeGroup === 'string' && bingeGroup.indexOf('|pack|') !== -1;

    const [packOpen, setPackOpen] = React.useState(false);
    const [seasons, setSeasons] = React.useState([]);
    const [season, setSeason] = React.useState(currentSeason);
    const [episodes, setEpisodes] = React.useState({});
    const [selected, setSelected] = React.useState({});
    const [busy, setBusy] = React.useState(false);

    const showError = React.useCallback((data) => {
        toast.show({ type: 'error', title: (data && data.message) || 'Не вдалося почати завантаження', timeout: 6000 });
    }, [toast]);

    const downloadOne = React.useCallback(() => {
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
    }, [url, showError, toast, closeMenu]);

    // серии пак-торрента одним запросом к Хабу; отмечена только текущая
    const loadPack = React.useCallback(() => {
        setEpisodes({ [currentSeason]: { loading: true, items: [] } });
        fetch(PACK_URL + encodeURIComponent(url), { credentials: 'same-origin', cache: 'no-store' })
            .then((response) => response.ok ? response.json() : { files: [] })
            .catch(() => ({ files: [] }))
            .then((data) => {
                const bySeason = {};
                (Array.isArray(data.files) ? data.files : []).forEach((f) => {
                    (bySeason[f.season] = bySeason[f.season] || []).push({ episode: f.episode, title: f.filename || '', url, fileIndex: f.fileIndex, size: f.size });
                });
                const list = Object.keys(bySeason).map(Number).sort((a, b) => a - b);
                // в пуле только эта серия — пака по факту нет, качаем её
                if (list.length === 0 || (list.length === 1 && bySeason[list[0]].length === 1)) {
                    setPackOpen(false);
                    downloadOne();
                    return;
                }
                const next = {};
                list.forEach((s) => { next[s] = { loading: false, items: bySeason[s].sort((a, b) => a.episode - b.episode) }; });
                setSeasons(list);
                setEpisodes(next);
                setSelected({ [`${currentSeason}:${currentEpisode}`]: true });
                setSeason(list.includes(currentSeason) ? currentSeason : list[0]);
            });
    }, [url, currentSeason, currentEpisode, downloadOne]);

    const onDownload = React.useCallback((event) => {
        event.preventDefault();
        if (!url || busy) return;
        if (!isPack) {
            downloadOne();
            return;
        }
        if (packOpen) {
            setPackOpen(false);
            return;
        }
        setPackOpen(true);
        loadPack();
    }, [url, busy, isPack, packOpen, downloadOne, loadPack]);

    const picked = React.useMemo(() => Object.keys(episodes).flatMap((s) => (episodes[s].items || [])
        .filter((item) => selected[`${s}:${item.episode}`])
        .map((item) => ({ ...item, season: Number(s) }))), [episodes, selected]);
    const pickedSize = picked.reduce((sum, item) => sum + (item.size || 0), 0);
    const sizeKnown = picked.every((item) => item.size);
    const allItems = Object.keys(episodes).flatMap((s) => (episodes[s].items || []).map((item) => `${s}:${item.episode}`));
    const allPicked = allItems.length > 0 && allItems.every((key) => selected[key]);
    const onToggleAll = React.useCallback((event) => {
        event.preventDefault();
        setSelected(allPicked ? {} : Object.fromEntries(allItems.map((key) => [key, true])));
    }, [allPicked, allItems]);

    const onPackDownload = React.useCallback((event) => {
        event.preventDefault();
        if (!picked.length || busy) return;
        setBusy(true);
        checkPack(picked).then(({ ok, data }) => {
            setBusy(false);
            if (!ok) {
                showError(data);
                return;
            }
            const files = Array.isArray(data.files) ? data.files : [];
            const good = picked.filter((item, index) => files[index] && files[index].ok);
            good.forEach((item, index) => setTimeout(() => startDownload(item.url, item.fileIndex), index * 1500));
            const skipped = picked.length - good.length;
            toast.show({
                type: good.length ? 'success' : 'error',
                title: `Стартувало ${good.length} з ${picked.length}${data.total ? ` · ${formatSize(data.total)}` : ''}${skipped ? ` · ${skipped} недоступні` : ''}`,
                timeout: 6000
            });
            if (good.length) closeMenu();
        });
    }, [picked, busy, showError, toast, closeMenu]);

    if (!url) return null;
    const current = episodes[season] || { loading: true, items: [] };
    return (
        <React.Fragment>
            <Button className={optionClassName} title={isPack ? 'Скачати: серії пака' : 'Скачати'} onClick={onDownload}>
                <Icon className={iconClassName} name={'download'} />
                <div className={labelClassName}>{busy && !packOpen ? 'Перевіряю…' : 'Скачати'}</div>
            </Button>
            {
                isPack && packOpen ?
                    <div className={styles['pack']}>
                        {
                            seasons.length > 1 ?
                                <div className={styles['seasons']}>
                                    {seasons.map((s) => (
                                        <Button key={s} className={classnames(styles['season'], { [styles['active']]: s === season })} title={`Сезон ${s}`} onClick={(event) => { event.preventDefault(); setSeason(s); }}>
                                            {`Сезон ${s}`}
                                        </Button>
                                    ))}
                                </div>
                                :
                                null
                        }
                        <Button className={styles['all']} title={'Усі серії пака'} onClick={onToggleAll}>
                            <span className={classnames(styles['check'], { [styles['checked']]: allPicked })}>{allPicked ? '✓' : ''}</span>
                            <span>{`Усі серії пака · ${allItems.length}`}</span>
                        </Button>
                        <div className={styles['episodes']}>
                            {
                                current.items.map((item) => {
                                    const key = `${season}:${item.episode}`;
                                    return (
                                        <Button key={key} className={styles['episode']} title={item.title} onClick={(event) => { event.preventDefault(); setSelected((prev) => ({ ...prev, [key]: !prev[key] })); }}>
                                            <span className={classnames(styles['check'], { [styles['checked']]: !!selected[key] })}>{selected[key] ? '✓' : ''}</span>
                                            <span className={styles['episode-name']}>{`${item.episode}. ${item.title}`}</span>
                                            <span className={styles['episode-size']}>{formatSize(item.size)}</span>
                                        </Button>
                                    );
                                })
                            }
                            {
                                current.loading ?
                                    <div className={styles['note']}>Шукаю серії пака…</div>
                                    :
                                    current.items.length === 0 ?
                                        <div className={styles['note']}>У цьому сезоні серій пака немає</div>
                                        :
                                        null
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
