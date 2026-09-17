/**
 * 11_QUET.js — the driver: time budget, cursor, resume, queue.
 *
 * Apps Script hard-stops at about 6 minutes. This file works for 4.5 minutes, commits the
 * batch it has, saves a cursor in PropertiesService, exits cleanly and schedules a trigger
 * to continue. A resumed scan keeps the SAME ma_lan_quet, and on resume it rebuilds the
 * list of already-written ids FROM THE SHEET, so a scan that died between the write and
 * the cursor save still cannot produce duplicates.
 */

var KHOA_CON = 'CON_QUET';        // the cursor
var KHOA_TIEN_DO = 'TIEN_DO';     // progress line for the UI
var HAM_TIEP_TUC = 'TIEP_TUC_QUET';

function thuocTinhScript() {
  return PropertiesService.getScriptProperties();
}

function taoMaLanQuet() {
  var d = new Date();
  function p(n, r) { var s = String(n); while (s.length < (r || 2)) s = '0' + s; return s; }
  var ngau = Math.floor(Math.random() * 46656).toString(36);
  return 'LQ-' + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + '-' +
         p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + '-' + ngau;
}

/** Cursor is JSON; transient keys (starting with _) are dropped. */
function luuCon(tt) {
  var sao = {};
  var k = Object.keys(tt);
  for (var i = 0; i < k.length; i++) {
    if (k[i].charAt(0) === '_') continue;
    sao[k[i]] = tt[k[i]];
  }
  thuocTinhScript().setProperty(KHOA_CON, JSON.stringify(sao));
}

function docCon() {
  var s = thuocTinhScript().getProperty(KHOA_CON);
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

function xoaCon() {
  thuocTinhScript().deleteProperty(KHOA_CON);
}

function capNhatTienDo(tt, ghiChu, xong) {
  var td = {
    maLanQuet: tt ? tt.maLanQuet : '',
    url: tt ? tt.urlNhap : '',
    bac: tt ? (tt.bacDung || tt.giaiDoan) : '',
    soSp: tt ? tt.soDaGhi : 0,
    ghiChu: ghiChu || '',
    xong: !!xong,
    luc: new Date().toISOString()
  };
  try { thuocTinhScript().setProperty(KHOA_TIEN_DO, JSON.stringify(td)); } catch (e) { /* progress is best-effort */ }
  return td;
}

function docTienDo() {
  var s = '';
  try { s = thuocTinhScript().getProperty(KHOA_TIEN_DO) || ''; } catch (e) { s = ''; }
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

/* ------------------------------------------------- reading back what was written */

/**
 * Read back the rows already written for this scan. This is the authority on what exists,
 * used on resume so that a lost cursor can never cause a duplicate or a miscount.
 */
function docHangDaGhi(maLanQuet) {
  var kq = { tong: 0, ma: {}, dem: {} };
  for (var i = 0; i < TRUONG_SAN_PHAM.length; i++) kq.dem[TRUONG_SAN_PHAM[i]] = 0;
  var b;
  try { b = layHoacTaoBang(TEN_BANG.SAN_PHAM, COT_SAN_PHAM); } catch (e) { return kq; }
  var lastRow = b.getLastRow();
  if (lastRow < 2) return kq;
  var gt = b.getRange(2, 1, lastRow - 1, COT_SAN_PHAM.length).getValues();
  var viTriMa = COT_SAN_PHAM.indexOf('ma_lan_quet');
  for (var r = 0; r < gt.length; r++) {
    if (String(gt[r][viTriMa]) !== String(maLanQuet)) continue;
    kq.tong++;
    for (var c = 0; c < COT_SAN_PHAM.length; c++) {
      var ten = COT_SAN_PHAM[c];
      if (TRUONG_SAN_PHAM.indexOf(ten) < 0) continue;
      var v = gt[r][c];
      if (!(v === null || v === undefined || v === '')) kq.dem[ten]++;
      if (ten === 'ma_ngoai' && v !== '') kq.ma[String(v)] = 1;
    }
  }
  return kq;
}

/** On resume, trust the sheet over the cursor for counts and ids. */
function napLaiTuBang(tt) {
  var daCo = docHangDaGhi(tt.maLanQuet);
  tt.daGhiMa = daCo.ma;
  tt.soDaGhi = daCo.tong;
  tt.tichLuy.tong = daCo.tong;
  tt.tichLuy.dem = daCo.dem;
  return daCo.tong;
}

/* ------------------------------------------------------------------ the loop */

/**
 * Run the ladder until it finishes or the time budget runs out.
 * @param {Object} tt scan state
 * @param {Object} bc network context
 * @param {{batDauMs:number, nganSachMs:number, duTruMs:number}} gio
 * @return {{xong:boolean, tt:Object, ketLuan:(Object|null), ghiChu:string}}
 */
function chayVongQuet(tt, bc, gio) {
  var batDauMs = gio.batDauMs !== undefined ? gio.batDauMs : Date.now();
  var nganSach = gio.nganSachMs || 270000;
  var duTru = gio.duTruMs !== undefined ? gio.duTruMs : 45000;
  var lo = [];
  var ghiChu = tt.ghiChu || '';
  var xong = false;

  while (true) {
    if (Date.now() - batDauMs > nganSach - duTru) {
      ghiChu = 'Tạm dừng do gần hết 6 phút của Apps Script. Đã lưu vị trí, sẽ chạy tiếp.';
      break;
    }
    var buoc;
    try {
      buoc = buocQuet(tt, bc);
    } catch (e) {
      themLyDo(tt, 'Lỗi khi chạy bậc ' + tt.giaiDoan + ': ' + (e && e.message ? e.message : e));
      tt.bacDung = tt.bacDung || BAC.BAC_6_KHONG_QUET_DUOC;
      tt.giaiDoan = GIAI_DOAN.XONG;
      buoc = { hang: [], xong: true, ghiChu: 'Gặp lỗi, dừng lần quét.' };
    }
    ghiChu = buoc.ghiChu || ghiChu;
    tt.ghiChu = ghiChu;
    if (buoc.hang && buoc.hang.length) {
      for (var i = 0; i < buoc.hang.length; i++) lo.push(buoc.hang[i]);
    }
    tt.mangLuoi = { demYeuCau: bc.demYeuCau, hostDaDung: bc.hostDaDung, loiLienTiep: bc.loiLienTiep };
    capNhatTienDo(tt, ghiChu, false);

    if (lo.length >= 250) {
      lo = xaLo(tt, lo);
      luuCon(tt);
    }
    if (buoc.xong || tt.giaiDoan === GIAI_DOAN.XONG) { xong = true; break; }
  }

  xaLo(tt, lo);

  if (!xong) {
    luuCon(tt);
    return { xong: false, tt: tt, ketLuan: null, ghiChu: ghiChu };
  }

  var kl = tinhKetLuanTuTichLuy(tt.tichLuy, tt.bacDung, { lyDo: tt.lyDoThatBai.join(' | ') });
  tt.ketThuc = new Date().toISOString();
  ghiLanQuet(tt, kl);
  xoaCon();
  capNhatTienDo(tt, 'Xong: ' + kl.ketLuan + ' — ' + kl.cau, true);
  return { xong: true, tt: tt, ketLuan: kl, ghiChu: ghiChu };
}

/** Commit a batch: write it, then count exactly what was written. Order matters. */
function xaLo(tt, lo) {
  if (!lo || lo.length === 0) return [];
  var kq = ghiSanPham(tt, lo);
  congTichLuy(tt.tichLuy, kq.hangDaGhi);
  return [];
}

/* --------------------------------------------------------------- entry flows */

function boiCanhTuTrangThai(tt, caiDat) {
  var bc = taoBoiCanhMang(caiDat);
  if (tt.mangLuoi) {
    bc.demYeuCau = tt.mangLuoi.demYeuCau || {};
    bc.hostDaDung = tt.mangLuoi.hostDaDung || {};
    bc.loiLienTiep = tt.mangLuoi.loiLienTiep || {};
  }
  return bc;
}

/** Start a scan for one URL. Returns the verdict when it finished inside this execution. */
function batDauQuet(url, nguoiQuet, tuyChon) {
  tuyChon = tuyChon || {};
  var caiDat = tuyChon.caiDat || docCaiDat();
  var tt = taoTrangThaiQuet(url, nguoiQuet || caiDat.nguoi_quet || '', taoMaLanQuet());
  luuCon(tt);
  var bc = boiCanhTuTrangThai(tt, caiDat);
  var kq = chayVongQuet(tt, bc, {
    batDauMs: tuyChon.batDauMs !== undefined ? tuyChon.batDauMs : Date.now(),
    nganSachMs: tuyChon.nganSachMs !== undefined ? tuyChon.nganSachMs : (Number(caiDat.ngan_sach_chay_ms) || 270000),
    duTruMs: tuyChon.duTruMs
  });
  if (!kq.xong) datLichTiepTuc();
  return kq;
}

/** Continue a scan that was cut off. Same ma_lan_quet, no duplicates, no gaps. */
function tiepTucQuet(tuyChon) {
  tuyChon = tuyChon || {};
  var tt = tuyChon.trangThai || docCon();
  if (!tt) return { xong: true, tt: null, ketLuan: null, ghiChu: 'Không có lần quét nào đang dở.' };
  if (!tt.tichLuy) tt.tichLuy = taoTichLuy();
  var caiDat = tuyChon.caiDat || docCaiDat();
  napLaiTuBang(tt);
  themLyDo(tt, 'Đã chạy tiếp sau khi tạm dừng; số liệu đã nạp lại từ bảng SAN_PHAM (' + tt.soDaGhi + ' dòng).');
  var bc = boiCanhTuTrangThai(tt, caiDat);
  var kq = chayVongQuet(tt, bc, {
    batDauMs: tuyChon.batDauMs !== undefined ? tuyChon.batDauMs : Date.now(),
    nganSachMs: tuyChon.nganSachMs !== undefined ? tuyChon.nganSachMs : (Number(caiDat.ngan_sach_chay_ms) || 270000),
    duTruMs: tuyChon.duTruMs
  });
  if (!kq.xong) datLichTiepTuc();
  else if (kq.ketLuan) danhDauHangDoiTheoUrl(tt.urlNhap, 'XONG', tt.maLanQuet, kq.ketLuan.ketLuan);
  return kq;
}

/* ------------------------------------------------------------------- triggers */

function datLichTiepTuc() {
  try {
    xoaLichTiepTuc();
    ScriptApp.newTrigger(HAM_TIEP_TUC).timeBased().after(30 * 1000).create();
    return true;
  } catch (e) {
    return false;
  }
}

function xoaLichTiepTuc() {
  try {
    var ds = ScriptApp.getProjectTriggers();
    for (var i = 0; i < ds.length; i++) {
      if (ds[i].getHandlerFunction() === HAM_TIEP_TUC) ScriptApp.deleteTrigger(ds[i]);
    }
  } catch (e) { /* no trigger scope in some contexts */ }
}

/* ---------------------------------------------------------------- the queue */

/** Queue many URLs at once (the "Dán nhiều link" mode). */
function xepHangNhieuUrl(vanBan) {
  var ds = tachNhieuUrl(vanBan);
  var lo = [];
  var t = nhanThoiGian();
  var hopLe = 0;
  for (var i = 0; i < ds.length; i++) {
    if (ds[i].ok) { lo.push([t, ds[i].url, 'CHO', '', '']); hopLe++; }
    else lo.push([t, ds[i].url, 'LOI', '', ds[i].lyDo]);
  }
  if (lo.length) ghiLo(TEN_BANG.HANG_DOI, lo, COT_HANG_DOI);
  return { tong: ds.length, hopLe: hopLe };
}

/** Next pending URL in the queue, or null. */
function layUrlChoTrongHangDoi() {
  var b = layHoacTaoBang(TEN_BANG.HANG_DOI, COT_HANG_DOI);
  if (b.getLastRow() < 2) return null;
  var gt = b.getRange(2, 1, b.getLastRow() - 1, COT_HANG_DOI.length).getValues();
  for (var i = 0; i < gt.length; i++) {
    if (String(gt[i][2]) === 'CHO') return { dong: i + 2, url: String(gt[i][1]) };
  }
  return null;
}

/**
 * One unit of operator-visible work: continue an unfinished scan, else start the next
 * queued URL, else say there is nothing to do.
 */
function quetTiepMotViec(tuyChon) {
  tuyChon = tuyChon || {};
  var dangDo = docCon();
  if (dangDo) return tiepTucQuet(tuyChon);
  var tiep = layUrlChoTrongHangDoi();
  if (!tiep) return { xong: true, tt: null, ketLuan: null, ghiChu: 'Hàng đợi trống.' };
  danhDauHangDoi(tiep.dong, 'DANG_QUET', '', '');
  var kq = batDauQuet(tiep.url, tuyChon.nguoiQuet, tuyChon);
  if (kq.xong && kq.ketLuan) {
    danhDauHangDoi(tiep.dong, 'XONG', kq.tt.maLanQuet, kq.ketLuan.ketLuan);
  } else if (kq.tt) {
    danhDauHangDoi(tiep.dong, 'DANG_QUET', kq.tt.maLanQuet, 'đang chạy tiếp');
  }
  return kq;
}
