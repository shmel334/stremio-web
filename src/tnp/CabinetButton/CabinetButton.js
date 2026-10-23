// TnP: кнопка «Кабінет» — переход на сайт (ЛК), дальше клиент ходит его навигацией;
// назад — вкладка «Дивитись» в ЛК. Обычная ссылка: ЛК — отдельная страница сайта, не маршрут веба.

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const styles = require('./styles');

const CABINET_URL = '/dashboard.html#overview';
const ICONS_SPRITE = '/img/icons.svg?v=11';

const CabinetButton = ({ className, desktopOnly }) => (
    <a className={classnames(className, styles['cabinet-button'], { [styles['desktop-only']]: desktopOnly })} href={CABINET_URL} title={'Кабінет'} tabIndex={-1}>
        <svg className={styles['icon']} aria-hidden={'true'}>
            <use href={`${ICONS_SPRITE}#user`} />
        </svg>
        <span className={styles['label']}>Кабінет</span>
    </a>
);

CabinetButton.propTypes = {
    className: PropTypes.string,
    desktopOnly: PropTypes.bool
};

module.exports = CabinetButton;
