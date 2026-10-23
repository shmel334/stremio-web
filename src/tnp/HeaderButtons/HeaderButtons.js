// TnP: кнопки справа в шапке, слева от полноэкранного режима: настройки TnP (шестерня Labs из ЛК).
// На телефоне Stremio прячет в шапке все кнопки, кроме «назад» и меню профиля (а меню у нас снято),
// поэтому там рисуем и свой полноэкранный режим.

const React = require('react');
const classnames = require('classnames');
const { Link } = require('react-router-dom');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { Button } = require('stremio/components');
const { useFullscreen } = require('stremio/common/Fullscreen');
const styles = require('./styles');

const ICONS_SPRITE = '/img/icons.svg?v=11';

const HeaderButtons = () => {
    const [fullscreen, requestFullscreen, exitFullscreen, , supported] = useFullscreen();
    return (
        <div className={styles['header-buttons']}>
            <Link className={styles['button']} to={'/tnp'} title={'Налаштування'} tabIndex={-1}>
                <svg className={styles['sprite-icon']} aria-hidden={'true'}>
                    <use href={`${ICONS_SPRITE}#settings`} />
                </svg>
            </Link>
            {
                supported ?
                    <Button className={classnames(styles['button'], styles['phone-only'])} title={fullscreen ? 'Вийти з повноекранного режиму' : 'На весь екран'} tabIndex={-1} onClick={fullscreen ? exitFullscreen : requestFullscreen}>
                        <Icon className={styles['icon']} name={fullscreen ? 'minimize' : 'maximize'} />
                    </Button>
                    :
                    null
            }
        </div>
    );
};

module.exports = HeaderButtons;
