/**
 * 04_ROBOTS.js — robots.txt reading, per RFC 9309. Pure functions; the fetch itself
 * lives in the network layer.
 *
 * Policy, and it is not configurable:
 *   - every path we fetch is checked first;
 *   - Crawl-delay is honoured when it is longer than our own minimum;
 *   - robots.txt 4xx (missing) => allowed; 5xx or unreachable => we do NOT crawl.
 */

/** Parse robots.txt text into groups. */
function phanTichRobots(vanBan) {
  var kq = { nhom: {}, sitemap: [] };
  var dong = String(vanBan || '').split(/\r\n|\r|\n/);
  var uaHienTai = [];
  var dangDocUA = false;

  for (var i = 0; i < dong.length; i++) {
    var d = dong[i];
    var vtC = d.indexOf('#');
    if (vtC >= 0) d = d.substring(0, vtC);
    d = d.trim();
    if (d === '') continue;
    var vt = d.indexOf(':');
    if (vt < 0) continue;
    var khoa = d.substring(0, vt).trim().toLowerCase();
    var giaTri = d.substring(vt + 1).trim();

    if (khoa === 'user-agent') {
      if (!dangDocUA) { uaHienTai = []; dangDocUA = true; }
      var ua = giaTri.toLowerCase();
      uaHienTai.push(ua);
      if (!kq.nhom[ua]) kq.nhom[ua] = { allow: [], disallow: [], crawlDelay: null };
      continue;
    }
    if (khoa === 'sitemap') { kq.sitemap.push(giaTri); continue; }

    dangDocUA = false;
    if (uaHienTai.length === 0) continue;
    for (var j = 0; j < uaHienTai.length; j++) {
      var n = kq.nhom[uaHienTai[j]];
      if (khoa === 'disallow') n.disallow.push(giaTri);
      else if (khoa === 'allow') n.allow.push(giaTri);
      else if (khoa === 'crawl-delay') {
        var so = parseFloat(giaTri.replace(',', '.'));
        if (isFinite(so) && so >= 0) n.crawlDelay = so;
      }
    }
  }
  return kq;
}

/** The product token of our User-Agent, lowercased ("durahomestorescanner"). */
function tokenUserAgent(ua) {
  var m = /^([^\/\s]+)/.exec(String(ua || '').trim());
  return m ? m[1].toLowerCase() : '';
}

/** Pick the group that applies to us: an exact agent match beats '*'. */
function chonNhomRobots(robots, ua) {
  var token = tokenUserAgent(ua);
  var ten = Object.keys(robots.nhom);
  var tot = null;
  for (var i = 0; i < ten.length; i++) {
    if (ten[i] !== '*' && token !== '' && (token === ten[i] || token.indexOf(ten[i]) === 0)) {
      tot = robots.nhom[ten[i]];
    }
  }
  if (tot) return tot;
  return robots.nhom['*'] || null;
}

/** Turn a robots path pattern (with * and $) into a regex. */
function mauRobotsThanhRegex(mau) {
  var s = String(mau);
  var ketThuc = false;
  if (s.charAt(s.length - 1) === '$') { ketThuc = true; s = s.substring(0, s.length - 1); }
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (c === '*') out += '.*';
    else out += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + out + (ketThuc ? '$' : ''));
}

/** Length of the matched rule, for longest-match-wins. -1 when it does not match. */
function doDaiKhopRobots(mau, duongDan) {
  if (mau === '') return -1;
  try {
    if (mauRobotsThanhRegex(mau).test(duongDan)) return mau.replace(/\$$/, '').length;
  } catch (e) { return -1; }
  return -1;
}

/**
 * May we fetch this path?
 * @return {{duoc:boolean, lyDo:string, crawlDelay:(number|null)}}
 */
function duocPhepLay(robots, duongDan, ua) {
  if (!robots) return { duoc: true, lyDo: 'khong_co_robots', crawlDelay: null };
  var nhom = chonNhomRobots(robots, ua);
  if (!nhom) return { duoc: true, lyDo: 'robots_khong_co_nhom_ap_dung', crawlDelay: null };

  var dd = duongDan === '' ? '/' : duongDan;
  var choPhep = -1, cam = -1, mauCam = '';
  for (var i = 0; i < nhom.allow.length; i++) {
    var a = doDaiKhopRobots(nhom.allow[i], dd);
    if (a > choPhep) choPhep = a;
  }
  for (var j = 0; j < nhom.disallow.length; j++) {
    var b = doDaiKhopRobots(nhom.disallow[j], dd);
    if (b > cam) { cam = b; mauCam = nhom.disallow[j]; }
  }
  if (cam >= 0 && cam > choPhep) {
    return { duoc: false, lyDo: 'robots.txt cấm đường dẫn này (Disallow: ' + mauCam + ')', crawlDelay: nhom.crawlDelay };
  }
  return { duoc: true, lyDo: '', crawlDelay: nhom.crawlDelay };
}
