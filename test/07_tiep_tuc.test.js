'use strict';
/**
 * Bức tường 6 phút của Apps Script: quét dở, lưu vị trí, chạy tiếp.
 * Yêu cầu: không trùng dòng, không thiếu dòng, và cùng một ma_lan_quet.
 */
const { nhom, kiemTra, that, bang } = require('./kt');
const { taoMoiTruong, docFixture } = require('./harness');

const JSON_KIEU = 'application/json; charset=utf-8';

/** 3 trang × 20 dòng, mỗi trang mã sản phẩm khác nhau, trang 4 rỗng. */
function trangSanPham(soTrang) {
  const du = JSON.parse(docFixture('bac1_shopify_products.json'));
  du.products.forEach((p, i) => {
    p.id = p.id + soTrang * 1000;
    p.handle = 'trang' + soTrang + '-' + p.handle;
    p.variants.forEach(v => { v.id = v.id + soTrang * 1000; });
  });
  return JSON.stringify(du);
}

function moiTruongNhieuTrang() {
  const env = taoMoiTruong();
  env.dinhTuyen(/robots\.txt$/, { code: 404, body: '' });
  for (const n of [1, 2, 3]) {
    env.dinhTuyen(new RegExp('products\\.json\\?limit=250&page=' + n + '$'), { code: 200, body: trangSanPham(n), kieu: JSON_KIEU });
  }
  env.dinhTuyen(/products\.json/, { code: 200, body: '{"products":[]}', kieu: JSON_KIEU });
  env.dinhTuyen(/^https:\/\/nhieutrang\.vn\/$/, { code: 200, body: docFixture('trang_chu_shopify.html') });
  return env;
}

function maTrung(sp) {
  const dem = {};
  const trung = [];
  for (const h of sp) {
    const k = String(h.ma_ngoai);
    dem[k] = (dem[k] || 0) + 1;
    if (dem[k] === 2) trung.push(k);
  }
  return trung;
}

nhom('Quét bị ngắt giữa chừng rồi chạy tiếp', () => {
  const env = moiTruongNhieuTrang();
  const caiDat = env.g.docCaiDatMacDinh();

  // Lượt 1: ngân sách chỉ đủ vài bước.
  const lan1 = env.g.batDauQuet('https://nhieutrang.vn', 'thu.ha@durahome.vn',
    { caiDat: caiDat, nganSachMs: 4000, duTruMs: 0 });
  const maLanQuet = lan1.tt.maLanQuet;
  const soDongLan1 = env.docBang('SAN_PHAM').length;
  const soLanQuetLan1 = env.docBang('LAN_QUET').length;
  const conLan1 = env.g.docCon();

  kiemTra('lượt 1 dừng giữa chừng, chưa kết luận', () => {
    bang(lan1.xong, false);
    bang(lan1.ketLuan, null);
    that(soDongLan1 > 0 && soDongLan1 < 60, 'đã ghi ' + soDongLan1 + ' dòng (phải >0 và <60)');
  });
  kiemTra('lô đang dở ĐÃ được ghi xuống bảng trước khi thoát', () => {
    bang(soDongLan1 % 20, 0, 'phải ghi trọn lô, không ghi nửa chừng');
  });
  kiemTra('chưa ghi dòng LAN_QUET nào (chưa xong thì chưa được kết luận)', () => {
    bang(soLanQuetLan1, 0);
  });
  kiemTra('con trỏ đã được lưu, nêu rõ đang ở đâu', () => {
    that(conLan1 !== null, 'phải có con trỏ');
    bang(conLan1.maLanQuet, maLanQuet);
    bang(conLan1.giaiDoan, 'BAC1');
    that(conLan1.trang >= 2, 'phải nhớ trang kế tiếp, đang là ' + conLan1.trang);
  });

  // Lượt 2: chạy tiếp cho xong.
  const lan2 = env.g.tiepTucQuet({ caiDat: caiDat });

  kiemTra('lượt 2 chạy xong', () => {
    bang(lan2.xong, true);
    that(lan2.ketLuan !== null);
  });
  kiemTra('CÙNG một ma_lan_quet', () => {
    bang(lan2.tt.maLanQuet, maLanQuet);
    const sp = env.docBang('SAN_PHAM');
    that(sp.every(h => h.ma_lan_quet === maLanQuet), 'mọi dòng phải cùng mã lần quét');
  });
  kiemTra('không thiếu dòng: đủ 60', () => bang(env.docBang('SAN_PHAM').length, 60));
  kiemTra('không trùng dòng nào', () => bang(maTrung(env.docBang('SAN_PHAM')), []));
  kiemTra('LAN_QUET có đúng 1 dòng cho cả 2 lượt chạy', () => {
    const lq = env.docBang('LAN_QUET');
    bang(lq.length, 1);
    bang(lq[0].ma_lan_quet, maLanQuet);
    bang(lq[0].so_sp, 60);
    bang(lq[0].ket_luan, 'CAO');
  });
  kiemTra('số liệu kết luận tính trên toàn bộ 60 dòng, không chỉ lô cuối', () => {
    bang(lan2.ketLuan.soSp, 60);
    bang(lan2.ketLuan.tyLeCoGia, 1);
  });
  kiemTra('con trỏ được dọn sau khi xong', () => bang(env.g.docCon(), null));
});

nhom('Ca xấu nhất: chết đúng giữa lúc ghi và lúc lưu con trỏ', () => {
  const env = moiTruongNhieuTrang();
  const caiDat = env.g.docCaiDatMacDinh();
  const lan1 = env.g.batDauQuet('https://nhieutrang.vn', '', { caiDat: caiDat, nganSachMs: 4000, duTruMs: 0 });
  const maLanQuet = lan1.tt.maLanQuet;
  const soDongLan1 = env.docBang('SAN_PHAM').length;

  // Giả lập con trỏ cũ hơn thực tế: quên sạch những gì đã ghi.
  const con = env.g.docCon();
  con.daGhiMa = {};
  con.soDaGhi = 0;
  con.trang = 1;                       // và quay lại trang đầu
  con.tichLuy = env.g.taoTichLuy();
  env.props['CON_QUET'] = JSON.stringify(con);

  const lan2 = env.g.tiepTucQuet({ caiDat: caiDat });
  const sp = env.docBang('SAN_PHAM');

  kiemTra('vẫn không trùng dòng nào dù con trỏ đã lạc hậu', () => {
    bang(maTrung(sp), [], 'số dòng: ' + sp.length + ' (lượt 1 đã ghi ' + soDongLan1 + ')');
  });
  kiemTra('đủ 60 dòng, cùng một ma_lan_quet', () => {
    bang(sp.length, 60);
    that(sp.every(h => h.ma_lan_quet === maLanQuet));
  });
  kiemTra('kết luận được tính lại từ chính bảng, không từ con trỏ hỏng', () => {
    bang(lan2.ketLuan.soSp, 60);
    bang(lan2.ketLuan.ketLuan, 'CAO');
  });
  kiemTra('ghi rõ trong ly_do rằng lần quét này có chạy tiếp', () => {
    that(String(env.docBang('LAN_QUET')[0].ly_do).indexOf('chạy tiếp') > 0, env.docBang('LAN_QUET')[0].ly_do);
  });
});

nhom('Hàng đợi nhiều link', () => {
  const env = moiTruongNhieuTrang();
  env.g.taoCacBangNeuThieu();
  const kq = env.g.xepHangNhieuUrl('https://nhieutrang.vn\nhttps://nhieutrang.vn?utm_source=x\nkhong-phai-link');

  kiemTra('bỏ trùng sau khi chuẩn hoá, giữ lại dòng hỏng', () => {
    bang(kq.tong, 2);
    bang(kq.hopLe, 1);
    bang(env.docBang('HANG_DOI').length, 2);
  });
  kiemTra('quetTiepMotViec() lấy link chờ đầu tiên và quét', () => {
    const r = env.g.quetTiepMotViec({ caiDat: env.g.docCaiDatMacDinh() });
    that(r.xong, r.ghiChu);
    bang(r.ketLuan.ketLuan, 'CAO');
    const hd = env.docBang('HANG_DOI');
    bang(hd[0].trang_thai, 'XONG');
    bang(hd[0].ma_lan_quet, r.tt.maLanQuet);
  });
  kiemTra('hàng đợi hết việc thì nói rõ', () => {
    const r = env.g.quetTiepMotViec({ caiDat: env.g.docCaiDatMacDinh() });
    bang(r.ghiChu, 'Hàng đợi trống.');
  });
});

nhom('Bảng THAY_DOI dựng từ 2 lần quét', () => {
  const env = moiTruongNhieuTrang();
  const caiDat = env.g.docCaiDatMacDinh();
  env.g.batDauQuet('https://nhieutrang.vn', '', { caiDat: caiDat });

  // Lần quét thứ hai: một sản phẩm tăng giá, một sản phẩm biến mất.
  const env2 = env;
  env2.dinhTuyenTruoc(/products\.json\?limit=250&page=1$/, {
    code: 200, kieu: JSON_KIEU, body: (() => {
      const du = JSON.parse(trangSanPham(1));
      du.products[0].variants[0].price = '299000.00';
      du.products.pop();
      return JSON.stringify(du);
    })()
  });
  const lan2 = env2.g.batDauQuet('https://nhieutrang.vn', '', { caiDat: caiDat });

  kiemTra('so sánh ra đúng loại thay đổi', () => {
    const kq = env.g.taoBangThayDoi('https://nhieutrang.vn/');
    that(kq.ok, kq.lyDo);
    const td = env.docBang('THAY_DOI');
    const tang = td.filter(t => t.loai_thay_doi === 'TANG_GIA');
    const mat = td.filter(t => t.loai_thay_doi === 'MAT');
    bang(tang.length, 1);
    bang(tang[0].gia_cu, 259000);
    bang(tang[0].gia_moi, 299000);
    bang(tang[0].chenh_lech, 40000);
    that(mat.length >= 2, 'sản phẩm bị gỡ phải hiện ra (2 biến thể): ' + mat.length);
  });
  kiemTra('SAN_PHAM vẫn giữ nguyên cả 2 ảnh chụp, không bị ghi đè', () => {
    const sp = env.docBang('SAN_PHAM');
    const ma = {};
    sp.forEach(h => { ma[h.ma_lan_quet] = (ma[h.ma_lan_quet] || 0) + 1; });
    bang(Object.keys(ma).length, 2, 'phải có 2 lần quét riêng biệt');
  });
  kiemTra('cần ít nhất 2 lần quét mới so sánh được', () => {
    const e3 = taoMoiTruong();
    e3.g.taoCacBangNeuThieu();
    const r = e3.g.taoBangThayDoi('https://chua-quet.vn/');
    bang(r.ok, false);
    that(r.lyDo.indexOf('2 lần quét') > 0, r.lyDo);
  });
});
