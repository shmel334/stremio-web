// TnP: «подобається / не подобається» вместо «лайк / сердце» Stremio.
// Оценка пишется к нам (POST /api/user/title-vote → TnP user_title_votes) — так мы её видим.
// Лайк дублируется в Stremio штатным действием ядра (Rate 'liked'); дизлайка в ядре нет — только у нас,
// поставленный в Stremio лайк при этом снимается. Если у нас оценки нет, а в Stremio стоит
// «лайк» или «сердце» (поставлено в приложении) — показываем лайк.

const React = require('react');
const PropTypes = require('prop-types');
const { useCore } = require('stremio/core');
// напрямую, не через stremio/components: тот сам грузит MetaPreview → сюда, и в CommonJS получился бы undefined
const { default: ActionsGroup } = require('stremio/components/ActionsGroup');
const styles = require('./styles');

const VOTE_URL = '/api/user/title-vote';

const TnpRatings = ({ ratingInfo, className }) => {
    const core = useCore();
    const content = ratingInfo && ratingInfo.type === 'Ready' ? ratingInfo.content : null;
    const metaId = content ? content.metaId : null;
    const coreStatus = content ? content.status : null;
    const [vote, setVote] = React.useState(null);
    React.useEffect(() => {
        if (typeof metaId !== 'string') {
            return;
        }
        let alive = true;
        setVote(null);
        fetch(`${VOTE_URL}?id=${encodeURIComponent(metaId)}`, { credentials: 'same-origin', cache: 'no-store' })
            .then((response) => response.ok ? response.json() : { vote: 0 })
            .catch(() => ({ vote: 0 }))
            .then((data) => {
                if (alive) {
                    setVote(data.vote ? data.vote : (coreStatus === 'liked' || coreStatus === 'loved' ? 1 : 0));
                }
            });
        return () => {
            alive = false;
        };
    }, [metaId]);
    const change = React.useCallback((next) => {
        setVote(next);
        fetch(VOTE_URL, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: metaId, vote: next })
        }).catch((error) => {
            console.error('TnP: title vote', error);
        });
        const status = next === 1 ? 'liked' : null;
        if (status !== coreStatus) {
            core.transport.dispatch({
                action: 'MetaDetails',
                args: {
                    action: 'Rate',
                    args: status,
                },
            });
        }
    }, [core, metaId, coreStatus]);
    const disabled = typeof metaId !== 'string' || vote === null;
    const items = React.useMemo(() => [
        {
            icon: vote === 1 ? 'thumbs-up' : 'thumbs-up-outline',
            label: 'Подобається',
            disabled,
            onClick: () => change(vote === 1 ? 0 : 1),
        },
        {
            icon: vote === -1 ? 'thumbs-up' : 'thumbs-up-outline',
            label: 'Не подобається',
            className: styles['dislike'],
            disabled,
            onClick: () => change(vote === -1 ? 0 : -1),
        },
    ], [vote, disabled, change]);
    return (
        <ActionsGroup items={items} className={className} />
    );
};

TnpRatings.propTypes = {
    ratingInfo: PropTypes.object,
    className: PropTypes.string
};

module.exports = TnpRatings;
