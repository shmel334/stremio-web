// TnP: «Файли» в ряду действий тайтла (оператор 25.10) — все файлы фильма / выбранной серии в режиме «тул»:
// наш аддон отдаёт список с ?purpose=files — без подстройки под устройство и без фильтра по каналу.
// У каждого файла: «Скачати» (тот же компонент, что в меню стрима: одиночный файл качается сразу, у пака
// раскрываются серии) и «Відкрити за допомогою» — ссылка Хаба во внешний плеер (Android — выбор приложения,
// на ПК ссылка копируется для VLC/mpv). Что отдать плееру, Хаб решает на клике по UA плеера.

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { useCore } = require('stremio/core');
// напрямую, не через stremio/components: тот сам грузит MetaPreview → сюда (круговой require в CommonJS)
const { default: Button } = require('stremio/components/Button');
const ReactDOM = require('react-dom');
const { default: Icon } = require('@stremio/stremio-icons/react');
const styles = require('./styles');

const FILES_PURPOSE = 'purpose=files';
const isAndroid = () => /Android/i.test(navigator.userAgent);

const formatSize = (bytes) => {
    if (!bytes) return '';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(2)} ГБ` : `${Math.max(1, Math.round(bytes / (1024 * 1024)))} МБ`;
};

// плёнка с треугольником «play»: не загрузка и не плеер — «файлы, которые можно смотреть»
const FilesIcon = ({ className }) => (
    <svg className={className} viewBox={'0 0 24 24'} fill={'none'} stroke={'currentColor'} strokeWidth={'1.8'} strokeLinecap={'round'} strokeLinejoin={'round'} aria-hidden={'true'}>
        <rect x={'3'} y={'3'} width={'18'} height={'18'} rx={'2.5'} />
        <path d={'M7 3v18M17 3v18M3 7.5h4M3 12h4M3 16.5h4M17 7.5h4M17 12h4M17 16.5h4'} />
        <path d={'M10.5 9.2v5.6l4.4-2.8z'} fill={'currentColor'} stroke={'none'} />
    </svg>
);
FilesIcon.propTypes = { className: PropTypes.string };

// наш аддон выдачи среди источников страницы
const ownAddon = (streams) => (Array.isArray(streams) ? streams : [])
    .map((s) => s && s.addon)
    .find((a) => a && typeof a.transportUrl === 'string' && (/stream\.tnp/.test(a.transportUrl) || /TnP/i.test((a.manifest && a.manifest.name) || ''))) || null;

const TnpFiles = ({ className }) => {
    const core = useCore();
    const [open, setOpen] = React.useState(false);
    const [state, setState] = React.useState({ loading: false, error: null, items: [], videoId: null });

    const load = React.useCallback(() => {
        setState({ loading: true, error: null, items: [], videoId: null });
        core.transport.getState('meta_details').then((md) => {
            const path = md && md.selected ? md.selected.streamPath : null;
            if (!path) {
                setState({ loading: false, error: 'Оберіть серію — список файлів показується для фільму або серії.', items: [], videoId: null });
                return;
            }
            const addon = ownAddon(md.streams);
            if (!addon) {
                setState({ loading: false, error: 'Аддон TnP не знайдено.', items: [], videoId: path.id });
                return;
            }
            const base = addon.transportUrl.replace(/\/manifest\.json.*$/, '');
            return fetch(`${base}/stream/${encodeURIComponent(path.type)}/${encodeURIComponent(path.id)}.json?${FILES_PURPOSE}`)
                .then((response) => response.ok ? response.json() : { streams: [] })
                .then((data) => {
                    const items = (Array.isArray(data.streams) ? data.streams : [])
                        .filter((s) => s && typeof s.url === 'string')
                        .map((s) => ({ ...s, transportUrl: addon.transportUrl }));
                    setState({ loading: false, error: items.length ? null : 'Файлів немає.', items, videoId: path.id });
                });
        }).catch(() => setState({ loading: false, error: 'Не вдалося отримати список файлів.', items: [], videoId: null }));
    }, [core]);

    const onOpen = React.useCallback((event) => {
        event.preventDefault();
        setOpen(true);
        load();
    }, [load]);
    const onClose = React.useCallback(() => setOpen(false), []);
    React.useEffect(() => {
        if (!open) return;
        const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    return (
        <React.Fragment>
            <Button className={classnames(className, styles['files-button'])} title={'Усі файли: скачати або відкрити у своєму плеєрі'} tabIndex={0} onClick={onOpen}>
                <FilesIcon className={styles['files-icon']} />
                <div className={styles['files-label']}>Файли</div>
            </Button>
            {
                open ?
                    // своё окно поверх всей страницы: контейнер окон Stremio на странице тайтла — левая колонка
                    ReactDOM.createPortal(
                        <div className={styles['files-overlay']} onClick={onClose}>
                            <div className={styles['files-modal']} onClick={(event) => event.stopPropagation()}>
                                <div className={styles['files-header']}>
                                    <div className={styles['files-title']}>Файли</div>
                                    <Button className={styles['files-close']} title={'Закрити'} onClick={(event) => { event.preventDefault(); onClose(); }}>
                                        <Icon className={styles['files-close-icon']} name={'close'} />
                                    </Button>
                                </div>
                                <FilesList state={state} onClose={onClose} />
                            </div>
                        </div>,
                        document.body
                    )
                    :
                    null
            }
        </React.Fragment>
    );
};

TnpFiles.propTypes = { className: PropTypes.string };

const FilesList = ({ state, onClose }) => {
    // лениво: StreamDownload и тосты тянут stremio/common → stremio/components → MetaPreview (кольцо при загрузке модуля)
    const StreamDownload = require('stremio/tnp/StreamDownload');
    const { useToast } = require('stremio/common');
    const toast = useToast();

    const openWith = React.useCallback((url) => {
        if (isAndroid()) {
            const u = new URL(url);
            window.location.href = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};type=video/*;end`;
            return;
        }
        const done = () => toast.show({ type: 'success', title: 'Посилання скопійовано — відкрийте його у VLC або mpv («Відкрити URL»)', timeout: 6000 });
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done).catch(() => window.prompt('Посилання для плеєра', url));
        } else {
            window.prompt('Посилання для плеєра', url);
        }
    }, [toast]);

    if (state.loading) return <div className={styles['note']}>Завантажую список файлів…</div>;
    if (state.error) return <div className={styles['note']}>{state.error}</div>;
    return (
        <div className={styles['files-list']}>
            <div className={styles['note']}>{`${state.items.length} файлів · без обмежень за пристроєм і швидкістю`}</div>
            {
                state.items.map((s, index) => (
                    <div key={`${index}:${s.url}`} className={styles['file']}>
                        <div className={styles['file-info']}>
                            <div className={styles['file-name']}>{s.name}</div>
                            <div className={styles['file-description']}>{s.description || s.title || ''}</div>
                            {s.behaviorHints && s.behaviorHints.videoSize ? <div className={styles['file-size']}>{formatSize(s.behaviorHints.videoSize)}</div> : null}
                        </div>
                        <div className={styles['file-actions']}>
                            <StreamDownload
                                stream={s}
                                videoId={state.videoId}
                                optionClassName={styles['file-action']}
                                iconClassName={styles['file-action-icon']}
                                labelClassName={styles['file-action-label']}
                                closeMenu={onClose}
                            />
                            <Button className={styles['file-action']} title={'Відкрити за допомогою'} onClick={(event) => { event.preventDefault(); openWith(s.url); }}>
                                <FilesIcon className={styles['file-action-icon']} />
                                <div className={styles['file-action-label']}>Відкрити за допомогою</div>
                            </Button>
                        </div>
                    </div>
                ))
            }
        </div>
    );
};

FilesList.propTypes = { state: PropTypes.object, onClose: PropTypes.func };

module.exports = TnpFiles;
