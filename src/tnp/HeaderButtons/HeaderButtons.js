// TnP: справа в шапке, слева от полноэкранного режима: меню профиля сайта (имя/план, аватар; внутри —
// Налаштування · Трафік · Головна · Вийти), общее с ЛК — src/tnp/ProfileMenu.
// Классы кнопки и иконки берём у шапки Stremio (buttonClassName/iconClassName) — размер, прозрачность
// и отступы на телефоне совпадают с их полноэкранным режимом по построению. На телефоне Stremio прячет
// свои кнопки шапки (кроме меню, которое у нас снято), поэтому там рисуем и свой полноэкранный режим.

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const ProfileMenu = require('stremio/tnp/ProfileMenu');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { Button } = require('stremio/components');
const { useFullscreen } = require('stremio/common/Fullscreen');
const styles = require('./styles');

const HeaderButtons = ({ buttonClassName, iconClassName }) => {
    const [fullscreen, requestFullscreen, exitFullscreen, , supported] = useFullscreen();
    return (
        <div className={styles['header-buttons']}>
            <ProfileMenu className={styles['profile']} />
            {
                supported ?
                    <Button className={classnames(buttonClassName, styles['button'], styles['phone-only'])} title={fullscreen ? 'Вийти з повноекранного режиму' : 'На весь екран'} tabIndex={-1} onClick={fullscreen ? exitFullscreen : requestFullscreen}>
                        <Icon className={classnames(iconClassName, styles['fullscreen-icon'])} name={fullscreen ? 'minimize' : 'maximize'} />
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
