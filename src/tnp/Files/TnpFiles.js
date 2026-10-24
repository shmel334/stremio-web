// TnP: кнопка «Скачати» в ряду действий тайтла (оператор 25.10) — иконка скачивания, высота как у соседних.
// Нажатие переключает режим выдачи (filesMode.js): список стримов на странице показывает от нашего аддона
// все файлы без подстройки под устройство и без фильтра по каналу. Повторное нажатие возвращает обычную выдачу.
// В режиме у каждого файла слева две кнопки без зажатия: «Скачати» (пак — серии под строкой) и «Відкрити з…».

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { useFilesMode, toggle } = require('./filesMode');
const OpenWith = require('./openWith');
const styles = require('./styles');

const TnpFiles = ({ className }) => {
    // лениво: ActionButton тянет stremio/components → MetaPreview → сюда (круговой require в CommonJS)
    const ActionButton = require('stremio/components/MetaPreview/ActionButton');
    const active = useFilesMode();
    const onClick = React.useCallback((event) => {
        event.preventDefault();
        toggle();
    }, []);
    return (
        <ActionButton
            className={classnames(className, styles['files-button'], { [styles['active']]: active })}
            icon={'download'}
            label={'Скачати'}
            title={active ? 'Повернути звичайну видачу' : 'Усі файли без фільтрів: скачати або відкрити у своєму плеєрі'}
            variant={'wide'}
            tabIndex={0}
            onClick={onClick}
        />
    );
};

TnpFiles.propTypes = { className: PropTypes.string };

// полоска над списком стримов, пока режим включён: что показано и как вернуться
const FilesModeBar = () => {
    const active = useFilesMode();
    if (!active) return null;
    return (
        <div className={styles['files-bar']}>
            <div className={styles['files-bar-label']}>Усі файли TnP · без фільтрів за пристроєм і швидкістю</div>
            <button className={styles['files-bar-off']} type={'button'} onClick={toggle}>Звичайна видача</button>
        </div>
    );
};

const noop = () => undefined;

// строка файла в режиме: слева «Скачати» и «Відкрити з…», справа описание со ссылкой на плеер веба.
// Кнопки — вне ссылки строки, поэтому их нажатие не запускает плеер.
const FileRow = ({ stream, videoId }) => {
    // лениво: оба модуля тянут stremio/components / stremio/common (кольцо при загрузке модуля)
    const { default: Button } = require('stremio/components/Button');
    const StreamDownload = require('stremio/tnp/StreamDownload');
    const { useToast, usePlatform, useProfile } = require('stremio/common');
    const streamStyles = require('stremio/routes/MetaDetails/StreamsList/Stream/styles');
    const toast = useToast();
    const platform = usePlatform();
    const profile = useProfile();
    const [chooser, setChooser] = React.useState(false);

    const openWith = React.useCallback((event) => {
        event.preventDefault();
        const configured = OpenWith.configuredLink(stream.url, platform.name, profile.settings.playerType);
        if (configured) return OpenWith.go(configured);
        if (platform.name === 'android') return OpenWith.go(OpenWith.intentLink(stream.url));
        if (OpenWith.isIos(platform.name)) return setChooser((open) => !open);
        // ПК: .m3u откроет плеер по умолчанию в системе; ссылка ещё и в буфере — на случай, если плеера нет
        OpenWith.downloadM3u(stream.url, stream.behaviorHints && stream.behaviorHints.filename);
        const done = () => toast.show({ type: 'success', title: 'Відкрийте playlist.m3u — запуститься ваш плеєр за замовчуванням. Посилання також скопійовано', timeout: 7000 });
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(stream.url).then(done).catch(done);
        else done();
    }, [stream.url, stream.behaviorHints, platform.name, profile.settings.playerType, toast]);

    return (
        <div className={styles['file-row']}>
            <StreamDownload
                stream={stream}
                videoId={videoId}
                optionClassName={classnames(styles['file-action'], styles['file-download'])}
                iconClassName={styles['file-action-icon']}
                labelClassName={styles['file-action-label']}
                closeMenu={noop}
            />
            <Button className={classnames(styles['file-action'], styles['file-open'])} title={'Відкрити за допомогою іншого плеєра'} onClick={openWith}>
                <Icon className={styles['file-action-icon']} name={'play'} />
                <div className={styles['file-action-label']}>Відкрити з…</div>
            </Button>
            {
                chooser ?
                    <div className={styles['players']}>
                        {OpenWith.IOS_PLAYERS.map((player) => (
                            <Button key={player.value} className={styles['player']} title={player.label} onClick={(event) => { event.preventDefault(); OpenWith.go(player.link(stream.url)); }}>
                                {player.label}
                            </Button>
                        ))}
                    </div>
                    :
                    null
            }
            <Button className={classnames(streamStyles['stream-container'], styles['file-link'])} title={stream.description} href={stream.deepLinks.player} onClick={stream.onClick}>
                <div className={streamStyles['description-container']}>{stream.description}</div>
                <Icon className={streamStyles['icon']} name={'play'} />
            </Button>
        </div>
    );
};

FileRow.propTypes = { stream: PropTypes.object, videoId: PropTypes.string };

// обёртка над строкой стрима Stremio: файл режима (tnpFile) — своя строка, остальное — их Stream как есть
const withFileRow = (Stream) => {
    const StreamOrFile = (props) => props.tnpStream && props.tnpStream.tnpFile ?
        <FileRow stream={props.tnpStream} videoId={props.videoId} />
        :
        <Stream {...props} />;
    StreamOrFile.propTypes = { tnpStream: PropTypes.object, videoId: PropTypes.string };
    StreamOrFile.Placeholder = Stream.Placeholder;
    return StreamOrFile;
};

module.exports = TnpFiles;
module.exports.withFileRow = withFileRow;
module.exports.FilesModeBar = FilesModeBar;
module.exports.useFilesStreams = require('./filesMode').useFilesStreams;
