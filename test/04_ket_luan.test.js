'use strict';
const { nhom, kiemTra, that, bang } = require('./kt');
const { taoMoiTruong, docFixture } = require('./harness');
const g = taoMoiTruong().g;

const bc = { url: 'https://durahome.vn/', origin: 'https://durahome.vn', tienTe: 'VND' };

nhom('KẾT LUẬN — bốn mức, mỗi mức một bộ dữ liệu mẫu bắt buộc phải ra đúng', () => {

  kiemTra('CAO — bậc 1, 100% có giá và có mã', () => {
    const hang = g.bocTachProductsJson(JSON.parse(docFixture('bac1_shopify_products.json')), bc);
    const kl = g.tinhKetLuan(hang, g.BAC.BAC_1_PRODUCTS_JSON, null);
    bang(kl.ketLuan, 'CAO');
    bang(kl.soSp, 20);
    bang(kl.tyLeCoGia, 1);
    that(kl.lyDo.indexOf('100.0%') > 0, 'lý do phải nêu con số đo được: ' + kl.lyDo);
  });

  kiemTra('TRUNG_BINH — bậc 3/4 (dữ liệu có cấu trúc), dù đủ giá', () => {
    const hang = g.bocTachJsonLdTrang(docFixture('bac3_jsonld_product.html'),
      { url: 'https://noithatviet.vn/san-pham/tham-duramat', origin: 'https://noithatviet.vn' });
    const kl = g.tinhKetLuan(hang, g.BAC.BAC_3_SITEMAP_LD, null);
    bang(kl.ketLuan, 'TRUNG_BINH');
    bang(kl.tyLeCoGia, 1);
  });

  kiemTra('TRUNG_BINH — bậc 1 nhưng chỉ 70–95% có giá', () => {
    const hang = g.bocTachProductsJson(JSON.parse(docFixture('bac1_shopify_products.json')), bc);
    // Bỏ giá của 3/20 dòng => 85% có giá
    for (let i = 0; i < 3; i++) { hang[i].gia_ban = ''; hang[i]._thieu.gia_ban = 'thu_nghiem'; }
    const kl = g.tinhKetLuan(hang, g.BAC.BAC_1_PRODUCTS_JSON, null);
    bang(kl.ketLuan, 'TRUNG_BINH');
    bang(Math.round(kl.tyLeCoGia * 100), 85);
  });

  kiemTra('THAP — bậc 5 (đoán từ HTML) dù 100% có giá', () => {
    const kq = g.bocTachHtmlDoan(docFixture('bac5_html_tho.html'),
      { url: 'https://thamviet.vn/danh-muc/tham', origin: 'https://thamviet.vn' });
    const kl = g.tinhKetLuan(kq.hang, g.BAC.BAC_5_HTML_DOAN, null);
    bang(kl.ketLuan, 'THAP');
    bang(kl.tyLeCoGia, 1);
  });

  kiemTra('THAP — bậc 1 nhưng dưới 70% có giá', () => {
    const hang = g.bocTachProductsJson(JSON.parse(docFixture('bac1_shopify_thieu_gia.json')), bc);
    const kl = g.tinhKetLuan(hang, g.BAC.BAC_1_PRODUCTS_JSON, null);
    bang(kl.ketLuan, 'THAP');
    that(kl.tyLeCoGia < 0.7, 'tỷ lệ có giá phải dưới 70%, đang là ' + kl.tyLeCoGia);
    that(kl.lyDo.indexOf('khong_doc_duoc_gia') > 0, 'phải nêu lý do thiếu giá: ' + kl.lyDo);
  });

  kiemTra('KHONG_QUET_DUOC — 0 dòng thì KHÔNG BAO GIỜ được ra CAO', () => {
    for (const b of Object.keys(g.BAC)) {
      const kl = g.tinhKetLuan([], g.BAC[b], { lyDo: 'thử với bậc ' + b });
      bang(kl.ketLuan, 'KHONG_QUET_DUOC', 'bậc ' + b + ' với 0 dòng');
      bang(kl.soSp, 0);
    }
  });

  kiemTra('KHONG_QUET_DUOC — bậc 6 giữ nguyên lý do cụ thể', () => {
    const kl = g.tinhKetLuan([], g.BAC.BAC_6_KHONG_QUET_DUOC, { lyDo: 'Trang chặn truy cập tự động (cf-browser-verification).' });
    bang(kl.ketLuan, 'KHONG_QUET_DUOC');
    that(kl.lyDo.indexOf('cf-browser-verification') > 0, kl.lyDo);
  });
});

nhom('Kết luận được ĐO, không phải được khẳng định', () => {
  kiemTra('tỷ lệ có giá bằng đúng số dòng có giá chia tổng số dòng', () => {
    const hang = [];
    for (let i = 0; i < 10; i++) {
      const h = g.hangTrong();
      g.dat(h, 'ma_ngoai', 'id-' + i, '');
      g.dat(h, 'url_san_pham', 'https://a.vn/p/' + i, '');
      g.dat(h, 'ten', 'SP ' + i, '');
      g.dat(h, 'gia_ban', i < 7 ? 1000 * i + 1000 : null, 'khong_co_gia_trong_nguon');
      hang.push(h);
    }
    const kl = g.tinhKetLuan(hang, g.BAC.BAC_1_PRODUCTS_JSON, null);
    bang(kl.tyLeCoGia, 0.7);
    bang(kl.ketLuan, 'TRUNG_BINH');
  });

  kiemTra('cộng dồn nhiều lô cho cùng kết quả như tính một lần (dùng khi quét bị ngắt)', () => {
    const hang = g.bocTachProductsJson(JSON.parse(docFixture('bac1_shopify_products.json')), bc);
    const motLan = g.tinhKetLuan(hang, g.BAC.BAC_1_PRODUCTS_JSON, null);
    let tl = g.taoTichLuy();
    g.congTichLuy(tl, hang.slice(0, 7));
    g.congTichLuy(tl, hang.slice(7));
    const nhieuLan = g.tinhKetLuanTuTichLuy(tl, g.BAC.BAC_1_PRODUCTS_JSON, null);
    bang(nhieuLan.ketLuan, motLan.ketLuan);
    bang(nhieuLan.soSp, motLan.soSp);
    bang(nhieuLan.tyLeCoGia, motLan.tyLeCoGia);
  });

  kiemTra('trường trống nhiều được liệt kê kèm phần trăm đo được', () => {
    const hang = g.bocTachProductsJson(JSON.parse(docFixture('bac1_shopify_products.json')), bc);
    const kl = g.tinhKetLuan(hang, g.BAC.BAC_1_PRODUCTS_JSON, null);
    that(kl.truongThieuNhieu.indexOf('so_luong_ton (0%)') >= 0, kl.truongThieuNhieu);
    that(kl.truongThieuNhieu.indexOf('danh_gia_sao (0%)') >= 0, kl.truongThieuNhieu);
  });

  kiemTra('mỗi kết luận có một câu tiếng Việt và một việc cần làm', () => {
    for (const k of ['CAO', 'TRUNG_BINH', 'THAP', 'KHONG_QUET_DUOC']) {
      that(g.CAU_KET_LUAN[k].length > 20, 'thiếu câu cho ' + k);
      that(g.viecCanLam(k).length > 20, 'thiếu việc cần làm cho ' + k);
    }
  });
});
