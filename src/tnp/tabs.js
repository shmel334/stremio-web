// TnP: наша вкладка в навигации. Иконка — шестерня Labs из ЛК (TnP/public/img/icons.svg#settings).
// Стоит на месте пазла «Аддоны»: на телефоне Stremio прячет последнюю вкладку (свои настройки),
// и наша остаётся видимой.

require('./hide-stremio-settings.less');

const settingsTab = { id: 'tnp', label: 'TnP', logo: require('./settings-icon.svg'), href: '/tnp' };

module.exports = { settingsTab };
