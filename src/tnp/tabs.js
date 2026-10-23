// TnP: вкладка «Кабінет» в навигации — знак TnP, ведёт на сайт (ЛК), дальше клиент ходит его
// навигацией, назад — вкладка «Дивитись» в ЛК. Вкладки Stremio — ссылки роутера веба, а ЛК —
// отдельная страница сайта, поэтому переход делаем сами в onClick.
// Стоит на месте пазла «Аддоны»: на телефоне Stremio прячет ПОСЛЕДНЮЮ вкладку (свои настройки,
// они к тому же скрыты hide-stremio-settings.less), и наша остаётся видимой.

require('./hide-stremio-settings.less');

const CABINET_URL = '/dashboard.html#overview';

const cabinetTab = {
    id: 'cabinet',
    label: 'Кабінет',
    logo: require('../../tnp/brand/symbol.svg'),
    href: '/',
    onClick: (event) => {
        event.preventDefault();
        window.location.assign(CABINET_URL);
    },
};

module.exports = { cabinetTab };
