/**
 * 15_TRUY_VAN.js — the query engine behind the UI.
 *
 * Everything except docKhoDuLieu() is pure: rows in, rows out. That is what makes the
 * whole query layer testable without a sheet and reusable if the storage ever moves.
 *
 * The rule that matters here: a QUERY IS NEVER MORE TRUSTWORTHY THAN ITS WEAKEST SCAN.
 * Every result carries tomTatTinCay(), which is the worst verdict among the scans that
 * contributed rows — so a table mixing CAO rows with THAP rows reads THAP, not CAO.
 */

/** Columns the UI never needs in bulk — dropped to keep the payload small. */
var COT_BO_QUA_KHI_TRUY_VAN = ['mo_ta_ngan'];

/** Hard ceiling on rows sent to the browser in one response. Aggregates still cover everything. */
var TRAN_DONG_GUI_UI = 3000;

/**
 * Read SAN_PHAM + LAN_QUET once and join the scan verdict onto every product row.
 * The only function in this file that touches the sheet.
 */
function docKhoDuLieu() {
  var lanQuet = docBangLanQuet();
  var b = layHoacTaoBang(TEN_BANG.SAN_PHAM, COT_SAN_PHAM);
  var hang = [];
  var lastRow = b.getLastRow();
  if (lastRow >= 2) {
    var gt = b.getRange(2, 1, lastRow - 1, COT_SAN_PHAM.length).getValues();
    for (var r = 0; r < gt.length; r++) {
      var o = {};
      for (var c = 0; c < COT_SAN_PHAM.length; c++) o[COT_SAN_PHAM[c]] = gt[r][c];
      if (String(o.ma_lan_quet) === '') continue;
      var lq = lanQuet[String(o.ma_lan_quet)];
      o._ket_luan = lq ? lq.ket_luan : '';
      o._bac = lq ? lq.bac_thang_dung : '';
      hang.push(o);
    }
  }
  return { hang: hang, lanQuet: lanQuet, tong: hang.length };
}

/** LAN_QUET as {ma_lan_quet: {...}}. */
function docBangLanQuet() {
  var b = layHoacTaoBang(TEN_BANG.LAN_QUET, COT_LAN_QUET);
  var ra = {};
  var lastRow = b.getLastRow();
  if (lastRow < 2) return ra;
  var gt = b.getRange(2, 1, lastRow - 1, COT_LAN_QUET.length).getValues();
  for (var r = 0; r < gt.length; r++) {
    var o = {};
    for (var c = 0; c < COT_LAN_QUET.length; c++) o[COT_LAN_QUET[c]] = gt[r][c];
    if (String(o.ma_lan_quet) === '') continue;
    ra[String(o.ma_lan_quet)] = o;
  }
  return ra;
}

/* ------------------------------------------------------------------- filtering */

function taoBoLocRong() {
  return {
    maLanQuet: [], tenMien: [], thuongHieu: [], danhMuc: [], nenTang: [], ketLuan: [],
    conHang: '', giaTu: null, giaDen: null, coGia: false, tuKhoa: '', chiMoiNhat: true
  };
}

function coTrongDanhSach(ds, v) {
  if (!ds || ds.length === 0) return true;
  return ds.indexOf(String(v)) >= 0;
}

/**
 * For each nguon_url keep only the newest scan. Without this, scanning a store twice
 * silently doubles every product in every table and every average.
 */
function locLanQuetMoiNhat(hang) {
  var moiNhat = {};
  for (var i = 0; i < hang.length; i++) {
    var u = String(hang[i].nguon_url);
    var ng = String(hang[i].ngay_quet);
    if (!moiNhat[u] || ng > moiNhat[u].ngay) moiNhat[u] = { ngay: ng, ma: String(hang[i].ma_lan_quet) };
  }
  var ra = [];
  for (var j = 0; j < hang.length; j++) {
    var u2 = String(hang[j].nguon_url);
    if (moiNhat[u2] && moiNhat[u2].ma === String(hang[j].ma_lan_quet)) ra.push(hang[j]);
  }
  return ra;
}

/** Apply a filter set. Pure. */
function locHang(hang, boLoc) {
  var bl = boLoc || taoBoLocRong();
  var ds = bl.chiMoiNhat ? locLanQuetMoiNhat(hang) : hang;
  var tuKhoa = String(bl.tuKhoa || '').trim().toLowerCase();
  var ra = [];
  for (var i = 0; i < ds.length; i++) {
    var h = ds[i];
    if (!coTrongDanhSach(bl.maLanQuet, h.ma_lan_quet)) continue;
    if (!coTrongDanhSach(bl.tenMien, h.ten_mien)) continue;
    if (!coTrongDanhSach(bl.thuongHieu, h.thuong_hieu)) continue;
    if (!coTrongDanhSach(bl.danhMuc, h.danh_muc)) continue;
    if (!coTrongDanhSach(bl.nenTang, h.nen_tang)) continue;
    if (!coTrongDanhSach(bl.ketLuan, h._ket_luan)) continue;
    if (bl.conHang && String(h.con_hang) !== bl.conHang) continue;

    var gia = laSo(h.gia_ban) ? Number(h.gia_ban) : null;
    if (bl.coGia && gia === null) continue;
    if (bl.giaTu !== null && bl.giaTu !== undefined && bl.giaTu !== '' && (gia === null || gia < Number(bl.giaTu))) continue;
    if (bl.giaDen !== null && bl.giaDen !== undefined && bl.giaDen !== '' && (gia === null || gia > Number(bl.giaDen))) continue;

    if (tuKhoa !== '') {
      var kho = (String(h.ten) + ' ' + String(h.sku) + ' ' + String(h.thuong_hieu) + ' ' +
                 String(h.danh_muc) + ' ' + String(h.phien_ban)).toLowerCase();
      if (kho.indexOf(tuKhoa) < 0) continue;
    }
    ra.push(h);
  }
  return ra;
}

function laSo(v) {
  if (v === null || v === undefined || v === '') return false;
  var n = Number(v);
  return isFinite(n);
}

/** Sort rows. Empty cells always sort last, whichever direction. */
function sapXepHang(hang, cot, giamDan) {
  var ds = hang.slice();
  ds.sort(function (a, b) {
    var x = a[cot], y = b[cot];
    var xRong = (x === null || x === undefined || x === '');
    var yRong = (y === null || y === undefined || y === '');
    if (xRong && yRong) return 0;
    if (xRong) return 1;
    if (yRong) return -1;
    var so = laSo(x) && laSo(y);
    var kq = so ? (Number(x) - Number(y)) : String(x).localeCompare(String(y), 'vi');
    return giamDan ? -kq : kq;
  });
  return ds;
}

/* ----------------------------------------------------------------- statistics */

/** Descriptive stats over a numeric list. Returns nulls (never 0) when there is no data. */
function thongKeSo(ds) {
  var so = [];
  for (var i = 0; i < ds.length; i++) if (laSo(ds[i])) so.push(Number(ds[i]));
  if (so.length === 0) return { n: 0, min: null, max: null, trungVi: null, trungBinh: null, p25: null, p75: null, tong: null };
  so.sort(function (a, b) { return a - b; });
  var tong = 0;
  for (var j = 0; j < so.length; j++) tong += so[j];
  return {
    n: so.length,
    min: so[0],
    max: so[so.length - 1],
    trungVi: phanVi(so, 0.5),
    p25: phanVi(so, 0.25),
    p75: phanVi(so, 0.75),
    trungBinh: Math.round((tong / so.length) * 100) / 100,
    tong: tong
  };
}

/** Linear-interpolated percentile over a pre-sorted array. */
function phanVi(daSapXep, p) {
  if (daSapXep.length === 0) return null;
  if (daSapXep.length === 1) return daSapXep[0];
  var vt = (daSapXep.length - 1) * p;
  var duoi = Math.floor(vt);
  var tren = Math.ceil(vt);
  if (duoi === tren) return daSapXep[duoi];
  return Math.round((daSapXep[duoi] + (daSapXep[tren] - daSapXep[duoi]) * (vt - duoi)) * 100) / 100;
}

/** Group rows by a column and describe gia_ban within each group. */
function gomNhomTheoGia(hang, cotNhom, tuyChon) {
  var tc = tuyChon || {};
  var nhom = {};
  var thuTu = [];
  for (var i = 0; i < hang.length; i++) {
    var k = String(hang[i][cotNhom] === undefined || hang[i][cotNhom] === '' ? '(không ghi)' : hang[i][cotNhom]);
    if (!nhom[k]) { nhom[k] = []; thuTu.push(k); }
    nhom[k].push(hang[i]);
  }
  var ra = [];
  for (var j = 0; j < thuTu.length; j++) {
    var ds = nhom[thuTu[j]];
    var gia = ds.map(function (h) { return h.gia_ban; });
    var tk = thongKeSo(gia);
    var conHang = 0;
    for (var k2 = 0; k2 < ds.length; k2++) if (String(ds[k2].con_hang) === 'CON') conHang++;
    ra.push({
      nhom: thuTu[j],
      soDong: ds.length,
      soCoGia: tk.n,
      tyLeCoGia: ds.length === 0 ? 0 : tk.n / ds.length,
      min: tk.min, p25: tk.p25, trungVi: tk.trungVi, p75: tk.p75, max: tk.max,
      trungBinh: tk.trungBinh,
      soConHang: conHang,
      tienTe: tienTeChinh(ds)
    });
  }
  ra.sort(function (a, b) { return b.soDong - a.soDong; });
  if (tc.toiDa && ra.length > tc.toiDa) return ra.slice(0, tc.toiDa);
  return ra;
}

/** The currency that actually appears in these rows. '' when mixed or unknown — never assumed. */
function tienTeChinh(hang) {
  var thay = {};
  for (var i = 0; i < hang.length; i++) {
    var t = String(hang[i].tien_te || '').trim();
    if (t !== '') thay[t] = (thay[t] || 0) + 1;
  }
  var khoa = Object.keys(thay);
  if (khoa.length === 0) return '';
  if (khoa.length === 1) return khoa[0];
  khoa.sort(function (a, b) { return thay[b] - thay[a]; });
  return khoa[0] + ' (+' + (khoa.length - 1) + ' đơn vị khác)';
}

/** Histogram buckets over gia_ban. Bucket width is a round number, not an arbitrary split. */
function chiaKhoangGia(hang, soKhoangMongMuon) {
  var so = [];
  for (var i = 0; i < hang.length; i++) if (laSo(hang[i].gia_ban)) so.push(Number(hang[i].gia_ban));
  if (so.length === 0) return { khoang: [], min: null, max: null, buoc: null };
  so.sort(function (a, b) { return a - b; });
  var min = so[0], max = so[so.length - 1];
  if (min === max) {
    return { khoang: [{ tu: min, den: min, so: so.length, nhan: dinhDangSo(min) }], min: min, max: max, buoc: 0 };
  }
  var n = soKhoangMongMuon || 12;
  var buoc = lamTronBuoc((max - min) / n);
  var batDau = Math.floor(min / buoc) * buoc;
  var khoang = [];
  for (var v = batDau; v <= max; v += buoc) {
    khoang.push({ tu: v, den: v + buoc, so: 0, nhan: dinhDangSo(v) + '–' + dinhDangSo(v + buoc) });
    if (khoang.length > 200) break;
  }
  for (var j = 0; j < so.length; j++) {
    var vt = Math.floor((so[j] - batDau) / buoc);
    if (vt < 0) vt = 0;
    if (vt >= khoang.length) vt = khoang.length - 1;
    khoang[vt].so++;
  }
  return { khoang: khoang, min: min, max: max, buoc: buoc };
}

/** Round a raw step up to 1/2/5 × 10^n so axis labels are readable. */
function lamTronBuoc(tho) {
  if (!(tho > 0)) return 1;
  var mu = Math.pow(10, Math.floor(Math.log(tho) / Math.LN10));
  var tyLe = tho / mu;
  var chon = tyLe <= 1 ? 1 : (tyLe <= 2 ? 2 : (tyLe <= 5 ? 5 : 10));
  return chon * mu;
}

function dinhDangSo(n) {
  if (n === null || n === undefined || n === '') return '';
  var s = String(Math.round(Number(n)));
  var ra = '';
  var dem = 0;
  for (var i = s.length - 1; i >= 0; i--) {
    ra = s.charAt(i) + ra;
    dem++;
    if (dem % 3 === 0 && i > 0) ra = '.' + ra;
  }
  return ra;
}

/* --------------------------------------------------------- trust propagation */

var THU_TU_KET_LUAN = ['CAO', 'TRUNG_BINH', 'THAP', 'KHONG_QUET_DUOC'];

/** Worst verdict wins. A table mixing CAO and THAP rows is a THAP table. */
function ketLuanXauNhat(ds) {
  var xau = -1;
  for (var i = 0; i < ds.length; i++) {
    var vt = THU_TU_KET_LUAN.indexOf(String(ds[i]));
    if (vt > xau) xau = vt;
  }
  return xau < 0 ? '' : THU_TU_KET_LUAN[xau];
}

/**
 * Trust summary for any set of rows: which scans produced them, what each scan's verdict
 * was, the worst one, and the measured price fill of THIS selection (not of the scan).
 */
function tomTatTinCay(hang, banDoLanQuet) {
  var theoLanQuet = {};
  var coGia = 0;
  for (var i = 0; i < hang.length; i++) {
    var ma = String(hang[i].ma_lan_quet);
    if (!theoLanQuet[ma]) {
      var lq = banDoLanQuet ? banDoLanQuet[ma] : null;
      theoLanQuet[ma] = {
        maLanQuet: ma,
        ketLuan: lq ? String(lq.ket_luan) : String(hang[i]._ket_luan || ''),
        bac: lq ? String(lq.bac_thang_dung) : String(hang[i]._bac || ''),
        url: String(hang[i].nguon_url),
        ngay: String(hang[i].ngay_quet),
        soDong: 0
      };
    }
    theoLanQuet[ma].soDong++;
    if (laSo(hang[i].gia_ban)) coGia++;
  }
  var ds = Object.keys(theoLanQuet).map(function (k) { return theoLanQuet[k]; });
  ds.sort(function (a, b) { return b.soDong - a.soDong; });
  var dem = { CAO: 0, TRUNG_BINH: 0, THAP: 0, KHONG_QUET_DUOC: 0, '': 0 };
  for (var j = 0; j < ds.length; j++) {
    var k2 = dem[ds[j].ketLuan] === undefined ? '' : ds[j].ketLuan;
    dem[k2]++;
  }
  var xauNhat = ketLuanXauNhat(ds.map(function (x) { return x.ketLuan; }));
  return {
    soDong: hang.length,
    soLanQuet: ds.length,
    lanQuet: ds,
    dem: dem,
    ketLuan: xauNhat,
    tyLeCoGia: hang.length === 0 ? 0 : coGia / hang.length,
    cau: cauTinCay(xauNhat, ds, hang.length),
    viecCanLam: xauNhat === '' ? '' : viecCanLam(xauNhat)
  };
}

function cauTinCay(xauNhat, dsLanQuet, soDong) {
  if (soDong === 0) return 'Không có dòng nào khớp bộ lọc.';
  if (dsLanQuet.length === 1) {
    return 'Dữ liệu đến từ 1 lần quét, kết luận ' + (xauNhat || 'không rõ') + '. ' + (CAU_KET_LUAN[xauNhat] || '');
  }
  var dem = {};
  for (var i = 0; i < dsLanQuet.length; i++) {
    var k = dsLanQuet[i].ketLuan || 'không rõ';
    dem[k] = (dem[k] || 0) + 1;
  }
  var mo = Object.keys(dem).map(function (k) { return dem[k] + '×' + k; }).join(', ');
  return 'Dữ liệu trộn từ ' + dsLanQuet.length + ' lần quét (' + mo + '). ' +
         'Cả bảng này chỉ đáng tin ở mức thấp nhất trong số đó: ' + (xauNhat || 'không rõ') + '.';
}

/** Distinct values for the filter dropdowns, with counts. */
function mucChonLoc(hang) {
  function dem(cot) {
    var m = {};
    for (var i = 0; i < hang.length; i++) {
      var v = String(hang[i][cot] === undefined || hang[i][cot] === '' ? '' : hang[i][cot]);
      if (v === '') continue;
      m[v] = (m[v] || 0) + 1;
    }
    var ds = Object.keys(m).map(function (k) { return { gia_tri: k, so: m[k] }; });
    ds.sort(function (a, b) { return b.so - a.so || a.gia_tri.localeCompare(b.gia_tri, 'vi'); });
    return ds.slice(0, 300);
  }
  return {
    tenMien: dem('ten_mien'),
    thuongHieu: dem('thuong_hieu'),
    danhMuc: dem('danh_muc'),
    nenTang: dem('nen_tang'),
    ketLuan: dem('_ket_luan')
  };
}

/** Rows -> CSV. Excel-safe: BOM is added by the client, cells are quoted. */
function hangThanhCsv(cot, hang) {
  function o(v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    if (/["\n,;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  var d = [cot.map(o).join(',')];
  for (var i = 0; i < hang.length; i++) {
    var r = [];
    for (var j = 0; j < cot.length; j++) r.push(o(hang[i][cot[j]]));
    d.push(r.join(','));
  }
  return d.join('\n');
}
