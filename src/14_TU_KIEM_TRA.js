/**
 * 14_TU_KIEM_TRA.js — tables the tests assert against, plus a self-test the operator can
 * run from the Apps Script editor without Node. Both the Node suite (test/) and CHAN_DOAN()
 * read these same tables, so there is exactly one source of truth for them.
 */

/** The Vietnamese price table from the specification. `gia: null` means "must refuse". */
var BANG_SO_VIET_NAM = [
  { vao: '1.250.000', gia: 1250000, tienTe: null, ghi: 'nhóm 3 chữ số, dấu chấm' },
  { vao: '1,250,000', gia: 1250000, tienTe: null, ghi: 'nhóm 3 chữ số, dấu phẩy' },
  { vao: '250.000₫', gia: 250000, tienTe: 'VND', ghi: 'có ký hiệu ₫' },
  { vao: '250.000 đ', gia: 250000, tienTe: 'VND', ghi: 'có chữ đ' },
  { vao: '1.250.000 VND', gia: 1250000, tienTe: 'VND', ghi: 'có chữ VND' },
  { vao: '1.250.00', gia: null, tienTe: null, ghi: 'nhóm cuối chỉ 2 chữ số — phải từ chối' },
  { vao: '3.5', gia: null, tienTe: null, ghi: 'KHÔNG BAO GIỜ được thành 35' },
  { vao: '250k', gia: null, tienTe: null, ghi: 'viết tắt — phải từ chối' },
  { vao: '1tr2', gia: null, tienTe: null, ghi: 'viết tắt — phải từ chối' },
  { vao: '250000', gia: 250000, tienTe: null, ghi: 'số nguyên không dấu phân cách' },
  { vao: '1 250 000', gia: 1250000, tienTe: null, ghi: 'nhóm 3 chữ số, dấu cách' },
  { vao: '12.34.567', gia: null, tienTe: null, ghi: 'nhóm giữa sai — phải từ chối' },
  { vao: '', gia: null, tienTe: null, ghi: 'rỗng' },
  { vao: 'Liên hệ', gia: null, tienTe: null, ghi: 'giá liên hệ — phải từ chối' },
  { vao: '1.250.000₫ - 2.000.000₫', gia: null, tienTe: null, ghi: 'khoảng giá — phải từ chối' }
];

/** URL classifier table: at least 12 real-shaped URLs across all six kinds. */
var BANG_PHAN_LOAI_URL = [
  { vao: 'https://durahome.vn', loai: 'STORE' },
  { vao: 'https://durahome.vn/?utm_source=fb&utm_medium=cpc&fbclid=abc123', loai: 'STORE', urlSach: 'https://durahome.vn/' },
  { vao: 'https://brand.vn/collections/tham-phong-tam', loai: 'CATEGORY' },
  { vao: 'https://brand.vn/collections/tham-phong-tam?page=2&utm_campaign=x', loai: 'CATEGORY', urlSach: 'https://brand.vn/collections/tham-phong-tam?page=2' },
  { vao: 'https://brand.vn/products/tham-x', loai: 'PRODUCT' },
  { vao: 'https://noithat.com.vn/san-pham/ghe-sofa-abc/', loai: 'PRODUCT', urlSach: 'https://noithat.com.vn/san-pham/ghe-sofa-abc' },
  { vao: 'https://shop.example.com/product-category/nha-bep', loai: 'CATEGORY' },
  { vao: 'https://shop.example.com/product/noi-chien-khong-dau', loai: 'PRODUCT' },
  { vao: 'https://shopee.vn/shop/123456', loai: 'MARKETPLACE_SHOP' },
  { vao: 'https://shopee.vn/Tham-nha-tam-i.123.456?xptdk=abc&spm=a2o4n', loai: 'MARKETPLACE_PRODUCT', urlSach: 'https://shopee.vn/Tham-nha-tam-i.123.456' },
  { vao: 'https://www.lazada.vn/products/tham-lau-chan-i1234567-s7654321.html?spm=a2o4n.home', loai: 'MARKETPLACE_PRODUCT' },
  { vao: 'https://www.tiktok.com/shop/abc-store', loai: 'MARKETPLACE_SHOP' },
  { vao: 'https://brand.vn/pages/lien-he', loai: 'UNKNOWN' },
  { vao: 'https://brand.vn/blogs/tin-tuc/cach-chon-tham', loai: 'UNKNOWN' },
  { vao: 'khong-phai-dia-chi', loai: 'UNKNOWN' },
  { vao: 'brand.vn/products/tham-y', loai: 'PRODUCT', urlSach: 'https://brand.vn/products/tham-y' }
];

/** Run the tables. Pure — no network, no sheet. */
function chayTuKiemTra() {
  var loi = [];
  var tong = 0;

  for (var i = 0; i < BANG_SO_VIET_NAM.length; i++) {
    var h = BANG_SO_VIET_NAM[i];
    tong++;
    var kq = phanTichGiaNguoiDoc(h.vao);
    if (kq.gia !== h.gia) {
      loi.push('SỐ: "' + h.vao + '" → ' + kq.gia + ' (đáng lẽ ' + h.gia + ') — ' + h.ghi + ' [' + kq.lyDo + ']');
    } else if (h.gia !== null && h.tienTe !== undefined && kq.tienTe !== h.tienTe) {
      loi.push('TIỀN TỆ: "' + h.vao + '" → ' + kq.tienTe + ' (đáng lẽ ' + h.tienTe + ')');
    }
  }

  for (var j = 0; j < BANG_PHAN_LOAI_URL.length; j++) {
    var u = BANG_PHAN_LOAI_URL[j];
    tong++;
    var pl = phanLoaiUrl(u.vao);
    if (pl.loai !== u.loai) {
      loi.push('URL: "' + u.vao + '" → ' + pl.loai + ' (đáng lẽ ' + u.loai + ')');
    } else if (u.urlSach && pl.url !== u.urlSach) {
      loi.push('CHUẨN HOÁ: "' + u.vao + '" → ' + pl.url + ' (đáng lẽ ' + u.urlSach + ')');
    }
  }

  // A JS shell must never look like an empty store.
  tong++;
  var vo = laVoTrangRong('<html><head><title>Cửa hàng</title></head><body><div id="root"></div>' +
                         '<script>' + new Array(400).join('var x=1;') + '</script></body></html>');
  if (!vo.laVo) loi.push('VỎ RỖNG: trang chỉ có <div id="root"></div> mà không bị nhận ra.');

  tong++;
  var klRong = tinhKetLuan([], BAC.BAC_5_HTML_DOAN, { lyDo: 'thử' });
  if (klRong.ketLuan !== KET_LUAN.KHONG_QUET_DUOC) {
    loi.push('KẾT LUẬN: 0 dòng mà vẫn ra ' + klRong.ketLuan + ' — sai nghiêm trọng.');
  }

  return { tong: tong, dat: tong - loi.length, loi: loi };
}
