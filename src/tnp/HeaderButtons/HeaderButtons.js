// TnP: кнопки справа в шапке, слева от полноэкранного режима: настройки TnP (шестерня Labs из ЛК).
// Классы кнопки и иконки берём у шапки Stremio (buttonClassName/iconClassName) — размер, прозрачность
// и отступы на телефоне совпадают с их полноэкранным режимом по построению. На телефоне Stremio прячет
// свои кнопки шапки (кроме меню, которое у нас снято), поэтому там рисуем и свой полноэкранный режим.

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { Link } = require('react-router-dom');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { Button } = require('stremio/components');
const { useFullscreen } = require('stremio/common/Fullscreen');
const styles = require('./styles');

const ICONS_SPRITE = '/img/icons.svg?v=11';

const HeaderButtons = ({ buttonClassName, iconClassName }) => {
    const [fullscreen, requestFullscreen, exitFullscreen, , supported] = useFullscreen();
    return (
        <div className={styles['header-buttons']}>
            <Link className={classnames(buttonClassName, styles['button'])} to={'/tnp'} title={'Налаштування'} tabIndex={-1}>
                <svg className={classnames(iconClassName, styles['sprite-icon'])} aria-hidden={'true'}>
                    <use href={`${ICONS_SPRITE}#settings`} />
                </svg>
            </Link>
            {
                supported ?
                    <Button className={classnames(buttonClassName, styles['button'], styles['phone-only'])} title={fullscreen ? 'Вийти з повноекранного режиму' : 'На весь екран'} tabIndex={-1} onClick={fullscreen ? exitFullscreen : requestFullscreen}>
                        <Icon className={iconClassName} name={fullscreen ? 'minimize' : 'maximize'} />
                    </Button>
                    :
                    null
            }
        </div>
    );
};

HeaderButtons.propTypes = {
    buttonClassName: PropTypes.string,
    iconClassName: PropTypes.string
};

module.exports = HeaderButtons;
