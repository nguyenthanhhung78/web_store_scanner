/**
 * tools/xem_truoc.js — dựng một bản XEM TRƯỚC giao diện chạy được trong trình duyệt
 * thường, không cần Google, không cần triển khai.
 *
 *   npm run xem-truoc      # tạo xem_truoc.html rồi mở tệp đó bằng trình duyệt
 *
 * Nó chạy ĐÚNG mã máy chủ trong src/ trên dữ liệu mẫu, rồi nhúng kết quả vào trang.
 * Dùng khi sửa giao diện: xem ngay được kết quả mà không phải dán lại vào Apps Script.
 * Đây chỉ là công cụ cho người bảo trì — không phải thứ đem đi dùng thật.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { taoMoiTruong } = require('../test/harness');

const SRC = require('path').join(__dirname, '..', 'src');
const OUT = process.argv[2] || require('path').join(__dirname, '..', 'xem_truoc.html');

const env = taoMoiTruong();
const g = env.g;
g.taoCacBangNeuThieu();

// Richer sample than the unit tests use, so the charts have something to show.
const thuongHieu = ['Durahome', 'Bathly', 'HomeCo', 'Sạch & Khô', 'MinhAn', 'Vinahome', 'CasaViet'];
const danhMuc = ['Thảm phòng tắm', 'Thảm bếp', 'Kệ nhà tắm', 'Hộp đựng', 'Khăn & vải'];
const mien = [
  { url: 'https://durahome.vn/', mien: 'durahome.vn', nen: 'Shopify', lq: 'LQ-2026-A', kl: 'CAO', ngay: '2026-09-15 08:12:00' },
  { url: 'https://nhabepviet.vn/', mien: 'nhabepviet.vn', nen: 'WooCommerce', lq: 'LQ-2026-B', kl: 'CAO', ngay: '2026-09-16 09:30:00' },
  { url: 'https://thamviet.vn/danh-muc/tham', mien: 'thamviet.vn', nen: 'Tự code', lq: 'LQ-2026-C', kl: 'THAP', ngay: '2026-09-16 14:02:00' }
];

let hat = 7;
function rnd() { hat = (hat * 1103515245 + 12345) % 2147483648; return hat / 2147483648; }

const rows = [];
mien.forEach((m, mi) => {
  const n = [46, 38, 22][mi];
  for (let i = 0; i < n; i++) {
    const th = thuongHieu[Math.floor(rnd() * thuongHieu.length)];
    const dm = danhMuc[Math.floor(rnd() * danhMuc.length)];
    const nen = 120000 + Math.floor(rnd() * 8) * 90000 + mi * 40000;
    const gia = (mi === 2 && i % 4 === 0) ? '' : nen + Math.floor(rnd() * 60000);
    const o = {};
    g.COT_SAN_PHAM.forEach(c => { o[c] = ''; });
    o.ma_lan_quet = m.lq; o.ngay_quet = m.ngay; o.nguon_url = m.url; o.ten_mien = m.mien;
    o.nen_tang = m.nen; o.ma_ngoai = m.lq + ':' + i; o.url_san_pham = m.url + 'products/sp-' + i;
    o.ten = dm + ' ' + th + ' mã ' + (100 + i); o.thuong_hieu = th; o.danh_muc = dm;
    o.sku = 'SKU-' + mi + '-' + i; o.phien_ban = i % 3 === 0 ? 'Xám' : (i % 3 === 1 ? 'Trắng' : '');
    o.gia_ban = gia; o.gia_goc = gia === '' ? '' : gia + 80000;
    o.tien_te = gia === '' ? '' : 'VND'; o.con_hang = rnd() > 0.25 ? 'CON' : 'HET';
    rows.push(g.COT_SAN_PHAM.map(c => o[c]));
  }
});
g.ghiLo('SAN_PHAM', rows, g.COT_SAN_PHAM);

g.ghiLo('LAN_QUET', mien.map(m => {
  const o = {};
  g.COT_LAN_QUET.forEach(c => { o[c] = ''; });
  o.ma_lan_quet = m.lq; o.bat_dau = m.ngay; o.ket_thuc = m.ngay; o.url_nhap = m.url;
  o.loai_url = 'STORE'; o.nen_tang = m.nen;
  o.bac_thang_dung = m.kl === 'CAO' ? 'BAC_1_PRODUCTS_JSON' : 'BAC_5_HTML_DOAN';
  o.so_sp = rows.filter(r => r[0] === m.lq).length;
  o.ty_le_co_gia = m.kl === 'CAO' ? 100 : 75;
  o.truong_thieu_nhieu = 'so_luong_ton (0%), danh_gia_sao (0%), so_da_ban (0%)';
  o.ket_luan = m.kl;
  o.ly_do = 'Đọc được ' + o.so_sp + ' dòng. Tỷ lệ có giá: ' + o.ty_le_co_gia + '%.';
  o.nguoi_quet = 'thu.ha@durahome.vn';
  return g.COT_LAN_QUET.map(c => o[c]);
}), g.COT_LAN_QUET);

const bl = g.taoBoLocRong();
const duLieu = {
  apiKhoiTao: g.apiKhoiTao(),
  apiTruyVan: g.apiTruyVan(bl, { cot: 'gia_ban', giamDan: true }, 1, 100),
  'apiBaoCao:BANG_GIA': g.apiBaoCao({ ma: 'BANG_GIA', boLoc: bl, thamSo: { nhomTheo: 'thuong_hieu' } }),
  'apiBaoCao:PHAN_BO_GIA': g.apiBaoCao({ ma: 'PHAN_BO_GIA', boLoc: bl, thamSo: {} }),
  'apiBaoCao:SO_SANH_DOI_THU': g.apiBaoCao({ ma: 'SO_SANH_DOI_THU', boLoc: bl, thamSo: { nhomTheo: 'danh_muc' } }),
  'apiBaoCao:CHAT_LUONG': g.apiBaoCao({ ma: 'CHAT_LUONG', boLoc: bl, thamSo: {} }),
  uiTienDo: { tienDo: null, dangDo: null, hangDoi: { cho: 0, xong: 3, loi: 0 } },
  uiLinkBang: 'https://docs.google.com/spreadsheets/d/XEM-TRUOC'
};

let html = fs.readFileSync(path.join(SRC, 'Bang.html'), 'utf8');
html = html.replace(/<\?!=\s*napHtml\('([A-Za-z0-9_]+)'\)\s*\?>/g,
  (_, ten) => fs.readFileSync(path.join(SRC, ten + '.html'), 'utf8'));

const stub = `
<script>
var DU_LIEU_XEM_TRUOC = ${JSON.stringify(duLieu)};
google = { script: { run: (function () {
  var thanhCong = null, thatBai = null;
  var api = {
    withSuccessHandler: function (f) { thanhCong = f; return api; },
    withFailureHandler: function (f) { thatBai = f; return api; }
  };
  ['apiKhoiTao','apiTruyVan','apiBaoCao','apiXuatBaoCaoRaSheet','apiXuatCsvDuLieu','apiXuatCsvBaoCao',
   'uiQuetMotLink','uiChayTiep','uiTienDo','uiXepHang','uiLinkBang','uiSanKhongQuetDuoc'].forEach(function (ten) {
    api[ten] = function (a) {
      var khoa = ten;
      if (ten === 'apiBaoCao' && a && a.ma) khoa = 'apiBaoCao:' + a.ma;
      var kq = DU_LIEU_XEM_TRUOC[khoa];
      if (ten === 'uiSanKhongQuetDuoc') kq = DU_LIEU_XEM_TRUOC.apiKhoiTao.sanKhongQuetDuoc;
      var f = thanhCong; thanhCong = null; thatBai = null;
      setTimeout(function () { if (f) f(kq); }, 5);
      return api;
    };
  });
  return api;
})() } };
window.onerror = function (m, s, l) {
  var d = document.createElement('div');
  d.id = 'LOI_JS';
  d.textContent = 'LỖI JS: ' + m + ' @' + l;
  d.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#d03b3b;color:#fff;padding:8px;z-index:999';
  document.body.appendChild(d);
};
</script>
`;
html = html.replace('<body>', '<body>' + stub);
fs.writeFileSync(OUT, html);
console.log('Đã dựng bản xem trước: ' + OUT + '\nMở tệp này bằng trình duyệt để xem giao diện.');
