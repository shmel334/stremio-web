// TnP: бренд и свои названия в текстах интерфейса. Словари апстрима не правим — подменяем при загрузке,
// поэтому новые строки апстрима получают бренд сами (web-stremio/CLAUDE.md).

// Свои названия поверх словаря (решения оператора)
const OVERRIDES = {
    'uk-UA': { Discover: 'Каталоги', STREMIO_TV_NAV_DISCOVER: 'Каталоги' },
    'ru-RU': { Discover: 'Каталоги' },
    'en-US': { Discover: 'Catalogs' },
};

const brandTranslations = (translations) => {
    return Object.fromEntries(Object.entries(translations).map(([language, strings]) => [
        language,
        Object.fromEntries(Object.entries(strings).map(([key, value]) => [
            key,
            OVERRIDES[language] && typeof OVERRIDES[language][key] === 'string' ?
                OVERRIDES[language][key]
                :
                typeof value === 'string' ? value.replace(/\bStremio\b/g, 'TnP') : value
        ]))
    ]));
};

module.exports = brandTranslations;
