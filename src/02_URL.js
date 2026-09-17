/**
 * 02_URL.js — URL normalisation and classification. Pure functions, no network.
 * Apps Script has no WHATWG URL class, so everything is hand-parsed.
 */

/** Split a URL into parts. Returns null when it is not a usable http(s) URL. */
function tachUrl(url) {
  if (typeof url !== 'string') return null;
  var s = url.trim();
  if (s === '') return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\//.test(s)) {
    if (/^\/\//.test(s)) s = 'https:' + s;
    else if (/^[a-zA-Z0-9][a-zA-Z0-9.\-]*\.[a-zA-Z]{2,}(\/|$|\?|#)/.test(s)) s = 'https://' + s;
    else return null;
  }
  var m = /^([a-zA-Z][a-zA-Z0-9+.\-]*):\/\/([^\/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/.exec(s);
  if (!m) return null;
  var giaoThuc = m[1].toLowerCase();
  if (giaoThuc !== 'http' && giaoThuc !== 'https') return null;
  var thamQuyen = m[2];
  if (thamQuyen === '') return null;
  // Strip credentials: this tool never authenticates, so any user:pass is dropped outright.
  var coDauA = thamQuyen.lastIndexOf('@');
  if (coDauA >= 0) thamQuyen = thamQuyen.substring(coDauA + 1);
  var cong = '';
  var mCong = /^(.*?):(\d+)$/.exec(thamQuyen);
  if (mCong) { thamQuyen = mCong[1]; cong = mCong[2]; }
  var host = thamQuyen.toLowerCase().replace(/\.$/, '');
  if (host === '' || host.indexOf('.') < 0) {
    if (host !== 'localhost') return null;
  }
  return {
    giaoThuc: giaoThuc,
    host: host,
    cong: cong,
    duongDan: m[3] || '',
    truyVan: m[4] ? m[4].substring(1) : '',
    neo: m[5] ? m[5].substring(1) : ''
  };
}

/** True when the query parameter is a tracking parameter we drop. */
function laThamSoRac(ten) {
  var t = String(ten).toLowerCase();
  if (t.indexOf('utm_') === 0) return true;
  for (var i = 0; i < THAM_SO_RAC.length; i++) if (THAM_SO_RAC[i] === t) return true;
  return false;
}

/**
 * Normalise a URL: drop tracking params and the fragment, lowercase scheme/host,
 * drop the default port, collapse duplicate slashes, drop a trailing slash on
 * non-root paths. Does NOT follow redirects (that needs the network layer).
 * Returns {ok, url, origin, host, duongDan, daBoThamSo:[], lyDo}
 */
function chuanHoaUrl(url) {
  var p = tachUrl(url);
  if (!p) return { ok: false, lyDo: 'Không phải địa chỉ http/https hợp lệ: ' + String(url).substring(0, 120) };

  var giu = [];
  var daBo = [];
  if (p.truyVan !== '') {
    var cap = p.truyVan.split('&');
    for (var i = 0; i < cap.length; i++) {
      if (cap[i] === '') continue;
      var vt = cap[i].indexOf('=');
      var ten = vt < 0 ? cap[i] : cap[i].substring(0, vt);
      if (laThamSoRac(ten)) daBo.push(ten);
      else giu.push(cap[i]);
    }
  }

  var duongDan = p.duongDan.replace(/\/{2,}/g, '/');
  if (duongDan === '') duongDan = '/';
  if (duongDan.length > 1 && duongDan.charAt(duongDan.length - 1) === '/') {
    duongDan = duongDan.substring(0, duongDan.length - 1);
  }

  var cong = '';
  if (p.cong !== '' && !((p.giaoThuc === 'https' && p.cong === '443') || (p.giaoThuc === 'http' && p.cong === '80'))) {
    cong = ':' + p.cong;
  }
  var origin = p.giaoThuc + '://' + p.host + cong;
  var sach = origin + duongDan + (giu.length ? '?' + giu.join('&') : '');
  return {
    ok: true,
    url: sach,
    origin: origin,
    host: p.host,
    duongDan: duongDan,
    daBoThamSo: daBo,
    lyDo: ''
  };
}

/** Resolve a possibly relative href against a base URL. Returns '' when impossible. */
function ghepUrl(goc, href) {
  if (typeof href !== 'string' || href.trim() === '') return '';
  var h = href.trim();
  if (/^(mailto|tel|javascript|data):/i.test(h)) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\//.test(h)) return h;
  var b = tachUrl(goc);
  if (!b) return '';
  var cong = b.cong ? ':' + b.cong : '';
  var origin = b.giaoThuc + '://' + b.host + cong;
  if (h.indexOf('//') === 0) return b.giaoThuc + ':' + h;
  if (h.charAt(0) === '/') return origin + h;
  if (h.charAt(0) === '#' || h.charAt(0) === '?') return origin + b.duongDan + h;
  var thuMuc = b.duongDan.replace(/[^\/]*$/, '');
  if (thuMuc === '') thuMuc = '/';
  var ghep = (origin + thuMuc + h);
  // resolve ../ and ./
  var m = /^([a-z]+:\/\/[^\/]+)(\/.*)$/.exec(ghep);
  if (!m) return ghep;
  var phan = m[2].split('/');
  var ra = [];
  for (var i = 0; i < phan.length; i++) {
    if (phan[i] === '.') continue;
    if (phan[i] === '..') { if (ra.length > 1) ra.pop(); continue; }
    ra.push(phan[i]);
  }
  return m[1] + ra.join('/').replace(/\/{2,}/g, '/');
}

/** Is this host one of the marketplaces we cannot scan? Returns the entry or null. */
function timSanKhongQuetDuoc(host) {
  for (var i = 0; i < HOST_KHONG_QUET_DUOC.length; i++) {
    if (HOST_KHONG_QUET_DUOC[i].mau.test(host)) return HOST_KHONG_QUET_DUOC[i];
  }
  return null;
}

var MAU_SAN_PHAM = [
  /\/products\/[^\/]+/i,
  /\/product\/[^\/]+/i,
  /\/san-pham\/[^\/]+/i,
  /\/sanpham\/[^\/]+/i,
  /\/p\/[^\/]+/i,
  /-p\d+\.html$/i,
  /-i\.\d+\.\d+/i,
  /\/dp\/[A-Z0-9]{6,}/i
];

var MAU_DANH_MUC = [
  /\/collections\/[^\/]+$/i,
  /\/collection\/[^\/]+/i,
  /\/product-category\/[^\/]+/i,
  /\/category\/[^\/]+/i,
  /\/categories\/[^\/]+/i,
  /\/danh-muc\/[^\/]+/i,
  /\/danhmuc\/[^\/]+/i,
  /\/c\/[^\/]+/i,
  /\/cua-hang\/?$/i,
  /\/shop\/?$/i
];

/**
 * Classify a URL. The kind decides the ladder strategy, so this runs before anything else.
 * Returns {loai, host, origin, duongDan, url, san} — `san` is set when the host is a
 * marketplace we cannot scan.
 */
function phanLoaiUrl(url) {
  var ch = chuanHoaUrl(url);
  if (!ch.ok) {
    return { loai: LOAI_URL.UNKNOWN, url: String(url), host: '', origin: '', duongDan: '', san: null, lyDo: ch.lyDo };
  }
  var san = timSanKhongQuetDuoc(ch.host);
  var d = ch.duongDan;
  var loai;

  if (san) {
    // Marketplace shapes: shop pages vs item pages.
    var laSanPham = false;
    for (var i = 0; i < MAU_SAN_PHAM.length; i++) if (MAU_SAN_PHAM[i].test(d)) laSanPham = true;
    if (/-i\.\d+\.\d+/.test(d) || /\/item\//i.test(d)) laSanPham = true;
    if (laSanPham) loai = LOAI_URL.MARKETPLACE_PRODUCT;
    else if (/^\/shop\//i.test(d) || /\/shop\/[^\/]+/i.test(d) || /^\/[^\/]+$/.test(d) || d === '/') loai = LOAI_URL.MARKETPLACE_SHOP;
    else loai = LOAI_URL.UNKNOWN;
    return { loai: loai, url: ch.url, host: ch.host, origin: ch.origin, duongDan: d, san: san, lyDo: '' };
  }

  if (d === '/' || d === '') {
    loai = LOAI_URL.STORE;
  } else {
    loai = LOAI_URL.UNKNOWN;
    for (var j = 0; j < MAU_SAN_PHAM.length; j++) {
      if (MAU_SAN_PHAM[j].test(d)) { loai = LOAI_URL.PRODUCT; break; }
    }
    if (loai === LOAI_URL.UNKNOWN) {
      for (var k = 0; k < MAU_DANH_MUC.length; k++) {
        if (MAU_DANH_MUC[k].test(d)) { loai = LOAI_URL.CATEGORY; break; }
      }
    }
  }
  return { loai: loai, url: ch.url, host: ch.host, origin: ch.origin, duongDan: d, san: null, lyDo: '' };
}

/** Split a multi-line paste into normalised, de-duplicated URLs. */
function tachNhieuUrl(vanBan) {
  var ra = [];
  var daCo = {};
  var dong = String(vanBan || '').split(/[\r\n,;\s]+/);
  for (var i = 0; i < dong.length; i++) {
    var t = dong[i].trim();
    if (t === '') continue;
    var ch = chuanHoaUrl(t);
    if (!ch.ok) { ra.push({ ok: false, url: t, lyDo: ch.lyDo }); continue; }
    if (daCo[ch.url]) continue;
    daCo[ch.url] = true;
    ra.push({ ok: true, url: ch.url });
  }
  return ra;
}

/** The handle (last path segment) — used as a fallback stable id. */
function layMaTuDuongDan(url) {
  var p = tachUrl(url);
  if (!p) return '';
  var d = p.duongDan.replace(/\/$/, '');
  return d === '' ? '/' : d;
}
