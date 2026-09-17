/**
 * 08_KET_LUAN.js — the verdict. The most important output of this tool.
 *
 * It is COMPUTED from the rows that were actually produced. There is no code path that
 * can return CAO without having counted filled cells first. If you change this file,
 * run test/ket_luan.test.js and test/dot_bien.test.js before committing.
 */

/** Rows are useless without these four, so CAO requires all four at >= 95%. */
var TRUONG_LOI = ['ma_ngoai', 'url_san_pham', 'ten', 'gia_ban'];

var NGUONG = {
  CAO: 0.95,
  TRUNG_BINH: 0.70,
  THIEU_NHIEU: 0.50
};

function coGiaTri(v) {
  return !(v === null || v === undefined || v === '');
}

/**
 * Accumulator. A scan can be cut in half by the 6-minute wall and resumed in another
 * execution, so the verdict cannot be computed from "the rows in memory" — it is computed
 * from counters that are carried across executions in the saved cursor.
 */
function taoTichLuy() {
  var dem = {};
  for (var i = 0; i < TRUONG_SAN_PHAM.length; i++) dem[TRUONG_SAN_PHAM[i]] = 0;
  return { tong: 0, dem: dem, lyDoThieu: {}, canhBao: {} };
}

/** Count a batch of rows into the accumulator. This is the only place fill rates come from. */
function congTichLuy(tichLuy, hang) {
  for (var j = 0; j < hang.length; j++) {
    tichLuy.tong++;
    for (var k = 0; k < TRUONG_SAN_PHAM.length; k++) {
      var tr = TRUONG_SAN_PHAM[k];
      if (coGiaTri(hang[j][tr])) {
        tichLuy.dem[tr]++;
      } else {
        var l = hang[j]._thieu && hang[j]._thieu[tr] ? String(hang[j]._thieu[tr]) : 'khong_ro_ly_do';
        l = l.replace(/\s*\([^)]*\)\s*$/, '');
        if (!tichLuy.lyDoThieu[tr]) tichLuy.lyDoThieu[tr] = {};
        tichLuy.lyDoThieu[tr][l] = (tichLuy.lyDoThieu[tr][l] || 0) + 1;
      }
    }
    var cb = hang[j]._canhBao || [];
    for (var c = 0; c < cb.length; c++) tichLuy.canhBao[cb[c]] = (tichLuy.canhBao[cb[c]] || 0) + 1;
  }
  return tichLuy;
}

function coGiaTri(v) {
  return !(v === null || v === undefined || v === '');
}

/** Top reasons a field stayed empty, for the ly_do column. */
function lyDoHayGap(tichLuy, truong, toiDa) {
  var m = tichLuy.lyDoThieu[truong] || {};
  var ds = Object.keys(m).map(function (k) { return { lyDo: k, so: m[k] }; });
  ds.sort(function (a, b) { return b.so - a.so; });
  return ds.slice(0, toiDa || 3);
}

/**
 * Verdict from a finished, in-memory row set. Thin wrapper — the real work is below.
 * @param {Array} hang rows actually extracted
 * @param {string} bacDung which rung produced them
 * @param {{lyDo:string}|null} thatBai set when the ladder ended at rung 6
 */
function tinhKetLuan(hang, bacDung, thatBai) {
  return tinhKetLuanTuTichLuy(congTichLuy(taoTichLuy(), hang || []), bacDung, thatBai);
}

/**
 * Compute the verdict from measured counters.
 * @return {{ketLuan, tyLeCoGia, tyLeCoMa, truongThieuNhieu, lyDo, tyLe, soSp, cau}}
 */
function tinhKetLuanTuTichLuy(tichLuy, bacDung, thatBai) {
  var tong = tichLuy.tong;
  var tyLe = {};
  for (var i = 0; i < TRUONG_SAN_PHAM.length; i++) {
    tyLe[TRUONG_SAN_PHAM[i]] = tong === 0 ? 0 : tichLuy.dem[TRUONG_SAN_PHAM[i]] / tong;
  }
  var tyLeCoGia = tyLe.gia_ban;
  var tyLeCoMa = tyLe.ma_ngoai;

  var thieu = [];
  for (var t = 0; t < TRUONG_SAN_PHAM.length; t++) {
    if (tong > 0 && tyLe[TRUONG_SAN_PHAM[t]] < NGUONG.THIEU_NHIEU) {
      thieu.push({ truong: TRUONG_SAN_PHAM[t], tyLe: tyLe[TRUONG_SAN_PHAM[t]] });
    }
  }
  thieu.sort(function (a, b) { return a.tyLe - b.tyLe; });
  var chuoiThieu = thieu.map(function (x) {
    return x.truong + ' (' + Math.round(x.tyLe * 100) + '%)';
  }).join(', ');

  if (tong === 0 || bacDung === BAC.BAC_6_KHONG_QUET_DUOC || !bacDung) {
    return {
      ketLuan: KET_LUAN.KHONG_QUET_DUOC,
      tyLeCoGia: 0,
      tyLeCoMa: 0,
      truongThieuNhieu: 'tất cả (không có dòng nào)',
      lyDo: thatBai && thatBai.lyDo ? thatBai.lyDo : 'Không tìm được sản phẩm nào ở bất kỳ bậc nào của thang dò.',
      tyLe: tyLe,
      soSp: 0,
      cau: CAU_KET_LUAN.KHONG_QUET_DUOC
    };
  }

  var laBacApi = (bacDung === BAC.BAC_1_PRODUCTS_JSON || bacDung === BAC.BAC_2_WOO_STORE_API);
  var laBacCauTruc = (bacDung === BAC.BAC_3_SITEMAP_LD || bacDung === BAC.BAC_4_TRANG_DON_LD);

  var ketLuan;
  var lyDo = [];
  lyDo.push('Đọc được ' + tong + ' dòng ở ' + tenBacTiengViet(bacDung) + '.');
  lyDo.push('Tỷ lệ có giá: ' + (tyLeCoGia * 100).toFixed(1) + '%.');

  if (tyLeCoGia < NGUONG.TRUNG_BINH) {
    ketLuan = KET_LUAN.THAP;
    lyDo.push('Dưới 70% số dòng có giá nên kết luận bị hạ xuống THẤP.');
  } else if (bacDung === BAC.BAC_5_HTML_DOAN) {
    ketLuan = KET_LUAN.THAP;
    lyDo.push('Dữ liệu do đoán từ HTML (bậc 5) nên trần kết luận là THẤP.');
  } else if (laBacApi) {
    var duLoi = true;
    var thieuLoi = [];
    for (var j = 0; j < TRUONG_LOI.length; j++) {
      if (tyLe[TRUONG_LOI[j]] < NGUONG.CAO) {
        duLoi = false;
        thieuLoi.push(TRUONG_LOI[j] + ' ' + Math.round(tyLe[TRUONG_LOI[j]] * 100) + '%');
      }
    }
    if (duLoi) {
      ketLuan = KET_LUAN.CAO;
      lyDo.push('Lấy thẳng từ API sản phẩm của nền tảng, đủ 95% cho cả mã, tên, link và giá.');
    } else {
      ketLuan = KET_LUAN.TRUNG_BINH;
      lyDo.push('Tuy lấy từ API nhưng có trường lõi chưa đủ 95%: ' + thieuLoi.join(', ') + '.');
    }
  } else if (laBacCauTruc) {
    ketLuan = KET_LUAN.TRUNG_BINH;
    lyDo.push('Dữ liệu đọc từ thẻ dữ liệu có cấu trúc trên trang web (bậc 3–4), không phải API.');
  } else {
    ketLuan = KET_LUAN.THAP;
    lyDo.push('Nguồn không xác định được độ tin cậy nên hạ xuống THẤP.');
  }

  if (chuoiThieu !== '') lyDo.push('Trường trống nhiều: ' + chuoiThieu + '.');
  var lyDoGia = lyDoHayGap(tichLuy, 'gia_ban', 2);
  if (lyDoGia.length) {
    lyDo.push('Lý do thiếu giá hay gặp nhất: ' + lyDoGia.map(function (x) { return x.lyDo + ' × ' + x.so; }).join('; ') + '.');
  }
  var khoaCb = Object.keys(tichLuy.canhBao || {});
  if (khoaCb.length) {
    lyDo.push('Cảnh báo: ' + khoaCb.slice(0, 2).map(function (k) { return k + ' × ' + tichLuy.canhBao[k]; }).join('; ') + '.');
  }

  return {
    ketLuan: ketLuan,
    tyLeCoGia: tyLeCoGia,
    tyLeCoMa: tyLeCoMa,
    truongThieuNhieu: chuoiThieu === '' ? '(không có)' : chuoiThieu,
    lyDo: lyDo.join(' '),
    tyLe: tyLe,
    soSp: tong,
    cau: CAU_KET_LUAN[ketLuan]
  };
}

function tenBacTiengViet(bac) {
  switch (bac) {
    case BAC.BAC_1_PRODUCTS_JSON: return 'bậc 1 (API products.json của nền tảng)';
    case BAC.BAC_2_WOO_STORE_API: return 'bậc 2 (WooCommerce Store API)';
    case BAC.BAC_3_SITEMAP_LD: return 'bậc 3 (sitemap + dữ liệu có cấu trúc)';
    case BAC.BAC_4_TRANG_DON_LD: return 'bậc 4 (dữ liệu có cấu trúc của một trang)';
    case BAC.BAC_5_HTML_DOAN: return 'bậc 5 (đoán từ HTML)';
    case BAC.BAC_6_KHONG_QUET_DUOC: return 'bậc 6 (không quét được)';
    default: return 'không rõ bậc';
  }
}

/** What the operator should do next, per verdict. Shown in the UI and in HUONG-DAN.md. */
function viecCanLam(ketLuan) {
  switch (ketLuan) {
    case KET_LUAN.CAO:
      return 'Dùng được ngay. Vẫn nên liếc qua cột tien_te: nếu trống thì đơn vị tiền chưa được xác minh.';
    case KET_LUAN.TRUNG_BINH:
      return 'Mở 3 dòng bất kỳ, bấm vào url_san_pham, so giá trên trang với cột gia_ban. Khớp cả 3 thì dùng được.';
    case KET_LUAN.THAP:
      return 'Coi đây là đầu mối, chưa phải dữ liệu. Kiểm chứng tay từng dòng trước khi đưa vào bất kỳ quyết định giá nào.';
    default:
      return 'Không có dòng nào được ghi. Đọc cột ly_do trong bảng LAN_QUET để biết vì sao và đi đường chính thức (API của nền tảng hoặc xuất dữ liệu tay).';
  }
}
