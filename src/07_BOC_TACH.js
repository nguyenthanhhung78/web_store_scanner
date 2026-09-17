/**
 * 07_BOC_TACH.js — extractors. Every function here takes TEXT (or already-parsed JSON)
 * and returns row objects. None of them touches the network.
 *
 * A field that cannot be read is written empty AND the reason is recorded in `_thieu`,
 * which is what the verdict is later computed from. Nothing is ever inferred from a
 * sibling variant, a sibling product, or the domain name.
 *
 * We collect public commercial facts only: title, price, SKU, stock state, aggregate
 * rating counts. No reviewer names, no review text, no seller phone numbers or addresses.
 */

function hangTrong() {
  var h = {};
  for (var i = 0; i < TRUONG_SAN_PHAM.length; i++) h[TRUONG_SAN_PHAM[i]] = '';
  h._thieu = {};
  h._canhBao = [];
  return h;
}

/** Set a field, or record why it stayed empty. Never writes 0, 'N/A' or a guess. */
function dat(hang, truong, giaTri, lyDoNeuTrong) {
  if (giaTri === null || giaTri === undefined || giaTri === '' ||
      (typeof giaTri === 'number' && !isFinite(giaTri))) {
    hang._thieu[truong] = lyDoNeuTrong || 'khong_co_trong_nguon';
    hang[truong] = '';
    return false;
  }
  hang[truong] = giaTri;
  return true;
}

function catMoTa(s) {
  var t = boThe(s);
  return t.length > 300 ? t.substring(0, 300) : t;
}

function chuoiHoacRong(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

/** schema.org availability URL -> CON / HET. Anything else stays empty with a reason. */
function docTinhTrangSchema(v) {
  var s = chuoiHoacRong(v).toLowerCase();
  if (s === '') return { con: '', lyDo: 'khong_co_truong_availability' };
  if (s.indexOf('instock') >= 0 || s.indexOf('in_stock') >= 0 || s.indexOf('limitedavailability') >= 0) return { con: 'CON', lyDo: '' };
  if (s.indexOf('outofstock') >= 0 || s.indexOf('soldout') >= 0 || s.indexOf('discontinued') >= 0) return { con: 'HET', lyDo: '' };
  if (s.indexOf('preorder') >= 0 || s.indexOf('backorder') >= 0) return { con: '', lyDo: 'trang_thai_dat_truoc_khong_phai_con_hang' };
  return { con: '', lyDo: 'khong_doc_duoc_availability (' + s.substring(0, 40) + ')' };
}

/* ------------------------------------------------------------------ RUNG 1 */

/**
 * Shopify / Haravan / Sapo products.json. Prices in this feed are machine decimals
 * ("259000.00"), so phanTichSoMay is the right reader — NOT the human one.
 */
function bocTachProductsJson(dulieu, boiCanh) {
  var ra = [];
  if (!dulieu) return ra;
  var ds = [];
  if (Object.prototype.toString.call(dulieu.products) === '[object Array]') ds = dulieu.products;
  else if (dulieu.product) ds = [dulieu.product];
  else if (Object.prototype.toString.call(dulieu) === '[object Array]') ds = dulieu;

  for (var i = 0; i < ds.length; i++) {
    var p = ds[i] || {};
    var bienThe = Object.prototype.toString.call(p.variants) === '[object Array]' ? p.variants : [];
    var urlSp = p.handle ? boiCanh.origin + '/products/' + p.handle : (boiCanh.url || '');
    var anh = '';
    if (Object.prototype.toString.call(p.images) === '[object Array]' && p.images.length) {
      anh = chuoiHoacRong(p.images[0].src || p.images[0]);
    } else if (p.image && p.image.src) {
      anh = chuoiHoacRong(p.image.src);
    }

    if (bienThe.length === 0) bienThe = [null];
    for (var j = 0; j < bienThe.length; j++) {
      var v = bienThe[j];
      var h = hangTrong();

      var ma = '';
      if (p.id !== undefined && v && v.id !== undefined) ma = String(p.id) + ':' + String(v.id);
      else if (p.id !== undefined) ma = String(p.id);
      else if (p.handle) ma = layMaTuDuongDan(urlSp);
      dat(h, 'ma_ngoai', ma, 'nguon_khong_co_id_san_pham');

      var urlBienThe = urlSp;
      if (v && v.id !== undefined && bienThe.length > 1) urlBienThe = urlSp + '?variant=' + v.id;
      dat(h, 'url_san_pham', urlBienThe, 'khong_dung_duoc_url_san_pham');
      dat(h, 'ten', chuoiHoacRong(p.title), 'nguon_khong_co_title');
      dat(h, 'thuong_hieu', chuoiHoacRong(p.vendor), 'nguon_khong_co_vendor');
      dat(h, 'danh_muc', chuoiHoacRong(p.product_type), 'nguon_khong_co_product_type');

      if (v) {
        dat(h, 'sku', chuoiHoacRong(v.sku), 'bien_the_khong_co_sku');
        var tenBt = chuoiHoacRong(v.title);
        if (tenBt === 'Default Title') tenBt = '';
        dat(h, 'phien_ban', tenBt, 'san_pham_khong_co_bien_the');

        var g = phanTichSoMay(v.price);
        dat(h, 'gia_ban', g.gia, 'khong_doc_duoc_gia: ' + g.lyDo);
        var gg = phanTichSoMay(v.compare_at_price);
        dat(h, 'gia_goc', gg.gia, 'khong_co_gia_goc: ' + gg.lyDo);

        if (v.available === true) h.con_hang = 'CON';
        else if (v.available === false) h.con_hang = 'HET';
        else dat(h, 'con_hang', '', 'nguon_khong_co_truong_available');

        var ton = phanTichSoNguyen(v.inventory_quantity);
        dat(h, 'so_luong_ton', ton.so, 'products.json cong khai khong tra ton kho');
        if (!anh && v.featured_image && v.featured_image.src) anh = chuoiHoacRong(v.featured_image.src);
      } else {
        dat(h, 'sku', '', 'san_pham_khong_co_bien_the');
        dat(h, 'phien_ban', '', 'san_pham_khong_co_bien_the');
        dat(h, 'gia_ban', null, 'san_pham_khong_co_bien_the_nen_khong_co_gia');
        dat(h, 'gia_goc', null, 'san_pham_khong_co_bien_the');
        dat(h, 'con_hang', '', 'san_pham_khong_co_bien_the');
        dat(h, 'so_luong_ton', null, 'san_pham_khong_co_bien_the');
      }

      dat(h, 'tien_te', boiCanh.tienTe || '', 'products.json khong ghi don vi tien te; chua xac minh duoc tu nguon khac');
      dat(h, 'danh_gia_sao', null, 'products.json khong co danh gia');
      dat(h, 'so_luot_danh_gia', null, 'products.json khong co danh gia');
      dat(h, 'so_da_ban', null, 'nen tang khong cong bo so da ban');
      dat(h, 'anh_chinh', anh, 'nguon_khong_co_anh');
      dat(h, 'mo_ta_ngan', catMoTa(p.body_html || p.description || ''), 'nguon_khong_co_mo_ta');

      var cb = canhBaoGiaKhoTin(h.gia_ban === '' ? null : h.gia_ban, h.tien_te || null);
      if (cb) h._canhBao.push(cb);
      ra.push(h);
    }
  }
  return ra;
}

/* ------------------------------------------------------------------ RUNG 2 */

/** WooCommerce Store API v1. Prices are integer minor units plus currency_minor_unit. */
function bocTachWooStoreApi(dulieu, boiCanh) {
  var ra = [];
  var ds = Object.prototype.toString.call(dulieu) === '[object Array]' ? dulieu
         : (dulieu && Object.prototype.toString.call(dulieu.products) === '[object Array]' ? dulieu.products
         : (dulieu && dulieu.id ? [dulieu] : []));

  for (var i = 0; i < ds.length; i++) {
    var p = ds[i] || {};
    var h = hangTrong();
    var gia = p.prices || {};
    var donVi = phanTichSoNguyen(gia.currency_minor_unit);
    var mu = donVi.so === null ? 2 : donVi.so;
    var chia = Math.pow(10, mu);

    dat(h, 'ma_ngoai', p.id !== undefined ? String(p.id) : layMaTuDuongDan(chuoiHoacRong(p.permalink)), 'nguon_khong_co_id');
    dat(h, 'url_san_pham', chuoiHoacRong(p.permalink), 'nguon_khong_co_permalink');
    dat(h, 'ten', giaiMaHtml(chuoiHoacRong(p.name)), 'nguon_khong_co_name');
    dat(h, 'thuong_hieu', '', 'WooCommerce Store API khong tra thuong hieu');

    var dm = [];
    if (Object.prototype.toString.call(p.categories) === '[object Array]') {
      for (var c = 0; c < p.categories.length; c++) dm.push(chuoiHoacRong(p.categories[c].name));
    }
    dat(h, 'danh_muc', dm.filter(function (x) { return x !== ''; }).join(' | '), 'nguon_khong_co_danh_muc');
    dat(h, 'sku', chuoiHoacRong(p.sku), 'nguon_khong_co_sku');

    var coKhoang = gia.price_range && gia.price_range.min_amount !== undefined &&
                   String(gia.price_range.min_amount) !== String(gia.price_range.max_amount);
    if (coKhoang) {
      dat(h, 'gia_ban', null, 'san_pham_bien_the_co_khoang_gia (' + gia.price_range.min_amount + '-' + gia.price_range.max_amount + '), khong chon dai dien');
      dat(h, 'gia_goc', null, 'san_pham_bien_the_co_khoang_gia');
    } else {
      var gb = phanTichSoNguyen(gia.price);
      dat(h, 'gia_ban', gb.so === null ? null : gb.so / chia, 'khong_doc_duoc_gia: ' + gb.lyDo);
      var gr = phanTichSoNguyen(gia.regular_price);
      var giaGoc = gr.so === null ? null : gr.so / chia;
      if (giaGoc !== null && h.gia_ban !== '' && giaGoc === h.gia_ban) {
        dat(h, 'gia_goc', null, 'gia_goc_bang_gia_ban_nen_bo_trong');
      } else {
        dat(h, 'gia_goc', giaGoc, 'khong_co_gia_goc: ' + gr.lyDo);
      }
    }
    dat(h, 'tien_te', chuoiHoacRong(gia.currency_code), 'nguon_khong_ghi_currency_code');

    var soBt = Object.prototype.toString.call(p.variations) === '[object Array]' ? p.variations.length : 0;
    dat(h, 'phien_ban', '', soBt > 0
      ? 'san_pham_co_' + soBt + '_bien_the nhung Store API khong tra gia tung bien the o endpoint nay'
      : 'san_pham_khong_co_bien_the');

    if (p.is_in_stock === true) h.con_hang = 'CON';
    else if (p.is_in_stock === false) h.con_hang = 'HET';
    else dat(h, 'con_hang', '', 'nguon_khong_co_is_in_stock');

    var ton = phanTichSoNguyen(p.stock_quantity);
    dat(h, 'so_luong_ton', ton.so, 'cua_hang_an_so_luong_ton');

    var slDg = phanTichSoNguyen(p.review_count);
    dat(h, 'so_luot_danh_gia', slDg.so, 'nguon_khong_co_review_count');
    if (slDg.so !== null && slDg.so > 0) {
      var sao = phanTichSao(p.average_rating);
      dat(h, 'danh_gia_sao', sao.sao, 'khong_doc_duoc_average_rating: ' + sao.lyDo);
    } else {
      dat(h, 'danh_gia_sao', null, 'chua_co_danh_gia_nao (average_rating = 0 khong phai la diem that)');
    }
    dat(h, 'so_da_ban', null, 'nen tang khong cong bo so da ban');

    var anh = '';
    if (Object.prototype.toString.call(p.images) === '[object Array]' && p.images.length) anh = chuoiHoacRong(p.images[0].src);
    dat(h, 'anh_chinh', anh, 'nguon_khong_co_anh');
    dat(h, 'mo_ta_ngan', catMoTa(p.short_description || p.description || ''), 'nguon_khong_co_mo_ta');

    var cb = canhBaoGiaKhoTin(h.gia_ban === '' ? null : h.gia_ban, h.tien_te || null);
    if (cb) h._canhBao.push(cb);
    ra.push(h);
  }
  return ra;
}

/* ------------------------------------------------------------- RUNG 3 & 4 */

function tenThuongHieu(v) {
  if (!v) return '';
  if (typeof v === 'string') return v.trim();
  if (Object.prototype.toString.call(v) === '[object Array]') return tenThuongHieu(v[0]);
  if (typeof v === 'object') return chuoiHoacRong(v.name);
  return '';
}

function anhDauTien(v) {
  if (!v) return '';
  if (typeof v === 'string') return v.trim();
  if (Object.prototype.toString.call(v) === '[object Array]') return anhDauTien(v[0]);
  if (typeof v === 'object') return chuoiHoacRong(v.url || v.contentUrl);
  return '';
}

function tenDanhMuc(v) {
  if (!v) return '';
  if (typeof v === 'string') return v.trim();
  if (Object.prototype.toString.call(v) === '[object Array]') return tenDanhMuc(v[0]);
  if (typeof v === 'object') return chuoiHoacRong(v.name);
  return '';
}

/** One JSON-LD Product node -> one row per offer (or a single row when there is no offer). */
function bocTachNutJsonLd(nut, boiCanh) {
  var chao = nut.offers;
  var ds = [];
  if (!chao) ds = [null];
  else if (Object.prototype.toString.call(chao) === '[object Array]') ds = chao;
  else ds = [chao];

  var ra = [];
  for (var i = 0; i < ds.length; i++) {
    var o = ds[i];
    var h = hangTrong();
    var urlSp = chuoiHoacRong(nut.url) || (o ? chuoiHoacRong(o.url) : '') || boiCanh.url || '';
    if (urlSp && urlSp.indexOf('http') !== 0) urlSp = ghepUrl(boiCanh.url || boiCanh.origin, urlSp);

    var ma = chuoiHoacRong(nut['@id']) || chuoiHoacRong(nut.productID) || chuoiHoacRong(nut.sku) ||
             (o ? chuoiHoacRong(o.sku) : '') || chuoiHoacRong(nut.mpn) || layMaTuDuongDan(urlSp);
    dat(h, 'ma_ngoai', ma, 'json_ld_khong_co_id_on_dinh');
    dat(h, 'url_san_pham', urlSp, 'khong_co_url_san_pham');
    dat(h, 'ten', giaiMaHtml(chuoiHoacRong(nut.name)), 'json_ld_khong_co_name');
    dat(h, 'thuong_hieu', tenThuongHieu(nut.brand), 'json_ld_khong_co_brand');
    dat(h, 'danh_muc', tenDanhMuc(nut.category), 'json_ld_khong_co_category');
    dat(h, 'sku', chuoiHoacRong(nut.sku) || (o ? chuoiHoacRong(o.sku) : ''), 'json_ld_khong_co_sku');
    dat(h, 'phien_ban', o ? chuoiHoacRong(o.name) : '', 'json_ld_khong_ghi_bien_the');

    var kieuChao = o ? chuoiHoacRong(o['@type']).toLowerCase() : '';
    if (o && kieuChao === 'aggregateoffer') {
      dat(h, 'gia_ban', null,
        'gia_la_khoang (' + chuoiHoacRong(o.lowPrice) + '-' + chuoiHoacRong(o.highPrice) + '), khong chon dai dien');
      dat(h, 'gia_goc', null, 'gia_la_khoang');
      dat(h, 'tien_te', chuoiHoacRong(o.priceCurrency), 'json_ld_khong_co_priceCurrency');
      dat(h, 'con_hang', '', 'aggregateOffer_khong_co_tinh_trang_cu_the');
    } else if (o) {
      var tt = chuoiHoacRong(o.priceCurrency);
      var g = phanTichGiaLinhHoat(
        o.price !== undefined ? o.price : (o.priceSpecification ? o.priceSpecification.price : undefined), tt);
      dat(h, 'gia_ban', g.gia, 'khong_doc_duoc_gia: ' + g.lyDo);
      dat(h, 'tien_te', tt || g.tienTe, 'json_ld_khong_co_priceCurrency; khong duoc mac dinh la VND');
      if (g.canhBao) h._canhBao.push(g.canhBao);
      dat(h, 'gia_goc', null, 'json_ld_khong_co_gia_goc');
      var tc = docTinhTrangSchema(o.availability);
      if (tc.con) h.con_hang = tc.con; else dat(h, 'con_hang', '', tc.lyDo);
    } else {
      dat(h, 'gia_ban', null, 'json_ld_khong_co_offers');
      dat(h, 'gia_goc', null, 'json_ld_khong_co_offers');
      dat(h, 'tien_te', '', 'json_ld_khong_co_offers');
      dat(h, 'con_hang', '', 'json_ld_khong_co_offers');
    }

    dat(h, 'so_luong_ton', null, 'json_ld_khong_cong_bo_ton_kho');
    var dg = nut.aggregateRating;
    if (dg) {
      var sao = phanTichSao(dg.ratingValue);
      dat(h, 'danh_gia_sao', sao.sao, 'khong_doc_duoc_ratingValue: ' + sao.lyDo);
      var sl = phanTichSoNguyen(dg.reviewCount !== undefined ? dg.reviewCount : dg.ratingCount);
      dat(h, 'so_luot_danh_gia', sl.so, 'json_ld_khong_co_reviewCount');
    } else {
      dat(h, 'danh_gia_sao', null, 'json_ld_khong_co_aggregateRating');
      dat(h, 'so_luot_danh_gia', null, 'json_ld_khong_co_aggregateRating');
    }
    dat(h, 'so_da_ban', null, 'nen tang khong cong bo so da ban');
    dat(h, 'anh_chinh', anhDauTien(nut.image), 'json_ld_khong_co_image');
    dat(h, 'mo_ta_ngan', catMoTa(nut.description || ''), 'json_ld_khong_co_description');
    ra.push(h);
  }
  return ra;
}

/** All JSON-LD Products on one page. */
function bocTachJsonLdTrang(html, boiCanh) {
  var nut = timSanPhamJsonLd(html);
  var ra = [];
  for (var i = 0; i < nut.length; i++) {
    var hang = bocTachNutJsonLd(nut[i], boiCanh);
    for (var j = 0; j < hang.length; j++) ra.push(hang[j]);
  }
  return ra;
}

/** Microdata, then Open Graph. One row for the page. Returns [] when there is no price signal. */
function bocTachMicroOg(html, boiCanh) {
  var md = layMicrodata(html);
  var meta = layTheMeta(html);
  var h = hangTrong();
  var nguon = '';

  var giaTho = md.price || meta['product:price:amount'] || meta['og:price:amount'] || meta['price'] || '';
  var ttTho = md.pricecurrency || meta['product:price:currency'] || meta['og:price:currency'] || meta['currency'] || '';
  if (md.price) nguon = 'microdata';
  else if (meta['product:price:amount'] || meta['og:price:amount']) nguon = 'open_graph';

  if (giaTho === '') return { hang: [], nguon: '', lyDo: 'Trang không có itemprop="price" và cũng không có og:price/product:price.' };

  var ten = giaiMaHtml(md.name || meta['og:title'] || layTieuDe(html));
  var url = meta['og:url'] || layCanonical(html) || boiCanh.url || '';
  if (url && url.indexOf('http') !== 0) url = ghepUrl(boiCanh.url || boiCanh.origin, url);

  dat(h, 'ma_ngoai', chuoiHoacRong(md.sku) || chuoiHoacRong(md.productid) || chuoiHoacRong(meta['product:retailer_item_id']) || layMaTuDuongDan(url),
      'trang_khong_co_ma_san_pham');
  dat(h, 'url_san_pham', url, 'khong_co_url_san_pham');
  dat(h, 'ten', ten, 'trang_khong_co_ten');
  dat(h, 'thuong_hieu', chuoiHoacRong(md.brand) || chuoiHoacRong(meta['product:brand']) || chuoiHoacRong(meta['og:brand']), 'trang_khong_co_thuong_hieu');
  dat(h, 'danh_muc', chuoiHoacRong(md.category) || chuoiHoacRong(meta['product:category']), 'trang_khong_co_danh_muc');
  dat(h, 'sku', chuoiHoacRong(md.sku) || chuoiHoacRong(meta['product:retailer_item_id']), 'trang_khong_co_sku');
  dat(h, 'phien_ban', '', 'nguon_nay_khong_co_bien_the');

  var g = phanTichGiaLinhHoat(giaTho, chuoiHoacRong(ttTho) || null);
  dat(h, 'gia_ban', g.gia, 'khong_doc_duoc_gia (' + nguon + '): ' + g.lyDo);
  dat(h, 'gia_goc', null, 'nguon_nay_khong_co_gia_goc');
  dat(h, 'tien_te', chuoiHoacRong(ttTho) || g.tienTe, 'khong_co_ky_hieu_tien_te; khong duoc mac dinh la VND');
  if (g.canhBao) h._canhBao.push(g.canhBao);

  var tt = docTinhTrangSchema(md.availability || meta['product:availability'] || meta['og:availability']);
  if (tt.con) h.con_hang = tt.con; else dat(h, 'con_hang', '', tt.lyDo);

  dat(h, 'so_luong_ton', null, 'nguon_nay_khong_co_ton_kho');
  dat(h, 'danh_gia_sao', null, 'nguon_nay_khong_co_danh_gia');
  dat(h, 'so_luot_danh_gia', null, 'nguon_nay_khong_co_danh_gia');
  dat(h, 'so_da_ban', null, 'nen tang khong cong bo so da ban');
  dat(h, 'anh_chinh', chuoiHoacRong(meta['og:image']) || chuoiHoacRong(md.image), 'trang_khong_co_anh');
  dat(h, 'mo_ta_ngan', catMoTa(meta['og:description'] || md.description || ''), 'trang_khong_co_mo_ta');

  return { hang: [h], nguon: nguon, lyDo: '' };
}

/* ------------------------------------------------------------------ RUNG 5 */

/**
 * Last resort: a currency-adjacent number sitting near something that looks like a
 * product link or heading. Deliberately generic — no per-site selectors ever, because the
 * next URL pasted into this tool is one nobody has seen before.
 * Anything from here is verdict THAP at best.
 */
function bocTachHtmlDoan(html, boiCanh) {
  var sach = boKhoiMa(html);
  var giaTrongTrang = timGiaTrongVanBan(boThe(sach));
  if (giaTrongTrang.length === 0) {
    return { hang: [], lyDo: 'HTML không chứa số nào đi kèm ký hiệu tiền tệ.' };
  }

  var lienKet = layLienKet(sach);
  var theoHref = {};
  var thuTu = [];
  var mauGia = /(?:(₫|đ|VNĐ|VND)\s*([0-9][0-9., ]{2,})|([0-9][0-9., ]{2,})\s*(₫|đ|VNĐ|VND))/g;
  var m;
  var vong = 0;
  while ((m = mauGia.exec(sach)) !== null && vong < 600) {
    vong++;
    // Nearest preceding anchor within 1200 chars is our best generic guess at "this price
    // belongs to that product".
    var gan = null;
    for (var i = 0; i < lienKet.length; i++) {
      if (lienKet[i].viTri < m.index && m.index - lienKet[i].viTri < 1200) {
        if (!gan || lienKet[i].viTri > gan.viTri) gan = lienKet[i];
      }
    }
    if (!gan || gan.chu === '') continue;
    var href = ghepUrl(boiCanh.url || boiCanh.origin, gan.href);
    if (href === '' || href.indexOf(boiCanh.origin) !== 0) continue;
    if (theoHref[href]) continue;
    var chuoiGia = (m[2] !== undefined ? m[2] : m[3]) + ' ' + (m[1] !== undefined ? m[1] : m[4]);
    theoHref[href] = { href: href, ten: gan.chu, gia: chuoiGia };
    thuTu.push(href);
  }

  var ra = [];
  for (var k = 0; k < thuTu.length; k++) {
    var t = theoHref[thuTu[k]];
    var h = hangTrong();
    dat(h, 'ma_ngoai', layMaTuDuongDan(t.href), 'khong_co_ma_tu_html');
    dat(h, 'url_san_pham', t.href, 'khong_co_url');
    dat(h, 'ten', t.ten, 'khong_doc_duoc_ten_tu_html');
    var g = phanTichGiaNguoiDoc(t.gia);
    dat(h, 'gia_ban', g.gia, 'khong_doc_duoc_gia_tu_html: ' + g.lyDo);
    dat(h, 'tien_te', g.tienTe, 'khong_thay_ky_hieu_tien_te');
    dat(h, 'thuong_hieu', '', 'doan_tu_html_khong_co_thuong_hieu');
    dat(h, 'danh_muc', '', 'doan_tu_html_khong_co_danh_muc');
    dat(h, 'sku', '', 'doan_tu_html_khong_co_sku');
    dat(h, 'phien_ban', '', 'doan_tu_html_khong_co_bien_the');
    dat(h, 'gia_goc', null, 'doan_tu_html_khong_co_gia_goc');
    dat(h, 'con_hang', '', 'doan_tu_html_khong_biet_tinh_trang_kho');
    dat(h, 'so_luong_ton', null, 'doan_tu_html_khong_co_ton_kho');
    dat(h, 'danh_gia_sao', null, 'doan_tu_html_khong_co_danh_gia');
    dat(h, 'so_luot_danh_gia', null, 'doan_tu_html_khong_co_danh_gia');
    dat(h, 'so_da_ban', null, 'doan_tu_html_khong_co_so_da_ban');
    dat(h, 'anh_chinh', '', 'doan_tu_html_khong_lay_anh');
    dat(h, 'mo_ta_ngan', '', 'doan_tu_html_khong_lay_mo_ta');
    h._canhBao.push('Dòng này do đoán từ HTML — phải kiểm chứng tay.');
    ra.push(h);
  }

  if (ra.length === 0) {
    // No product links, but the page itself has a price: treat the page as one product.
    var h1 = hangTrong();
    var ten = layTieuDe(html);
    var url = layCanonical(html) || boiCanh.url || '';
    var g1 = phanTichGiaNguoiDoc(giaTrongTrang[0].chuoi);
    dat(h1, 'ma_ngoai', layMaTuDuongDan(url), 'khong_co_ma');
    dat(h1, 'url_san_pham', url, 'khong_co_url');
    dat(h1, 'ten', ten, 'khong_doc_duoc_ten');
    dat(h1, 'gia_ban', g1.gia, 'khong_doc_duoc_gia_tu_html: ' + g1.lyDo);
    dat(h1, 'tien_te', g1.tienTe, 'khong_thay_ky_hieu_tien_te');
    var conLai = ['thuong_hieu', 'danh_muc', 'sku', 'phien_ban', 'gia_goc', 'con_hang',
                  'so_luong_ton', 'danh_gia_sao', 'so_luot_danh_gia', 'so_da_ban', 'anh_chinh', 'mo_ta_ngan'];
    for (var z = 0; z < conLai.length; z++) dat(h1, conLai[z], '', 'doan_tu_html_khong_co_truong_nay');
    h1._canhBao.push('Dòng này do đoán từ HTML — phải kiểm chứng tay.');
    ra.push(h1);
  }
  return { hang: ra, lyDo: '' };
}
