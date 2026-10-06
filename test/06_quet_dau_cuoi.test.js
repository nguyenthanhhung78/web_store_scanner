'use strict';
/** Quét đầu-cuối trên dữ liệu mẫu. Không có lần gọi mạng thật nào: UrlFetchApp là bảng định tuyến. */
const { nhom, kiemTra, that, bang } = require('./kt');
const { taoMoiTruong, docFixture } = require('./harness');

const JSON_KIEU = 'application/json; charset=utf-8';

function moiTruongShopify() {
  const env = taoMoiTruong();
  env.dinhTuyen(/^https:\/\/durahome\.vn\/robots\.txt$/, { code: 200, body: 'User-agent: *\nDisallow: /cart\n', kieu: 'text/plain' });
  env.dinhTuyen(/^https:\/\/durahome\.vn\/products\.json\?limit=250&page=1$/, { code: 200, body: docFixture('bac1_shopify_products.json'), kieu: JSON_KIEU });
  env.dinhTuyen(/^https:\/\/durahome\.vn\/products\.json/, { code: 200, body: '{"products":[]}', kieu: JSON_KIEU });
  env.dinhTuyen(/^https:\/\/durahome\.vn\/$/, { code: 200, body: docFixture('trang_chu_shopify.html') });
  return env;
}

nhom('Đầu-cuối: cửa hàng Shopify/Haravan (bậc 1)', () => {
  const env = moiTruongShopify();
  const kq = env.g.batDauQuet('https://durahome.vn/?utm_source=facebook&fbclid=xyz', 'chi.lan@durahome.vn');

  kiemTra('quét xong trong một lượt chạy', () => that(kq.xong, 'phải xong: ' + kq.ghiChu));
  kiemTra('kết luận CAO', () => bang(kq.ketLuan.ketLuan, 'CAO'));
  kiemTra('ghi đủ 20 dòng vào SAN_PHAM', () => {
    const sp = env.docBang('SAN_PHAM');
    bang(sp.length, 20);
    bang(sp[0].ten_mien, 'durahome.vn');
    bang(sp[0].nen_tang, 'Shopify');
    bang(sp[0].nguon_url, 'https://durahome.vn/', 'URL đã được chuẩn hoá, bỏ utm/fbclid');
    bang(sp[0].tien_te, 'VND', 'tiền tệ lấy từ Shopify.currency trên trang');
  });
  kiemTra('LAN_QUET có đúng 1 dòng, ghi đủ bằng chứng', () => {
    const lq = env.docBang('LAN_QUET');
    bang(lq.length, 1);
    bang(lq[0].ket_luan, 'CAO');
    bang(lq[0].bac_thang_dung, 'BAC_1_PRODUCTS_JSON');
    bang(lq[0].so_sp, 20);
    bang(lq[0].ty_le_co_gia, 100);
    bang(lq[0].loai_url, 'STORE');
    bang(lq[0].nguoi_quet, 'chi.lan@durahome.vn');
    that(String(lq[0].truong_thieu_nhieu).indexOf('so_luong_ton') >= 0, lq[0].truong_thieu_nhieu);
  });
  kiemTra('dừng phân trang khi trang sau trả về rỗng', () => {
    const goi = env.nhatKyGoi.filter(x => x.url.indexOf('products.json') > 0);
    bang(goi.length, 2, 'gọi trang 1 rồi trang 2 rỗng là dừng');
  });
  kiemTra('lịch sự: ≥1500ms giữa 2 lần gọi cùng tên miền, có User-Agent kèm liên hệ', () => {
    that(env.nhatKyGoi.length >= 3);
    const ua = env.nhatKyGoi[0].opt.headers['User-Agent'];
    that(/@/.test(ua), 'User-Agent phải có địa chỉ liên hệ: ' + ua);
    that(env.nhatKyGoi.every(x => x.opt.headers['User-Agent'] === ua), 'không được đổi User-Agent giữa chừng');
    // đồng hồ giả chỉ nhích khi Utilities.sleep() được gọi
    that(env.dongHo.lech >= 1500 * (env.nhatKyGoi.length - 1),
      'tổng thời gian chờ ' + env.dongHo.lech + 'ms không đủ cho ' + env.nhatKyGoi.length + ' lần gọi');
  });
  kiemTra('không còn con trỏ dở dang sau khi xong', () => bang(env.g.docCon(), null));
});

nhom('Đầu-cuối: WooCommerce (bậc 2)', () => {
  const env = taoMoiTruong();
  env.dinhTuyen(/robots\.txt$/, { code: 404, body: 'không có' });
  env.dinhTuyen(/^https:\/\/nhabepviet\.vn\/products\.json/, { code: 404, body: '<html>404</html>' });
  env.dinhTuyen(/wc\/store\/v1\/products\?per_page=100&page=1$/, { code: 200, body: docFixture('bac2_woo_products.json'), kieu: JSON_KIEU });
  env.dinhTuyen(/wc\/store\/v1\/products/, { code: 200, body: '[]', kieu: JSON_KIEU });
  env.dinhTuyen(/^https:\/\/nhabepviet\.vn\/$/, { code: 200, body: docFixture('trang_chu_woo.html') });
  const kq = env.g.batDauQuet('https://nhabepviet.vn', '');

  kiemTra('dùng bậc 2 sau khi bậc 1 thất bại', () => {
    bang(kq.tt.bacDung, 'BAC_2_WOO_STORE_API');
    bang(env.docBang('SAN_PHAM').length, 6);
  });
  kiemTra('kết luận CAO và nền tảng là WooCommerce', () => {
    bang(kq.ketLuan.ketLuan, 'CAO');
    bang(env.docBang('LAN_QUET')[0].nen_tang, 'WordPress/WooCommerce');
  });
  kiemTra('tiền tệ VND lấy từ currency_code của API', () => {
    bang(env.docBang('SAN_PHAM')[0].tien_te, 'VND');
    bang(env.docBang('SAN_PHAM')[0].gia_ban, 350000);
  });
});

nhom('Đầu-cuối: sitemap + JSON-LD (bậc 3)', () => {
  const env = taoMoiTruong();
  env.dinhTuyen(/^https:\/\/noithatviet\.vn\/robots\.txt$/, { code: 200, body: docFixture('robots_cho_phep.txt'), kieu: 'text/plain' });
  env.dinhTuyen(/products\.json|wp-json/, { code: 404, body: 'không có' });
  env.dinhTuyen(/sitemap_index\.xml$/, { code: 200, body: docFixture('sitemap_index.xml'), kieu: 'application/xml' });
  env.dinhTuyen(/sitemap_products_1\.xml$/, { code: 200, body: docFixture('sitemap_products.xml'), kieu: 'application/xml' });
  env.dinhTuyen(/sitemap_pages_1\.xml$/, { code: 200, body: '<urlset><url><loc>https://noithatviet.vn/gioi-thieu</loc></url></urlset>', kieu: 'application/xml' });
  env.dinhTuyen(/\/san-pham\/tham-duramat$/, { code: 200, body: docFixture('bac3_jsonld_product.html') });
  env.dinhTuyen(/\/san-pham\/ke-goc-3-tang$/, { code: 200, body: docFixture('bac3_jsonld_gia_nguoi_doc.html') });
  env.dinhTuyen(/^https:\/\/noithatviet\.vn\/$/, { code: 200, body: '<html><head><title>Nội Thất Việt</title></head><body><h1>Nội Thất Việt</h1><p>Cửa hàng nội thất, xem sản phẩm trong danh mục.</p></body></html>' });
  const kq = env.g.batDauQuet('https://noithatviet.vn', '');

  kiemTra('đi tới bậc 3 và đọc được 2 trang sản phẩm', () => {
    bang(kq.tt.bacDung, 'BAC_3_SITEMAP_LD');
    bang(env.docBang('SAN_PHAM').length, 2);
  });
  kiemTra('kết luận TRUNG_BINH (không phải API nền tảng)', () => bang(kq.ketLuan.ketLuan, 'TRUNG_BINH'));
  kiemTra('bỏ qua URL không phải sản phẩm trong sitemap', () => {
    that(!env.nhatKyGoi.some(x => /gioi-thieu/.test(x.url)), 'không được đi lấy trang giới thiệu');
  });
  kiemTra('tôn trọng Crawl-delay: 2 giây > mức tối thiểu 1,5 giây', () => {
    that(env.dongHo.lech >= 2000 * (env.nhatKyGoi.length - 2), 'chờ ' + env.dongHo.lech + 'ms');
  });
  kiemTra('giá viết kiểu người đọc trong JSON-LD vẫn ra đúng 1.250.000', () => {
    const sp = env.docBang('SAN_PHAM');
    that(sp.some(h => h.gia_ban === 1250000), JSON.stringify(sp.map(h => h.gia_ban)));
  });
});

nhom('Đầu-cuối: trang sản phẩm chỉ có Open Graph (bậc 4)', () => {
  const env = taoMoiTruong();
  env.dinhTuyen(/robots\.txt$/, { code: 404, body: '' });
  env.dinhTuyen(/\.json|wp-json/, { code: 404, body: 'không có' });
  env.dinhTuyen(/^https:\/\/bepxinh\.vn\/p\/hop-gia-vi-3-ngan$/, { code: 200, body: docFixture('bac4_og_only.html') });
  const kq = env.g.batDauQuet('https://bepxinh.vn/p/hop-gia-vi-3-ngan', '');

  kiemTra('dùng bậc 4, ghi 1 dòng', () => {
    bang(kq.tt.bacDung, 'BAC_4_TRANG_DON_LD');
    bang(env.docBang('SAN_PHAM').length, 1);
    bang(env.docBang('SAN_PHAM')[0].gia_ban, 189000);
  });
  kiemTra('kết luận TRUNG_BINH', () => bang(kq.ketLuan.ketLuan, 'TRUNG_BINH'));
  kiemTra('URL loại PRODUCT thì thử {url}.json trước', () => {
    that(env.nhatKyGoi.some(x => /hop-gia-vi-3-ngan\.json$/.test(x.url)), JSON.stringify(env.nhatKyGoi.map(x => x.url)));
  });
});

nhom('Đầu-cuối: chỉ đoán được từ HTML (bậc 5) → THAP', () => {
  const env = taoMoiTruong();
  env.dinhTuyen(/robots\.txt$/, { code: 404, body: '' });
  env.dinhTuyen(/\.json|wp-json|sitemap/, { code: 404, body: 'không có' });
  env.dinhTuyen(/^https:\/\/thamviet\.vn\/danh-muc\/tham-nha-tam$/, { code: 200, body: docFixture('bac5_html_tho.html') });
  const kq = env.g.batDauQuet('https://thamviet.vn/danh-muc/tham-nha-tam', '');

  kiemTra('dùng bậc 5', () => bang(kq.tt.bacDung, 'BAC_5_HTML_DOAN'));
  kiemTra('kết luận THAP dù đủ giá', () => {
    bang(kq.ketLuan.ketLuan, 'THAP');
    bang(kq.ketLuan.tyLeCoGia, 1);
  });
  kiemTra('3 dòng, đều là phỏng đoán', () => bang(env.docBang('SAN_PHAM').length, 3));
});

nhom('CA QUAN TRỌNG NHẤT: vỏ rỗng JavaScript → KHONG_QUET_DUOC, tuyệt đối không phải CAO với 0 dòng', () => {
  const env = taoMoiTruong();
  env.dinhTuyen(/robots\.txt$/, { code: 404, body: '' });
  env.dinhTuyen(/\.json|wp-json|sitemap/, { code: 404, body: 'không có' });
  env.dinhTuyen(/^https:\/\/sanmoi\.vn\/$/, { code: 200, body: docFixture('bac6_js_shell.html') });
  const kq = env.g.batDauQuet('https://sanmoi.vn', '');

  kiemTra('kết luận KHONG_QUET_DUOC', () => bang(kq.ketLuan.ketLuan, 'KHONG_QUET_DUOC'));
  kiemTra('không ghi dòng sản phẩm nào', () => bang(env.docBang('SAN_PHAM').length, 0));
  kiemTra('vẫn ghi 1 dòng LAN_QUET nêu rõ lý do JavaScript', () => {
    const lq = env.docBang('LAN_QUET');
    bang(lq.length, 1);
    bang(lq[0].so_sp, 0);
    bang(lq[0].bac_thang_dung, 'BAC_6_KHONG_QUET_DUOC');
    that(String(lq[0].ly_do).indexOf('JavaScript') > 0, lq[0].ly_do);
  });
});

nhom('Bị chặn (403 + thử thách chống bot) → dừng, không lách', () => {
  const env = taoMoiTruong();
  env.dinhTuyen(/robots\.txt$/, { code: 404, body: '' });
  env.dinhTuyen(/^https:\/\/chanbot\.vn/, { code: 403, body: docFixture('bac6_challenge_403.html') });
  const kq = env.g.batDauQuet('https://chanbot.vn/collections/tat-ca', '');

  kiemTra('kết luận KHONG_QUET_DUOC', () => bang(kq.ketLuan.ketLuan, 'KHONG_QUET_DUOC'));
  kiemTra('nêu đúng dấu hiệu thử thách', () => {
    that(String(env.docBang('LAN_QUET')[0].ly_do).indexOf('cf-browser-verification') > 0, env.docBang('LAN_QUET')[0].ly_do);
  });
  kiemTra('KHÔNG thử lại bằng User-Agent khác và dừng tên miền ngay', () => {
    const goiTrang = env.nhatKyGoi.filter(x => !/robots\.txt/.test(x.url));
    bang(goiTrang.length, 1, 'chỉ được gọi đúng 1 lần rồi dừng: ' + JSON.stringify(goiTrang.map(x => x.url)));
    const ua = new Set(env.nhatKyGoi.map(x => x.opt.headers['User-Agent']));
    bang(ua.size, 1, 'chỉ được dùng một User-Agent duy nhất');
  });
});

nhom('robots.txt cấm → không lấy gì hết', () => {
  const env = taoMoiTruong();
  env.dinhTuyen(/robots\.txt$/, { code: 200, body: docFixture('robots_cam.txt'), kieu: 'text/plain' });
  env.dinhTuyen(/.*/, { code: 200, body: docFixture('trang_chu_shopify.html') });
  const kq = env.g.batDauQuet('https://camquet.vn', '');

  kiemTra('kết luận KHONG_QUET_DUOC', () => bang(kq.ketLuan.ketLuan, 'KHONG_QUET_DUOC'));
  kiemTra('chỉ gọi đúng robots.txt, không gọi gì khác', () => {
    bang(env.nhatKyGoi.length, 1);
    that(/robots\.txt$/.test(env.nhatKyGoi[0].url));
  });
  kiemTra('lý do nêu rõ robots.txt', () => {
    that(String(env.docBang('LAN_QUET')[0].ly_do).indexOf('robots.txt') > 0, env.docBang('LAN_QUET')[0].ly_do);
  });
});

nhom('Sàn không quét được → trả lời ngay, không gọi mạng lần nào', () => {
  for (const u of ['https://shopee.vn/shop/123456', 'https://www.tiktok.com/shop/abc', 'https://www.lazada.vn/products/x-i1-s2.html']) {
    const env = taoMoiTruong();
    env.dinhTuyen(/.*/, { code: 200, body: '<html>không bao giờ được gọi tới đây</html>' });
    const kq = env.g.batDauQuet(u, '');
    kiemTra(u + ' → KHONG_QUET_DUOC, 0 lần gọi mạng', () => {
      bang(kq.ketLuan.ketLuan, 'KHONG_QUET_DUOC');
      bang(env.nhatKyGoi.length, 0, 'không được gọi mạng: ' + JSON.stringify(env.nhatKyGoi.map(x => x.url)));
      const ly = String(env.docBang('LAN_QUET')[0].ly_do);
      that(ly.indexOf('API') > 0 || ly.indexOf('Seller Center') > 0, 'phải chỉ ra đường đi hợp lệ: ' + ly);
    });
  }
});

nhom('Dán link danh mục nhưng chỉ đọc được cả cửa hàng thì phải nói rõ', () => {
  const env = moiTruongShopify();
  env.dinhTuyen(/^https:\/\/durahome\.vn\/product-category\/nha-tam$/, { code: 200, body: docFixture('trang_chu_shopify.html') });
  const kq = env.g.batDauQuet('https://durahome.vn/product-category/nha-tam', '');

  kiemTra('vẫn lấy được dữ liệu', () => {
    bang(kq.tt.loaiUrl, 'CATEGORY');
    bang(env.docBang('SAN_PHAM').length, 20);
  });
  kiemTra('ly_do nêu rõ đây là số của TOÀN BỘ cửa hàng', () => {
    const ly = String(env.docBang('LAN_QUET')[0].ly_do);
    that(ly.indexOf('TOÀN BỘ cửa hàng') > 0, ly);
  });
  kiemTra('URL danh mục Shopify (/collections/) thì KHÔNG cảnh báo vì lấy đúng danh mục', () => {
    const e2 = taoMoiTruong();
    e2.dinhTuyen(/robots\.txt$/, { code: 404, body: '' });
    e2.dinhTuyen(/collections\/tham\/products\.json\?limit=250&page=1$/, { code: 200, body: docFixture('bac1_shopify_products.json'), kieu: JSON_KIEU });
    e2.dinhTuyen(/products\.json/, { code: 200, body: '{"products":[]}', kieu: JSON_KIEU });
    e2.dinhTuyen(/.*/, { code: 200, body: docFixture('trang_chu_shopify.html') });
    e2.g.batDauQuet('https://durahome.vn/collections/tham', '');
    const ly = String(e2.docBang('LAN_QUET')[0].ly_do);
    that(ly.indexOf('TOÀN BỘ cửa hàng') < 0, 'không được cảnh báo nhầm: ' + ly);
    bang(e2.docBang('SAN_PHAM').length, 20);
  });
});

nhom('Chuyển hướng: phải lấy ĐỊA CHỈ CUỐI làm địa chỉ của lần quét', () => {
  const env = taoMoiTruong();
  env.dinhTuyen(/robots\.txt$/, { code: 404, body: '' });
  env.dinhTuyen(/^https:\/\/cu\.vn\/tat-ca$/,
    { code: 301, body: '', headers: { Location: 'https://moi.vn/collections/all' } });
  env.dinhTuyen(/moi\.vn\/collections\/all\/products\.json\?limit=250&page=1$/,
    { code: 200, body: docFixture('bac1_shopify_products.json'), kieu: JSON_KIEU });
  env.dinhTuyen(/products\.json/, { code: 200, body: '{"products":[]}', kieu: JSON_KIEU });
  env.dinhTuyen(/^https:\/\/moi\.vn\/collections\/all$/, { code: 200, body: docFixture('trang_chu_shopify.html') });
  const kq = env.g.batDauQuet('https://cu.vn/tat-ca', '');

  kiemTra('địa chỉ, tên miền và loại URL đều cập nhật theo đích đến', () => {
    bang(kq.tt.url, 'https://moi.vn/collections/all');
    bang(kq.tt.host, 'moi.vn');
    bang(kq.tt.loaiUrl, 'CATEGORY', 'phải phân loại lại theo địa chỉ cuối');
  });
  kiemTra('bậc 1 gọi endpoint của địa chỉ CUỐI, không phải địa chỉ đã nhập', () => {
    that(env.nhatKyGoi.some(x => x.url === 'https://moi.vn/collections/all/products.json?limit=250&page=1'),
      JSON.stringify(env.nhatKyGoi.map(x => x.url)));
    bang(kq.tt.bacDung, 'BAC_1_PRODUCTS_JSON');
    bang(kq.ketLuan.ketLuan, 'CAO');
  });
  kiemTra('dòng ghi xuống mang tên miền đích, và sổ ghi lại việc chuyển hướng', () => {
    bang(env.docBang('SAN_PHAM')[0].ten_mien, 'moi.vn');
    that(String(env.docBang('LAN_QUET')[0].ly_do).indexOf('Chuyển hướng') > 0, env.docBang('LAN_QUET')[0].ly_do);
  });
  kiemTra('bước chuyển hướng cũng phải chờ đủ độ trễ lịch sự', () => {
    // Độ trễ tính theo TỪNG tên miền, nên lần gọi đầu tới mỗi tên miền không phải chờ.
    // Ở đây có 2 tên miền (cu.vn rồi moi.vn), nên số lần phải chờ = số lượt gọi − 2.
    const soHost = new Set(env.nhatKyGoi.map(x => x.url.split('/')[2])).size;
    bang(soHost, 2);
    that(env.dongHo.lech >= 1500 * (env.nhatKyGoi.length - soHost),
      env.nhatKyGoi.length + ' lượt gọi trên ' + soHost + ' tên miền, chỉ chờ ' + env.dongHo.lech + 'ms');
  });
});

nhom('Chuyển hướng sang sàn không quét được thì dừng ngay', () => {
  const env = taoMoiTruong();
  env.dinhTuyen(/robots\.txt$/, { code: 404, body: '' });
  env.dinhTuyen(/^https:\/\/rutgon\.vn\/abc$/,
    { code: 302, body: '', headers: { Location: 'https://shopee.vn/shop/999' } });
  env.dinhTuyen(/.*/, { code: 200, body: '<html><body>không bao giờ tới đây</body></html>' });
  const kq = env.g.batDauQuet('https://rutgon.vn/abc', '');

  kiemTra('kết luận KHONG_QUET_DUOC và nêu đường đi hợp lệ', () => {
    bang(kq.ketLuan.ketLuan, 'KHONG_QUET_DUOC');
    const ly = String(env.docBang('LAN_QUET')[0].ly_do);
    that(ly.indexOf('Shopee') > 0, ly);
    that(ly.indexOf('Seller') > 0 || ly.indexOf('API') > 0, ly);
  });
  kiemTra('không ghi dòng sản phẩm nào', () => bang(env.docBang('SAN_PHAM').length, 0));
});

nhom('404 khi dò thang không được tính là lỗi tên miền', () => {
  const env = taoMoiTruong();
  env.dinhTuyen(/robots\.txt$/, { code: 404, body: '' });
  env.dinhTuyen(/products\.json|wp-json|sitemap/, { code: 404, body: 'không có' });
  env.dinhTuyen(/^https:\/\/dobac\.vn\/$/, { code: 200, body: docFixture('bac5_html_tho.html') });
  const kq = env.g.batDauQuet('https://dobac.vn', '');

  kiemTra('dò qua 5 lần 404 vẫn xuống được tới bậc 5', () => {
    const so404 = env.nhatKyGoi.filter(x => x.code === 404).length;
    that(so404 >= 4, 'phải có ít nhất 4 lần 404, đang có ' + so404);
    bang(kq.tt.bacDung, 'BAC_5_HTML_DOAN');
  });
  kiemTra('tên miền KHÔNG bị dừng vì 404', () => {
    bang(Object.keys(kq.tt.mangLuoi.hostDaDung).length, 0);
  });
});

nhom('Lỗi máy chủ 5xx liên tiếp thì mới dừng tên miền', () => {
  const env = taoMoiTruong();
  env.dinhTuyen(/robots\.txt$/, { code: 404, body: '' });
  env.dinhTuyen(/.*/, { code: 500, body: 'lỗi máy chủ' });
  const kq = env.g.batDauQuet('https://hong.vn', '');

  kiemTra('dừng tên miền sau 3 lỗi liên tiếp', () => {
    that(kq.tt.mangLuoi.hostDaDung['hong.vn'] !== undefined, 'phải dừng tên miền');
    bang(kq.ketLuan.ketLuan, 'KHONG_QUET_DUOC');
  });
  kiemTra('không gọi mãi: tổng số lần gọi có giới hạn', () => {
    that(env.nhatKyGoi.length <= 6, 'gọi ' + env.nhatKyGoi.length + ' lần');
  });
});

nhom('Không khẳng định điều chưa đo được', () => {
  const env = taoMoiTruong();
  // robots.txt lỗi máy chủ => theo RFC 9309 là không được quét gì cả.
  env.dinhTuyen(/robots\.txt$/, { code: 503, body: 'bảo trì' });
  env.dinhTuyen(/.*/, { code: 200, body: docFixture('trang_chu_shopify.html') });
  const kq = env.g.batDauQuet('https://khongbiet.vn', '');
  const ly = String(env.docBang('LAN_QUET')[0].ly_do);

  kiemTra('KHÔNG được kết luận "không phải WordPress" khi chưa hỏi được /wp-json/', () => {
    that(ly.indexOf('Không phải WordPress') < 0, 'khẳng định điều chưa đo: ' + ly);
    that(ly.indexOf('Chưa biết có phải WordPress') > 0, ly);
  });
  kiemTra('lần gọi bị chặn không bị tính vào trần số trang', () => {
    bang(kq.tt.soTrangDaLay, 0, 'không gọi ra mạng được lần nào thì không tiêu trang nào');
  });
  kiemTra('kết luận KHONG_QUET_DUOC và nêu đúng lý do robots.txt', () => {
    bang(kq.ketLuan.ketLuan, 'KHONG_QUET_DUOC');
    that(ly.indexOf('robots.txt') > 0, ly);
  });
});

nhom('Trần số trang và trần số lượt gọi', () => {
  const env = taoMoiTruong();
  env.dinhTuyen(/robots\.txt$/, { code: 404, body: '' });
  env.dinhTuyen(/products\.json/, { code: 200, body: docFixture('bac1_shopify_products.json'), kieu: JSON_KIEU });
  env.dinhTuyen(/.*/, { code: 200, body: docFixture('trang_chu_shopify.html') });
  const caiDat = env.g.docCaiDatMacDinh();
  caiDat.gioi_han_trang = 4;
  const kq = env.g.batDauQuet('https://vohan.vn', '', { caiDat: caiDat });

  kiemTra('dừng đúng ở trần 4 trang dù nguồn còn trả dữ liệu', () => {
    that(kq.tt.soTrangDaLay <= 5, 'đã lấy ' + kq.tt.soTrangDaLay + ' trang');
    that(kq.xong, 'phải kết thúc gọn');
  });
  kiemTra('vẫn ra kết luận có số đo', () => {
    that(kq.ketLuan.soSp > 0);
    bang(kq.ketLuan.ketLuan, 'CAO');
  });
});
