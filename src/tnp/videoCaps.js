// TnP: проба видео браузера — что он РЕАЛЬНО играет, а не что о себе говорит.
// Стенд 24–25.10 показал, что ответам API верить нельзя: Firefox на HEVC отвечает «да» в isTypeSupported,
// decodingInfo и canPlayType, а играть отказывается; Edge на той же машине, где Chrome играет HEVC, не играет.
// Поэтому решает проигрывание микроролика (init + один фрагмент, нарезанный как на ноде), а ответы API
// пишутся рядом как «заявлено». «_mid» — старт со второго сегмента без предыдущего: ровно случай E5
// (открытый GOP ломает старт с середины в Samsung Internet 30 на H.264).
// Проба идёт один раз на отпечаток (браузер + видеокарта + экран), только на видимой вкладке и не во время
// просмотра; результат уходит в ЛК (POST /api/user/video-caps), а оттуда на Хаб — к device_id этого браузера.
// Ролики — tnp/probe-media (собираются make-probe-media.sh стенда), копируются в сборку как tnp-probe/.

const PROBE_VERSION = 1;
const STORE_KEY = 'tnp.videoCaps';
const RECHECK_MS = 30 * 24 * 3600 * 1000;
const CASE_TIMEOUT_MS = 6000;

const CASES = [
    { id: 'h264_closed_mid', file: 'h264_closed_mid.mp4', codec: 'avc1.64001e' },
    { id: 'h264_open_mid', file: 'h264_open_mid.mp4', codec: 'avc1.64001e' },
    { id: 'hevc8_1080', file: 'hevc8_1080.mp4', codec: 'hvc1.1.6.L120.90' },
    { id: 'hevc10_pq_2160', file: 'hevc10_pq_2160.mp4', codec: 'hvc1.2.4.L150.90' },
    { id: 'hevc_open_mid', file: 'hevc_open_mid.mp4', codec: 'hvc1.2.4.L93.90' },
    { id: 'av1_10_pq', file: 'av1_10_pq.mp4', codec: 'av01.0.08M.10' },
    { id: 'mkv_h264', file: 'h264.mkv', direct: true },
    { id: 'mkv_hevc', file: 'hevc.mkv', direct: true },
];

const DECLARED_VIDEO = {
    h264: 'avc1.640028', hevc8: 'hvc1.1.6.L120.90', hevc10: 'hvc1.2.4.L153.90', av1_10: 'av01.0.13M.10',
    dv8: 'dvh1.08.06', dv5: 'dvh1.05.06', vp9_10: 'vp09.02.10.10.01.09.16.09.01',
};
const DECLARED_AUDIO = {
    aac: 'mp4a.40.2', ac3: 'ac-3', eac3: 'ec-3', opus: 'opus', flac: 'flac', dts: 'dtsc', truehd: 'mlpa',
};

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const safe = (fn, fallback) => {
    try {
        return fn();
    } catch (_e) {
        return fallback;
    }
};

const gpu = () => safe(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? {
        vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),
        renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),
    } : null;
}, null);

const mq = (q) => safe(() => window.matchMedia(q).matches, null);

async function collectClient() {
    const nav = window.navigator;
    let uaData = null;
    if (nav.userAgentData) {
        uaData = { brands: nav.userAgentData.brands, mobile: nav.userAgentData.mobile, platform: nav.userAgentData.platform };
        const high = safe(() => nav.userAgentData.getHighEntropyValues(['fullVersionList', 'platformVersion', 'model']), null);
        if (high) {
            Object.assign(uaData, await high.catch(() => ({})));
        }
    }
    let audioChannels = null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
        const ctx = safe(() => new AC(), null);
        if (ctx) {
            audioChannels = ctx.destination.maxChannelCount;
            safe(() => ctx.close());
        }
    }
    return {
        ua: nav.userAgent,
        uaData,
        gpu: gpu(),
        screen: { w: window.screen.width, h: window.screen.height, dpr: window.devicePixelRatio },
        display: {
            hdr: mq('(dynamic-range: high)'),
            videoHdr: mq('(video-dynamic-range: high)'),
            p3: mq('(color-gamut: p3)'),
            rec2020: mq('(color-gamut: rec2020)'),
        },
        audioChannels,
        audioTracksApi: typeof HTMLMediaElement !== 'undefined' && 'audioTracks' in HTMLMediaElement.prototype,
    };
}

function fingerprint(client) {
    const g = client.gpu || {};
    return [client.ua, g.vendor, g.renderer, client.screen.w, client.screen.h, client.screen.dpr, client.display.hdr].join('|');
}

async function collectDeclared() {
    const MS = window.MediaSource || window.ManagedMediaSource;
    const its = (mime) => safe(() => (MS ? MS.isTypeSupported(mime) : null), null);
    const probe = document.createElement('video');
    const out = { mse: {}, audio: {}, canPlay: {}, decodingInfo: {} };
    Object.keys(DECLARED_VIDEO).forEach((k) => {
        out.mse[k] = its(`video/mp4; codecs="${DECLARED_VIDEO[k]}"`);
    });
    Object.keys(DECLARED_AUDIO).forEach((k) => {
        out.audio[k] = its(`audio/mp4; codecs="${DECLARED_AUDIO[k]}"`);
    });
    out.canPlay.hlsNative = probe.canPlayType('application/vnd.apple.mpegurl');
    out.canPlay.mkvHevc = probe.canPlayType('video/x-matroska; codecs="hvc1.1.6.L120.90"');
    out.canPlay.mkv = probe.canPlayType('video/x-matroska');
    const mc = window.navigator.mediaCapabilities;
    if (mc && mc.decodingInfo) {
        const conf = (codec, w, h, extra) => ({
            type: 'media-source',
            video: Object.assign({ contentType: `video/mp4; codecs="${codec}"`, width: w, height: h, bitrate: 20e6, framerate: 24 }, extra),
        });
        const pq = { transferFunction: 'pq', colorGamut: 'rec2020' };
        const configs = {
            hevc10_2160_pq: conf(DECLARED_VIDEO.hevc10, 3840, 2160, pq),
            av1_10_2160_pq: conf(DECLARED_VIDEO.av1_10, 3840, 2160, pq),
            hevc10_2160_hdr10plus: conf(DECLARED_VIDEO.hevc10, 3840, 2160, Object.assign({ hdrMetadataType: 'smpteSt2094-40' }, pq)),
        };
        for (const k of Object.keys(configs)) {
            out.decodingInfo[k] = await mc.decodingInfo(configs[k])
                .then((r) => ({ supported: r.supported, smooth: r.smooth, powerEfficient: r.powerEfficient }))
                .catch(() => null);
        }
    }
    return out;
}

function videoElement() {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.setAttribute('aria-hidden', 'true');
    // видимый для движка (иначе часть браузеров не декодирует), невидимый для глаза
    v.style.cssText = 'position:fixed;right:0;bottom:0;width:16px;height:9px;opacity:0.01;pointer-events:none;z-index:2147483647';
    document.body.appendChild(v);
    return v;
}

const decodedFrames = (v) => safe(() => (v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality().totalVideoFrames : v.webkitDecodedFrameCount), null);

function frameColor(v) {
    if (typeof VideoFrame === 'undefined') {
        return null;
    }
    return safe(() => {
        const f = new VideoFrame(v);
        const cs = f.colorSpace;
        const r = { primaries: cs.primaries, transfer: cs.transfer, matrix: cs.matrix };
        f.close();
        return r;
    }, null);
}

// Успех = время ушло вперёд И вырос счётчик декодированных кадров (одно без другого бывает при отказе декодера).
function runCase(base, c) {
    return new Promise((resolve) => {
        const t0 = Date.now();
        const v = videoElement();
        let url = null;
        let start = 0;
        let bufStart = null;
        let done = false;
        let timer = null;
        let guard = null;
        const finish = (res) => {
            if (done) {
                return;
            }
            done = true;
            clearInterval(timer);
            clearTimeout(guard);
            if (res.ok) {
                res.color = frameColor(v);
            }
            res.ms = Date.now() - t0;
            if (bufStart !== null) {
                res.buf = [Number(bufStart.toFixed(3)), start];
            }
            safe(() => v.pause());
            v.removeAttribute('src');
            safe(() => v.load());
            if (url) {
                URL.revokeObjectURL(url);
            }
            v.remove();
            resolve(res);
        };
        // страховка на случай, когда до watch() не доходим (sourceopen / updateend не пришли)
        guard = setTimeout(() => finish({ ok: false, why: 'stuck-before-play' }), CASE_TIMEOUT_MS + 2000);
        const watch = () => {
            v.addEventListener('error', () => finish({ ok: false, why: `error ${v.error ? v.error.code + ' ' + (v.error.message || '') : ''}`.trim() }));
            timer = setInterval(() => {
                const frames = decodedFrames(v);
                if (v.currentTime > start + 0.2 && (frames === null || frames > 0)) {
                    finish({ ok: true, frames });
                } else if (Date.now() - t0 > CASE_TIMEOUT_MS) {
                    finish({ ok: false, why: `timeout t=${v.currentTime.toFixed(2)} rs=${v.readyState} frames=${frames}` });
                }
            }, 100);
            v.play().catch((e) => {
                if (e && e.name !== 'AbortError') {
                    finish({ ok: false, why: `play ${e.name}` });
                }
            });
        };
        if (c.direct) {
            v.src = base + c.file;
            watch();
            return;
        }
        const MS = window.MediaSource || window.ManagedMediaSource;
        if (!MS) {
            finish({ ok: false, why: 'no-mse' });
            return;
        }
        const ms = new MS();
        url = URL.createObjectURL(ms);
        v.disableRemotePlayback = true;
        v.src = url;
        ms.addEventListener('sourceopen', () => {
            fetch(base + c.file, { cache: 'force-cache' })
                .then((r) => {
                    if (!r.ok) {
                        throw new Error(`http ${r.status}`);
                    }
                    return r.arrayBuffer();
                })
                .then((buf) => {
                    let sb;
                    try {
                        sb = ms.addSourceBuffer(`video/mp4; codecs="${c.codec}"`);
                    } catch (e) {
                        finish({ ok: false, why: `addSourceBuffer ${e.name}` });
                        return;
                    }
                    sb.addEventListener('error', () => finish({ ok: false, why: 'sourcebuffer-error' }));
                    sb.addEventListener('updateend', () => {
                        if (done) {
                            return;
                        }
                        if (!sb.buffered.length) {
                            finish({ ok: false, why: 'nothing-buffered' });
                            return;
                        }
                        // время — на номинальное начало сегмента, как ставит плеер по плейлисту (сетка роликов —
                        // целые секунды), а не на начало буфера: при открытом GOP браузер выбрасывает ведущие кадры,
                        // буфер начинается позже границы, и именно на этой дыре стоит Samsung Internet (стенд 25.10)
                        bufStart = sb.buffered.start(0);
                        start = Math.round(bufStart);
                        safe(() => ms.endOfStream());
                        v.currentTime = start;
                        watch();
                    }, { once: true });
                    sb.appendBuffer(buf);
                })
                .catch((e) => finish({ ok: false, why: `fetch ${e.message}` }));
        }, { once: true });
    });
}

// Перевод в словарь матрицы (device-capability.json). «unknown» — проба не различила (провалился контрольный).
function derive(t) {
    const yn = (r) => (r ? (r.ok ? 'yes' : 'no') : 'unknown');
    const control = t.h264_closed_mid && t.h264_closed_mid.ok;
    const e5 = (open) => (!control || !t[open] ? 'unknown' : t[open].ok ? 'ok' : 'fail');
    return {
        video: { h264: yn(t.h264_closed_mid), hevc: yn(t.hevc8_1080), hevc10: yn(t.hevc10_pq_2160), hdr10: yn(t.hevc10_pq_2160), av1: yn(t.av1_10_pq) },
        video_2160: { hevc10: yn(t.hevc10_pq_2160) },
        container: { mkv_h264: yn(t.mkv_h264), mkv_hevc: yn(t.mkv_hevc) },
        e5_h264_open_gop: e5('h264_open_mid'),
        e5_hevc_open_gop: t.hevc8_1080 && t.hevc8_1080.ok ? e5('hevc_open_mid') : 'unknown',
    };
}

let running = false;

// opts: base — откуда ролики; post — куда слать (null — не слать); force — без проверки отпечатка.
async function run(opts) {
    const o = Object.assign({ base: 'tnp-probe/', post: '/api/user/video-caps', force: false }, opts);
    if (running) {
        return null;
    }
    running = true;
    try {
        const client = await collectClient();
        const fp = fingerprint(client);
        const prev = safe(() => JSON.parse(window.localStorage.getItem(STORE_KEY)), null);
        if (!o.force && prev && prev.v === PROBE_VERSION && prev.fp === fp && Date.now() - prev.at < RECHECK_MS) {
            return null;
        }
        const declared = await collectDeclared();
        const tests = {};
        for (const c of CASES) {
            // фоновая вкладка не декодирует видео — такой прогон врёт, бросаем и пробуем при следующем заходе
            if (document.visibilityState !== 'visible') {
                return null;
            }
            tests[c.id] = await runCase(o.base, c);
            await sleep(150);
        }
        const result = { v: PROBE_VERSION, fp, at: new Date().toISOString(), client, declared, tests, derived: derive(tests) };
        window.__tnpVideoCaps = result;
        if (o.post) {
            const r = await fetch(o.post, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result),
            }).catch(() => null);
            if (!r || !r.ok) {
                return result; // приёмник недоступен — отпечаток не запоминаем, повторим при следующем заходе
            }
        }
        safe(() => window.localStorage.setItem(STORE_KEY, JSON.stringify({ v: PROBE_VERSION, fp, at: Date.now() })));
        return result;
    } finally {
        running = false;
    }
}

const playing = () => Array.prototype.some.call(document.querySelectorAll('video'), (v) => !v.paused && !v.ended);

// Запуск из приложения: не раньше чем через 10 с после загрузки, в простое, не во время просмотра.
// force — ручной прогон (?tnpcaps=1): без проверки отпечатка, через 3 с.
function schedule(force) {
    const attempt = (left) => {
        if (left <= 0) {
            return;
        }
        if (document.visibilityState !== 'visible' || playing() || /^#\/player/.test(window.location.hash)) {
            setTimeout(() => attempt(left - 1), 60000);
            return;
        }
        run({ force: !!force }).catch((e) => console.warn('TnP: video caps', e));
    };
    setTimeout(() => {
        const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 0));
        idle(() => attempt(10));
    }, force ? 3000 : 10000);
}

module.exports = { run, schedule, derive, PROBE_VERSION };
