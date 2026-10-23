// TnP: языки из ЛК («Як ви дивитесь» + «Інтерфейс») → настройки плеера ядра.
// Правда — у TnP (/api/user/viewing-prefs, /api/user/metadata-config); ядру только переносим.
// Настройки ядра локальные для браузера, на ТВ/телефон клиента не уходят.

const CODE3 = { uk: 'ukr', ru: 'rus', en: 'eng' };
const UI_LOCALES = ['uk-UA', 'ru-RU', 'en-US'];
// Тот же порог, что у нижней панели на телефоне (screen-sizes.less @minimum)
const PHONE_QUERY = '(max-width: 640px)';
const PHONE_INTERFACE_SCALE = 75;

const known = (codes) => (Array.isArray(codes) ? codes : []).map((code) => CODE3[code]).filter(Boolean);

// Озвучка: звук по списку, субтитры выключены (плеер включает их сам, если язык задан).
// Англійська + субтитри: звук английский, субтитры по списку.
const languageSettings = (prefs, ui) => {
    const patch = {};
    if (prefs && Array.isArray(prefs.langs)) {
        const langs = known(prefs.langs);
        if (prefs.mode === 'subs') {
            const subs = known(prefs.subLangs).length > 0 ? known(prefs.subLangs) : langs;
            patch.audioLanguage = 'eng';
            patch.secondaryAudioLanguage = langs.find((code) => code !== 'eng') || null;
            patch.subtitlesLanguage = subs[0] || null;
            patch.secondarySubtitlesLanguage = subs[1] || null;
        } else {
            patch.audioLanguage = langs[0] || null;
            patch.secondaryAudioLanguage = langs[1] || null;
            patch.subtitlesLanguage = null;
            patch.secondarySubtitlesLanguage = null;
        }
    }
    if (Array.isArray(ui) && ui.length > 0) {
        const locale = UI_LOCALES.find((code) => code.startsWith(ui[0] + '-'));
        if (locale) {
            patch.interfaceLanguage = locale;
        }
    }
    return patch;
};

const loadLanguageSettings = () => {
    const get = (url) => fetch(url, { credentials: 'same-origin', cache: 'no-store' })
        .then((response) => response.ok ? response.json() : null)
        .catch(() => null);
    return Promise.all([get('/api/user/viewing-prefs'), get('/api/user/metadata-config')])
        .then(([prefs, meta]) => {
            const ui = meta && typeof meta.language === 'string' ? [meta.language.slice(0, 2)] : null;
            return languageSettings(prefs, ui);
        });
};

const applySettings = (core, settings, patch) => {
    const changed = Object.keys(patch).some((key) => settings[key] !== patch[key]);
    if (!changed) {
        return;
    }
    core.transport.dispatch({
        action: 'Ctx',
        args: {
            action: 'UpdateSettings',
            args: { ...settings, ...patch }
        }
    });
};

const firstLoginSettings = () => {
    const patch = {};
    if (window.matchMedia && window.matchMedia(PHONE_QUERY).matches) {
        patch.interfaceScale = PHONE_INTERFACE_SCALE;
    }
    return patch;
};

// Первый вход в этом браузере: языки из ЛК и масштаб для телефона. Слушатель вешаем на ядро, а не на
// экран автовхода: экран закрывается (переход на главную) раньше, чем приходит UserAuthenticated.
const applyAfterLogin = (core) => {
    const onEvent = (name) => {
        if (name !== 'UserAuthenticated') {
            return;
        }
        core.off('event', onEvent);
        Promise.all([loadLanguageSettings().catch(() => ({})), core.transport.getState('ctx')])
            .then(([patch, ctx]) => {
                applySettings(core, ctx.profile.settings, { ...firstLoginSettings(), ...patch });
            })
            .catch((error) => {
                console.error('TnP: first login settings', error);
            });
    };
    core.on('event', onEvent);
};

module.exports = {
    languageSettings,
    loadLanguageSettings,
    applySettings,
    applyAfterLogin,
};
