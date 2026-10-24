// TnP: кнопка «все файлы» в ряду действий тайтла (оператор 25.10) — иконка скачивания размером с соседние.
// Нажатие переключает режим выдачи (filesMode.js): список стримов на странице показывает от нашего аддона
// все файлы без подстройки под устройство и без фильтра по каналу. Повторное нажатие возвращает обычную выдачу.

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { useFilesMode, toggle } = require('./filesMode');
const styles = require('./styles');

const TnpFiles = ({ className }) => {
    // лениво: ActionButton тянет stremio/components → MetaPreview → сюда (круговой require в CommonJS)
    const ActionButton = require('stremio/components/MetaPreview/ActionButton');
    const active = useFilesMode();
    const onClick = React.useCallback((event) => {
        event.preventDefault();
        toggle();
    }, []);
    const label = active ? 'Звичайна видача' : 'Усі файли: без фільтрів, для скачування';
    return (
        <ActionButton
            className={classnames(className, styles['files-button'], { [styles['active']]: active })}
            icon={'download'}
            label={label}
            tooltip={true}
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

module.exports = TnpFiles;
module.exports.FilesModeBar = FilesModeBar;
module.exports.useFilesStreams = require('./filesMode').useFilesStreams;
