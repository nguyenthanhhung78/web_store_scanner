/**
 * 09_THANG.js — the detection ladder, as a resumable state machine.
 *
 * Runtime detection only. There is no watchlist and no per-site adapter: the URL is
 * unknown until the operator pastes it, so the tool tries rungs in order and stops at the
 * first one that yields products. Which rung succeeded is recorded, because it decides
 * the verdict.
 *
 * Each call to buocQuet() performs AT MOST ONE network request and returns. That is what
 * makes the 6-minute wall survivable: the driver can stop between any two steps.
 */

var GIAI_DOAN = {
  KHOI_DONG: 'KHOI_DONG',
  BAC1: 'BAC1',
  BAC2: 'BAC2',
  BAC3_TIM_SITEMAP: 'BAC3_TIM_SITEMAP',
  BAC3_DOC_SITEMAP: 'BAC3_DOC_SITEMAP',
  BAC3_DOC_TRANG: 'BAC3_DOC_TRANG',
  BAC4: 'BAC4',
  BAC5: 'BAC5',
  XONG: 'XONG'
};

var CHU_KY_NEN_TANG = [
  { mau: /cdn\.shopify\.com|Shopify\.theme|shopify-section/i, ten: 'Shopify' },
  { mau: /haravan\.com|Haravan\.|hstatic\.net/i, ten: 'Haravan' },
  { mau: /bizweb\.dkstatic\.vn|sapoapp|Sapo\.|sapo-section/i, ten: 'Sapo/Bizweb' },
  { mau: /wp-content|wp-includes|woocommerce/i, ten: 'WordPress/WooCommerce' },
  { mau: /Magento_|mage\/|magento/i, ten: 'Magento' },
  { mau: /nhanh\.vn/i, ten: 'Nhanh.vn' },
  { mau: /kiotviet/i, ten: 'KiotViet' },
  { mau: /wixstatic\.com|wix-code/i, ten: 'Wix' },
  { mau: /ladipage|ladi-/i, ten: 'LadiPage' }
];

function nhanDienNenTang(html) {
  var s = String(html || '').substring(0, 400000);
  for (var i = 0; i < CHU_KY_NEN_TANG.length; i++) {
    if (CHU_KY_NEN_TANG[i].mau.test(s)) return CHU_KY_NEN_TANG[i].ten;
  }
  return '';
}

/**
 * Currency, only from an explicit signal on the page. Never from the domain, never from
 * "the price looks Vietnamese". Empty means we did not find out.
 */
function nhanDienTienTe(html) {
  var s = String(html || '');
  var m = /Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/.exec(s);
  if (m) return m[1];
  m = /Haravan\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/.exec(s);
  if (m) return m[1];
  var meta = layTheMeta(s);
  if (meta['product:price:currency']) return String(meta['product:price:currency']).toUpperCase();
  if (meta['og:price:currency']) return String(meta['og:price:currency']).toUpperCase();
  var md = layMicrodata(s);
  if (md.pricecurrency && /^[A-Za-z]{3}$/.test(md.pricecurrency)) return md.pricecurrency.toUpperCase();
  var sp = timSanPhamJsonLd(s);
  for (var i = 0; i < sp.length; i++) {
    var o = sp[i].offers;
    if (!o) continue;
    var ds = Object.prototype.toString.call(o) === '[object Array]' ? o : [o];
    for (var j = 0; j < ds.length; j++) {
      if (ds[j] && ds[j].priceCurrency && /^[A-Za-z]{3}$/.test(String(ds[j].priceCurrency))) {
        return String(ds[j].priceCurrency).toUpperCase();
      }
    }
  }
  return '';
}

/** Fresh scan state for one URL. Everything here is JSON-serialisable (keys with _ are not saved). */
function taoTrangThaiQuet(urlNhap, nguoiQuet, maLanQuet) {
  var pl = phanLoaiUrl(urlNhap);
  return {
    maLanQuet: maLanQuet,
    batDau: new Date().toISOString(),
    ketThuc: '',
    urlNhap: String(urlNhap).trim(),
    url: pl.url,
    loaiUrl: pl.loai,
    host: pl.host,
    origin: pl.origin,
    sanKhongQuetDuoc: pl.san ? { ten: pl.san.ten, lyDo: pl.san.lyDo, loiRa: pl.san.loiRa } : null,
    nenTang: '',
    tienTe: '',
    giaiDoan: GIAI_DOAN.KHOI_DONG,
    trang: 1,
    soTrangDaLay: 0,
    bacDung: '',
    lyDoThatBai: [],
    sitemapChoDoc: [],
    spChoDoc: [],
    viTriSp: 0,
    daGhiMa: {},
    soDaGhi: 0,
    tichLuy: taoTichLuy(),
    nguoiQuet: nguoiQuet || '',
    ghiChu: 'Chuẩn bị quét…'
  };
}

function themLyDo(tt, s) {
  tt.lyDoThatBai.push(s);
  if (tt.lyDoThatBai.length > 30) tt.lyDoThatBai.shift();
}

function chamTranTrang(tt, bc) {
  var tran = Number(bc.caiDat.gioi_han_trang) || 20;
  return tt.soTrangDaLay >= tran;
}

function boiCanhBocTach(tt) {
  return { url: tt.url, origin: tt.origin, nenTang: tt.nenTang, tienTe: tt.tienTe };
}

/**
 * When the pasted URL is a CATEGORY but the rung we ended up using reads the WHOLE store,
 * say so once, loudly, in the scan record. Otherwise the operator reads "180 sản phẩm" as
 * "this category has 180 products", which is not what was measured.
 */
function canhBaoLayCaCuaHang(tt, ten) {
  if (tt.loaiUrl !== LOAI_URL.CATEGORY || tt.daCanhBaoToanCuaHang) return;
  tt.daCanhBaoToanCuaHang = true;
  themLyDo(tt, 'CHÚ Ý: địa chỉ bạn dán là một DANH MỤC, nhưng ' + ten + ' chỉ đọc được theo ' +
               'cả cửa hàng. Số dòng dưới đây là của TOÀN BỘ cửa hàng, không phải riêng danh mục đó.');
}

/** The Shopify/Haravan/Sapo URL to try for this step, or '' when rung 1 does not apply. */
function urlBac1(tt) {
  if (tt.loaiUrl === LOAI_URL.PRODUCT) {
    if (tt.trang > 1) return '';
    return tt.url.split('?')[0] + '.json';
  }
  if (tt.loaiUrl === LOAI_URL.CATEGORY) {
    var m = /\/collections\/([^\/?#]+)/.exec(tt.url);
    if (m) return tt.origin + '/collections/' + m[1] + '/products.json?limit=250&page=' + tt.trang;
  }
  return tt.origin + '/products.json?limit=250&page=' + tt.trang;
}

/** One step of the ladder. Performs at most one network request. */
function buocQuet(tt, bc) {
  switch (tt.giaiDoan) {
    case GIAI_DOAN.KHOI_DONG: return buocKhoiDong(tt, bc);
    case GIAI_DOAN.BAC1: return buocBac1(tt, bc);
    case GIAI_DOAN.BAC2: return buocBac2(tt, bc);
    case GIAI_DOAN.BAC3_TIM_SITEMAP: return buocTimSitemap(tt, bc);
    case GIAI_DOAN.BAC3_DOC_SITEMAP: return buocDocSitemap(tt, bc);
    case GIAI_DOAN.BAC3_DOC_TRANG: return buocDocTrangSanPham(tt, bc);
    case GIAI_DOAN.BAC4: return buocBac4(tt, bc);
    case GIAI_DOAN.BAC5: return buocBac5(tt, bc);
    default: return { hang: [], xong: true, ghiChu: 'Đã xong.' };
  }
}

function buocKhoiDong(tt, bc) {
  if (tt.sanKhongQuetDuoc) {
    tt.bacDung = BAC.BAC_6_KHONG_QUET_DUOC;
    tt.giaiDoan = GIAI_DOAN.XONG;
    themLyDo(tt, tt.sanKhongQuetDuoc.ten + ': ' + tt.sanKhongQuetDuoc.lyDo + ' Đường đi hợp lệ: ' + tt.sanKhongQuetDuoc.loiRa);
    return { hang: [], xong: true, ghiChu: 'Không quét được ' + tt.sanKhongQuetDuoc.ten + ' — dừng ngay, không thử vòng khác.' };
  }
  if (!tt.url) {
    tt.bacDung = BAC.BAC_6_KHONG_QUET_DUOC;
    tt.giaiDoan = GIAI_DOAN.XONG;
    themLyDo(tt, 'Địa chỉ không hợp lệ: ' + tt.urlNhap);
    return { hang: [], xong: true, ghiChu: 'Địa chỉ không hợp lệ.' };
  }

  var tl = layNoiDung(tt.url, { boiCanh: bc, nhan: 'trang-goc' });
  tt.soTrangDaLay++;
  if (!tl.ok) {
    themLyDo(tt, 'Trang gốc: ' + tl.tuChoi.loai + ' — ' + tl.tuChoi.lyDo);
    tt._html = '';
  } else {
    tt._html = tl.noiDung;
    tt.nenTang = nhanDienNenTang(tl.noiDung);
    tt.tienTe = nhanDienTienTe(tl.noiDung);
    var vo = laVoTrangRong(tl.noiDung);
    tt.voTrangRong = vo.laVo;
    tt.lyDoVoTrang = vo.lyDo;
    if (vo.laVo) themLyDo(tt, 'Trang gốc là vỏ rỗng: ' + vo.lyDo);
  }
  tt.giaiDoan = GIAI_DOAN.BAC1;
  tt.trang = 1;
  return {
    hang: [], xong: false,
    ghiChu: 'Đã đọc trang gốc' + (tt.nenTang ? ' (nhận diện: ' + tt.nenTang + ')' : '') + '. Đang thử bậc 1…'
  };
}

function buocBac1(tt, bc) {
  var url = urlBac1(tt);
  if (url === '' || chamTranTrang(tt, bc)) {
    return ketThucBac1(tt, bc, url === '' ? 'Bậc 1 không áp dụng cho loại URL này.' : 'Chạm trần số trang ở bậc 1.');
  }
  var kq = layJson(url, { boiCanh: bc, nhan: 'bac1' });
  tt.soTrangDaLay++;
  if (!kq.ok) {
    themLyDo(tt, 'Bậc 1 (' + url + '): ' + (kq.tuChoi ? kq.tuChoi.lyDo : 'không đọc được JSON') +
                 (kq.maTrangThai ? ' [HTTP ' + kq.maTrangThai + ']' : ''));
    return ketThucBac1(tt, bc, 'Bậc 1 không dùng được.');
  }
  var hang = bocTachProductsJson(kq.dulieu, boiCanhBocTach(tt));
  if (hang.length === 0) {
    return ketThucBac1(tt, bc, tt.bacDung ? 'Hết sản phẩm ở bậc 1.' : 'Bậc 1 trả về danh sách rỗng.');
  }
  tt.bacDung = BAC.BAC_1_PRODUCTS_JSON;
  if (url.indexOf('/collections/') < 0) canhBaoLayCaCuaHang(tt, 'bậc 1 (products.json)');
  if (!tt.nenTang) tt.nenTang = 'Shopify/Haravan/Sapo (products.json)';
  if (tt.loaiUrl === LOAI_URL.PRODUCT) {
    tt.giaiDoan = GIAI_DOAN.XONG;
    return { hang: hang, xong: true, ghiChu: 'Bậc 1: đọc được 1 sản phẩm từ API của nền tảng.' };
  }
  tt.trang++;
  return { hang: hang, xong: false, ghiChu: 'Bậc 1: đã đọc trang ' + (tt.trang - 1) + ', tổng ' + (tt.soDaGhi + hang.length) + ' dòng.' };
}

function ketThucBac1(tt, bc, ghiChu) {
  if (tt.bacDung === BAC.BAC_1_PRODUCTS_JSON) {
    tt.giaiDoan = GIAI_DOAN.XONG;
    return { hang: [], xong: true, ghiChu: ghiChu };
  }
  tt.giaiDoan = GIAI_DOAN.BAC2;
  tt.trang = 1;
  return { hang: [], xong: false, ghiChu: ghiChu + ' Đang thử bậc 2 (WooCommerce)…' };
}

function buocBac2(tt, bc) {
  if (chamTranTrang(tt, bc)) return ketThucBac2(tt, bc, 'Chạm trần số trang ở bậc 2.');
  var url = tt.origin + '/wp-json/wc/store/v1/products?per_page=100&page=' + tt.trang;
  var kq = layJson(url, { boiCanh: bc, nhan: 'bac2' });
  tt.soTrangDaLay++;
  if (!kq.ok && tt.trang === 1) {
    // Older stores expose the Store API without the version segment.
    var url0 = tt.origin + '/wp-json/wc/store/products?per_page=100&page=1';
    kq = layJson(url0, { boiCanh: bc, nhan: 'bac2-cu' });
    tt.soTrangDaLay++;
  }
  if (!kq.ok) {
    themLyDo(tt, 'Bậc 2: ' + (kq.tuChoi ? kq.tuChoi.lyDo : 'không đọc được JSON') + (kq.maTrangThai ? ' [HTTP ' + kq.maTrangThai + ']' : ''));
    if (tt.trang === 1 && !chamTranTrang(tt, bc)) {
      // Confirm whether this is even WordPress, so the log says something useful.
      var wp = layJson(tt.origin + '/wp-json/', { boiCanh: bc, nhan: 'bac2-wp' });
      tt.soTrangDaLay++;
      themLyDo(tt, wp.ok ? 'Là WordPress nhưng không bật WooCommerce Store API.' : 'Không phải WordPress (/wp-json/ không trả JSON).');
    }
    return ketThucBac2(tt, bc, 'Bậc 2 không dùng được.');
  }
  var hang = bocTachWooStoreApi(kq.dulieu, boiCanhBocTach(tt));
  if (hang.length === 0) return ketThucBac2(tt, bc, tt.bacDung ? 'Hết sản phẩm ở bậc 2.' : 'Bậc 2 trả về danh sách rỗng.');
  tt.bacDung = BAC.BAC_2_WOO_STORE_API;
  canhBaoLayCaCuaHang(tt, 'bậc 2 (WooCommerce Store API)');
  if (!tt.nenTang) tt.nenTang = 'WooCommerce';
  tt.trang++;
  return { hang: hang, xong: false, ghiChu: 'Bậc 2: đã đọc trang ' + (tt.trang - 1) + ', tổng ' + (tt.soDaGhi + hang.length) + ' dòng.' };
}

function ketThucBac2(tt, bc, ghiChu) {
  if (tt.bacDung === BAC.BAC_2_WOO_STORE_API) {
    tt.giaiDoan = GIAI_DOAN.XONG;
    return { hang: [], xong: true, ghiChu: ghiChu };
  }
  if (tt.loaiUrl === LOAI_URL.PRODUCT || tt.loaiUrl === LOAI_URL.MARKETPLACE_PRODUCT) {
    tt.giaiDoan = GIAI_DOAN.BAC4;
    return { hang: [], xong: false, ghiChu: ghiChu + ' Đang thử bậc 4 (dữ liệu có cấu trúc của trang)…' };
  }
  tt.giaiDoan = GIAI_DOAN.BAC3_TIM_SITEMAP;
  return { hang: [], xong: false, ghiChu: ghiChu + ' Đang thử bậc 3 (sitemap)…' };
}

function buocTimSitemap(tt, bc) {
  var rb = bc.robots[tt.origin];
  var ds = [];
  if (rb && rb.robots && rb.robots.sitemap && rb.robots.sitemap.length) {
    for (var i = 0; i < rb.robots.sitemap.length && i < 10; i++) ds.push(rb.robots.sitemap[i]);
  }
  if (ds.length === 0) {
    ds = [tt.origin + '/sitemap.xml', tt.origin + '/sitemap_index.xml', tt.origin + '/sitemap_products_1.xml'];
  }
  tt.sitemapChoDoc = ds;
  tt.giaiDoan = GIAI_DOAN.BAC3_DOC_SITEMAP;
  return { hang: [], xong: false, ghiChu: 'Bậc 3: có ' + ds.length + ' sitemap để thử.' };
}

var MAU_URL_SAN_PHAM_SITEMAP = /\/(products|product|san-pham|sanpham|p)\//i;

function buocDocSitemap(tt, bc) {
  if (tt.sitemapChoDoc.length === 0 || chamTranTrang(tt, bc)) {
    if (tt.spChoDoc.length > 0) {
      tt.giaiDoan = GIAI_DOAN.BAC3_DOC_TRANG;
      return { hang: [], xong: false, ghiChu: 'Bậc 3: có ' + tt.spChoDoc.length + ' trang sản phẩm để đọc.' };
    }
    tt.giaiDoan = GIAI_DOAN.BAC4;
    themLyDo(tt, 'Bậc 3: không tìm được URL sản phẩm nào trong sitemap.');
    return { hang: [], xong: false, ghiChu: 'Bậc 3 không có kết quả. Đang thử bậc 4…' };
  }
  var url = tt.sitemapChoDoc.shift();
  var tl = layNoiDung(url, { boiCanh: bc, nhan: 'sitemap' });
  tt.soTrangDaLay++;
  if (!tl.ok) {
    themLyDo(tt, 'Sitemap ' + url + ': ' + tl.tuChoi.lyDo);
    return { hang: [], xong: false, ghiChu: 'Không đọc được ' + url };
  }
  var sm = docSitemap(tl.noiDung);
  if (sm.laChiMuc) {
    var uuTien = [];
    var conLai = [];
    for (var i = 0; i < sm.url.length; i++) {
      if (/product|san-pham|sanpham/i.test(sm.url[i])) uuTien.push(sm.url[i]);
      else conLai.push(sm.url[i]);
    }
    var them = uuTien.concat(conLai).slice(0, 10);
    tt.sitemapChoDoc = them.concat(tt.sitemapChoDoc).slice(0, 20);
    return { hang: [], xong: false, ghiChu: 'Sitemap tổng: thêm ' + them.length + ' sitemap con.' };
  }
  var loc = [];
  for (var j = 0; j < sm.url.length; j++) {
    if (MAU_URL_SAN_PHAM_SITEMAP.test(sm.url[j])) loc.push(sm.url[j]);
  }
  if (loc.length === 0 && /product|san-pham/i.test(url)) loc = sm.url.slice(0, 200);
  for (var k = 0; k < loc.length && tt.spChoDoc.length < 200; k++) {
    if (tt.spChoDoc.indexOf(loc[k]) < 0) tt.spChoDoc.push(loc[k]);
  }
  return { hang: [], xong: false, ghiChu: 'Sitemap: gom được ' + tt.spChoDoc.length + ' URL sản phẩm.' };
}

function buocDocTrangSanPham(tt, bc) {
  if (tt.viTriSp >= tt.spChoDoc.length || chamTranTrang(tt, bc)) {
    if (tt.bacDung === BAC.BAC_3_SITEMAP_LD) {
      tt.giaiDoan = GIAI_DOAN.XONG;
      return { hang: [], xong: true, ghiChu: 'Bậc 3: đã đọc xong ' + tt.viTriSp + ' trang sản phẩm.' };
    }
    tt.giaiDoan = GIAI_DOAN.BAC4;
    return { hang: [], xong: false, ghiChu: 'Bậc 3 không đọc được sản phẩm nào. Đang thử bậc 4…' };
  }
  var url = tt.spChoDoc[tt.viTriSp];
  tt.viTriSp++;
  var tl = layNoiDung(url, { boiCanh: bc, nhan: 'bac3-trang' });
  tt.soTrangDaLay++;
  if (!tl.ok) {
    themLyDo(tt, 'Trang sản phẩm ' + url + ': ' + tl.tuChoi.lyDo);
    return { hang: [], xong: false, ghiChu: 'Bỏ qua 1 trang không đọc được.' };
  }
  var bt = { url: url, origin: tt.origin, nenTang: tt.nenTang, tienTe: tt.tienTe };
  var hang = bocTachJsonLdTrang(tl.noiDung, bt);
  if (hang.length === 0) {
    var mo = bocTachMicroOg(tl.noiDung, bt);
    hang = mo.hang;
  }
  if (hang.length === 0) {
    themLyDo(tt, 'Trang ' + url + ': không có dữ liệu có cấu trúc.');
    return { hang: [], xong: false, ghiChu: 'Trang không có dữ liệu có cấu trúc.' };
  }
  tt.bacDung = BAC.BAC_3_SITEMAP_LD;
  canhBaoLayCaCuaHang(tt, 'bậc 3 (sitemap)');
  return {
    hang: hang, xong: false,
    ghiChu: 'Bậc 3: ' + tt.viTriSp + '/' + tt.spChoDoc.length + ' trang, tổng ' + (tt.soDaGhi + hang.length) + ' dòng.'
  };
}

function buocBac4(tt, bc) {
  var html = tt._html;
  if (!html) {
    if (chamTranTrang(tt, bc)) {
      tt.giaiDoan = GIAI_DOAN.XONG;
      themLyDo(tt, 'Bậc 4: chạm trần số trang, không đọc lại được trang gốc.');
      return { hang: [], xong: true, ghiChu: 'Chạm trần số trang.' };
    }
    var tl = layNoiDung(tt.url, { boiCanh: bc, nhan: 'bac4' });
    tt.soTrangDaLay++;
    if (!tl.ok) {
      themLyDo(tt, 'Bậc 4: ' + tl.tuChoi.lyDo);
      tt.giaiDoan = GIAI_DOAN.XONG;
      return { hang: [], xong: true, ghiChu: 'Bậc 4 không đọc được trang.' };
    }
    html = tl.noiDung;
    tt._html = html;
    if (!tt.nenTang) tt.nenTang = nhanDienNenTang(html);
    if (!tt.tienTe) tt.tienTe = nhanDienTienTe(html);
    var vo = laVoTrangRong(html);
    tt.voTrangRong = vo.laVo;
    tt.lyDoVoTrang = vo.lyDo;
  }

  var bt = boiCanhBocTach(tt);
  var hang = bocTachJsonLdTrang(html, bt);
  if (hang.length > 0) {
    tt.bacDung = BAC.BAC_4_TRANG_DON_LD;
    tt.giaiDoan = GIAI_DOAN.XONG;
    return { hang: hang, xong: true, ghiChu: 'Bậc 4: đọc được ' + hang.length + ' dòng từ JSON-LD của trang.' };
  }
  var mo = bocTachMicroOg(html, bt);
  if (mo.hang.length > 0) {
    tt.bacDung = BAC.BAC_4_TRANG_DON_LD;
    tt.giaiDoan = GIAI_DOAN.XONG;
    return { hang: mo.hang, xong: true, ghiChu: 'Bậc 4: đọc được 1 dòng từ ' + mo.nguon + '.' };
  }
  themLyDo(tt, 'Bậc 4: ' + (mo.lyDo || 'không có JSON-LD Product trên trang.'));
  tt.giaiDoan = GIAI_DOAN.BAC5;
  return { hang: [], xong: false, ghiChu: 'Bậc 4 không có kết quả. Đang thử bậc 5 (đoán từ HTML)…' };
}

function buocBac5(tt, bc) {
  var html = tt._html || '';
  if (html === '' || tt.voTrangRong) {
    tt.bacDung = BAC.BAC_6_KHONG_QUET_DUOC;
    tt.giaiDoan = GIAI_DOAN.XONG;
    themLyDo(tt, tt.voTrangRong
      ? ('Bậc 6: ' + (tt.lyDoVoTrang || 'trang là vỏ rỗng do JavaScript dựng.'))
      : 'Bậc 6: không lấy được HTML của trang.');
    return { hang: [], xong: true, ghiChu: 'Không quét được — trang không có dữ liệu trong HTML.' };
  }
  var kq = bocTachHtmlDoan(html, boiCanhBocTach(tt));
  if (kq.hang.length === 0) {
    tt.bacDung = BAC.BAC_6_KHONG_QUET_DUOC;
    tt.giaiDoan = GIAI_DOAN.XONG;
    themLyDo(tt, 'Bậc 5: ' + (kq.lyDo || 'không tìm thấy giá trong HTML.'));
    return { hang: [], xong: true, ghiChu: 'Không quét được — HTML không chứa giá.' };
  }
  tt.bacDung = BAC.BAC_5_HTML_DOAN;
  tt.giaiDoan = GIAI_DOAN.XONG;
  return { hang: kq.hang, xong: true, ghiChu: 'Bậc 5: đoán được ' + kq.hang.length + ' dòng từ HTML (độ tin cậy thấp).' };
}
