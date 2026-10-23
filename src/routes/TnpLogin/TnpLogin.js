// TnP: автовход вместо экрана входа Stremio (TnP/docs/web-player.md).
// Ключ сессии Stremio клиента отдаёт TnP по куке своей сессии; ядро входит штатным
// LoginWithToken и получает отдельную сессию веба, поэтому выход из веба синк не трогает.

const React = require('react');
const { useNavigate } = require('react-router-dom');
const { useCore } = require('stremio/core');
const { applyAfterLogin } = require('stremio/tnp/coreSettings');
const { Button, Image } = require('stremio/components');
const styles = require('./styles');

const SESSION_URL = '/api/user/stremio-web-session';
const LOGIN_URL = '/login.html';
const DASHBOARD_URL = '/dashboard.html';

const MESSAGES = {
    loading: 'Входимо у ваш акаунт…',
    no_email: 'Щоб дивитись тут, додайте email у кабінеті.',
    auth: 'Не вдалося увійти в акаунт Stremio. Перепривʼяжіть його в кабінеті.',
    default: 'Не вдалося увійти. Спробуйте ще раз.',
};

const TnpLogin = () => {
    const core = useCore();
    const navigate = useNavigate();
    const [state, setState] = React.useState({ status: 'loading', code: null });
    const login = React.useCallback(() => {
        // идёт выход из меню профиля — не входить заново
        if (window.__tnpLoggingOut) {
            return;
        }
        setState({ status: 'loading', code: null });
        fetch(SESSION_URL, { credentials: 'same-origin', cache: 'no-store' })
            .then((response) => {
                if (response.status === 401) {
                    window.location.href = LOGIN_URL;
                    return;
                }
                return response.json()
                    .catch(() => null)
                    .then((data) => {
                        if (!response.ok || !data || typeof data.authKey !== 'string') {
                            setState({ status: 'error', code: data && data.error ? data.error : null });
                            return;
                        }
                        applyAfterLogin(core);
                        core.transport.dispatch({
                            action: 'Ctx',
                            args: {
                                action: 'Authenticate',
                                args: {
                                    type: 'LoginWithToken',
                                    token: data.authKey
                                }
                            }
                        });
                    });
            })
            .catch(() => {
                setState({ status: 'error', code: null });
            });
    }, [core]);
    React.useEffect(() => {
        login();
    }, [login]);
    React.useEffect(() => {
        const onCoreEvent = (name) => {
            if (name === 'UserAuthenticated') {
                navigate('/', { replace: true });
            }
        };
        const onCoreError = (source) => {
            if (source.event === 'UserAuthenticated') {
                setState({ status: 'error', code: 'auth' });
            }
        };
        core.on('event', onCoreEvent);
        core.on('error', onCoreError);
        return () => {
            core.off('event', onCoreEvent);
            core.off('error', onCoreError);
        };
    }, [core, navigate]);
    const message = state.status === 'loading' ?
        MESSAGES.loading
        :
        MESSAGES[state.code] || MESSAGES.default;
    return (
        <div className={styles['tnp-login-container']}>
            <Image className={styles['logo']} src={require('/assets/images/logo.png')} alt={' '} />
            <div className={styles['message']}>{message}</div>
            {
                state.status === 'error' ?
                    <div className={styles['actions']}>
                        <Button className={styles['action']} title={'Спробувати ще'} onClick={login}>Спробувати ще</Button>
                        <Button className={styles['action']} title={'До кабінету'} href={DASHBOARD_URL}>До кабінету</Button>
                    </div>
                    :
                    null
            }
        </div>
    );
};

module.exports = TnpLogin;
