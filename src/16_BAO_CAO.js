/**
 * 16_BAO_CAO.js — the report builder. Pure: it takes an already-loaded data store and a
 * report definition, and returns a report object (columns, rows, chart data, stat tiles,
 * trust summary, warnings). Nothing here reads the sheet or the network.
 *
 * Two design rules, both inherited from the scanner itself:
 *   1. A report never looks more confident than the weakest scan feeding it.
 *   2. The report says out loud what would make it wrong — mixed currencies, snapshots
 *      taken weeks apart, groups too small for a median to mean anything.
 */

var LOAI_BAO_CAO = [
  { ma: 'BANG_GIA', ten: 'Bậc thang giá theo nhóm',
    moTa: 'Nhóm sản phẩm theo thương hiệu / danh mục / cửa hàng rồi xem khoảng giá: thấp nhất, trung vị, cao nhất.',
    thamSo: [{ khoa: 'nhomTheo', nhan: 'Nhóm theo', kieu: 'chon',
               chon: [['thuong_hieu', 'Thương hiệu'], ['danh_muc', 'Danh mục'], ['ten_mien', 'Cửa hàng'], ['nen_tang', 'Nền tảng']] }] },
  { ma: 'PHAN_BO_GIA', ten: 'Phân bố giá',
    moTa: 'Đếm số sản phẩm trong từng khoảng giá. Dùng để thấy thị trường đang dồn ở mức giá nào.',
    thamSo: [] },
  { ma: 'SO_SANH_DOI_THU', ten: 'So sánh cửa hàng theo danh mục',
    moTa: 'Bảng chéo: mỗi dòng một danh mục, mỗi cột một cửa hàng, ô là giá trung vị. Đánh dấu nơi rẻ nhất.',
    thamSo: [{ khoa: 'nhomTheo', nhan: 'Dòng là', kieu: 'chon',
               chon: [['danh_muc', 'Danh mục'], ['thuong_hieu', 'Thương hiệu']] }] },
  { ma: 'THAY_DOI', ten: 'Thay đổi giữa 2 lần quét',
    moTa: 'So 2 lần quét gần nhất của cùng một địa chỉ: tăng giá, giảm giá, mới, mất, hết hàng.',
    thamSo: [{ khoa: 'nguonUrl', nhan: 'Địa chỉ đã quét', kieu: 'chon_url' }] },
  { ma: 'CHAT_LUONG', ten: 'Chất lượng dữ liệu theo lần quét',
    moTa: 'Mỗi lần quét một dòng: kết luận, bậc thang, và tỷ lệ điền của từng cột. Đây là bảng để soi khi nghi ngờ số liệu.',
    thamSo: [] }
];

var NGUONG_NHOM_NHO = 5;          // fewer rows than this and a median means little
var NGUONG_NGAY_LECH = 14;        // snapshots this many days apart are not "the same moment"

function docNgay(s) {
  if (!s) return null;
  var t = String(s).trim().replace(' ', 'T');
  var d = new Date(t);
  return isFinite(d.getTime()) ? d : null;
}

function soNgayLech(a, b) {
  var x = docNgay(a), y = docNgay(b);
  if (!x || !y) return null;
  return Math.abs(x.getTime() - y.getTime()) / 86400000;
}

/**
 * The honesty layer. Every warning here is a reason the numbers above it could be wrong.
 *
 * It does NOT repeat the trust verdict: every screen and every export that shows these
 * warnings also shows tomTatTinCay() right above them, and printing the same sentence
 * twice trains people to stop reading it.
 *
 * @return {Array<{muc:string, cau:string}>} muc: 'nang' | 'vua' | 'nhe'
 */
function canhBaoDuLieu(hang, tinCay, tuyChon) {
  var tc = tuyChon || {};
  var ra = [];

  var tienTe = {};
  var soCoGia = 0;
  for (var i = 0; i < hang.length; i++) {
    if (!laSo(hang[i].gia_ban)) continue;
    soCoGia++;
    var t = String(hang[i].tien_te || '').trim();
    var khoaT = t === '' ? '(trống)' : t;
    tienTe[khoaT] = (tienTe[khoaT] || 0) + 1;
  }
  var khoaTt = Object.keys(tienTe);
  var khacTrong = khoaTt.filter(function (k) { return k !== '(trống)'; });
  if (khacTrong.length > 1) {
    ra.push({ muc: 'nang', cau: 'Đang trộn ' + khacTrong.length + ' đơn vị tiền tệ (' + khacTrong.join(', ') +
      '). Mọi con số trung bình / trung vị bên dưới đều VÔ NGHĨA cho tới khi bạn lọc về một đơn vị.' });
  }
  if (tienTe['(trống)'] && soCoGia > 0) {
    var tyLeTrong = tienTe['(trống)'] / soCoGia;
    if (tyLeTrong > 0.2) {
      ra.push({ muc: 'vua', cau: Math.round(tyLeTrong * 100) + '% số dòng có giá nhưng KHÔNG xác minh được đơn vị tiền tệ. ' +
        'Công cụ không mặc định VND; nếu bạn chắc chắn đây là VND thì phần suy luận đó là của bạn, không phải của dữ liệu.' });
    }
  }

  if (hang.length > 0) {
    var tyLeGia = soCoGia / hang.length;
    if (tyLeGia < 0.7) {
      ra.push({ muc: 'nang', cau: 'Chỉ ' + Math.round(tyLeGia * 100) + '% số dòng trong lát cắt này có giá. ' +
        'Mọi thống kê giá bên dưới chỉ tính trên phần đó, không đại diện cho cả tập.' });
    }
  }

  if (tinCay && tinCay.lanQuet && tinCay.lanQuet.length > 1) {
    var som = null, muon = null;
    for (var j = 0; j < tinCay.lanQuet.length; j++) {
      var ng = tinCay.lanQuet[j].ngay;
      if (!som || String(ng) < String(som)) som = ng;
      if (!muon || String(ng) > String(muon)) muon = ng;
    }
    var lech = soNgayLech(som, muon);
    if (lech !== null && lech > NGUONG_NGAY_LECH) {
      ra.push({ muc: 'vua', cau: 'Các lần quét trong lát cắt này cách nhau tới ' + Math.round(lech) + ' ngày (' +
        String(som).substring(0, 10) + ' → ' + String(muon).substring(0, 10) + '). ' +
        'Đây là so sánh giữa các thời điểm khác nhau, không phải một lát cắt thị trường tại một thời điểm.' });
    }
  }

  if (tc.nhomNho && tc.nhomNho.length) {
    ra.push({ muc: 'nhe', cau: tc.nhomNho.length + ' nhóm có dưới ' + NGUONG_NHOM_NHO +
      ' sản phẩm (' + tc.nhomNho.slice(0, 5).join(', ') + (tc.nhomNho.length > 5 ? '…' : '') +
      '). Trung vị của nhóm nhỏ như vậy dễ lệch — đọc cột "số dòng" trước khi kết luận.' });
  }
  if (tc.themCanhBao) for (var k = 0; k < tc.themCanhBao.length; k++) ra.push(tc.themCanhBao[k]);
  return ra;
}

/** Build a report. `kho` is the output of docKhoDuLieu(); nothing here touches the sheet. */
function taoBaoCao(dinhNghia, kho) {
  var dn = dinhNghia || {};
  var ma = dn.ma || 'BANG_GIA';
  var boLoc = dn.boLoc || taoBoLocRong();
  var thamSo = dn.thamSo || {};
  var hang = locHang(kho.hang, boLoc);
  var tinCay = tomTatTinCay(hang, kho.lanQuet);

  switch (ma) {
    case 'BANG_GIA': return baoCaoBangGia(hang, tinCay, thamSo, boLoc);
    case 'PHAN_BO_GIA': return baoCaoPhanBoGia(hang, tinCay, thamSo, boLoc);
    case 'SO_SANH_DOI_THU': return baoCaoSoSanhDoiThu(hang, tinCay, thamSo, boLoc);
    case 'THAY_DOI': return baoCaoThayDoi(kho, tinCay, thamSo, boLoc);
    case 'CHAT_LUONG': return baoCaoChatLuong(kho, hang, tinCay, boLoc);
    default:
      return { ma: ma, tieuDe: 'Không có loại báo cáo này', cot: [], hang: [], tomTat: [],
               tinCay: tinCay, canhBao: [{ muc: 'nang', cau: 'Mã báo cáo không hợp lệ: ' + ma }], bieuDo: null };
  }
}

function tile(nhan, giaTri, phu) {
  return { nhan: nhan, gia_tri: giaTri, phu: phu || '' };
}

function nhanCot(c) {
  var m = {
    thuong_hieu: 'Thương hiệu', danh_muc: 'Danh mục', ten_mien: 'Cửa hàng', nen_tang: 'Nền tảng',
    ten: 'Tên', gia_ban: 'Giá bán', gia_goc: 'Giá gốc', con_hang: 'Còn hàng', sku: 'SKU',
    phien_ban: 'Phiên bản', tien_te: 'Tiền tệ', ma_ngoai: 'Mã ngoài', url_san_pham: 'Link',
    ngay_quet: 'Ngày quét', ma_lan_quet: 'Lần quét', nguon_url: 'Địa chỉ đã quét',
    so_luong_ton: 'Tồn kho', danh_gia_sao: 'Điểm ĐG', so_luot_danh_gia: 'Lượt ĐG',
    so_da_ban: 'Đã bán', anh_chinh: 'Ảnh', _ket_luan: 'Kết luận'
  };
  return m[c] || c;
}

/* ------------------------------------------------------------- 1. BANG_GIA */

function baoCaoBangGia(hang, tinCay, thamSo, boLoc) {
  var cotNhom = thamSo.nhomTheo || 'thuong_hieu';
  var nhom = gomNhomTheoGia(hang, cotNhom);
  var nhomNho = nhom.filter(function (n) { return n.soCoGia > 0 && n.soCoGia < NGUONG_NHOM_NHO; })
                    .map(function (n) { return n.nhom; });
  var tk = thongKeSo(hang.map(function (h) { return h.gia_ban; }));

  // Chọn 12 nhóm nhiều sản phẩm nhất, RỒI xếp theo trung vị để biểu đồ đọc ra một bậc thang.
  var veDuoc = nhom.filter(function (n) { return n.min !== null; }).slice(0, 12);
  veDuoc.sort(function (a, b) { return b.trungVi - a.trungVi; });
  var bieuDo = veDuoc.length === 0 ? null : {
    kieu: 'thanh_khoang',
    tieuDe: 'Khoảng giá theo ' + nhanCot(cotNhom).toLowerCase() + ' — 12 nhóm nhiều sản phẩm nhất, xếp theo trung vị',
    donVi: tienTeChinh(hang),
    diem: veDuoc.map(function (n) {
      return { nhan: n.nhom, min: n.min, giua: n.trungVi, max: n.max, so: n.soDong };
    })
  };

  return {
    ma: 'BANG_GIA',
    tieuDe: 'Bậc thang giá theo ' + nhanCot(cotNhom).toLowerCase(),
    moTa: 'Mỗi dòng là một ' + nhanCot(cotNhom).toLowerCase() + '. Khi so sánh hãy dùng cột TRUNG VỊ, không dùng trung bình: một sản phẩm đắt bất thường kéo lệch trung bình.',
    cot: [
      { khoa: 'nhom', nhan: nhanCot(cotNhom), kieu: 'chu' },
      { khoa: 'soDong', nhan: 'Số dòng', kieu: 'so' },
      { khoa: 'tyLeCoGia', nhan: '% có giá', kieu: 'phanTram' },
      { khoa: 'min', nhan: 'Thấp nhất', kieu: 'tien' },
      { khoa: 'p25', nhan: '25%', kieu: 'tien' },
      { khoa: 'trungVi', nhan: 'Trung vị', kieu: 'tien' },
      { khoa: 'p75', nhan: '75%', kieu: 'tien' },
      { khoa: 'max', nhan: 'Cao nhất', kieu: 'tien' },
      { khoa: 'soConHang', nhan: 'Còn hàng', kieu: 'so' },
      { khoa: 'tienTe', nhan: 'Tiền tệ', kieu: 'chu' }
    ],
    hang: nhom,
    bieuDo: bieuDo,
    tomTat: [
      tile('Số dòng', dinhDangSo(hang.length), tinCay.soLanQuet + ' lần quét'),
      tile('Có giá', Math.round(tinCay.tyLeCoGia * 100) + '%', tk.n + ' dòng có giá'),
      tile('Giá trung vị', tk.trungVi === null ? '—' : dinhDangSo(tk.trungVi), tienTeChinh(hang)),
      tile('Khoảng giá', tk.min === null ? '—' : (dinhDangSo(tk.min) + ' – ' + dinhDangSo(tk.max)), tienTeChinh(hang)),
      tile('Số nhóm', String(nhom.length), nhanCot(cotNhom).toLowerCase())
    ],
    tinCay: tinCay,
    canhBao: canhBaoDuLieu(hang, tinCay, { nhomNho: nhomNho })
  };
}

/* --------------------------------------------------------- 2. PHAN_BO_GIA */

function baoCaoPhanBoGia(hang, tinCay, thamSo, boLoc) {
  var kq = chiaKhoangGia(hang, 12);
  var tk = thongKeSo(hang.map(function (h) { return h.gia_ban; }));
  var dong = kq.khoang.map(function (k) {
    return { khoang: k.nhan, tu: k.tu, den: k.den, so: k.so, tyLe: tk.n === 0 ? 0 : k.so / tk.n };
  });
  return {
    ma: 'PHAN_BO_GIA',
    tieuDe: 'Phân bố giá',
    moTa: 'Số sản phẩm trong từng khoảng giá. Chỉ tính ' + tk.n + ' dòng đọc được giá.',
    cot: [
      { khoa: 'khoang', nhan: 'Khoảng giá', kieu: 'chu' },
      { khoa: 'so', nhan: 'Số sản phẩm', kieu: 'so' },
      { khoa: 'tyLe', nhan: 'Tỷ lệ', kieu: 'phanTram' }
    ],
    hang: dong,
    bieuDo: dong.length === 0 ? null : {
      kieu: 'cot',
      tieuDe: 'Số sản phẩm theo khoảng giá',
      donVi: tienTeChinh(hang),
      diem: dong.map(function (d) { return { nhan: d.khoang, gia_tri: d.so, tu: d.tu, den: d.den }; })
    },
    tomTat: [
      tile('Dòng có giá', dinhDangSo(tk.n), 'trong ' + dinhDangSo(hang.length) + ' dòng'),
      tile('Trung vị', tk.trungVi === null ? '—' : dinhDangSo(tk.trungVi), tienTeChinh(hang)),
      tile('25% rẻ nhất dưới', tk.p25 === null ? '—' : dinhDangSo(tk.p25), tienTeChinh(hang)),
      tile('25% đắt nhất trên', tk.p75 === null ? '—' : dinhDangSo(tk.p75), tienTeChinh(hang)),
      tile('Bước chia', kq.buoc === null ? '—' : dinhDangSo(kq.buoc), 'mỗi cột')
    ],
    tinCay: tinCay,
    canhBao: canhBaoDuLieu(hang, tinCay, {})
  };
}

/* ---------------------------------------------------- 3. SO_SANH_DOI_THU */

function baoCaoSoSanhDoiThu(hang, tinCay, thamSo, boLoc) {
  var cotNhom = thamSo.nhomTheo || 'danh_muc';
  var demMien = {};
  var demNhom = {};
  var o = {};                       // {nhom: {mien: [prices]}}
  for (var i = 0; i < hang.length; i++) {
    if (!laSo(hang[i].gia_ban)) continue;
    var m = String(hang[i].ten_mien || '(không rõ)');
    var nRaw = hang[i][cotNhom];
    var n = String(nRaw === '' || nRaw === undefined || nRaw === null ? '(không ghi)' : nRaw);
    demMien[m] = (demMien[m] || 0) + 1;
    demNhom[n] = (demNhom[n] || 0) + 1;
    if (!o[n]) o[n] = {};
    if (!o[n][m]) o[n][m] = [];
    o[n][m].push(Number(hang[i].gia_ban));
  }
  var dsMien = Object.keys(demMien).sort(function (a, b) { return demMien[b] - demMien[a]; }).slice(0, 8);
  var dsNhom = Object.keys(demNhom).sort(function (a, b) { return demNhom[b] - demNhom[a]; }).slice(0, 40);

  var cot = [{ khoa: 'nhom', nhan: nhanCot(cotNhom), kieu: 'chu' }];
  for (var j = 0; j < dsMien.length; j++) cot.push({ khoa: 'c' + j, nhan: dsMien[j], kieu: 'tien' });
  cot.push({ khoa: 'reNhat', nhan: 'Rẻ nhất', kieu: 'chu' });

  var dong = [];
  for (var k2 = 0; k2 < dsNhom.length; k2++) {
    var r = { nhom: dsNhom[k2] };
    var reNhat = null, tenReNhat = '';
    for (var m2 = 0; m2 < dsMien.length; m2++) {
      var ds = o[dsNhom[k2]] ? o[dsNhom[k2]][dsMien[m2]] : null;
      if (!ds || ds.length === 0) { r['c' + m2] = null; continue; }
      ds.sort(function (a, b) { return a - b; });
      var tv = phanVi(ds, 0.5);
      r['c' + m2] = tv;
      r['_n' + m2] = ds.length;
      if (reNhat === null || tv < reNhat) { reNhat = tv; tenReNhat = dsMien[m2]; }
    }
    r.reNhat = tenReNhat === '' ? '—' : ('↓ ' + tenReNhat);
    r._reNhatCot = tenReNhat;
    dong.push(r);
  }

  var them = [];
  if (dsMien.length < 2) {
    them.push({ muc: 'vua', cau: 'Lát cắt này chỉ có ' + dsMien.length + ' cửa hàng nên không có gì để so sánh. ' +
      'Bỏ bớt bộ lọc, hoặc quét thêm cửa hàng khác rồi mở lại báo cáo này.' });
  }
  if (Object.keys(demMien).length > 8) {
    them.push({ muc: 'nhe', cau: 'Có ' + Object.keys(demMien).length + ' cửa hàng, bảng chỉ hiện 8 cửa hàng nhiều dòng nhất.' });
  }
  them.push({ muc: 'nhe', cau: 'Hai cửa hàng chỉ so được với nhau khi bán thứ giống nhau. Danh mục do chính họ tự đặt tên, ' +
    'nên "Nhà tắm" của cửa hàng A có thể không cùng phạm vi với "Nhà tắm" của cửa hàng B.' });

  return {
    ma: 'SO_SANH_DOI_THU',
    tieuDe: 'So sánh cửa hàng theo ' + nhanCot(cotNhom).toLowerCase(),
    moTa: 'Ô là GIÁ TRUNG VỊ của cửa hàng đó trong nhóm đó. Ô trống nghĩa là cửa hàng không có sản phẩm nào đọc được giá trong nhóm.',
    cot: cot,
    hang: dong,
    bieuDo: null,
    tomTat: [
      tile('Cửa hàng', String(Object.keys(demMien).length), 'hiện ' + dsMien.length + ' cột'),
      tile(nhanCot(cotNhom), String(Object.keys(demNhom).length), 'hiện ' + dsNhom.length + ' dòng'),
      tile('Dòng có giá', dinhDangSo(hang.filter(function (h) { return laSo(h.gia_ban); }).length), 'dùng để tính'),
      tile('Tiền tệ', tienTeChinh(hang) || '(không rõ)', 'trong lát cắt')
    ],
    tinCay: tinCay,
    canhBao: canhBaoDuLieu(hang, tinCay, { themCanhBao: them })
  };
}

/* ------------------------------------------------------------ 4. THAY_DOI */

function baoCaoThayDoi(kho, tinCayChung, thamSo, boLoc) {
  var url = thamSo.nguonUrl || '';
  var theoLan = {};
  var thuTu = [];
  for (var i = 0; i < kho.hang.length; i++) {
    var h = kho.hang[i];
    if (String(h.nguon_url) !== String(url)) continue;
    var ma = String(h.ma_lan_quet);
    if (!theoLan[ma]) { theoLan[ma] = { maLanQuet: ma, ngay: String(h.ngay_quet), hang: [] }; thuTu.push(ma); }
    theoLan[ma].hang.push(h);
  }
  var ds = thuTu.map(function (m) { return theoLan[m]; });
  ds.sort(function (a, b) { return a.ngay < b.ngay ? 1 : (a.ngay > b.ngay ? -1 : 0); });

  if (ds.length < 2) {
    return {
      ma: 'THAY_DOI',
      tieuDe: 'Thay đổi giữa 2 lần quét',
      moTa: url === '' ? 'Hãy chọn một địa chỉ đã quét.' : url,
      cot: [], hang: [], bieuDo: null, tomTat: [],
      tinCay: tomTatTinCay(ds.length ? ds[0].hang : [], kho.lanQuet),
      canhBao: [{ muc: 'vua', cau: 'Địa chỉ này mới có ' + ds.length + ' lần quét. Cần ít nhất 2 lần quét cùng một địa chỉ mới so sánh được. ' +
                                   'Hãy quét lại địa chỉ đó rồi mở lại báo cáo.' }]
    };
  }

  var thayDoi = soSanhSnapshot(ds[1], ds[0]);
  var hangGop = ds[0].hang.concat(ds[1].hang);
  var tinCay = tomTatTinCay(hangGop, kho.lanQuet);
  var dem = { TANG_GIA: 0, GIAM_GIA: 0, MOI: 0, MAT: 0, HET_HANG: 0, CON_HANG_LAI: 0 };
  for (var j = 0; j < thayDoi.length; j++) {
    if (dem[thayDoi[j].loai_thay_doi] !== undefined) dem[thayDoi[j].loai_thay_doi]++;
  }
  var lech = soNgayLech(ds[1].ngay, ds[0].ngay);
  var them = [];
  if (lech !== null && lech < 0.5) {
    them.push({ muc: 'vua', cau: 'Hai lần quét cách nhau chưa tới nửa ngày. Chênh lệch thấy được nhiều khả năng là ' +
      'khuyến mãi theo giờ, không phải một lần đổi giá thật.' });
  }
  if (thayDoi.length === 0) {
    them.push({ muc: 'nhe', cau: 'Hai lần quét giống hệt nhau — không có thay đổi nào.' });
  }
  if (dem.MAT > 0) {
    them.push({ muc: 'nhe', cau: dem.MAT + ' dòng "MẤT" không chắc là sản phẩm bị gỡ: cũng có thể lần quét sau ' +
      'chạm trần số trang, hoặc cửa hàng đổi mã sản phẩm. Kiểm cột số dòng của 2 lần quét trước khi kết luận.' });
  }

  return {
    ma: 'THAY_DOI',
    tieuDe: 'Thay đổi: ' + url,
    moTa: 'So ' + String(ds[1].ngay).substring(0, 16) + ' → ' + String(ds[0].ngay).substring(0, 16) +
          (lech === null ? '' : ' (cách nhau ' + (lech < 1 ? Math.round(lech * 24) + ' giờ' : Math.round(lech) + ' ngày') + ')'),
    cot: [
      { khoa: 'loai_thay_doi', nhan: 'Thay đổi', kieu: 'chu' },
      { khoa: 'ten', nhan: 'Tên', kieu: 'chu' },
      { khoa: 'ma_ngoai', nhan: 'Mã ngoài', kieu: 'chu' },
      { khoa: 'gia_cu', nhan: 'Giá cũ', kieu: 'tien' },
      { khoa: 'gia_moi', nhan: 'Giá mới', kieu: 'tien' },
      { khoa: 'chenh_lech', nhan: 'Chênh lệch', kieu: 'tien' },
      { khoa: 'phan_tram', nhan: '%', kieu: 'so' },
      { khoa: 'con_hang_cu', nhan: 'Kho cũ', kieu: 'chu' },
      { khoa: 'con_hang_moi', nhan: 'Kho mới', kieu: 'chu' }
    ],
    hang: thayDoi,
    bieuDo: null,
    tomTat: [
      tile('Tăng giá', String(dem.TANG_GIA), 'sản phẩm'),
      tile('Giảm giá', String(dem.GIAM_GIA), 'sản phẩm'),
      tile('Mới', String(dem.MOI), 'so với lần trước'),
      tile('Mất', String(dem.MAT), 'không còn thấy'),
      tile('Hết hàng', String(dem.HET_HANG), 'chuyển sang hết')
    ],
    tinCay: tinCay,
    canhBao: canhBaoDuLieu(hangGop, tinCay, { themCanhBao: them })
  };
}

/* ---------------------------------------------------------- 5. CHAT_LUONG */

function baoCaoChatLuong(kho, hangDaLoc, tinCay, boLoc) {
  var theoLan = {};
  for (var i = 0; i < kho.hang.length; i++) {
    var h = kho.hang[i];
    var ma = String(h.ma_lan_quet);
    if (!theoLan[ma]) theoLan[ma] = [];
    theoLan[ma].push(h);
  }
  var dong = [];
  var khoa = Object.keys(theoLan);
  for (var j = 0; j < khoa.length; j++) {
    var ds = theoLan[khoa[j]];
    var lq = kho.lanQuet[khoa[j]] || {};
    var r = {
      ma_lan_quet: khoa[j],
      ngay: String(ds[0].ngay_quet),
      nguon_url: String(ds[0].nguon_url),
      ket_luan: String(lq.ket_luan || ''),
      bac: String(lq.bac_thang_dung || ''),
      nen_tang: String(ds[0].nen_tang || ''),
      soDong: ds.length
    };
    for (var t = 0; t < TRUONG_SAN_PHAM.length; t++) {
      var tr = TRUONG_SAN_PHAM[t];
      var co = 0;
      for (var k = 0; k < ds.length; k++) {
        var v = ds[k][tr];
        if (!(v === null || v === undefined || v === '')) co++;
      }
      r['fill_' + tr] = ds.length === 0 ? 0 : co / ds.length;
    }
    dong.push(r);
  }
  dong.sort(function (a, b) { return a.ngay < b.ngay ? 1 : (a.ngay > b.ngay ? -1 : 0); });

  var cot = [
    { khoa: 'ket_luan', nhan: 'Kết luận', kieu: 'ket_luan' },
    { khoa: 'ngay', nhan: 'Ngày quét', kieu: 'chu' },
    { khoa: 'nguon_url', nhan: 'Địa chỉ', kieu: 'chu' },
    { khoa: 'nen_tang', nhan: 'Nền tảng', kieu: 'chu' },
    { khoa: 'bac', nhan: 'Bậc', kieu: 'chu' },
    { khoa: 'soDong', nhan: 'Số dòng', kieu: 'so' }
  ];
  var truongQuanTrong = ['gia_ban', 'ten', 'ma_ngoai', 'tien_te', 'con_hang', 'sku', 'thuong_hieu', 'danh_muc'];
  for (var q = 0; q < truongQuanTrong.length; q++) {
    cot.push({ khoa: 'fill_' + truongQuanTrong[q], nhan: '% ' + truongQuanTrong[q], kieu: 'phanTram' });
  }

  var demKl = { CAO: 0, TRUNG_BINH: 0, THAP: 0, KHONG_QUET_DUOC: 0 };
  for (var d2 = 0; d2 < dong.length; d2++) if (demKl[dong[d2].ket_luan] !== undefined) demKl[dong[d2].ket_luan]++;

  return {
    ma: 'CHAT_LUONG',
    tieuDe: 'Chất lượng dữ liệu theo lần quét',
    moTa: 'Bảng này KHÔNG chịu tác động của bộ lọc ở trên — nó luôn hiện toàn bộ lịch sử quét, vì đây là sổ tin cậy.',
    cot: cot,
    hang: dong,
    bieuDo: null,
    tomTat: [
      tile('Tổng lần quét', String(dong.length), ''),
      tile('CAO', String(demKl.CAO), 'dùng được ngay'),
      tile('TRUNG BÌNH', String(demKl.TRUNG_BINH), 'kiểm tay 3 dòng'),
      tile('THẤP', String(demKl.THAP), 'phải kiểm chứng'),
      tile('KHÔNG QUÉT ĐƯỢC', String(demKl.KHONG_QUET_DUOC), 'không có dòng nào')
    ],
    tinCay: tomTatTinCay(kho.hang, kho.lanQuet),
    canhBao: (demKl.THAP + demKl.KHONG_QUET_DUOC) === 0 ? [] : [{
      muc: 'nhe',
      cau: 'Có ' + (demKl.THAP + demKl.KHONG_QUET_DUOC) + ' lần quét ở mức THẤP hoặc KHÔNG QUÉT ĐƯỢC. ' +
           'Nếu chúng nằm trong lát cắt bạn đang dùng để ra quyết định, hãy lọc chúng ra.'
    }]
  };
}

/** Report -> flat rows for the sheet / CSV export. */
function baoCaoThanhMang(bc) {
  var cot = bc.cot.map(function (c) { return c.nhan; });
  var lo = [];
  for (var i = 0; i < bc.hang.length; i++) {
    var d = [];
    for (var j = 0; j < bc.cot.length; j++) {
      var v = bc.hang[i][bc.cot[j].khoa];
      if (v === null || v === undefined) v = '';
      if (bc.cot[j].kieu === 'phanTram' && v !== '') v = Math.round(Number(v) * 1000) / 10;
      d.push(v);
    }
    lo.push(d);
  }
  return { cot: cot, hang: lo };
}
