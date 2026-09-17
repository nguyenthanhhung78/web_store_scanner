'use strict';
const { nhom, kiemTra, that, bang } = require('./kt');
const { taoMoiTruong, docFixture } = require('./harness');
const g = taoMoiTruong().g;

const bc = { url: 'https://durahome.vn/', origin: 'https://durahome.vn', nenTang: 'Shopify', tienTe: 'VND' };

nhom('Bậc 1 — products.json (Shopify/Haravan/Sapo)', () => {
  const du = JSON.parse(docFixture('bac1_shopify_products.json'));
  const hang = g.bocTachProductsJson(du, bc);

  kiemTra('10 sản phẩm × 2 biến thể = 20 dòng', () => bang(hang.length, 20));
  kiemTra('mã ngoài là id nền tảng, không phải vị trí dòng hay tên', () => {
    bang(hang[0].ma_ngoai, '6000000000:7000000000');
    that(!/^\d+$/.test(String(hang[0].ma_ngoai)) || hang[0].ma_ngoai.indexOf(':') > 0, 'phải là id:id');
  });
  kiemTra('giá đọc bằng bộ đọc của máy: "259000.00" → 259000', () => {
    bang(hang[0].gia_ban, 259000);
    bang(hang[0].gia_goc, 329000);
  });
  kiemTra('tồn kho không có trong nguồn thì để trống KÈM lý do, không ghi 0', () => {
    bang(hang[0].so_luong_ton, '');
    that(String(hang[0]._thieu.so_luong_ton).indexOf('ton kho') >= 0, 'phải nói rõ vì sao trống');
  });
  kiemTra('đánh giá/số đã bán để trống kèm lý do', () => {
    bang(hang[0].danh_gia_sao, '');
    that(hang[0]._thieu.danh_gia_sao !== undefined);
    bang(hang[0].so_da_ban, '');
  });
  kiemTra('còn hàng / hết hàng đọc từ trường available', () => {
    bang(hang[0].con_hang, 'HET');   // (i+j)%5===0 với i=0,j=0
    bang(hang[1].con_hang, 'CON');
  });
  kiemTra('URL biến thể có ?variant=', () => {
    that(hang[1].url_san_pham.indexOf('?variant=7000000001') > 0, hang[1].url_san_pham);
  });
  kiemTra('tiền tệ lấy từ bối cảnh đã xác minh, không tự suy ra', () => {
    const khongTienTe = g.bocTachProductsJson(du, { url: bc.url, origin: bc.origin, tienTe: '' });
    bang(khongTienTe[0].tien_te, '');
    that(khongTienTe[0]._thieu.tien_te !== undefined, 'phải ghi lý do thiếu tiền tệ');
  });
  kiemTra('một sản phẩm đơn ({url}.json) cũng đọc được', () => {
    const mot = g.bocTachProductsJson(JSON.parse(docFixture('bac1_shopify_mot_san_pham.json')), bc);
    bang(mot.length, 2);
  });
  kiemTra('danh sách rỗng → 0 dòng (không phải lỗi)', () => {
    bang(g.bocTachProductsJson(JSON.parse(docFixture('bac1_shopify_rong.json')), bc).length, 0);
  });
});

nhom('Bậc 2 — WooCommerce Store API', () => {
  const hang = g.bocTachWooStoreApi(JSON.parse(docFixture('bac2_woo_products.json')),
                                    { url: 'https://nhabepviet.vn/', origin: 'https://nhabepviet.vn' });
  kiemTra('6 dòng', () => bang(hang.length, 6));
  kiemTra('đơn vị nhỏ nhất được quy đổi đúng: 35000000 / 10^2 = 350000', () => {
    bang(hang[0].gia_ban, 350000);
    bang(hang[0].tien_te, 'VND');
  });
  kiemTra('giá gốc khác giá bán thì ghi lại', () => {
    bang(hang[0].gia_goc, 420000);
  });
  kiemTra('giá gốc BẰNG giá bán thì để trống kèm lý do, không lặp lại', () => {
    const mot = g.bocTachWooStoreApi([{ id: 1, name: 'X', permalink: 'https://a.vn/p/x',
      prices: { price: '10000', regular_price: '10000', currency_code: 'VND', currency_minor_unit: 2 } }],
      { url: 'https://a.vn/', origin: 'https://a.vn' });
    bang(mot[0].gia_ban, 100);
    bang(mot[0].gia_goc, '');
    bang(mot[0]._thieu.gia_goc, 'gia_goc_bang_gia_ban_nen_bo_trong');
  });
  kiemTra('average_rating = 0 khi chưa có đánh giá thì KHÔNG ghi 0 sao', () => {
    const chuaCo = hang.filter(h => h.so_luot_danh_gia === 0);
    that(chuaCo.length > 0, 'phải có dòng 0 đánh giá trong dữ liệu mẫu');
    bang(chuaCo[0].danh_gia_sao, '');
    that(String(chuaCo[0]._thieu.danh_gia_sao).indexOf('chua_co_danh_gia') >= 0);
  });
  kiemTra('sản phẩm có biến thể thì ghi rõ endpoint này không trả giá từng biến thể', () => {
    const coBt = hang.filter(h => String(h._thieu.phien_ban || '').indexOf('bien_the') >= 0);
    that(coBt.length > 0);
  });
  kiemTra('tồn kho null thì trống kèm lý do', () => {
    const tron = hang.filter(h => h.so_luong_ton === '');
    that(tron.length > 0);
  });
});

nhom('Bậc 3/4 — dữ liệu có cấu trúc', () => {
  kiemTra('JSON-LD trong @graph, offers lồng nhau', () => {
    const h = g.bocTachJsonLdTrang(docFixture('bac3_jsonld_product.html'),
      { url: 'https://noithatviet.vn/san-pham/tham-duramat', origin: 'https://noithatviet.vn' });
    bang(h.length, 1);
    bang(h[0].ten, 'Thảm phòng tắm diatomite DURAMAT 60x40');
    bang(h[0].gia_ban, 459000);
    bang(h[0].tien_te, 'VND');
    bang(h[0].con_hang, 'CON');
    bang(h[0].thuong_hieu, 'DURAMAT');
    bang(h[0].danh_gia_sao, 4.8);
    bang(h[0].so_luot_danh_gia, 137);
    bang(h[0].sku, 'DRM-6040');
  });

  kiemTra('JSON-LD ghi giá kiểu người đọc ("1.250.000") vẫn đọc đúng', () => {
    const h = g.bocTachJsonLdTrang(docFixture('bac3_jsonld_gia_nguoi_doc.html'),
      { url: 'https://shop.vn/p/ke-goc', origin: 'https://shop.vn' });
    bang(h[0].gia_ban, 1250000);
    bang(h[0].con_hang, 'HET');
  });

  kiemTra('Open Graph khi không có JSON-LD', () => {
    const kq = g.bocTachMicroOg(docFixture('bac4_og_only.html'),
      { url: 'https://bepxinh.vn/p/hop-gia-vi-3-ngan', origin: 'https://bepxinh.vn' });
    bang(kq.nguon, 'open_graph');
    bang(kq.hang[0].gia_ban, 189000);
    bang(kq.hang[0].tien_te, 'VND');
    bang(kq.hang[0].con_hang, 'CON');
    bang(kq.hang[0].ma_ngoai, 'BX-HGV-3N');
  });

  kiemTra('Microdata itemprop', () => {
    const kq = g.bocTachMicroOg(docFixture('bac4_microdata.html'),
      { url: 'https://shop.vn/p/gia-treo-khan', origin: 'https://shop.vn' });
    bang(kq.nguon, 'microdata');
    bang(kq.hang[0].gia_ban, 329000);
    bang(kq.hang[0].ten, 'Giá treo khăn inox 304 - 60cm');
  });

  kiemTra('trang không có tín hiệu giá → 0 dòng kèm lý do', () => {
    const kq = g.bocTachMicroOg('<html><body><p>Giới thiệu công ty</p></body></html>',
      { url: 'https://a.vn/gioi-thieu', origin: 'https://a.vn' });
    bang(kq.hang.length, 0);
    that(kq.lyDo !== '');
  });
});

nhom('Bậc 5 — đoán từ HTML (chỉ khi mọi bậc trên đều thua)', () => {
  const kq = g.bocTachHtmlDoan(docFixture('bac5_html_tho.html'),
    { url: 'https://thamviet.vn/danh-muc/tham-nha-tam', origin: 'https://thamviet.vn' });
  kiemTra('gom được 3 sản phẩm có giá', () => bang(kq.hang.length, 3));
  kiemTra('"Liên hệ" không bị biến thành số', () => {
    that(!kq.hang.some(h => h.ten.indexOf('Thảm cao su D') >= 0), 'sản phẩm không có giá thì không được bịa');
  });
  kiemTra('đọc đúng 1.250.000 đ', () => {
    const c = kq.hang.find(h => h.url_san_pham.indexOf('tham-c') > 0);
    bang(c.gia_ban, 1250000);
    bang(c.tien_te, 'VND');
  });
  kiemTra('mọi dòng bậc 5 đều mang cảnh báo phải kiểm chứng tay', () => {
    that(kq.hang.every(h => h._canhBao.length > 0));
  });
  kiemTra('HTML không có giá → 0 dòng kèm lý do', () => {
    const r = g.bocTachHtmlDoan('<html><body><h1>Về chúng tôi</h1></body></html>', { url: 'https://a.vn/x', origin: 'https://a.vn' });
    bang(r.hang.length, 0);
    that(r.lyDo !== '');
  });
});

nhom('Nhận diện vỏ rỗng và nền tảng', () => {
  kiemTra('trang JS shell bị nhận ra là vỏ rỗng', () => {
    const vo = g.laVoTrangRong(docFixture('bac6_js_shell.html'));
    that(vo.laVo, 'phải nhận ra là vỏ rỗng');
    that(vo.lyDo.indexOf('JavaScript') > 0, vo.lyDo);
  });
  kiemTra('trang có JSON-LD Product thì KHÔNG bị coi là vỏ rỗng', () => {
    bang(g.laVoTrangRong(docFixture('bac3_jsonld_product.html')).laVo, false);
  });
  kiemTra('nhận diện Shopify và tiền tệ từ tín hiệu tường minh', () => {
    const html = docFixture('trang_chu_shopify.html');
    bang(g.nhanDienNenTang(html), 'Shopify');
    bang(g.nhanDienTienTe(html), 'VND');
  });
  kiemTra('nhận diện WooCommerce', () => {
    bang(g.nhanDienNenTang(docFixture('trang_chu_woo.html')), 'WordPress/WooCommerce');
  });
  kiemTra('không có tín hiệu tiền tệ thì trả rỗng, không đoán VND', () => {
    bang(g.nhanDienTienTe('<html><body>Giá 250.000</body></html>'), '');
  });
});

nhom('robots.txt', () => {
  kiemTra('đọc Crawl-delay và Sitemap', () => {
    const r = g.phanTichRobots(docFixture('robots_cho_phep.txt'));
    bang(r.sitemap, ['https://noithatviet.vn/sitemap_index.xml']);
    bang(r.nhom['*'].crawlDelay, 2);
  });
  kiemTra('Disallow /cart chặn đúng đường dẫn đó', () => {
    const r = g.phanTichRobots(docFixture('robots_cho_phep.txt'));
    bang(g.duocPhepLay(r, '/cart', 'X/1.0').duoc, false);
    bang(g.duocPhepLay(r, '/products.json', 'X/1.0').duoc, true);
  });
  kiemTra('Disallow: / chặn tất cả', () => {
    const r = g.phanTichRobots(docFixture('robots_cam.txt'));
    bang(g.duocPhepLay(r, '/products.json', 'X/1.0').duoc, false);
  });
  kiemTra('Allow dài hơn thì thắng Disallow', () => {
    const r = g.phanTichRobots('User-agent: *\nDisallow: /a\nAllow: /a/b\n');
    bang(g.duocPhepLay(r, '/a/b/c', 'X/1.0').duoc, true);
    bang(g.duocPhepLay(r, '/a/x', 'X/1.0').duoc, false);
  });
});

nhom('Sitemap', () => {
  kiemTra('nhận ra sitemap tổng', () => {
    const s = g.docSitemap(docFixture('sitemap_index.xml'));
    that(s.laChiMuc);
    bang(s.url.length, 2);
  });
  kiemTra('đọc danh sách URL sản phẩm', () => {
    const s = g.docSitemap(docFixture('sitemap_products.xml'));
    bang(s.laChiMuc, false);
    bang(s.url.length, 3);
  });
});
