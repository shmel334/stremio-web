// TnP: выключатели поведения апстрима. В чужих файлах — только импорт и условие с флагом,
// сам код апстрима не удаляем: так мерж с апстримом не конфликтует (web-stremio/CLAUDE.md).

module.exports = {
    // каталог аддонов снят: набор аддонов ведёт ЛК
    addonsCatalog: false,
    // локального стриминг-сервера у веба нет, стримы идут через ноды
    streamingServerWarning: false,
    // ссылки на сайт Stremio и Trakt в настройках (поддержка, условия, удаление аккаунта и т. п.)
    stremioAccountLinks: false,
    // «Play URL/Magnet link» и «Help & Feedback» в меню профиля
    stremioMenuExtras: false,
    // меню профиля справа сверху: в шапке остаётся только полноэкранный режим
    navMenu: false,
    // раздел Streaming настроек: связь с локальным сервером приложения Stremio (в вебе закрыт CSP)
    streamingSection: false,
};
