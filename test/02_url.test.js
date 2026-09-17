'use strict';
const { nhom, kiemTra, that, bang } = require('./kt');
const { taoMoiTruong } = require('./harness');
const g = taoMoiTruong().g;

nhom('Phân loại URL — 16 địa chỉ thật, đủ 6 loại', () => {
  for (const h of g.BANG_PHAN_LOAI_URL) {
    kiemTra(`${h.vao} → ${h.loai}`, () => {
      const pl = g.phanLoaiUrl(h.vao);
      bang(pl.loai, h.loai, 'loại URL');
      if (h.urlSach) bang(pl.url, h.urlSach, 'URL sau khi chuẩn hoá');
    });
  }

  kiemTra('đủ cả 6 loại trong bảng kiểm thử', () => {
    const co = {};
    for (const h of g.BANG_PHAN_LOAI_URL) co[h.loai] = true;
    for (const k of ['STORE', 'CATEGORY', 'PRODUCT', 'MARKETPLACE_SHOP', 'MARKETPLACE_PRODUCT', 'UNKNOWN']) {
      that(co[k], 'thiếu loại ' + k + ' trong bảng kiểm thử');
    }
  });
});

nhom('Chuẩn hoá địa chỉ', () => {
  kiemTra('bỏ utm_*, fbclid, gclid, spm, xptdk — giữ tham số thật', () => {
    const ch = g.chuanHoaUrl('https://a.vn/collections/x?utm_source=fb&page=2&fbclid=1&gclid=2&spm=3&xptdk=4&sort=price');
    bang(ch.url, 'https://a.vn/collections/x?page=2&sort=price');
    bang(ch.daBoThamSo.sort(), ['fbclid', 'gclid', 'spm', 'utm_source', 'xptdk']);
  });
  kiemTra('bỏ neo #, cổng mặc định, chữ hoa trong tên miền', () => {
    bang(g.chuanHoaUrl('HTTPS://Brand.VN:443/products/x#mo-ta').url, 'https://brand.vn/products/x');
  });
  kiemTra('bỏ thông tin đăng nhập trong URL (công cụ không bao giờ đăng nhập)', () => {
    bang(g.chuanHoaUrl('https://user:pass@brand.vn/products/x').url, 'https://brand.vn/products/x');
  });
  kiemTra('gộp dấu / lặp và bỏ / cuối', () => {
    bang(g.chuanHoaUrl('https://brand.vn//collections//x/').url, 'https://brand.vn/collections/x');
  });
  kiemTra('từ chối thứ không phải http(s)', () => {
    that(!g.chuanHoaUrl('ftp://brand.vn/x').ok);
    that(!g.chuanHoaUrl('javascript:alert(1)').ok);
    that(!g.chuanHoaUrl('').ok);
  });
});

nhom('Dán nhiều link', () => {
  kiemTra('tách theo dòng, bỏ trùng, giữ lại dòng hỏng kèm lý do', () => {
    const ds = g.tachNhieuUrl('https://a.vn/products/x\nhttps://a.vn/products/x?utm_source=z\n\nkhong-phai-link\nhttps://b.vn');
    bang(ds.length, 3);
    bang(ds[0].url, 'https://a.vn/products/x');
    that(ds[1].ok === false && ds[1].lyDo !== '', 'dòng hỏng phải có lý do');
    bang(ds[2].url, 'https://b.vn/');
  });
});

nhom('Sàn không quét được được nhận ra trước khi gọi mạng', () => {
  for (const u of ['https://shopee.vn/shop/123456', 'https://www.lazada.vn/products/x-i1-s2.html', 'https://www.tiktok.com/shop/abc', 'https://tiki.vn/p/abc']) {
    kiemTra(u + ' bị chặn ngay ở khâu phân loại', () => {
      const pl = g.phanLoaiUrl(u);
      that(pl.san !== null, 'phải nhận ra là sàn không quét được');
      that(pl.san.loiRa.length > 10, 'phải nêu đường đi hợp lệ');
    });
  }
  kiemTra('cửa hàng thường thì không bị chặn', () => {
    bang(g.phanLoaiUrl('https://durahome.vn').san, null);
  });
});

nhom('Ghép URL tương đối', () => {
  kiemTra('/abc, ../abc, //cdn, tuyệt đối', () => {
    bang(g.ghepUrl('https://a.vn/collections/x', '/products/y'), 'https://a.vn/products/y');
    bang(g.ghepUrl('https://a.vn/a/b/c', '../d'), 'https://a.vn/a/d');
    bang(g.ghepUrl('https://a.vn/x', '//cdn.a.vn/i.jpg'), 'https://cdn.a.vn/i.jpg');
    bang(g.ghepUrl('https://a.vn/x', 'https://b.vn/y'), 'https://b.vn/y');
    bang(g.ghepUrl('https://a.vn/x', 'javascript:void(0)'), '');
  });
});
