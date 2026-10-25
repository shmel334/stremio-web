// TnP: ошибки и зависания веб-плеера → ЛК POST /api/user/player-event → Хаб (web_player_events).
// Без этого отказ виден только в консоли браузера: нода видит, что клиент перестал ходить за сегментами,
// но не почему (25.10: «Error occurred when decoding» на 4K HEVC, причина — во вложенной ошибке hls.js).
// Подключение в Player.js: load(url) при загрузке потока, error(e) из обработчика ошибок плеера.
// Шлём: каждую ошибку (не больше MAX_EVENTS на поток) и одно «stall», если за STALL_MS после загрузки
// время так и не пошло. Ошибки отправки глотаем: телеметрия не должна мешать просмотру.

const STALL_MS = 20000;
const POLL_MS = 1000;
const MAX_EVENTS = 5;
const TRAIL_MAX = 90;
const POST = '/api/user/player-event';

let cur = null;

const safe = (fn, dflt) => {
    try {
        return fn();
    } catch (_e) {
        return dflt;
    }
};

// Хронология с загрузки потока: создание/удаление SourceBuffer (с mime), жизнь MediaSource, запросы
// плеера (только имя файла), события <video>. hls.js живёт внутри stremio-video и снаружи недоступен,
// поэтому смотрим на уровень ниже — MSE и XHR. Уходит с ошибкой в state.trail.
let trail = [];
function mark(k, d) {
    if (!cur) return;
    trail.push(d === undefined ? [Date.now() - cur.at, k] : [Date.now() - cur.at, k, String(d).slice(0, 80)]);
    if (trail.length > TRAIL_MAX) trail.shift();
}
const fileOf = (u) => safe(() => new URL(String(u), location.href).pathname.split('/').pop().slice(0, 40), '?');

safe(() => {
    const MS = window.MediaSource;
    if (MS && MS.prototype) {
        const add = MS.prototype.addSourceBuffer;
        MS.prototype.addSourceBuffer = function(mime) {
            mark('addSB', mime);
            try {
                return add.apply(this, arguments);
            } catch (err) {
                mark('addSB!', err && err.name);
                throw err;
            }
        };
        const rm = MS.prototype.removeSourceBuffer;
        MS.prototype.removeSourceBuffer = function() {
            mark('rmSB');
            return rm.apply(this, arguments);
        };
        const eos = MS.prototype.endOfStream;
        MS.prototype.endOfStream = function(reason) {
            mark('eos', reason || '');
            return eos.apply(this, arguments);
        };
    }
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        const f = fileOf(url);
        mark('xhr', f);
        if (!this.__tnpTrail) {
            this.__tnpTrail = true;
            this.addEventListener('loadend', () => mark('xhr<', f + ' ' + this.status));
        }
        return open.apply(this, arguments);
    };
    const abort = XMLHttpRequest.prototype.abort;
    XMLHttpRequest.prototype.abort = function() {
        mark('xhrAbort');
        return abort.apply(this, arguments);
    };
    // Транмуксер hls.js в воркере: команды (reset/configure/demux/flush с номером сегмента) и ответы.
    // По ним видно, обрабатывался ли сегмент дважды и сбрасывался ли транмуксер.
    const W = window.Worker;
    if (W && W.prototype) {
        const meta = (m) => {
            const c = m && (m.chunkMeta || (m.sn !== undefined ? m : null));
            return c ? ` ${c.level}:${c.sn}` : '';
        };
        const post = W.prototype.postMessage;
        W.prototype.postMessage = function(m) {
            if (m && typeof m === 'object' && m.cmd) mark('w>', m.cmd + meta(m));
            return post.apply(this, arguments);
        };
        const ael = W.prototype.addEventListener;
        W.prototype.addEventListener = function(type, fn) {
            if (type === 'message' && typeof fn === 'function') {
                ael.call(this, 'message', (e) => {
                    const d = e && e.data;
                    if (d && typeof d === 'object' && d.event && d.event !== 'workerLog') mark('w<', d.event + meta(d.data || d));
                });
            }
            return ael.apply(this, arguments);
        };
    }
    const mev = ['emptied', 'loadstart', 'loadedmetadata', 'canplay', 'playing', 'waiting', 'seeking', 'seeked', 'pause', 'error'];
    document.addEventListener('play', (e) => e.target instanceof HTMLVideoElement && mark('play'), true);
    for (const n of mev) document.addEventListener(n, (e) => {
        if (e.target instanceof HTMLVideoElement) mark(n, n === 'seeking' ? e.target.currentTime.toFixed(1) : undefined);
    }, true);
});

function videoState() {
    const v = document.querySelector('video');
    if (!v) return null;
    const q = safe(() => v.getVideoPlaybackQuality(), null);
    return {
        rs: v.readyState,
        ns: v.networkState,
        paused: v.paused,
        t: +v.currentTime.toFixed(2),
        dur: isFinite(v.duration) ? +v.duration.toFixed(1) : null,
        buf: safe(() => [...Array(Math.min(v.buffered.length, 5))].map((_, i) => [+v.buffered.start(i).toFixed(2), +v.buffered.end(i).toFixed(2)]), []),
        w: v.videoWidth,
        h: v.videoHeight,
        frames: q ? q.totalVideoFrames : null,
        dropped: q ? q.droppedVideoFrames : null,
        err: v.error ? { code: v.error.code, message: v.error.message || '' } : null,
        vis: document.visibilityState,
    };
}

// Вложенная ошибка: данные события ERROR hls.js или MediaError видео-элемента.
function inner(e) {
    if (!e || typeof e !== 'object') return null;
    const out = {};
    for (const k of ['type', 'details', 'fatal', 'reason', 'mimeType', 'parent', 'sourceBufferName', 'code', 'message']) {
        if (e[k] !== undefined && e[k] !== null && typeof e[k] !== 'object') out[k] = String(e[k]).slice(0, 300);
    }
    if (e.error) out.error = String(e.error.message || e.error).slice(0, 500);
    if (e.err) out.err = String(e.err.message || e.err).slice(0, 500);
    if (e.frag) out.frag = { sn: e.frag.sn, type: e.frag.type, start: e.frag.start, duration: e.frag.duration, level: e.frag.level };
    if (e.response) out.response = { code: e.response.code, text: String(e.response.text || '').slice(0, 200) };
    if (e.buffer !== undefined) out.buffer = e.buffer;
    return out;
}

function send(kind, extra) {
    if (!cur || cur.n >= MAX_EVENTS) return;
    cur.n++;
    const body = Object.assign({
        v: 1,
        kind,
        url: cur.url,
        since_load_ms: Date.now() - cur.at,
        state: Object.assign(safe(videoState, null) || {}, { trail: trail.slice() }),
        at: Date.now(),
    }, extra);
    safe(() => fetch(POST, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
    }).catch(() => null));
}

function stop() {
    if (cur && cur.timer) clearInterval(cur.timer);
    if (cur) cur.timer = null;
}

function load(url) {
    stop();
    cur = null;
    if (typeof url !== 'string' || !url) return;
    cur = { url: url.slice(0, 2000), at: Date.now(), n: 0, t0: null, started: false, errored: false, timer: null };
    trail = [];
    cur.timer = setInterval(() => {
        if (!cur) return;
        const v = document.querySelector('video');
        const t = v ? v.currentTime : 0;
        if (cur.t0 === null) cur.t0 = t;
        if (t > cur.t0 + 1) {
            cur.started = true;
            stop();
            return;
        }
        // на паузе или во вкладке в фоне время не идёт не по нашей вине
        if (cur.errored || (v && v.paused && v.readyState >= 3) || document.visibilityState !== 'visible') return;
        if (Date.now() - cur.at > STALL_MS) {
            send('stall', {});
            stop();
        }
    }, POLL_MS);
}

function error(e) {
    if (!cur) return;
    if (e && e.critical) {
        cur.errored = true;
        stop();
    }
    send('error', {
        started: cur.started,
        code: e ? e.code : null,
        message: e && e.message ? String(e.message).slice(0, 300) : null,
        critical: !!(e && e.critical),
        inner: inner(e && e.error),
    });
}

module.exports = { load, error };
