/**
 * 10_GHI_BANG.js — THE ONLY PLACE THAT WRITES TO THE SHEET.
 *
 * One function takes a whole batch and makes exactly one setValues() call. There is no
 * appendRow() anywhere in this project: appendRow inside a loop is what turns a 400-row
 * scan into a 6-minute timeout.
 *
 * SAN_PHAM and LAN_QUET are append-only. A previous scan's rows are never touched.
 */

var KHOA_ID_BANG = 'ID_BANG_TINH';

function layBangTinh() {
  var ss = null;
  try { ss = SpreadsheetApp.getActive(); } catch (e) { ss = null; }
  if (ss) return ss;
  var id = '';
  try { id = PropertiesService.getScriptProperties().getProperty(KHOA_ID_BANG) || ''; } catch (e) { id = ''; }
  if (id) return SpreadsheetApp.openById(id);
  throw new Error('Không tìm thấy bảng tính. Hãy gắn script vào một Google Sheet, hoặc đặt thuộc tính ' +
                  KHOA_ID_BANG + ' bằng ID của bảng tính.');
}

/** Get a sheet, creating it with its header row if it does not exist. */
function layHoacTaoBang(ten, cot) {
  var ss = layBangTinh();
  var b = ss.getSheetByName(ten);
  if (!b) {
    b = ss.insertSheet(ten);
    b.getRange(1, 1, 1, cot.length).setValues([cot]);
    b.setFrozenRows(1);
  } else if (b.getLastRow() === 0) {
    b.getRange(1, 1, 1, cot.length).setValues([cot]);
    b.setFrozenRows(1);
  }
  return b;
}

/** A leading =, +, - or @ would be read as a formula. Keep it as text. */
function antoanChoO(v) {
  if (typeof v !== 'string') return v;
  if (v.length && '=+-@'.indexOf(v.charAt(0)) >= 0) return "'" + v;
  return v;
}

/**
 * THE WRITER. One batch, one setValues, append-only.
 * @param {string} tenBang
 * @param {Array<Array>} loHang
 * @param {Array<string>} cot
 * @return {number} first row written (1-based), or 0 when nothing was written
 */
function ghiLo(tenBang, loHang, cot) {
  if (!loHang || loHang.length === 0) return 0;
  var b = layHoacTaoBang(tenBang, cot);
  var sach = [];
  for (var i = 0; i < loHang.length; i++) {
    var d = [];
    for (var j = 0; j < cot.length; j++) d.push(antoanChoO(loHang[i][j] === undefined ? '' : loHang[i][j]));
    sach.push(d);
  }
  var dong = b.getLastRow() + 1;
  b.getRange(dong, 1, sach.length, cot.length).setValues(sach);
  return dong;
}

function nhanThoiGian(d) {
  var ngay = d || new Date();
  try {
    return Utilities.formatDate(ngay, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');
  } catch (e) {
    return ngay.toISOString().replace('T', ' ').substring(0, 19);
  }
}

/** Row object -> array in SAN_PHAM column order. */
function hangSanPhamThanhMang(tt, hang, thoiDiem) {
  var d = [];
  for (var i = 0; i < COT_SAN_PHAM.length; i++) {
    var c = COT_SAN_PHAM[i];
    if (c === 'ma_lan_quet') d.push(tt.maLanQuet);
    else if (c === 'ngay_quet') d.push(thoiDiem);
    else if (c === 'nguon_url') d.push(tt.url || tt.urlNhap);
    else if (c === 'ten_mien') d.push(tt.host);
    else if (c === 'nen_tang') d.push(tt.nenTang || '');
    else d.push(hang[c] === undefined || hang[c] === null ? '' : hang[c]);
  }
  return d;
}

/**
 * Write one batch of product rows. De-duplicates by ma_ngoai within the scan so that a
 * resumed scan cannot write the same variant twice.
 * @return {{soDaGhi:number, hangDaGhi:Array}}
 */
function ghiSanPham(tt, hang) {
  var lo = [];
  var giuLai = [];
  var t = nhanThoiGian();
  for (var i = 0; i < hang.length; i++) {
    var ma = hang[i].ma_ngoai;
    var khoa = ma === '' ? ('__trong__' + tt.soDaGhi + '_' + i) : String(ma);
    if (tt.daGhiMa[khoa]) continue;
    tt.daGhiMa[khoa] = 1;
    giuLai.push(hang[i]);
    lo.push(hangSanPhamThanhMang(tt, hang[i], t));
  }
  if (lo.length === 0) return { soDaGhi: 0, hangDaGhi: [] };
  ghiLo(TEN_BANG.SAN_PHAM, lo, COT_SAN_PHAM);
  tt.soDaGhi += lo.length;
  return { soDaGhi: lo.length, hangDaGhi: giuLai };
}

/** Write the single LAN_QUET row for a finished scan. Called exactly once per scan. */
function ghiLanQuet(tt, kl) {
  if (tt.daGhiLanQuet) return 0;
  var d = [];
  for (var i = 0; i < COT_LAN_QUET.length; i++) {
    var c = COT_LAN_QUET[i];
    if (c === 'ma_lan_quet') d.push(tt.maLanQuet);
    else if (c === 'bat_dau') d.push(nhanThoiGian(new Date(tt.batDau)));
    else if (c === 'ket_thuc') d.push(nhanThoiGian());
    else if (c === 'url_nhap') d.push(tt.urlNhap);
    else if (c === 'loai_url') d.push(tt.loaiUrl);
    else if (c === 'nen_tang') d.push(tt.nenTang || '(không nhận diện được)');
    else if (c === 'bac_thang_dung') d.push(tt.bacDung || BAC.BAC_6_KHONG_QUET_DUOC);
    else if (c === 'so_sp') d.push(kl.soSp);
    else if (c === 'ty_le_co_gia') d.push(Math.round(kl.tyLeCoGia * 1000) / 10);
    else if (c === 'truong_thieu_nhieu') d.push(kl.truongThieuNhieu);
    else if (c === 'ket_luan') d.push(kl.ketLuan);
    else if (c === 'ly_do') d.push(catLyDo(kl.lyDo + ' | ' + tt.lyDoThatBai.join(' | ')));
    else if (c === 'nguoi_quet') d.push(tt.nguoiQuet || '');
    else d.push('');
  }
  ghiLo(TEN_BANG.LAN_QUET, [d], COT_LAN_QUET);
  tt.daGhiLanQuet = true;
  return 1;
}

function catLyDo(s) {
  var t = String(s || '').replace(/\s*\|\s*$/, '');
  return t.length > 4000 ? t.substring(0, 4000) + '…' : t;
}

/* ------------------------------------------------------------------ CAI_DAT */

function docCaiDatMacDinh() {
  var o = {};
  for (var i = 0; i < CAI_DAT_MAC_DINH.length; i++) o[CAI_DAT_MAC_DINH[i][0]] = CAI_DAT_MAC_DINH[i][1];
  return o;
}

/** Settings from the CAI_DAT sheet, layered over the defaults. Creates the sheet if needed. */
function docCaiDat() {
  var o = docCaiDatMacDinh();
  var b;
  try {
    b = layHoacTaoBang(TEN_BANG.CAI_DAT, COT_CAI_DAT);
  } catch (e) {
    return o;
  }
  if (b.getLastRow() < 2) {
    ghiLo(TEN_BANG.CAI_DAT, CAI_DAT_MAC_DINH, COT_CAI_DAT);
    return o;
  }
  var gt = b.getRange(2, 1, b.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < gt.length; i++) {
    var k = String(gt[i][0]).trim();
    if (k === '') continue;
    var v = gt[i][1];
    if (v === '' || v === null) continue;
    o[k] = v;
  }
  // Politeness floor is not negotiable, whatever the sheet says.
  if (!(Number(o.do_tre_giua_2_yeu_cau_ms) >= 1500)) o.do_tre_giua_2_yeu_cau_ms = 1500;
  return o;
}

/** Make sure every tab exists, with headers and default settings. Safe to run repeatedly. */
function taoCacBangNeuThieu() {
  layHoacTaoBang(TEN_BANG.SAN_PHAM, COT_SAN_PHAM);
  layHoacTaoBang(TEN_BANG.LAN_QUET, COT_LAN_QUET);
  layHoacTaoBang(TEN_BANG.HANG_DOI, COT_HANG_DOI);
  var cd = layHoacTaoBang(TEN_BANG.CAI_DAT, COT_CAI_DAT);
  if (cd.getLastRow() < 2) ghiLo(TEN_BANG.CAI_DAT, CAI_DAT_MAC_DINH, COT_CAI_DAT);
  return true;
}

/* ------------------------------------------------------------------ HANG_DOI */

/**
 * The queue's status column is the one place we update an existing cell: it is scan
 * bookkeeping, not scan data. SAN_PHAM and LAN_QUET stay append-only.
 */
function danhDauHangDoi(dong, trangThai, maLanQuet, ghiChu) {
  var b = layHoacTaoBang(TEN_BANG.HANG_DOI, COT_HANG_DOI);
  b.getRange(dong, 3, 1, 3).setValues([[trangThai, maLanQuet || '', ghiChu || '']]);
}

/** Mark every queue row for this URL, used when a resumed scan finally finishes. */
function danhDauHangDoiTheoUrl(url, trangThai, maLanQuet, ghiChu) {
  var b;
  try { b = layHoacTaoBang(TEN_BANG.HANG_DOI, COT_HANG_DOI); } catch (e) { return 0; }
  if (b.getLastRow() < 2) return 0;
  var gt = b.getRange(2, 1, b.getLastRow() - 1, COT_HANG_DOI.length).getValues();
  var dem = 0;
  for (var i = 0; i < gt.length; i++) {
    if (String(gt[i][1]) !== String(url)) continue;
    if (String(gt[i][2]) === 'XONG') continue;
    b.getRange(i + 2, 3, 1, 3).setValues([[trangThai, maLanQuet || '', ghiChu || '']]);
    dem++;
  }
  return dem;
}
