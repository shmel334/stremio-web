// TnP: наши настройки — тот же блок «Як ви дивитесь», что в ЛК (/js/view-prefs.js с сайта TnP),
// те же эндпоинты, поэтому ЛК и веб видят одно и то же. Каждое сохранение переносим в настройки
// плеера ядра (src/tnp/coreSettings.js).

const React = require('react');
const { useCore } = require('stremio/core');
const { useProfile } = require('stremio/common');
const { MainNavBars } = require('stremio/components');
const { languageSettings, applySettings } = require('stremio/tnp/coreSettings');
const styles = require('./styles');

// Та сама адреса, що в ЛК: TnP веде її на view-prefs.js?h=<хеш вмісту>, тож версію тут не пінимо (25.10:
// пін ?v=8 лишив /watch на старому файлі, коли ЛК уже показував нові блоки).
const VIEW_PREFS_SCRIPT = '/js/view-prefs.latest.js';

const TnpSettings = () => {
    const core = useCore();
    const profile = useProfile();
    const settingsRef = React.useRef(profile.settings);
    React.useEffect(() => {
        settingsRef.current = profile.settings;
    }, [profile.settings]);
    React.useEffect(() => {
        const onViewPrefs = (event) => {
            applySettings(core, settingsRef.current, languageSettings(event.detail.prefs, event.detail.ui));
        };
        window.addEventListener('tnp:viewprefs', onViewPrefs);
        if (typeof window.loadViewPrefs === 'function') {
            window.loadViewPrefs();
        } else {
            const script = document.createElement('script');
            script.src = VIEW_PREFS_SCRIPT;
            script.async = true;
            document.head.appendChild(script);
        }
        return () => {
            window.removeEventListener('tnp:viewprefs', onViewPrefs);
        };
    }, [core]);
    return (
        <MainNavBars className={styles['tnp-settings-container']} route={'tnp'}>
            <div className={styles['tnp-settings-content']}>
                <div id={'viewPrefsBox'} />
            </div>
        </MainNavBars>
    );
};

module.exports = TnpSettings;
