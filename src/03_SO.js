/**
 * 03_SO.js — number parsing. Pure, no network, no side effects.
 *
 * Two different parsers on purpose, because they read two different things:
 *
 *  - phanTichGiaNguoiDoc(): text written for a human ("1.250.000₫"). Vietnamese grouping.
 *    It REJECTS anything ambiguous instead of guessing. "3.5" is null, never 35.
 *  - phanTichSoMay(): a machine decimal from a JSON API ("259000.00", 259000).
 *    Here the dot IS a decimal point, by the API contract.
 *
 * Calling the wrong one on the wrong input is the single easiest way to invent a price,
 * so every call site names which one it means.
 */

var KY_HIEU_TIEN_TE = [
  { mau: /(₫|đ|Đ|VNĐ|VND|vnd)/g, ma: 'VND' },
  { mau: /(US\$|USD|\$)/g, ma: 'USD' },
  { mau: /(EUR|€)/g, ma: 'EUR' },
  { mau: /(JPY|¥)/g, ma: 'JPY' },
  { mau: /(GBP|£)/g, ma: 'GBP' },
  { mau: /(THB|฿)/g, ma: 'THB' },
  { mau: /(SGD|S\$)/g, ma: 'SGD' },
  { mau: /(MYR|RM)/g, ma: 'MYR' },
  { mau: /(CNY|RMB)/g, ma: 'CNY' },
  { mau: /(KRW|₩)/g, ma: 'KRW' }
];

/** Shorthand amounts we refuse rather than expand. No rule has been written and tested for them. */
var MAU_VIET_TAT = /(\d)\s*(k|nghìn|nghin|ngàn|ngan|tr|trieu|triệu|m|củ|cu|tỷ|ty|b)\b/i;

function ketQuaGia(gia, tienTe, daBo, lyDo) {
  return { gia: gia, tienTe: tienTe, daBo: daBo, lyDo: lyDo };
}

/**
 * Parse a human-written price string.
 * @return {{gia:(number|null), tienTe:(string|null), daBo:string, lyDo:string}}
 *   gia === null means "we could not read it" — the caller must write an empty cell and
 *   count it. lyDo always says why.
 */
function phanTichGiaNguoiDoc(dauVao) {
  if (dauVao === null || dauVao === undefined) return ketQuaGia(null, null, '', 'gia_tri_rong');
  if (typeof dauVao === 'number') {
    if (!isFinite(dauVao)) return ketQuaGia(null, null, '', 'so_khong_hop_le');
    if (dauVao < 0) return ketQuaGia(null, null, '', 'gia_am');
    return ketQuaGia(dauVao, null, '', 'so_san_co_khong_co_ky_hieu_tien_te');
  }
  var s = String(dauVao);
  s = s.replace(/ | | | /g, ' ').trim();
  if (s === '') return ketQuaGia(null, null, '', 'gia_tri_rong');

  // 1. Currency markers: detect and strip, remembering what was stripped.
  var tienTe = null;
  var daBo = [];
  for (var i = 0; i < KY_HIEU_TIEN_TE.length; i++) {
    var m = s.match(KY_HIEU_TIEN_TE[i].mau);
    if (m) {
      if (tienTe === null) tienTe = KY_HIEU_TIEN_TE[i].ma;
      else if (tienTe !== KY_HIEU_TIEN_TE[i].ma) {
        return ketQuaGia(null, null, m.join(''), 'nhieu_ky_hieu_tien_te_khac_nhau');
      }
      for (var j = 0; j < m.length; j++) daBo.push(m[j]);
      s = s.replace(KY_HIEU_TIEN_TE[i].mau, ' ');
    }
  }
  var chuoiDaBo = daBo.join('');

  // 2. Shorthand ("250k", "1tr2") is refused, not expanded.
  if (MAU_VIET_TAT.test(s)) {
    return ketQuaGia(null, tienTe, chuoiDaBo, 'viet_tat_khong_duoc_ho_tro (' + String(dauVao).trim() + ')');
  }
  if (/[a-zA-ZÀ-ỹ]/.test(s)) {
    return ketQuaGia(null, tienTe, chuoiDaBo, 'con_chu_trong_chuoi_gia');
  }
  if (/-/.test(s)) {
    return ketQuaGia(null, tienTe, chuoiDaBo, 'co_dau_tru_hoac_khoang_gia');
  }

  s = s.replace(/\s+/g, ' ').trim();
  if (s === '') return ketQuaGia(null, tienTe, chuoiDaBo, 'khong_co_chu_so');
  if (!/^[0-9][0-9., ]*$/.test(s)) {
    return ketQuaGia(null, tienTe, chuoiDaBo, 'ky_tu_la_trong_chuoi_gia');
  }

  var ket = docNhomChuSo(s);
  if (ket.gia === null) return ketQuaGia(null, tienTe, chuoiDaBo, ket.lyDo);
  return ketQuaGia(ket.gia, tienTe, chuoiDaBo, tienTe === null ? 'khong_thay_ky_hieu_tien_te' : '');
}

/**
 * Digit-group reader. Only exact 3-digit groups after a separator are accepted.
 * A single separator followed by 1 or 2 digits is REFUSED: "3.5" must never become 35,
 * and "1.250.00" must never become 125000.
 */
function docNhomChuSo(s) {
  var dauPhanCach = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (c === '.' || c === ',' || c === ' ') dauPhanCach.push(c);
  }
  if (dauPhanCach.length === 0) {
    if (!/^\d+$/.test(s)) return { gia: null, lyDo: 'khong_phai_so_nguyen' };
    return { gia: parseInt(s, 10), lyDo: '' };
  }

  var rieng = {};
  for (var k = 0; k < dauPhanCach.length; k++) rieng[dauPhanCach[k]] = true;
  var loai = Object.keys(rieng);

  if (loai.length > 2) return { gia: null, lyDo: 'qua_nhieu_kieu_dau_phan_cach' };

  if (loai.length === 2) {
    // Mixed separators: the LAST one is the decimal point, the other groups thousands.
    var cuoi = s.charAt(indexCuaDauCuoi(s));
    var nhomChar = loai[0] === cuoi ? loai[1] : loai[0];
    if (nhomChar === ' ' && cuoi === ' ') return { gia: null, lyDo: 'dau_phan_cach_mo_ho' };
    var viTri = s.lastIndexOf(cuoi);
    if (s.substring(viTri + 1).indexOf(nhomChar) >= 0) return { gia: null, lyDo: 'dau_phan_cach_lan_lon' };
    var phanNguyen = s.substring(0, viTri);
    var phanLe = s.substring(viTri + 1);
    if (!/^\d{1,2}$/.test(phanLe)) return { gia: null, lyDo: 'phan_thap_phan_khong_hop_le' };
    var ngKet = ghepNhom(phanNguyen, nhomChar);
    if (ngKet.gia === null) return ngKet;
    return { gia: Number(String(ngKet.gia) + '.' + phanLe), lyDo: '' };
  }

  return ghepNhom(s, loai[0]);
}

function indexCuaDauCuoi(s) {
  for (var i = s.length - 1; i >= 0; i--) {
    var c = s.charAt(i);
    if (c === '.' || c === ',' || c === ' ') return i;
  }
  return -1;
}

/** Join thousand groups: first group 1..3 digits, every following group exactly 3. */
function ghepNhom(s, dau) {
  var phan = s.split(dau);
  if (phan.length < 2) {
    if (!/^\d+$/.test(s)) return { gia: null, lyDo: 'khong_phai_so_nguyen' };
    return { gia: parseInt(s, 10), lyDo: '' };
  }
  if (!/^\d{1,3}$/.test(phan[0])) return { gia: null, lyDo: 'nhom_dau_tien_khong_tu_1_den_3_chu_so' };
  for (var i = 1; i < phan.length; i++) {
    if (!/^\d{3}$/.test(phan[i])) {
      return { gia: null, lyDo: 'nhom_sau_dau_phan_cach_khong_du_3_chu_so (' + s + ')' };
    }
  }
  return { gia: parseInt(phan.join(''), 10), lyDo: '' };
}

/**
 * Parse a machine decimal from a JSON API. The dot is a decimal point here, by contract.
 * @return {{gia:(number|null), lyDo:string}}
 */
function phanTichSoMay(dauVao) {
  if (dauVao === null || dauVao === undefined || dauVao === '') return { gia: null, lyDo: 'gia_tri_rong' };
  if (typeof dauVao === 'number') {
    if (!isFinite(dauVao) || dauVao < 0) return { gia: null, lyDo: 'so_khong_hop_le' };
    return { gia: dauVao, lyDo: '' };
  }
  var s = String(dauVao).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return { gia: null, lyDo: 'khong_phai_so_thap_phan_may (' + s.substring(0, 40) + ')' };
  var n = Number(s);
  if (!isFinite(n)) return { gia: null, lyDo: 'so_khong_hop_le' };
  return { gia: n, lyDo: '' };
}

/** Integer counts (review count, sold count, stock). Rejects anything not a plain integer. */
function phanTichSoNguyen(dauVao) {
  if (dauVao === null || dauVao === undefined || dauVao === '') return { so: null, lyDo: 'gia_tri_rong' };
  if (typeof dauVao === 'number') {
    if (!isFinite(dauVao) || Math.floor(dauVao) !== dauVao) return { so: null, lyDo: 'khong_phai_so_nguyen' };
    return { so: dauVao, lyDo: '' };
  }
  var s = String(dauVao).trim().replace(/[.,  ]/g, '');
  if (!/^\d+$/.test(s)) return { so: null, lyDo: 'khong_phai_so_nguyen (' + String(dauVao).substring(0, 30) + ')' };
  return { so: parseInt(s, 10), lyDo: '' };
}

/** Ratings like "4.5" or "4,5" — a decimal, capped at 5. */
function phanTichSao(dauVao) {
  if (dauVao === null || dauVao === undefined || dauVao === '') return { sao: null, lyDo: 'gia_tri_rong' };
  var s = String(dauVao).trim().replace(',', '.');
  if (!/^\d(\.\d{1,2})?$|^\d{1,2}(\.\d{1,2})?$/.test(s)) return { sao: null, lyDo: 'khong_phai_diem_danh_gia' };
  var n = Number(s);
  if (!isFinite(n) || n < 0 || n > 5) return { sao: null, lyDo: 'diem_danh_gia_ngoai_khoang_0_5' };
  return { sao: n, lyDo: '' };
}

/**
 * Price from a JSON-LD / microdata / OG field. Those are supposed to carry machine decimals,
 * but Vietnamese sites routinely put "1.250.000" there, so we try machine first and fall
 * back to the human reader. Records which route was taken.
 */
function phanTichGiaLinhHoat(dauVao, tienTeGoiY) {
  var may = phanTichSoMay(dauVao);
  if (may.gia !== null) {
    var kq = ketQuaGia(may.gia, tienTeGoiY || null, '', 'doc_kieu_so_may');
    kq.canhBao = canhBaoGiaKhoTin(may.gia, kq.tienTe);
    return kq;
  }
  var nguoi = phanTichGiaNguoiDoc(dauVao);
  if (nguoi.gia !== null && nguoi.tienTe === null && tienTeGoiY) nguoi.tienTe = tienTeGoiY;
  nguoi.canhBao = canhBaoGiaKhoTin(nguoi.gia, nguoi.tienTe);
  return nguoi;
}

/** A VND price below 1.000 or with decimals is almost certainly a misread. Flag, never fix. */
function canhBaoGiaKhoTin(gia, tienTe) {
  if (gia === null) return '';
  if (tienTe === 'VND' && (gia < 1000 || Math.floor(gia) !== gia)) {
    return 'gia_VND_kho_tin (' + gia + ') — có thể nguồn ghi sai đơn vị, hãy kiểm tra tay';
  }
  return '';
}

/** Find a currency-adjacent number in free text. Used only by rung 5. */
function timGiaTrongVanBan(vanBan) {
  var s = String(vanBan || '').replace(/ /g, ' ');
  var mau = /(?:(₫|đ|VNĐ|VND|\$|€|£|¥)\s*([0-9][0-9., ]{2,})|([0-9][0-9., ]{2,})\s*(₫|đ|VNĐ|VND|\$|€|£|¥))/g;
  var ra = [];
  var m;
  var vong = 0;
  while ((m = mau.exec(s)) !== null && vong < 400) {
    vong++;
    var so = m[2] !== undefined ? m[2] : m[3];
    var ky = m[1] !== undefined ? m[1] : m[4];
    ra.push({ chuoi: (so + ' ' + ky).trim(), viTri: m.index, thoChuoi: m[0] });
  }
  return ra;
}
