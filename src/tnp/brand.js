// TnP: бренд в текстах интерфейса. Словари апстрима не правим — подменяем имя при загрузке,
// поэтому новые строки апстрима получают бренд сами (web-stremio/CLAUDE.md).

const brandTranslations = (translations) => {
    return Object.fromEntries(Object.entries(translations).map(([language, strings]) => [
        language,
        Object.fromEntries(Object.entries(strings).map(([key, value]) => [
            key,
            typeof value === 'string' ? value.replace(/\bStremio\b/g, 'TnP') : value
        ]))
    ]));
};

module.exports = brandTranslations;
