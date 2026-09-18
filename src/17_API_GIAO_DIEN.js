/**
 * 17_API_GIAO_DIEN.js — everything the browser calls with google.script.run.
 *
 * Each function is one round trip, so each one returns everything the screen needs.
 * Filtering and aggregation happen HERE, over the whole table; only the visible page of
 * rows travels to the browser. That way the numbers on screen are computed over all
 * matching rows even when the table shows the first 3.000.
 */

/** One call on page load: settings, filter options, scan list, totals. */
function apiKhoiTao() {
  taoCacBangNeuThieu();
  var kho = docKhoDuLieu();
  var lanQuet = [];
  var khoa = Object.keys(kho.lanQuet);
  for (var i = 0; i < khoa.length; i++) {
    var lq = kho.lanQuet[khoa[i]];
    lanQuet.push({
      ma_lan_quet: String(lq.ma_lan_quet),
      bat_dau: String(lq.bat_dau),
      url_nhap: String(lq.url_nhap),
      loai_url: String(lq.loai_url),
      nen_tang: String(lq.nen_tang),
      bac: String(lq.bac_thang_dung),
      so_sp: Number(lq.so_sp) || 0,
      ty_le_co_gia: Number(lq.ty_le_co_gia) || 0,
      truong_thieu_nhieu: String(lq.truong_thieu_nhieu),
      ket_luan: String(lq.ket_luan),
      ly_do: String(lq.ly_do),
      nguoi_quet: String(lq.nguoi_quet)
    });
  }
  lanQuet.sort(function (a, b) { return a.bat_dau < b.bat_dau ? 1 : (a.bat_dau > b.bat_dau ? -1 : 0); });

  var urlDaQuet = {};
  for (var j = 0; j < kho.hang.length; j++) {
    var u = String(kho.hang[j].nguon_url);
    if (!urlDaQuet[u]) urlDaQuet[u] = { url: u, soLan: {}, soDong: 0 };
    urlDaQuet[u].soLan[String(kho.hang[j].ma_lan_quet)] = 1;
    urlDaQuet[u].soDong++;
  }
  var dsUrl = Object.keys(urlDaQuet).map(function (u) {
    return { url: u, soLanQuet: Object.keys(urlDaQuet[u].soLan).length, soDong: urlDaQuet[u].soDong };
  });
  dsUrl.sort(function (a, b) { return b.soLanQuet - a.soLanQuet || b.soDong - a.soDong; });

  return {
    tongDong: kho.tong,
    lanQuet: lanQuet,
    url: dsUrl,
    mucChon: mucChonLoc(kho.hang),
    loaiBaoCao: LOAI_BAO_CAO,
    cotSanPham: COT_SAN_PHAM.map(function (c) { return { khoa: c, nhan: nhanCot(c) }; }),
    tranDong: TRAN_DONG_GUI_UI,
    sanKhongQuetDuoc: uiSanKhongQuetDuoc(),
    linkBang: uiLinkBang(),
    nguoiDung: Session_email(),
    dangQuetDo: docCon() ? { maLanQuet: docCon().maLanQuet, url: docCon().urlNhap } : null
  };
}

/**
 * The data tab. Filters over everything, returns one page of rows plus aggregates and the
 * trust summary computed over the WHOLE match, not the page.
 */
function apiTruyVan(boLoc, sapXep, trang, moiTrang) {
  var kho = docKhoDuLieu();
  var hang = locHang(kho.hang, boLoc || taoBoLocRong());
  var cotSap = (sapXep && sapXep.cot) ? sapXep.cot : 'ngay_quet';
  var daSap = sapXepHang(hang, cotSap, sapXep ? !!sapXep.giamDan : true);

  var kt = Math.max(1, Math.min(Number(moiTrang) || 100, 500));
  var soTrang = Math.max(1, Math.ceil(daSap.length / kt));
  var t = Math.max(1, Math.min(Number(trang) || 1, soTrang));
  var batDau = (t - 1) * kt;
  var trangHang = daSap.slice(batDau, batDau + kt);

  var gon = [];
  for (var i = 0; i < trangHang.length; i++) {
    var o = {};
    for (var c = 0; c < COT_SAN_PHAM.length; c++) {
      var ten = COT_SAN_PHAM[c];
      if (COT_BO_QUA_KHI_TRUY_VAN.indexOf(ten) >= 0) continue;
      o[ten] = trangHang[i][ten];
    }
    o._ket_luan = trangHang[i]._ket_luan;
    gon.push(o);
  }

  var tk = thongKeSo(hang.map(function (h) { return h.gia_ban; }));
  var tinCay = tomTatTinCay(hang, kho.lanQuet);
  return {
    hang: gon,
    tongKhop: hang.length,
    tongTatCa: kho.tong,
    trang: t,
    soTrang: soTrang,
    moiTrang: kt,
    thongKe: tk,
    tienTe: tienTeChinh(hang),
    tinCay: tinCay,
    canhBao: canhBaoDuLieu(hang, tinCay, {}),
    tomTat: [
      { nhan: 'Dòng khớp', gia_tri: dinhDangSo(hang.length), phu: 'trong ' + dinhDangSo(kho.tong) + ' dòng' },
      { nhan: 'Có giá', gia_tri: Math.round(tinCay.tyLeCoGia * 100) + '%', phu: tk.n + ' dòng' },
      { nhan: 'Trung vị', gia_tri: tk.trungVi === null ? '—' : dinhDangSo(tk.trungVi), phu: tienTeChinh(hang) },
      { nhan: 'Thấp – cao', gia_tri: tk.min === null ? '—' : (dinhDangSo(tk.min) + ' – ' + dinhDangSo(tk.max)), phu: tienTeChinh(hang) },
      { nhan: 'Lần quét', gia_tri: String(tinCay.soLanQuet), phu: 'góp dữ liệu' }
    ]
  };
}

/** The report tab. */
function apiBaoCao(dinhNghia) {
  var kho = docKhoDuLieu();
  return taoBaoCao(dinhNghia, kho);
}

/** Write the current report to the BAO_CAO tab, warnings and all. */
function apiXuatBaoCaoRaSheet(dinhNghia) {
  var bc = apiBaoCao(dinhNghia);
  var phang = baoCaoThanhMang(bc);
  var lo = [];
  lo.push([bc.tieuDe]);
  lo.push([bc.moTa || '']);
  lo.push(['Dựng lúc', nhanThoiGian(), 'bởi', Session_email()]);
  lo.push(['Kết luận tin cậy', bc.tinCay.ketLuan || '(không rõ)', bc.tinCay.cau]);
  lo.push(['Việc cần làm', bc.tinCay.viecCanLam || '']);
  for (var i = 0; i < bc.canhBao.length; i++) {
    lo.push(['Cảnh báo (' + bc.canhBao[i].muc + ')', bc.canhBao[i].cau]);
  }
  lo.push(['Bộ lọc', motaBoLoc(dinhNghia ? dinhNghia.boLoc : null)]);
  lo.push([]);
  lo.push(phang.cot);
  for (var j = 0; j < phang.hang.length; j++) lo.push(phang.hang[j]);
  var soDong = ghiDeBang(TEN_BANG.BAO_CAO, lo);

  var link = '';
  try {
    var ss = layBangTinh();
    var b = ss.getSheetByName(TEN_BANG.BAO_CAO);
    link = ss.getUrl() + (b ? '#gid=' + b.getSheetId() : '');
  } catch (e) { link = ''; }
  return {
    soDong: soDong,
    link: link,
    thongBao: 'Đã ghi báo cáo "' + bc.tieuDe + '" (' + bc.hang.length + ' dòng) vào thẻ ' + TEN_BANG.BAO_CAO +
              '. Thẻ này được dựng lại mỗi lần xuất, nên đừng sửa tay vào đó.'
  };
}

function motaBoLoc(bl) {
  if (!bl) return '(không lọc)';
  var ph = [];
  if (bl.chiMoiNhat) ph.push('chỉ lần quét mới nhất của mỗi địa chỉ');
  if (bl.tenMien && bl.tenMien.length) ph.push('cửa hàng: ' + bl.tenMien.join(', '));
  if (bl.thuongHieu && bl.thuongHieu.length) ph.push('thương hiệu: ' + bl.thuongHieu.join(', '));
  if (bl.danhMuc && bl.danhMuc.length) ph.push('danh mục: ' + bl.danhMuc.join(', '));
  if (bl.ketLuan && bl.ketLuan.length) ph.push('kết luận: ' + bl.ketLuan.join(', '));
  if (bl.maLanQuet && bl.maLanQuet.length) ph.push('lần quét: ' + bl.maLanQuet.join(', '));
  if (bl.conHang) ph.push('kho: ' + bl.conHang);
  if (bl.coGia) ph.push('chỉ dòng có giá');
  if (bl.giaTu !== null && bl.giaTu !== undefined && bl.giaTu !== '') ph.push('giá từ ' + bl.giaTu);
  if (bl.giaDen !== null && bl.giaDen !== undefined && bl.giaDen !== '') ph.push('giá đến ' + bl.giaDen);
  if (bl.tuKhoa) ph.push('từ khoá "' + bl.tuKhoa + '"');
  return ph.length ? ph.join(' · ') : '(không lọc)';
}

/** CSV of the current selection (all matching rows, not just the visible page). */
function apiXuatCsvDuLieu(boLoc, sapXep) {
  var kho = docKhoDuLieu();
  var hang = locHang(kho.hang, boLoc || taoBoLocRong());
  var cotSap = (sapXep && sapXep.cot) ? sapXep.cot : 'ngay_quet';
  hang = sapXepHang(hang, cotSap, sapXep ? !!sapXep.giamDan : true);
  var cot = COT_SAN_PHAM.slice();
  return {
    ten: 'san_pham_' + nhanThoiGian().replace(/[: ]/g, '-') + '.csv',
    soDong: hang.length,
    csv: hangThanhCsv(cot, hang)
  };
}

/** CSV of the current report. */
function apiXuatCsvBaoCao(dinhNghia) {
  var bc = apiBaoCao(dinhNghia);
  var phang = baoCaoThanhMang(bc);
  var hang = phang.hang.map(function (d) {
    var o = {};
    for (var i = 0; i < phang.cot.length; i++) o[phang.cot[i]] = d[i];
    return o;
  });
  return {
    ten: 'bao_cao_' + bc.ma + '_' + nhanThoiGian().replace(/[: ]/g, '-') + '.csv',
    soDong: hang.length,
    // The trust line rides along inside the file: a report pasted into a deck must not
    // lose the sentence that says how much to trust it.
    csv: 'Kết luận tin cậy,' + (bc.tinCay.ketLuan || '') + '\n' +
         '"' + String(bc.tinCay.cau).replace(/"/g, '""') + '"\n\n' +
         hangThanhCsv(phang.cot, hang)
  };
}
