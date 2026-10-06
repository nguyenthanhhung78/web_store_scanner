/**
 * 05_MANG_LUOI.js — THE ONLY PLACE THAT TOUCHES THE NETWORK.
 *
 * Everything else in this project takes text and returns objects. When UrlFetchApp is
 * replaced (Apps Script will change, or this moves to another runtime), this file is the
 * only one that has to be rewritten.
 *
 * Rules enforced here, all of them non-negotiable:
 *   - robots.txt is read once per origin and obeyed for every path;
 *   - at least `do_tre_giua_2_yeu_cau_ms` between two requests to the same host, and more
 *     when robots.txt asks for more;
 *   - the tool identifies itself with a contact address in the User-Agent;
 *   - 429/503 => exponential backoff, then give up;
 *   - 3 consecutive failures on a host => that host is dropped for the rest of the scan;
 *   - a 403 or a bot challenge is a NO. We record it and stop. We do not rotate the
 *     User-Agent, we do not retry from another angle, we do not call private endpoints.
 */

var TU_CHOI = {
  ROBOTS: 'ROBOTS',
  CHAN: 'CHAN',
  LOI_MANG: 'LOI_MANG',
  QUA_GIOI_HAN: 'QUA_GIOI_HAN',
  DUNG_HOST: 'DUNG_HOST',
  URL_HONG: 'URL_HONG'
};

/** Per-scan network context. Counters live here so they survive a resume. */
function taoBoiCanhMang(caiDat) {
  return {
    caiDat: caiDat || docCaiDatMacDinh(),
    demYeuCau: {},        // host -> number of requests this scan
    loiLienTiep: {},      // host -> consecutive failures
    hostDaDung: {},       // host -> reason
    lanCuoiMs: {},        // host -> timestamp of last request
    robots: {},           // origin -> {robots, crawlDelay, trangThai}
    nhatKy: []            // short audit trail, shown in CHAN_DOAN
  };
}

function ghiNhatKyMang(bc, dong) {
  bc.nhatKy.push(dong);
  if (bc.nhatKy.length > 200) bc.nhatKy.shift();
}

/** Signatures of anti-bot interstitials. Detecting one means we stop, not that we try harder. */
var DAU_HIEU_THU_THACH = [
  'cf-browser-verification', '_cf_chl', 'cf_chl_opt', 'just a moment...',
  'checking your browser', 'attention required! | cloudflare', 'ddos protection by',
  'captcha-delivery', 'geo.captcha-delivery.com', 'px-captcha', 'are you a human',
  'incapsula incident id', 'access denied', 'request unsuccessful. incapsula',
  'verify you are human', 'enable javascript and cookies to continue'
];

function laTrangThuThach(noiDung, maTrangThai) {
  var s = String(noiDung || '').substring(0, 20000).toLowerCase();
  for (var i = 0; i < DAU_HIEU_THU_THACH.length; i++) {
    if (s.indexOf(DAU_HIEU_THU_THACH[i]) >= 0) return DAU_HIEU_THU_THACH[i];
  }
  if (maTrangThai === 403) return 'HTTP 403';
  return '';
}

function tuChoi(loai, lyDo, them) {
  var r = { ok: false, tuChoi: { loai: loai, lyDo: lyDo }, maTrangThai: 0, noiDung: '', urlCuoi: '' };
  if (them) for (var k in them) if (Object.prototype.hasOwnProperty.call(them, k)) r[k] = them[k];
  return r;
}

/** Make sure robots.txt for this origin is loaded. Never recurses into layNoiDung. */
function damBaoRobots(bc, origin) {
  if (Object.prototype.hasOwnProperty.call(bc.robots, origin)) return bc.robots[origin];
  var ket = { robots: null, trangThai: 0, choPhepTatCa: true, lyDo: '' };
  var hostRb = tachUrl(origin);
  var tenHost = hostRb ? hostRb.host : origin;
  choLichSu(bc, tenHost, null);
  bc.demYeuCau[tenHost] = (bc.demYeuCau[tenHost] || 0) + 1;
  var tl = goiMangTho(bc, origin + '/robots.txt');
  ket.trangThai = tl.maTrangThai;
  if (tl.loi) {
    // Unreachable robots.txt: RFC 9309 says treat as full disallow. We do.
    ket.choPhepTatCa = false;
    ket.lyDo = 'Không đọc được robots.txt (' + tl.loi + ') — theo RFC 9309 thì không được quét.';
  } else if (tl.maTrangThai >= 500) {
    ket.choPhepTatCa = false;
    ket.lyDo = 'robots.txt trả về lỗi máy chủ ' + tl.maTrangThai + ' — theo RFC 9309 thì không được quét.';
  } else if (tl.maTrangThai >= 400) {
    ket.choPhepTatCa = true;
    ket.lyDo = 'Không có robots.txt (' + tl.maTrangThai + ') — được phép quét.';
  } else {
    ket.robots = phanTichRobots(tl.noiDung);
    ket.lyDo = 'Đã đọc robots.txt.';
  }
  bc.robots[origin] = ket;
  ghiNhatKyMang(bc, 'robots ' + origin + ' -> ' + ket.trangThai + ' ' + ket.lyDo);
  return ket;
}

/** Wait until the per-host politeness delay has elapsed. */
function choLichSu(bc, host, crawlDelay) {
  var toiThieu = Number(bc.caiDat.do_tre_giua_2_yeu_cau_ms) || 1500;
  if (toiThieu < 1500) toiThieu = 1500;
  if (crawlDelay !== null && crawlDelay !== undefined && crawlDelay * 1000 > toiThieu) {
    toiThieu = Math.ceil(crawlDelay * 1000);
  }
  var truoc = bc.lanCuoiMs[host];
  var bayGio = Date.now();
  if (truoc) {
    var conThieu = toiThieu - (bayGio - truoc);
    if (conThieu > 0) Utilities.sleep(conThieu);
  }
  bc.lanCuoiMs[host] = Date.now();
}

/**
 * Raw HTTP with manual redirect following, so the final URL is known.
 * No policy here — policy is in layNoiDung.
 */
function goiMangTho(bc, url, soLanChuyenHuong) {
  var lan = soLanChuyenHuong || 0;
  var ua = String(bc.caiDat.user_agent || 'DurahomeStoreScanner/1.0 (+lien-he@durahome.vn)');
  try {
    var tl = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: false,
      validateHttpsCertificates: true,
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.6'
      }
    });
    var ma = tl.getResponseCode();
    var headers = tl.getAllHeaders ? tl.getAllHeaders() : {};
    if (ma >= 300 && ma < 400 && lan < 5) {
      var loc = headers['Location'] || headers['location'];
      if (loc) {
        if (Object.prototype.toString.call(loc) === '[object Array]') loc = loc[loc.length - 1];
        var tiep = ghepUrl(url, loc);
        if (tiep) {
          // Một bước chuyển hướng vẫn là một lượt gọi tới máy chủ đó: phải chờ đủ độ trễ
          // lịch sự và phải tính vào trần lượt gọi, y như mọi lượt khác.
          var hostTiep = tachUrl(tiep);
          if (hostTiep) {
            choLichSu(bc, hostTiep.host, null);
            bc.demYeuCau[hostTiep.host] = (bc.demYeuCau[hostTiep.host] || 0) + 1;
          }
          return goiMangTho(bc, tiep, lan + 1);
        }
      }
    }
    var kieu = headers['Content-Type'] || headers['content-type'] || '';
    if (Object.prototype.toString.call(kieu) === '[object Array]') kieu = kieu[0];
    return {
      loi: null,
      maTrangThai: ma,
      noiDung: tl.getContentText(),
      kieuNoiDung: String(kieu || ''),
      urlCuoi: url
    };
  } catch (e) {
    return { loi: String(e && e.message ? e.message : e), maTrangThai: 0, noiDung: '', kieuNoiDung: '', urlCuoi: url };
  }
}

/**
 * The one fetch entry point.
 * @param {string} url
 * @param {{boiCanh:Object, boQuaRobots:boolean, nhan:string}} tuyChon
 * @return {{ok:boolean, maTrangThai:number, noiDung:string, kieuNoiDung:string,
 *           urlCuoi:string, tuChoi:(Object|null)}}
 */
function layNoiDung(url, tuyChon) {
  tuyChon = tuyChon || {};
  var bc = tuyChon.boiCanh;
  if (!bc) throw new Error('layNoiDung: thiếu boiCanh — mọi lần gọi mạng phải đi kèm bối cảnh của lần quét.');

  var ch = chuanHoaUrl(url);
  if (!ch.ok) return tuChoi(TU_CHOI.URL_HONG, ch.lyDo);
  var host = ch.host;

  if (bc.hostDaDung[host]) return tuChoi(TU_CHOI.DUNG_HOST, bc.hostDaDung[host]);

  var tran = Number(bc.caiDat.gioi_han_yeu_cau_moi_host) || 500;
  if ((bc.demYeuCau[host] || 0) >= tran) {
    return tuChoi(TU_CHOI.QUA_GIOI_HAN, 'Đã chạm trần ' + tran + ' lượt gọi cho tên miền ' + host + ' trong lần quét này.');
  }

  var crawlDelay = null;
  if (!tuyChon.boQuaRobots) {
    var rb = damBaoRobots(bc, ch.origin);
    if (!rb.choPhepTatCa && !rb.robots) return tuChoi(TU_CHOI.ROBOTS, rb.lyDo);
    var phep = duocPhepLay(rb.robots, ch.duongDan, bc.caiDat.user_agent);
    crawlDelay = phep.crawlDelay;
    if (!phep.duoc) return tuChoi(TU_CHOI.ROBOTS, phep.lyDo + ' (' + ch.url + ')');
  }

  var lanThu = 0;
  var choBackoff = 2000;
  while (lanThu < 3) {
    lanThu++;
    choLichSu(bc, host, crawlDelay);
    bc.demYeuCau[host] = (bc.demYeuCau[host] || 0) + 1;
    var tl = goiMangTho(bc, ch.url);
    ghiNhatKyMang(bc, (tuyChon.nhan || 'lay') + ' ' + ch.url + ' -> ' + (tl.loi ? 'LOI ' + tl.loi : tl.maTrangThai));

    if (tl.loi) {
      demLoi(bc, host);
      if (lanThu >= 3 || bc.hostDaDung[host]) {
        return tuChoi(TU_CHOI.LOI_MANG, 'Lỗi mạng: ' + tl.loi, { maTrangThai: 0 });
      }
      Utilities.sleep(choBackoff); choBackoff *= 2;
      continue;
    }

    if (tl.maTrangThai === 429 || tl.maTrangThai === 503) {
      demLoi(bc, host);
      if (lanThu >= 3) {
        return tuChoi(TU_CHOI.CHAN,
          'Máy chủ trả về ' + tl.maTrangThai + ' (giới hạn tần suất) sau ' + lanThu + ' lần thử. Đã dừng, không thử vòng khác.',
          { maTrangThai: tl.maTrangThai });
      }
      Utilities.sleep(choBackoff); choBackoff *= 2;
      continue;
    }

    var thuThach = laTrangThuThach(tl.noiDung, tl.maTrangThai);
    if (thuThach) {
      bc.hostDaDung[host] = 'Trang chặn truy cập tự động (' + thuThach + '). Công cụ dừng tại đây theo đúng thiết kế.';
      return tuChoi(TU_CHOI.CHAN, bc.hostDaDung[host], { maTrangThai: tl.maTrangThai });
    }

    if (tl.maTrangThai >= 400) {
      // A 404/410 is a definite answer ("that endpoint does not exist here"), not a failure.
      // The ladder produces those by design while probing, so they must not count towards
      // the consecutive-failure limit — otherwise probing rung 1 and 2 would stop the host
      // before rung 3 ever runs.
      if (tl.maTrangThai >= 500 || tl.maTrangThai === 408) demLoi(bc, host);
      else bc.loiLienTiep[host] = 0;
      return tuChoi(TU_CHOI.LOI_MANG, 'Máy chủ trả về HTTP ' + tl.maTrangThai, { maTrangThai: tl.maTrangThai, noiDung: tl.noiDung });
    }

    bc.loiLienTiep[host] = 0;
    return {
      ok: true,
      maTrangThai: tl.maTrangThai,
      noiDung: tl.noiDung,
      kieuNoiDung: tl.kieuNoiDung,
      urlCuoi: tl.urlCuoi,
      tuChoi: null
    };
  }
  return tuChoi(TU_CHOI.LOI_MANG, 'Không lấy được nội dung sau 3 lần thử.');
}

function demLoi(bc, host) {
  bc.loiLienTiep[host] = (bc.loiLienTiep[host] || 0) + 1;
  var tran = Number(bc.caiDat.so_loi_lien_tiep_toi_da) || 3;
  if (bc.loiLienTiep[host] >= tran) {
    bc.hostDaDung[host] = 'Đã ' + bc.loiLienTiep[host] + ' lỗi liên tiếp trên ' + host + ' — dừng tên miền này cho hết lần quét.';
  }
}

/** Fetch and JSON.parse in one step. Never throws on bad JSON. */
function layJson(url, tuyChon) {
  var tl = layNoiDung(url, tuyChon);
  if (!tl.ok) return { ok: false, tuChoi: tl.tuChoi, maTrangThai: tl.maTrangThai, dulieu: null, noiDung: '' };
  var s = String(tl.noiDung || '').replace(/^﻿/, '').trim();
  if (s === '') return { ok: false, tuChoi: { loai: TU_CHOI.LOI_MANG, lyDo: 'Nội dung rỗng' }, maTrangThai: tl.maTrangThai, dulieu: null, noiDung: '' };
  try {
    return { ok: true, tuChoi: null, maTrangThai: tl.maTrangThai, dulieu: JSON.parse(s), noiDung: tl.noiDung, urlCuoi: tl.urlCuoi };
  } catch (e) {
    return { ok: false, tuChoi: { loai: TU_CHOI.LOI_MANG, lyDo: 'Không phải JSON hợp lệ' }, maTrangThai: tl.maTrangThai, dulieu: null, noiDung: tl.noiDung };
  }
}
