// TnP: место строки поиска в шапке.
// ПК — строка поиска Stremio как есть («Кабінет» стоит справа, у полноэкранного режима).
// Телефон — кнопка «Кабінет» + лупа + полноэкранный режим; лупа ведёт на поиск Stremio (#/search),
// там на месте кнопки строка поиска и крестик назад. Переключение — CSS-брейкпойнт шапки (640px),
// поэтому поворот телефона перестраивает шапку сам.

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { useNavigate } = require('react-router-dom');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { Button } = require('stremio/components');
const { useFullscreen } = require('stremio/common/Fullscreen');
const CabinetButton = require('stremio/tnp/CabinetButton');
const styles = require('./styles');

const HeaderSearch = ({ className, active, children }) => {
    const navigate = useNavigate();
    const [fullscreen, requestFullscreen, exitFullscreen, , supported] = useFullscreen();
    const openSearch = React.useCallback(() => {
        navigate('/search');
    }, [navigate]);
    const closeSearch = React.useCallback(() => {
        navigate(-1);
    }, [navigate]);
    return (
        <div className={classnames(className, styles['header-search'], { [styles['active']]: active })}>
            <div className={styles['search']}>{children}</div>
            <div className={styles['mobile-tools']}>
                {
                    active ?
                        <Button className={styles['tool']} title={'Закрити пошук'} tabIndex={-1} onClick={closeSearch}>
                            <Icon className={styles['icon']} name={'close'} />
                        </Button>
                        :
                        <React.Fragment>
                            <CabinetButton className={styles['cabinet']} />
                            <Button className={styles['tool']} title={'Пошук'} tabIndex={-1} onClick={openSearch}>
                                <Icon className={styles['icon']} name={'search'} />
                            </Button>
                        </React.Fragment>
                }
                {
                    supported ?
                        <Button className={styles['tool']} title={fullscreen ? 'Вийти з повноекранного режиму' : 'На весь екран'} tabIndex={-1} onClick={fullscreen ? exitFullscreen : requestFullscreen}>
                            <Icon className={styles['icon']} name={fullscreen ? 'minimize' : 'maximize'} />
                        </Button>
                        :
                        null
                }
            </div>
        </div>
    );
};

HeaderSearch.propTypes = {
    className: PropTypes.string,
    active: PropTypes.bool,
    children: PropTypes.node
};

module.exports = HeaderSearch;
