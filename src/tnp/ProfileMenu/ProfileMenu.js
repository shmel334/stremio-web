// TnP: меню профиля — тот же модуль, что в шапке ЛК (TnP/public/js/profile-menu.js + css), грузим его
// с сайта (тот же origin), копии нет: вид, данные и кнопки совпадают по построению.
// Отличия веба: «Налаштування» — наш экран #/tnp без перезагрузки; перед выходом веб выходит и из
// своей сессии Stremio (её создал LoginWithToken — ключ синка клиента не задевается, Ф0).

const React = require('react');
const PropTypes = require('prop-types');
const { useNavigate } = require('react-router-dom');
const { useCore } = require('stremio/core');

const SCRIPT_URL = '/js/profile-menu.js?v=2';
const STYLE_URL = '/css/profile-menu.css?v=2';

let assets = null;
const loadAssets = () => {
    if (assets) {
        return assets;
    }
    assets = new Promise((resolve) => {
        if (window.TnpProfileMenu) {
            resolve();
            return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = STYLE_URL;
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = SCRIPT_URL;
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
    });
    return assets;
};

const ProfileMenu = ({ className }) => {
    const ref = React.useRef(null);
    const navigate = useNavigate();
    const core = useCore();
    React.useEffect(() => {
        let alive = true;
        let menu = null;
        loadAssets().then(() => {
            if (!alive || !window.TnpProfileMenu || !ref.current) {
                return;
            }
            menu = window.TnpProfileMenu.mount(ref.current, {
                context: 'web',
                onSettings: () => navigate('/tnp'),
                beforeLogout: () => {
                    // автовход (TnpLogin) не должен успеть войти заново, пока идёт выход
                    window.__tnpLoggingOut = true;
                    core.transport.dispatch({ action: 'Ctx', args: { action: 'Logout' } });
                },
            });
        });
        return () => {
            alive = false;
            if (menu) {
                menu.destroy();
            }
        };
    }, [navigate, core]);
    return <div ref={ref} className={className} />;
};

ProfileMenu.propTypes = {
    className: PropTypes.string
};

module.exports = ProfileMenu;
