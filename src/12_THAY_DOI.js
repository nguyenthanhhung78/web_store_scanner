/**
 * 12_THAY_DOI.js — the derived diff tab.
 *
 * Snapshots in SAN_PHAM are the source of truth and are never modified. THAY_DOI is
 * derived and disposable: it is rebuilt from the two most recent scans of the same
 * nguon_url. Delete the tab at any time and nothing is lost.
 */

/** Group SAN_PHAM rows by ma_lan_quet for one source URL, newest scan first. */
function docSnapshotTheoUrl(nguonUrl) {
  var b = layHoacTaoBang(TEN_BANG.SAN_PHAM, COT_SAN_PHAM);
  if (b.getLastRow() < 2) return [];
  var gt = b.getRange(2, 1, b.getLastRow() - 1, COT_SAN_PHAM.length).getValues();
  var iMa = COT_SAN_PHAM.indexOf('ma_lan_quet');
  var iUrl = COT_SAN_PHAM.indexOf('nguon_url');
  var iNgay = COT_SAN_PHAM.indexOf('ngay_quet');
  var nhom = {};
  var thuTu = [];
  for (var r = 0; r < gt.length; r++) {
    if (String(gt[r][iUrl]) !== String(nguonUrl)) continue;
    var ma = String(gt[r][iMa]);
    if (!nhom[ma]) { nhom[ma] = { maLanQuet: ma, ngay: String(gt[r][iNgay]), hang: [] }; thuTu.push(ma); }
    var o = {};
    for (var c = 0; c < COT_SAN_PHAM.length; c++) o[COT_SAN_PHAM[c]] = gt[r][c];
    nhom[ma].hang.push(o);
  }
  var ds = thuTu.map(function (m) { return nhom[m]; });
  ds.sort(function (a, b2) { return a.ngay < b2.ngay ? 1 : (a.ngay > b2.ngay ? -1 : 0); });
  return ds;
}

/**
 * Diff two snapshots by ma_ngoai.
 * @return {Array<Object>} change records
 */
function soSanhSnapshot(cu, moi) {
  var mapCu = {};
  for (var i = 0; i < cu.hang.length; i++) {
    var k = String(cu.hang[i].ma_ngoai);
    if (k !== '') mapCu[k] = cu.hang[i];
  }
  var mapMoi = {};
  for (var j = 0; j < moi.hang.length; j++) {
    var k2 = String(moi.hang[j].ma_ngoai);
    if (k2 !== '') mapMoi[k2] = moi.hang[j];
  }
  var ra = [];
  var khoaMoi = Object.keys(mapMoi);
  for (var m = 0; m < khoaMoi.length; m++) {
    var kk = khoaMoi[m];
    var b = mapMoi[kk];
    var a = mapCu[kk];
    if (!a) { ra.push(banGhiThayDoi(moi, cu, b, null, 'MOI')); continue; }
    var gCu = a.gia_ban === '' ? null : Number(a.gia_ban);
    var gMoi = b.gia_ban === '' ? null : Number(b.gia_ban);
    if (gCu !== null && gMoi !== null && gCu !== gMoi) {
      ra.push(banGhiThayDoi(moi, cu, b, a, gMoi > gCu ? 'TANG_GIA' : 'GIAM_GIA'));
    } else if (String(a.con_hang) !== String(b.con_hang) && String(b.con_hang) !== '') {
      ra.push(banGhiThayDoi(moi, cu, b, a, b.con_hang === 'CON' ? 'CON_HANG_LAI' : 'HET_HANG'));
    }
  }
  var khoaCu = Object.keys(mapCu);
  for (var n = 0; n < khoaCu.length; n++) {
    if (!mapMoi[khoaCu[n]]) ra.push(banGhiThayDoi(moi, cu, null, mapCu[khoaCu[n]], 'MAT'));
  }
  return ra;
}

function banGhiThayDoi(moi, cu, hMoi, hCu, loai) {
  var gCu = hCu && hCu.gia_ban !== '' ? Number(hCu.gia_ban) : '';
  var gMoi = hMoi && hMoi.gia_ban !== '' ? Number(hMoi.gia_ban) : '';
  var chenh = (gCu !== '' && gMoi !== '') ? gMoi - gCu : '';
  var pt = (chenh !== '' && gCu) ? Math.round((chenh / gCu) * 1000) / 10 : '';
  return {
    ngay_so_sanh: nhanThoiGian(),
    nguon_url: (hMoi || hCu).nguon_url,
    ma_ngoai: (hMoi || hCu).ma_ngoai,
    ten: (hMoi || hCu).ten,
    loai_thay_doi: loai,
    gia_cu: gCu,
    gia_moi: gMoi,
    chenh_lech: chenh,
    phan_tram: pt,
    con_hang_cu: hCu ? hCu.con_hang : '',
    con_hang_moi: hMoi ? hMoi.con_hang : '',
    lan_quet_cu: cu.maLanQuet,
    lan_quet_moi: moi.maLanQuet
  };
}

/** Rebuild THAY_DOI for one source URL from its two most recent scans. */
function taoBangThayDoi(nguonUrl) {
  var ds = docSnapshotTheoUrl(nguonUrl);
  if (ds.length < 2) {
    return { ok: false, lyDo: 'Cần ít nhất 2 lần quét cùng một địa chỉ để so sánh. Hiện có ' + ds.length + '.' , so: 0 };
  }
  var thayDoi = soSanhSnapshot(ds[1], ds[0]);
  var lo = thayDoi.map(function (t) {
    return COT_THAY_DOI.map(function (c) { return t[c] === undefined ? '' : t[c]; });
  });
  // Derived tab: rebuilt every time, so it can never drift from the snapshots it describes.
  ghiDeBang(TEN_BANG.THAY_DOI, [COT_THAY_DOI].concat(lo));
  return {
    ok: true,
    so: lo.length,
    lanQuetCu: ds[1].maLanQuet,
    lanQuetMoi: ds[0].maLanQuet,
    lyDo: lo.length === 0 ? 'Hai lần quét giống hệt nhau — không có thay đổi nào.' : ''
  };
}
