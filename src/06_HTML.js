/**
 * 06_HTML.js — pure HTML/XML readers. No network, no DOM (Apps Script has none),
 * so everything is careful regex work on text.
 */

var THUC_THE = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'",
  '&nbsp;': ' ', '&ndash;': '-', '&mdash;': '-', '&hellip;': '...', '&eacute;': 'é'
};

function giaiMaHtml(s) {
  var t = String(s || '');
  t = t.replace(/&(amp|lt|gt|quot|apos|#39|nbsp|ndash|mdash|hellip|eacute);/g, function (m) {
    return THUC_THE[m] !== undefined ? THUC_THE[m] : m;
  });
  t = t.replace(/&#x([0-9a-fA-F]+);/g, function (m, h) {
    var n = parseInt(h, 16);
    return n > 0 && n < 0x110000 ? String.fromCharCode(n) : m;
  });
  t = t.replace(/&#(\d+);/g, function (m, d) {
    var n = parseInt(d, 10);
    return n > 0 && n < 0x110000 ? String.fromCharCode(n) : m;
  });
  return t;
}

/** Remove script/style/noscript blocks — their contents are never visible text. */
function boKhoiMa(html) {
  return String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

function boThe(html) {
  return giaiMaHtml(boKhoiMa(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Read an attribute out of a single tag string. */
function layThuocTinh(the, ten) {
  var mau = new RegExp(ten + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s">]+))', 'i');
  var m = mau.exec(the);
  if (!m) return '';
  var v = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : m[4]);
  return giaiMaHtml(v === undefined ? '' : v);
}

/** All <meta> tags as {khoa: noiDung}, keyed by name or property, lowercased. */
function layTheMeta(html) {
  var ra = {};
  var mau = /<meta\b[^>]*>/gi;
  var m;
  while ((m = mau.exec(html)) !== null) {
    var the = m[0];
    var khoa = layThuocTinh(the, 'property') || layThuocTinh(the, 'name') || layThuocTinh(the, 'itemprop');
    if (!khoa) continue;
    var giaTri = layThuocTinh(the, 'content');
    if (giaTri === '') continue;
    ra[khoa.toLowerCase()] = giaTri;
  }
  return ra;
}

function layCanonical(html) {
  var mau = /<link\b[^>]*>/gi;
  var m;
  while ((m = mau.exec(html)) !== null) {
    if (/rel\s*=\s*["']?canonical/i.test(m[0])) return layThuocTinh(m[0], 'href');
  }
  return '';
}

function layTieuDe(html) {
  var h1 = /<h1\b[^>]*>([\s\S]{0,400}?)<\/h1>/i.exec(html);
  if (h1) {
    var t = boThe(h1[1]);
    if (t !== '') return t;
  }
  var tt = /<title\b[^>]*>([\s\S]{0,400}?)<\/title>/i.exec(html);
  if (tt) return boThe(tt[1]);
  return '';
}

/** Every <script type="application/ld+json"> block, parsed. Unparseable blocks are skipped. */
function layKhoiJsonLd(html) {
  var ra = [];
  var mau = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  var m;
  while ((m = mau.exec(html)) !== null) {
    var s = m[1].replace(/^\s*\/\/<!\[CDATA\[|\]\]>\s*$/g, '').replace(/<!--|-->/g, '').trim();
    if (s === '') continue;
    try { ra.push(JSON.parse(s)); } catch (e) { /* malformed JSON-LD is ignored, never patched */ }
  }
  return ra;
}

/** Walk a JSON-LD tree (arrays, @graph, nested nodes) and collect nodes whose @type matches. */
function gomNutJsonLd(goc, kieuMuonTim) {
  var ra = [];
  var hang = [goc];
  var vong = 0;
  while (hang.length && vong < 5000) {
    vong++;
    var n = hang.shift();
    if (n === null || typeof n !== 'object') continue;
    if (Object.prototype.toString.call(n) === '[object Array]') {
      for (var i = 0; i < n.length; i++) hang.push(n[i]);
      continue;
    }
    var t = n['@type'];
    var danhSach = Object.prototype.toString.call(t) === '[object Array]' ? t : [t];
    for (var j = 0; j < danhSach.length; j++) {
      if (typeof danhSach[j] === 'string' && danhSach[j].toLowerCase() === kieuMuonTim.toLowerCase()) {
        ra.push(n);
        break;
      }
    }
    var khoa = Object.keys(n);
    for (var k = 0; k < khoa.length; k++) {
      var v = n[khoa[k]];
      if (v && typeof v === 'object') hang.push(v);
    }
  }
  return ra;
}

/** All JSON-LD Product nodes on a page. */
function timSanPhamJsonLd(html) {
  var khoi = layKhoiJsonLd(html);
  var ra = [];
  for (var i = 0; i < khoi.length; i++) {
    var sp = gomNutJsonLd(khoi[i], 'Product');
    for (var j = 0; j < sp.length; j++) ra.push(sp[j]);
  }
  return ra;
}

/** Microdata fields on a page: itemprop="price" etc. Returns the first of each. */
function layMicrodata(html) {
  var ra = {};
  var mau = /<[a-zA-Z][^>]*itemprop\s*=\s*["']?([a-zA-Z]+)["']?[^>]*>/g;
  var m;
  var vong = 0;
  while ((m = mau.exec(html)) !== null && vong < 2000) {
    vong++;
    var ten = m[1].toLowerCase();
    if (ra[ten] !== undefined) continue;
    var the = m[0];
    var giaTri = layThuocTinh(the, 'content') || layThuocTinh(the, 'href') || layThuocTinh(the, 'src');
    if (giaTri === '') {
      // Take the text of the element that opens here, up to its closing tag.
      var sau = html.substring(m.index + the.length, m.index + the.length + 300);
      var ct = /^([\s\S]*?)</.exec(sau);
      giaTri = ct ? boThe(ct[1]) : '';
    }
    if (giaTri !== '') ra[ten] = giaTri;
  }
  return ra;
}

/**
 * Is this an HTML shell with nothing in it — a page whose content is drawn by JavaScript?
 * UrlFetchApp does not run JavaScript, so such a page can never be scanned from here.
 * Getting this wrong in the optimistic direction is what produces "CAO with zero rows",
 * so the test suite pins it.
 */
function laVoTrangRong(html) {
  var s = String(html || '');
  if (s.trim() === '') return { laVo: true, lyDo: 'Máy chủ trả về nội dung rỗng.' };
  var vanBan = boThe(s);
  var coJsonLdSanPham = timSanPhamJsonLd(s).length > 0;
  if (coJsonLdSanPham) return { laVo: false, lyDo: '' };

  var goc = /<(div|main)\b[^>]*id\s*=\s*["']?(root|app|__next|__nuxt|q-app)["']?[^>]*>\s*<\/(div|main)>/i.test(s);
  var coGia = timGiaTrongVanBan(vanBan).length > 0;
  var tyLeChu = s.length > 0 ? vanBan.length / s.length : 0;

  if (goc && !coGia) {
    return { laVo: true, lyDo: 'Trang chỉ có khung rỗng (<div id="root"></div>), nội dung do JavaScript dựng. UrlFetchApp không chạy JavaScript.' };
  }
  if (!coGia && vanBan.length < 600 && s.length > 2000) {
    return { laVo: true, lyDo: 'Trang trả về ' + s.length + ' ký tự HTML nhưng chỉ ' + vanBan.length + ' ký tự chữ và không có giá — gần như chắc chắn nội dung do JavaScript dựng.' };
  }
  if (!coGia && tyLeChu < 0.02 && s.length > 20000) {
    return { laVo: true, lyDo: 'Gần như toàn bộ trang là mã JavaScript (chữ chiếm ' + (tyLeChu * 100).toFixed(1) + '%), không có giá trong HTML.' };
  }
  return { laVo: false, lyDo: '' };
}

/** <loc> entries out of a sitemap or sitemap index. */
function docSitemap(xml) {
  var s = String(xml || '');
  var laChiMuc = /<sitemapindex\b/i.test(s);
  var ra = [];
  var mau = /<loc>\s*([\s\S]*?)\s*<\/loc>/gi;
  var m;
  var vong = 0;
  while ((m = mau.exec(s)) !== null && vong < 60000) {
    vong++;
    var u = giaiMaHtml(m[1]).trim();
    if (u !== '') ra.push(u);
  }
  return { laChiMuc: laChiMuc, url: ra };
}

/** Anchors as {href, chu} — used by the rung 5 heuristic and by sitemap-less crawling. */
function layLienKet(html) {
  var ra = [];
  var mau = /<a\b([^>]*)>([\s\S]{0,300}?)<\/a>/gi;
  var m;
  var vong = 0;
  while ((m = mau.exec(html)) !== null && vong < 3000) {
    vong++;
    var href = layThuocTinh('<a ' + m[1] + '>', 'href');
    if (href === '') continue;
    ra.push({ href: href, chu: boThe(m[2]), viTri: m.index, thoThe: m[0] });
  }
  return ra;
}
