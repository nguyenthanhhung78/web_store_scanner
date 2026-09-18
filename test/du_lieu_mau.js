'use strict';
/** Shared sample data for the query/report tests. Written straight into the fake sheet. */

function napDuLieuMau(env) {
  const g = env.g;
  g.taoCacBangNeuThieu();

  function sp(maLanQuet, ngay, url, mien, nenTang, maNgoai, ten, thuongHieu, danhMuc, sku, gia, tienTe, conHang) {
    const o = {};
    g.COT_SAN_PHAM.forEach(c => { o[c] = ''; });
    o.ma_lan_quet = maLanQuet; o.ngay_quet = ngay; o.nguon_url = url; o.ten_mien = mien;
    o.nen_tang = nenTang; o.ma_ngoai = maNgoai; o.url_san_pham = url + '/p/' + maNgoai;
    o.ten = ten; o.thuong_hieu = thuongHieu; o.danh_muc = danhMuc; o.sku = sku;
    o.gia_ban = gia === null ? '' : gia; o.tien_te = tienTe; o.con_hang = conHang;
    return g.COT_SAN_PHAM.map(c => o[c]);
  }

  const A = [], B = [], C = [];
  const giaA = [100000, 200000, 300000, 400000, 500000, 600000];
  giaA.forEach((gia, i) => {
    A.push(sp('LQ-A', '2026-09-01 08:00:00', 'https://durahome.vn/', 'durahome.vn', 'Shopify',
              'A' + i, 'Thảm Durahome ' + i, 'Durahome', i < 4 ? 'Nhà tắm' : 'Nhà bếp',
              'DH-' + i, gia, 'VND', i % 2 === 0 ? 'CON' : 'HET'));
  });

  [150000, 250000, 350000, null].forEach((gia, i) => {
    B.push(sp('LQ-B', '2026-09-02 09:00:00', 'https://doithu.vn/', 'doithu.vn', 'WooCommerce',
              'B' + i, 'Thảm Đối Thủ ' + i, 'ĐốiThủ', 'Nhà tắm', 'DT-' + i, gia, gia === null ? '' : 'VND',
              i === 3 ? '' : 'CON'));
  });

  // Re-scan of durahome.vn: A0 goes up, A5 disappears, C9 is new.
  const giaC = [120000, 200000, 300000, 400000, 500000];
  giaC.forEach((gia, i) => {
    C.push(sp('LQ-C', '2026-09-10 08:00:00', 'https://durahome.vn/', 'durahome.vn', 'Shopify',
              'A' + i, 'Thảm Durahome ' + i, 'Durahome', i < 4 ? 'Nhà tắm' : 'Nhà bếp',
              'DH-' + i, gia, 'VND', 'CON'));
  });
  C.push(sp('LQ-C', '2026-09-10 08:00:00', 'https://durahome.vn/', 'durahome.vn', 'Shopify',
            'A9', 'Thảm Durahome mới', 'Durahome', 'Nhà tắm', 'DH-9', 700000, 'VND', 'CON'));

  g.ghiLo('SAN_PHAM', A.concat(B).concat(C), g.COT_SAN_PHAM);

  function lq(ma, batDau, url, nenTang, bac, soSp, tyLe, ketLuan) {
    const o = {};
    g.COT_LAN_QUET.forEach(c => { o[c] = ''; });
    o.ma_lan_quet = ma; o.bat_dau = batDau; o.ket_thuc = batDau; o.url_nhap = url;
    o.loai_url = 'STORE'; o.nen_tang = nenTang; o.bac_thang_dung = bac; o.so_sp = soSp;
    o.ty_le_co_gia = tyLe; o.truong_thieu_nhieu = 'so_luong_ton (0%)'; o.ket_luan = ketLuan;
    o.ly_do = 'dữ liệu mẫu'; o.nguoi_quet = 'thu@durahome.vn';
    return g.COT_LAN_QUET.map(c => o[c]);
  }
  g.ghiLo('LAN_QUET', [
    lq('LQ-A', '2026-09-01 08:00:00', 'https://durahome.vn/', 'Shopify', 'BAC_1_PRODUCTS_JSON', 6, 100, 'CAO'),
    lq('LQ-B', '2026-09-02 09:00:00', 'https://doithu.vn/', 'WooCommerce', 'BAC_5_HTML_DOAN', 4, 75, 'THAP'),
    lq('LQ-C', '2026-09-10 08:00:00', 'https://durahome.vn/', 'Shopify', 'BAC_1_PRODUCTS_JSON', 6, 100, 'CAO')
  ], g.COT_LAN_QUET);

  return env;
}

module.exports = { napDuLieuMau };
