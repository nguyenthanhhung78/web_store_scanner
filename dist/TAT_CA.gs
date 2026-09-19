/**
 * TAT_CA.gs — TOÀN BỘ mã của công cụ quét cửa hàng, gộp thành một tệp.
 *
 * KHÔNG SỬA TRỰC TIẾP TỆP NÀY. Nó được sinh ra từ thư mục src/ bằng lệnh
 * `npm run dong-goi`. Sửa ở đây thì lần sinh sau sẽ mất.
 *
 * Thứ tự gộp = thứ tự tên tệp trong src/, đúng như Apps Script nạp.
 * Gồm 18 tệp: 00_MENU.js, 01_CAU_HINH.js, 02_URL.js, 03_SO.js, 04_ROBOTS.js, 05_MANG_LUOI.js, 06_HTML.js, 07_BOC_TACH.js, 08_KET_LUAN.js, 09_THANG.js, 10_GHI_BANG.js, 11_QUET.js, 12_THAY_DOI.js, 13_GIAO_DIEN.js, 14_TU_KIEM_TRA.js, 15_TRUY_VAN.js, 16_BAO_CAO.js, 17_API_GIAO_DIEN.js
 */

/* ==========================================================================
   00_MENU.js
   ========================================================================== */
/**
 * 00_MENU.js — BẮT ĐẦU Ở ĐÂY.
 *
 * Bốn hàm đầu tiên dưới đây không cần tham số: chọn tên hàm trên thanh công cụ của
 * trình soạn thảo Apps Script rồi bấm ▶ là chạy được.
 *
 *   MO_BANG_DIEU_KHIEN()    — mở bảng điều khiển đầy đủ: quét, lọc dữ liệu, dựng báo cáo
 *   MO_BANG_QUET()          — mở thanh quét nhanh ở cạnh bảng tính
 *   QUET_MOT_LINK()         — quét một link ngay
 *   TIEP_TUC_QUET()         — chạy tiếp lần quét bị ngắt giữa chừng (trigger cũng gọi hàm này)
 *   CHAN_DOAN()             — tự kiểm tra: bảng, cài đặt, bộ đọc số, phân loại URL
 *   SO_SANH_HAI_LAN_QUET()  — dựng bảng THAY_DOI từ 2 lần quét gần nhất
 *
 * Mọi lệnh gọi SpreadsheetApp.getUi() đều được bọc try/catch vì nó ném lỗi khi chạy từ
 * trình soạn thảo hoặc từ trigger.
 */

/**
 * Mở BẢNG ĐIỀU KHIỂN đầy đủ (quét + lọc dữ liệu + báo cáo) dưới dạng hộp thoại.
 * Không cần triển khai ứng dụng web: mở thẳng từ bảng tính là chạy.
 */
function MO_BANG_DIEU_KHIEN() {
  taoCacBangNeuThieu();
  try {
    var html = HtmlService.createTemplateFromFile('Bang')
      .evaluate()
      .setWidth(1600)
      .setHeight(900);
    SpreadsheetApp.getUi().showModalDialog(html, 'Bảng điều khiển quét cửa hàng');
    return 'Đã mở bảng điều khiển.';
  } catch (e) {
    var tb = 'Không mở được hộp thoại (đang chạy từ trình soạn thảo hoặc từ trigger). ' +
             'Hãy mở Google Sheet rồi dùng menu "Quét cửa hàng → Mở bảng điều khiển".';
    Logger.log(tb + ' Chi tiết: ' + (e && e.message ? e.message : e));
    return tb;
  }
}

/** Mở thanh quét nhanh ở cạnh bảng tính. Chạy được cả khi không có giao diện. */
function MO_BANG_QUET() {
  taoCacBangNeuThieu();
  try {
    var html = HtmlService.createHtmlOutputFromFile('BangQuet')
      .setTitle('Quét cửa hàng')
      .setWidth(420);
    SpreadsheetApp.getUi().showSidebar(html);
    return 'Đã mở bảng quét ở thanh bên.';
  } catch (e) {
    var tb = 'Không mở được thanh bên (đang chạy từ trình soạn thảo hoặc từ trigger). ' +
             'Hãy mở Google Sheet của bạn rồi dùng menu "Quét cửa hàng → Mở bảng quét". ' +
             'Các bảng SAN_PHAM / LAN_QUET / CAI_DAT / HANG_DOI đã được tạo sẵn.';
    Logger.log(tb);
    return tb;
  }
}

/**
 * Quét một link. Có giao diện thì hỏi link; không có giao diện (chạy ▶ trong trình soạn
 * thảo) thì lấy link đang chờ trong bảng HANG_DOI.
 */
function QUET_MOT_LINK() {
  taoCacBangNeuThieu();
  var url = '';
  try {
    var ui = SpreadsheetApp.getUi();
    var tl = ui.prompt('Quét cửa hàng', 'Dán địa chỉ cửa hàng / danh mục / sản phẩm:', ui.ButtonSet.OK_CANCEL);
    if (tl.getSelectedButton() !== ui.Button.OK) return 'Đã huỷ.';
    url = tl.getResponseText();
  } catch (e) {
    url = '';
  }

  var kq;
  if (url && String(url).trim() !== '') {
    var dangDo = docCon();
    if (dangDo) {
      var tb0 = 'Đang có lần quét dở: ' + dangDo.maLanQuet + ' (' + dangDo.urlNhap + '). ' +
                'Hãy chạy TIEP_TUC_QUET() cho xong trước, hoặc xếp link mới vào HANG_DOI.';
      Logger.log(tb0);
      baoChoNguoiDung('Chưa quét được', tb0);
      return tb0;
    }
    kq = batDauQuet(String(url).trim(), Session_email());
  } else {
    kq = quetTiepMotViec({ nguoiQuet: Session_email() });
  }

  var tt = tomTatChoNguoiDung(kq);
  var bao = tt.tieuDe + (tt.chiTiet ? '\n' + tt.chiTiet : '') +
            (tt.viecCanLam ? '\n\nViệc cần làm: ' + tt.viecCanLam : '') +
            (tt.lyDo ? '\n\nLý do: ' + tt.lyDo : '');
  Logger.log(bao);
  baoChoNguoiDung('Kết quả quét', bao);
  return bao;
}

/** Chạy tiếp lần quét bị ngắt. Đây cũng là hàm mà trigger gọi. */
function TIEP_TUC_QUET() {
  var kq = quetTiepMotViec({ nguoiQuet: Session_email() });
  var tt = tomTatChoNguoiDung(kq);
  Logger.log(tt.tieuDe + ' ' + (tt.chiTiet || ''));
  return tt.tieuDe + ' ' + (tt.chiTiet || '');
}

/** Tự kiểm tra toàn bộ: bảng, cài đặt, bộ đọc số, phân loại URL, trạng thái đang dở. */
function CHAN_DOAN() {
  var d = [];
  d.push('=== CHẨN ĐOÁN CÔNG CỤ QUÉT CỬA HÀNG ===');
  d.push('Thời điểm: ' + nhanThoiGian());

  var kt = chayTuKiemTra();
  d.push('Tự kiểm tra: ' + kt.dat + '/' + kt.tong + ' mục đạt.');
  if (kt.loi.length) {
    d.push('!!! CÓ LỖI — KHÔNG ĐƯỢC TIN KẾT QUẢ QUÉT CHO ĐẾN KHI SỬA XONG:');
    for (var i = 0; i < kt.loi.length; i++) d.push('   - ' + kt.loi[i]);
  } else {
    d.push('Bộ đọc số tiếng Việt và bộ phân loại URL đều đúng.');
  }

  try {
    taoCacBangNeuThieu();
    var ss = layBangTinh();
    d.push('Bảng tính: ' + ss.getName());
    var bSp = ss.getSheetByName(TEN_BANG.SAN_PHAM);
    var bLq = ss.getSheetByName(TEN_BANG.LAN_QUET);
    d.push('SAN_PHAM: ' + Math.max(0, bSp.getLastRow() - 1) + ' dòng.');
    d.push('LAN_QUET: ' + Math.max(0, bLq.getLastRow() - 1) + ' lần quét.');
  } catch (e) {
    d.push('!!! Không truy cập được bảng tính: ' + (e && e.message ? e.message : e));
  }

  try {
    var cd = docCaiDat();
    d.push('Cài đặt: độ trễ ' + cd.do_tre_giua_2_yeu_cau_ms + 'ms, trần ' +
           cd.gioi_han_yeu_cau_moi_host + ' lượt/tên miền, ' + cd.gioi_han_trang + ' trang, ngân sách ' +
           cd.ngan_sach_chay_ms + 'ms.');
    d.push('User-Agent: ' + cd.user_agent);
    if (String(cd.user_agent).indexOf('lien-he@durahome.vn') >= 0) {
      d.push('   → Hãy đổi email liên hệ trong bảng CAI_DAT thành email thật của bạn.');
    }
  } catch (e) {
    d.push('!!! Không đọc được CAI_DAT: ' + (e && e.message ? e.message : e));
  }

  var con = docCon();
  d.push(con
    ? 'Đang có lần quét dở: ' + con.maLanQuet + ' — ' + con.urlNhap + ' (giai đoạn ' + con.giaiDoan +
      ', đã ghi ' + con.soDaGhi + ' dòng). Chạy TIEP_TUC_QUET() để hoàn tất.'
    : 'Không có lần quét nào đang dở.');

  d.push('Các sàn công cụ này KHÔNG quét được (và sẽ không giả vờ quét được):');
  for (var j = 0; j < HOST_KHONG_QUET_DUOC.length; j++) {
    d.push('   - ' + HOST_KHONG_QUET_DUOC[j].ten + ': ' + HOST_KHONG_QUET_DUOC[j].lyDo +
           ' Đường đi hợp lệ: ' + HOST_KHONG_QUET_DUOC[j].loiRa);
  }

  var bc = d.join('\n');
  Logger.log(bc);
  baoChoNguoiDung('Chẩn đoán', bc.length > 1400 ? bc.substring(0, 1400) + '\n… (xem đầy đủ trong Nhật ký thực thi)' : bc);
  return bc;
}

/** Dựng bảng THAY_DOI cho địa chỉ của lần quét gần nhất. */
function SO_SANH_HAI_LAN_QUET() {
  taoCacBangNeuThieu();
  var b = layHoacTaoBang(TEN_BANG.LAN_QUET, COT_LAN_QUET);
  if (b.getLastRow() < 2) {
    var t0 = 'Chưa có lần quét nào.';
    baoChoNguoiDung('So sánh', t0);
    return t0;
  }
  var iUrl = COT_LAN_QUET.indexOf('url_nhap');
  var hang = b.getRange(b.getLastRow(), 1, 1, COT_LAN_QUET.length).getValues()[0];
  var urlNhap = String(hang[iUrl]);
  var pl = phanLoaiUrl(urlNhap);
  var kq = taoBangThayDoi(pl.url || urlNhap);
  var tb = kq.ok
    ? ('Đã so sánh ' + kq.lanQuetCu + ' → ' + kq.lanQuetMoi + ': ghi ' + kq.so + ' thay đổi vào bảng THAY_DOI. ' + (kq.lyDo || ''))
    : ('Chưa so sánh được: ' + kq.lyDo);
  Logger.log(tb);
  baoChoNguoiDung('So sánh hai lần quét', tb);
  return tb;
}

/** Hiện hộp thoại nếu có giao diện; im lặng nếu không. */
function baoChoNguoiDung(tieuDe, noiDung) {
  try {
    SpreadsheetApp.getUi().alert(tieuDe, noiDung, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { /* chạy từ trình soạn thảo hoặc trigger thì không có giao diện */ }
}

/* ==========================================================================
   01_CAU_HINH.js
   ========================================================================== */
/**
 * 01_CAU_HINH.js — constants, sheet schema, default settings.
 * All operator-facing strings are Vietnamese. Code/identifiers are English-ish Vietnamese
 * on purpose: the sheet headers are contractual and must match the spec exactly.
 */

var TEN_BANG = {
  SAN_PHAM: 'SAN_PHAM',
  LAN_QUET: 'LAN_QUET',
  CAI_DAT: 'CAI_DAT',
  THAY_DOI: 'THAY_DOI',
  BAO_CAO: 'BAO_CAO',
  HANG_DOI: 'HANG_DOI'
};

/** SAN_PHAM columns, in order. Append-only sheet: one row per product-variant. */
var COT_SAN_PHAM = [
  'ma_lan_quet', 'ngay_quet', 'nguon_url', 'ten_mien', 'nen_tang', 'ma_ngoai', 'url_san_pham',
  'ten', 'thuong_hieu', 'danh_muc', 'sku', 'phien_ban', 'gia_ban', 'gia_goc', 'tien_te',
  'con_hang', 'so_luong_ton', 'danh_gia_sao', 'so_luot_danh_gia', 'so_da_ban', 'anh_chinh',
  'mo_ta_ngan'
];

/** Product-level fields the extractors fill (everything in COT_SAN_PHAM minus scan-level). */
var TRUONG_SAN_PHAM = [
  'ma_ngoai', 'url_san_pham', 'ten', 'thuong_hieu', 'danh_muc', 'sku', 'phien_ban',
  'gia_ban', 'gia_goc', 'tien_te', 'con_hang', 'so_luong_ton', 'danh_gia_sao',
  'so_luot_danh_gia', 'so_da_ban', 'anh_chinh', 'mo_ta_ngan'
];

/** LAN_QUET columns — the trust record. One row per scan. */
var COT_LAN_QUET = [
  'ma_lan_quet', 'bat_dau', 'ket_thuc', 'url_nhap', 'loai_url', 'nen_tang', 'bac_thang_dung',
  'so_sp', 'ty_le_co_gia', 'truong_thieu_nhieu', 'ket_luan', 'ly_do', 'nguoi_quet'
];

var COT_CAI_DAT = ['khoa', 'gia_tri', 'mo_ta'];

var COT_THAY_DOI = [
  'ngay_so_sanh', 'nguon_url', 'ma_ngoai', 'ten', 'loai_thay_doi', 'gia_cu', 'gia_moi',
  'chenh_lech', 'phan_tram', 'con_hang_cu', 'con_hang_moi', 'lan_quet_cu', 'lan_quet_moi'
];

var COT_HANG_DOI = ['ngay_them', 'url', 'trang_thai', 'ma_lan_quet', 'ghi_chu'];

/** Verdict values. Machine values are stable; the Vietnamese sentence lives in CAU_KET_LUAN. */
var KET_LUAN = {
  CAO: 'CAO',
  TRUNG_BINH: 'TRUNG_BINH',
  THAP: 'THAP',
  KHONG_QUET_DUOC: 'KHONG_QUET_DUOC'
};

var CAU_KET_LUAN = {
  CAO: 'CAO — dữ liệu lấy từ API sản phẩm của nền tảng. Dùng được ngay.',
  TRUNG_BINH: 'TRUNG BÌNH — dữ liệu đọc từ trang web, không phải API. Hãy kiểm tra tay 3 dòng bất kỳ trước khi dùng.',
  THAP: 'THẤP — chỉ đoán được từ HTML hoặc thiếu giá nhiều. Coi đây là đầu mối, phải kiểm chứng lại toàn bộ.',
  KHONG_QUET_DUOC: 'KHÔNG QUÉT ĐƯỢC — không ghi dòng nào. Lý do ghi ở cột ly_do.'
};

var LOAI_URL = {
  STORE: 'STORE',
  CATEGORY: 'CATEGORY',
  PRODUCT: 'PRODUCT',
  MARKETPLACE_SHOP: 'MARKETPLACE_SHOP',
  MARKETPLACE_PRODUCT: 'MARKETPLACE_PRODUCT',
  UNKNOWN: 'UNKNOWN'
};

/** Ladder rungs. BAC_6 means "cannot scan". */
var BAC = {
  BAC_1_PRODUCTS_JSON: 'BAC_1_PRODUCTS_JSON',
  BAC_2_WOO_STORE_API: 'BAC_2_WOO_STORE_API',
  BAC_3_SITEMAP_LD: 'BAC_3_SITEMAP_LD',
  BAC_4_TRANG_DON_LD: 'BAC_4_TRANG_DON_LD',
  BAC_5_HTML_DOAN: 'BAC_5_HTML_DOAN',
  BAC_6_KHONG_QUET_DUOC: 'BAC_6_KHONG_QUET_DUOC'
};

/**
 * Hosts that are known to be unscannable from Apps Script. This is not a blocklist we
 * route around — it is an honest short-circuit so the operator is not made to wait for a
 * failure we can already predict. See DIEM-MU.md.
 */
var HOST_KHONG_QUET_DUOC = [
  {
    mau: /(^|\.)shopee\.(vn|com|sg|co\.id|co\.th|ph|com\.my|com\.br)$/i,
    ten: 'Shopee',
    lyDo: 'Shopee trả về trang rỗng (nội dung do JavaScript dựng) và chặn dải IP của Google. UrlFetchApp không chạy JavaScript.',
    loiRa: 'Dùng Shopee Open Platform (tài khoản người bán), Shopee Affiliate API, hoặc xuất dữ liệu tay từ Kênh Người Bán.'
  },
  {
    mau: /(^|\.)lazada\.(vn|com|co\.id|co\.th|com\.my|com\.ph|sg)$/i,
    ten: 'Lazada',
    lyDo: 'Lazada dựng trang bằng JavaScript và có thử thách chống bot; IP trung tâm dữ liệu của Google bị giới hạn.',
    loiRa: 'Dùng Lazada Open Platform (API người bán), Lazada Affiliate, hoặc xuất báo cáo từ Seller Center.'
  },
  {
    mau: /(^|\.)(tiktok|tiktokshop)\.(com|vn)$/i,
    ten: 'TikTok Shop',
    lyDo: 'TikTok Shop yêu cầu JavaScript và chữ ký phiên; không có trang HTML tĩnh chứa giá.',
    loiRa: 'Dùng TikTok Shop Partner API (tài khoản người bán) hoặc xuất dữ liệu tay từ Seller Center.'
  },
  {
    mau: /(^|\.)(tiki\.vn)$/i,
    ten: 'Tiki',
    lyDo: 'Tiki dựng trang bằng JavaScript; endpoint dữ liệu là API nội bộ, không phải API công khai.',
    loiRa: 'Dùng Tiki Open API dành cho nhà bán, hoặc xuất dữ liệu tay từ Seller Center.'
  },
  {
    mau: /(^|\.)(amazon\.[a-z.]+|aliexpress\.com|taobao\.com|1688\.com)$/i,
    ten: 'Sàn quốc tế (Amazon/AliExpress/Taobao/1688)',
    lyDo: 'Các sàn này chặn truy cập tự động từ IP trung tâm dữ liệu và trả về thử thách chống bot.',
    loiRa: 'Dùng API chính thức của sàn (Amazon PA-API, AliExpress Affiliate) hoặc nhà cung cấp dữ liệu có giấy phép.'
  }
];

/**
 * CAI_DAT defaults: [khoa, gia_tri, mo_ta]. Written once when the sheet is created; the
 * operator may edit values in the sheet and they win.
 */
var CAI_DAT_MAC_DINH = [
  ['do_tre_giua_2_yeu_cau_ms', 1500,
   'Thời gian chờ tối thiểu giữa 2 lần gọi cùng một tên miền (mili giây). Không đặt dưới 1500.'],
  ['gioi_han_yeu_cau_moi_host', 500,
   'Số lần gọi mạng tối đa tới một tên miền trong một lần quét.'],
  ['gioi_han_trang', 20,
   'Số trang (trang danh sách hoặc trang sản phẩm) tối đa cho một lần quét.'],
  ['user_agent', 'DurahomeStoreScanner/1.0 (+lien-he@durahome.vn)',
   'Chuỗi nhận diện công cụ gửi kèm mỗi yêu cầu. PHẢI thay bằng email liên hệ thật của bạn.'],
  ['thoi_gian_cho_ms', 30000,
   'Ngân sách chờ cho một yêu cầu, dùng để tự tính giờ. Lưu ý: Apps Script KHÔNG cho đặt timeout thật, đây chỉ là con số nội bộ.'],
  ['ngan_sach_chay_ms', 270000,
   'Chạy tối đa 4,5 phút rồi lưu vị trí và thoát, để không chạm trần 6 phút của Apps Script.'],
  ['so_loi_lien_tiep_toi_da', 3,
   'Sau bằng này lần lỗi liên tiếp trên một tên miền thì dừng hẳn tên miền đó.'],
  ['ton_trong_robots', 'CO',
   'CO = luôn đọc robots.txt và tuân thủ. Không có lựa chọn KHONG.'],
  ['nguoi_quet', '',
   'Tên hoặc email người chạy quét, ghi vào cột nguoi_quet của bảng LAN_QUET.']
];

/** Fields that are allowed to be empty without it meaning the extractor is broken. */
var TRUONG_DUOC_PHEP_TRONG = ['so_luong_ton', 'so_da_ban', 'danh_gia_sao', 'so_luot_danh_gia', 'phien_ban', 'gia_goc'];

/** Tracking parameters stripped during normalisation. */
var THAM_SO_RAC = [
  'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'mc_cid', 'mc_eid', 'igshid', 'ttclid',
  'spm', 'xptdk', 'zanpid', 'yclid', '_ga', '_gl'
];

/* ==========================================================================
   02_URL.js
   ========================================================================== */
/**
 * 02_URL.js — URL normalisation and classification. Pure functions, no network.
 * Apps Script has no WHATWG URL class, so everything is hand-parsed.
 */

/** Split a URL into parts. Returns null when it is not a usable http(s) URL. */
function tachUrl(url) {
  if (typeof url !== 'string') return null;
  var s = url.trim();
  if (s === '') return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\//.test(s)) {
    if (/^\/\//.test(s)) s = 'https:' + s;
    else if (/^[a-zA-Z0-9][a-zA-Z0-9.\-]*\.[a-zA-Z]{2,}(\/|$|\?|#)/.test(s)) s = 'https://' + s;
    else return null;
  }
  var m = /^([a-zA-Z][a-zA-Z0-9+.\-]*):\/\/([^\/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/.exec(s);
  if (!m) return null;
  var giaoThuc = m[1].toLowerCase();
  if (giaoThuc !== 'http' && giaoThuc !== 'https') return null;
  var thamQuyen = m[2];
  if (thamQuyen === '') return null;
  // Strip credentials: this tool never authenticates, so any user:pass is dropped outright.
  var coDauA = thamQuyen.lastIndexOf('@');
  if (coDauA >= 0) thamQuyen = thamQuyen.substring(coDauA + 1);
  var cong = '';
  var mCong = /^(.*?):(\d+)$/.exec(thamQuyen);
  if (mCong) { thamQuyen = mCong[1]; cong = mCong[2]; }
  var host = thamQuyen.toLowerCase().replace(/\.$/, '');
  if (host === '' || host.indexOf('.') < 0) {
    if (host !== 'localhost') return null;
  }
  return {
    giaoThuc: giaoThuc,
    host: host,
    cong: cong,
    duongDan: m[3] || '',
    truyVan: m[4] ? m[4].substring(1) : '',
    neo: m[5] ? m[5].substring(1) : ''
  };
}

/** True when the query parameter is a tracking parameter we drop. */
function laThamSoRac(ten) {
  var t = String(ten).toLowerCase();
  if (t.indexOf('utm_') === 0) return true;
  for (var i = 0; i < THAM_SO_RAC.length; i++) if (THAM_SO_RAC[i] === t) return true;
  return false;
}

/**
 * Normalise a URL: drop tracking params and the fragment, lowercase scheme/host,
 * drop the default port, collapse duplicate slashes, drop a trailing slash on
 * non-root paths. Does NOT follow redirects (that needs the network layer).
 * Returns {ok, url, origin, host, duongDan, daBoThamSo:[], lyDo}
 */
function chuanHoaUrl(url) {
  var p = tachUrl(url);
  if (!p) return { ok: false, lyDo: 'Không phải địa chỉ http/https hợp lệ: ' + String(url).substring(0, 120) };

  var giu = [];
  var daBo = [];
  if (p.truyVan !== '') {
    var cap = p.truyVan.split('&');
    for (var i = 0; i < cap.length; i++) {
      if (cap[i] === '') continue;
      var vt = cap[i].indexOf('=');
      var ten = vt < 0 ? cap[i] : cap[i].substring(0, vt);
      if (laThamSoRac(ten)) daBo.push(ten);
      else giu.push(cap[i]);
    }
  }

  var duongDan = p.duongDan.replace(/\/{2,}/g, '/');
  if (duongDan === '') duongDan = '/';
  if (duongDan.length > 1 && duongDan.charAt(duongDan.length - 1) === '/') {
    duongDan = duongDan.substring(0, duongDan.length - 1);
  }

  var cong = '';
  if (p.cong !== '' && !((p.giaoThuc === 'https' && p.cong === '443') || (p.giaoThuc === 'http' && p.cong === '80'))) {
    cong = ':' + p.cong;
  }
  var origin = p.giaoThuc + '://' + p.host + cong;
  var sach = origin + duongDan + (giu.length ? '?' + giu.join('&') : '');
  return {
    ok: true,
    url: sach,
    origin: origin,
    host: p.host,
    duongDan: duongDan,
    daBoThamSo: daBo,
    lyDo: ''
  };
}

/** Resolve a possibly relative href against a base URL. Returns '' when impossible. */
function ghepUrl(goc, href) {
  if (typeof href !== 'string' || href.trim() === '') return '';
  var h = href.trim();
  if (/^(mailto|tel|javascript|data):/i.test(h)) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\//.test(h)) return h;
  var b = tachUrl(goc);
  if (!b) return '';
  var cong = b.cong ? ':' + b.cong : '';
  var origin = b.giaoThuc + '://' + b.host + cong;
  if (h.indexOf('//') === 0) return b.giaoThuc + ':' + h;
  if (h.charAt(0) === '/') return origin + h;
  if (h.charAt(0) === '#' || h.charAt(0) === '?') return origin + b.duongDan + h;
  var thuMuc = b.duongDan.replace(/[^\/]*$/, '');
  if (thuMuc === '') thuMuc = '/';
  var ghep = (origin + thuMuc + h);
  // resolve ../ and ./
  var m = /^([a-z]+:\/\/[^\/]+)(\/.*)$/.exec(ghep);
  if (!m) return ghep;
  var phan = m[2].split('/');
  var ra = [];
  for (var i = 0; i < phan.length; i++) {
    if (phan[i] === '.') continue;
    if (phan[i] === '..') { if (ra.length > 1) ra.pop(); continue; }
    ra.push(phan[i]);
  }
  return m[1] + ra.join('/').replace(/\/{2,}/g, '/');
}

/** Is this host one of the marketplaces we cannot scan? Returns the entry or null. */
function timSanKhongQuetDuoc(host) {
  for (var i = 0; i < HOST_KHONG_QUET_DUOC.length; i++) {
    if (HOST_KHONG_QUET_DUOC[i].mau.test(host)) return HOST_KHONG_QUET_DUOC[i];
  }
  return null;
}

var MAU_SAN_PHAM = [
  /\/products\/[^\/]+/i,
  /\/product\/[^\/]+/i,
  /\/san-pham\/[^\/]+/i,
  /\/sanpham\/[^\/]+/i,
  /\/p\/[^\/]+/i,
  /-p\d+\.html$/i,
  /-i\.\d+\.\d+/i,
  /\/dp\/[A-Z0-9]{6,}/i
];

var MAU_DANH_MUC = [
  /\/collections\/[^\/]+$/i,
  /\/collection\/[^\/]+/i,
  /\/product-category\/[^\/]+/i,
  /\/category\/[^\/]+/i,
  /\/categories\/[^\/]+/i,
  /\/danh-muc\/[^\/]+/i,
  /\/danhmuc\/[^\/]+/i,
  /\/c\/[^\/]+/i,
  /\/cua-hang\/?$/i,
  /\/shop\/?$/i
];

/**
 * Classify a URL. The kind decides the ladder strategy, so this runs before anything else.
 * Returns {loai, host, origin, duongDan, url, san} — `san` is set when the host is a
 * marketplace we cannot scan.
 */
function phanLoaiUrl(url) {
  var ch = chuanHoaUrl(url);
  if (!ch.ok) {
    return { loai: LOAI_URL.UNKNOWN, url: String(url), host: '', origin: '', duongDan: '', san: null, lyDo: ch.lyDo };
  }
  var san = timSanKhongQuetDuoc(ch.host);
  var d = ch.duongDan;
  var loai;

  if (san) {
    // Marketplace shapes: shop pages vs item pages.
    var laSanPham = false;
    for (var i = 0; i < MAU_SAN_PHAM.length; i++) if (MAU_SAN_PHAM[i].test(d)) laSanPham = true;
    if (/-i\.\d+\.\d+/.test(d) || /\/item\//i.test(d)) laSanPham = true;
    if (laSanPham) loai = LOAI_URL.MARKETPLACE_PRODUCT;
    else if (/^\/shop\//i.test(d) || /\/shop\/[^\/]+/i.test(d) || /^\/[^\/]+$/.test(d) || d === '/') loai = LOAI_URL.MARKETPLACE_SHOP;
    else loai = LOAI_URL.UNKNOWN;
    return { loai: loai, url: ch.url, host: ch.host, origin: ch.origin, duongDan: d, san: san, lyDo: '' };
  }

  if (d === '/' || d === '') {
    loai = LOAI_URL.STORE;
  } else {
    loai = LOAI_URL.UNKNOWN;
    for (var j = 0; j < MAU_SAN_PHAM.length; j++) {
      if (MAU_SAN_PHAM[j].test(d)) { loai = LOAI_URL.PRODUCT; break; }
    }
    if (loai === LOAI_URL.UNKNOWN) {
      for (var k = 0; k < MAU_DANH_MUC.length; k++) {
        if (MAU_DANH_MUC[k].test(d)) { loai = LOAI_URL.CATEGORY; break; }
      }
    }
  }
  return { loai: loai, url: ch.url, host: ch.host, origin: ch.origin, duongDan: d, san: null, lyDo: '' };
}

/** Split a multi-line paste into normalised, de-duplicated URLs. */
function tachNhieuUrl(vanBan) {
  var ra = [];
  var daCo = {};
  var dong = String(vanBan || '').split(/[\r\n,;\s]+/);
  for (var i = 0; i < dong.length; i++) {
    var t = dong[i].trim();
    if (t === '') continue;
    var ch = chuanHoaUrl(t);
    if (!ch.ok) { ra.push({ ok: false, url: t, lyDo: ch.lyDo }); continue; }
    if (daCo[ch.url]) continue;
    daCo[ch.url] = true;
    ra.push({ ok: true, url: ch.url });
  }
  return ra;
}

/** The handle (last path segment) — used as a fallback stable id. */
function layMaTuDuongDan(url) {
  var p = tachUrl(url);
  if (!p) return '';
  var d = p.duongDan.replace(/\/$/, '');
  return d === '' ? '/' : d;
}

/* ==========================================================================
   03_SO.js
   ========================================================================== */
/**
 * 03_SO.js — number parsing. Pure, no network, no side effects.
 *
 * Two different parsers on purpose, because they read two different things:
 *
 *  - phanTichGiaNguoiDoc(): text written for a human ("1.250.000₫"). Vietnamese grouping.
 *    It REJECTS anything ambiguous instead of guessing. "3.5" is null, never 35.
 *  - phanTichSoMay(): a machine decimal from a JSON API ("259000.00", 259000).
 *    Here the dot IS a decimal point, by the API contract.
 *
 * Calling the wrong one on the wrong input is the single easiest way to invent a price,
 * so every call site names which one it means.
 */

var KY_HIEU_TIEN_TE = [
  { mau: /(₫|đ|Đ|VNĐ|VND|vnd)/g, ma: 'VND' },
  { mau: /(US\$|USD|\$)/g, ma: 'USD' },
  { mau: /(EUR|€)/g, ma: 'EUR' },
  { mau: /(JPY|¥)/g, ma: 'JPY' },
  { mau: /(GBP|£)/g, ma: 'GBP' },
  { mau: /(THB|฿)/g, ma: 'THB' },
  { mau: /(SGD|S\$)/g, ma: 'SGD' },
  { mau: /(MYR|RM)/g, ma: 'MYR' },
  { mau: /(CNY|RMB)/g, ma: 'CNY' },
  { mau: /(KRW|₩)/g, ma: 'KRW' }
];

/** Shorthand amounts we refuse rather than expand. No rule has been written and tested for them. */
var MAU_VIET_TAT = /(\d)\s*(k|nghìn|nghin|ngàn|ngan|tr|trieu|triệu|m|củ|cu|tỷ|ty|b)\b/i;

function ketQuaGia(gia, tienTe, daBo, lyDo) {
  return { gia: gia, tienTe: tienTe, daBo: daBo, lyDo: lyDo };
}

/**
 * Parse a human-written price string.
 * @return {{gia:(number|null), tienTe:(string|null), daBo:string, lyDo:string}}
 *   gia === null means "we could not read it" — the caller must write an empty cell and
 *   count it. lyDo always says why.
 */
function phanTichGiaNguoiDoc(dauVao) {
  if (dauVao === null || dauVao === undefined) return ketQuaGia(null, null, '', 'gia_tri_rong');
  if (typeof dauVao === 'number') {
    if (!isFinite(dauVao)) return ketQuaGia(null, null, '', 'so_khong_hop_le');
    if (dauVao < 0) return ketQuaGia(null, null, '', 'gia_am');
    return ketQuaGia(dauVao, null, '', 'so_san_co_khong_co_ky_hieu_tien_te');
  }
  var s = String(dauVao);
  s = s.replace(/ | | | /g, ' ').trim();
  if (s === '') return ketQuaGia(null, null, '', 'gia_tri_rong');

  // 1. Currency markers: detect and strip, remembering what was stripped.
  var tienTe = null;
  var daBo = [];
  for (var i = 0; i < KY_HIEU_TIEN_TE.length; i++) {
    var m = s.match(KY_HIEU_TIEN_TE[i].mau);
    if (m) {
      if (tienTe === null) tienTe = KY_HIEU_TIEN_TE[i].ma;
      else if (tienTe !== KY_HIEU_TIEN_TE[i].ma) {
        return ketQuaGia(null, null, m.join(''), 'nhieu_ky_hieu_tien_te_khac_nhau');
      }
      for (var j = 0; j < m.length; j++) daBo.push(m[j]);
      s = s.replace(KY_HIEU_TIEN_TE[i].mau, ' ');
    }
  }
  var chuoiDaBo = daBo.join('');

  // 2. Shorthand ("250k", "1tr2") is refused, not expanded.
  if (MAU_VIET_TAT.test(s)) {
    return ketQuaGia(null, tienTe, chuoiDaBo, 'viet_tat_khong_duoc_ho_tro (' + String(dauVao).trim() + ')');
  }
  if (/[a-zA-ZÀ-ỹ]/.test(s)) {
    return ketQuaGia(null, tienTe, chuoiDaBo, 'con_chu_trong_chuoi_gia');
  }
  if (/-/.test(s)) {
    return ketQuaGia(null, tienTe, chuoiDaBo, 'co_dau_tru_hoac_khoang_gia');
  }

  s = s.replace(/\s+/g, ' ').trim();
  if (s === '') return ketQuaGia(null, tienTe, chuoiDaBo, 'khong_co_chu_so');
  if (!/^[0-9][0-9., ]*$/.test(s)) {
    return ketQuaGia(null, tienTe, chuoiDaBo, 'ky_tu_la_trong_chuoi_gia');
  }

  var ket = docNhomChuSo(s);
  if (ket.gia === null) return ketQuaGia(null, tienTe, chuoiDaBo, ket.lyDo);
  return ketQuaGia(ket.gia, tienTe, chuoiDaBo, tienTe === null ? 'khong_thay_ky_hieu_tien_te' : '');
}

/**
 * Digit-group reader. Only exact 3-digit groups after a separator are accepted.
 * A single separator followed by 1 or 2 digits is REFUSED: "3.5" must never become 35,
 * and "1.250.00" must never become 125000.
 */
function docNhomChuSo(s) {
  var dauPhanCach = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (c === '.' || c === ',' || c === ' ') dauPhanCach.push(c);
  }
  if (dauPhanCach.length === 0) {
    if (!/^\d+$/.test(s)) return { gia: null, lyDo: 'khong_phai_so_nguyen' };
    return { gia: parseInt(s, 10), lyDo: '' };
  }

  var rieng = {};
  for (var k = 0; k < dauPhanCach.length; k++) rieng[dauPhanCach[k]] = true;
  var loai = Object.keys(rieng);

  if (loai.length > 2) return { gia: null, lyDo: 'qua_nhieu_kieu_dau_phan_cach' };

  if (loai.length === 2) {
    // Mixed separators: the LAST one is the decimal point, the other groups thousands.
    var cuoi = s.charAt(indexCuaDauCuoi(s));
    var nhomChar = loai[0] === cuoi ? loai[1] : loai[0];
    if (nhomChar === ' ' && cuoi === ' ') return { gia: null, lyDo: 'dau_phan_cach_mo_ho' };
    var viTri = s.lastIndexOf(cuoi);
    if (s.substring(viTri + 1).indexOf(nhomChar) >= 0) return { gia: null, lyDo: 'dau_phan_cach_lan_lon' };
    var phanNguyen = s.substring(0, viTri);
    var phanLe = s.substring(viTri + 1);
    if (!/^\d{1,2}$/.test(phanLe)) return { gia: null, lyDo: 'phan_thap_phan_khong_hop_le' };
    var ngKet = ghepNhom(phanNguyen, nhomChar);
    if (ngKet.gia === null) return ngKet;
    return { gia: Number(String(ngKet.gia) + '.' + phanLe), lyDo: '' };
  }

  return ghepNhom(s, loai[0]);
}

function indexCuaDauCuoi(s) {
  for (var i = s.length - 1; i >= 0; i--) {
    var c = s.charAt(i);
    if (c === '.' || c === ',' || c === ' ') return i;
  }
  return -1;
}

/** Join thousand groups: first group 1..3 digits, every following group exactly 3. */
function ghepNhom(s, dau) {
  var phan = s.split(dau);
  if (phan.length < 2) {
    if (!/^\d+$/.test(s)) return { gia: null, lyDo: 'khong_phai_so_nguyen' };
    return { gia: parseInt(s, 10), lyDo: '' };
  }
  if (!/^\d{1,3}$/.test(phan[0])) return { gia: null, lyDo: 'nhom_dau_tien_khong_tu_1_den_3_chu_so' };
  for (var i = 1; i < phan.length; i++) {
    if (!/^\d{3}$/.test(phan[i])) {
      return { gia: null, lyDo: 'nhom_sau_dau_phan_cach_khong_du_3_chu_so (' + s + ')' };
    }
  }
  return { gia: parseInt(phan.join(''), 10), lyDo: '' };
}

/**
 * Parse a machine decimal from a JSON API. The dot is a decimal point here, by contract.
 * @return {{gia:(number|null), lyDo:string}}
 */
function phanTichSoMay(dauVao) {
  if (dauVao === null || dauVao === undefined || dauVao === '') return { gia: null, lyDo: 'gia_tri_rong' };
  if (typeof dauVao === 'number') {
    if (!isFinite(dauVao) || dauVao < 0) return { gia: null, lyDo: 'so_khong_hop_le' };
    return { gia: dauVao, lyDo: '' };
  }
  var s = String(dauVao).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return { gia: null, lyDo: 'khong_phai_so_thap_phan_may (' + s.substring(0, 40) + ')' };
  var n = Number(s);
  if (!isFinite(n)) return { gia: null, lyDo: 'so_khong_hop_le' };
  return { gia: n, lyDo: '' };
}

/** Integer counts (review count, sold count, stock). Rejects anything not a plain integer. */
function phanTichSoNguyen(dauVao) {
  if (dauVao === null || dauVao === undefined || dauVao === '') return { so: null, lyDo: 'gia_tri_rong' };
  if (typeof dauVao === 'number') {
    if (!isFinite(dauVao) || Math.floor(dauVao) !== dauVao) return { so: null, lyDo: 'khong_phai_so_nguyen' };
    return { so: dauVao, lyDo: '' };
  }
  var s = String(dauVao).trim().replace(/[.,  ]/g, '');
  if (!/^\d+$/.test(s)) return { so: null, lyDo: 'khong_phai_so_nguyen (' + String(dauVao).substring(0, 30) + ')' };
  return { so: parseInt(s, 10), lyDo: '' };
}

/** Ratings like "4.5" or "4,5" — a decimal, capped at 5. */
function phanTichSao(dauVao) {
  if (dauVao === null || dauVao === undefined || dauVao === '') return { sao: null, lyDo: 'gia_tri_rong' };
  var s = String(dauVao).trim().replace(',', '.');
  if (!/^\d(\.\d{1,2})?$|^\d{1,2}(\.\d{1,2})?$/.test(s)) return { sao: null, lyDo: 'khong_phai_diem_danh_gia' };
  var n = Number(s);
  if (!isFinite(n) || n < 0 || n > 5) return { sao: null, lyDo: 'diem_danh_gia_ngoai_khoang_0_5' };
  return { sao: n, lyDo: '' };
}

/**
 * Price from a JSON-LD / microdata / OG field. Those are supposed to carry machine decimals,
 * but Vietnamese sites routinely put "1.250.000" there, so we try machine first and fall
 * back to the human reader. Records which route was taken.
 */
function phanTichGiaLinhHoat(dauVao, tienTeGoiY) {
  var may = phanTichSoMay(dauVao);
  if (may.gia !== null) {
    var kq = ketQuaGia(may.gia, tienTeGoiY || null, '', 'doc_kieu_so_may');
    kq.canhBao = canhBaoGiaKhoTin(may.gia, kq.tienTe);
    return kq;
  }
  var nguoi = phanTichGiaNguoiDoc(dauVao);
  if (nguoi.gia !== null && nguoi.tienTe === null && tienTeGoiY) nguoi.tienTe = tienTeGoiY;
  nguoi.canhBao = canhBaoGiaKhoTin(nguoi.gia, nguoi.tienTe);
  return nguoi;
}

/** A VND price below 1.000 or with decimals is almost certainly a misread. Flag, never fix. */
function canhBaoGiaKhoTin(gia, tienTe) {
  if (gia === null) return '';
  if (tienTe === 'VND' && (gia < 1000 || Math.floor(gia) !== gia)) {
    return 'gia_VND_kho_tin (' + gia + ') — có thể nguồn ghi sai đơn vị, hãy kiểm tra tay';
  }
  return '';
}

/** Find a currency-adjacent number in free text. Used only by rung 5. */
function timGiaTrongVanBan(vanBan) {
  var s = String(vanBan || '').replace(/ /g, ' ');
  var mau = /(?:(₫|đ|VNĐ|VND|\$|€|£|¥)\s*([0-9][0-9., ]{2,})|([0-9][0-9., ]{2,})\s*(₫|đ|VNĐ|VND|\$|€|£|¥))/g;
  var ra = [];
  var m;
  var vong = 0;
  while ((m = mau.exec(s)) !== null && vong < 400) {
    vong++;
    var so = m[2] !== undefined ? m[2] : m[3];
    var ky = m[1] !== undefined ? m[1] : m[4];
    ra.push({ chuoi: (so + ' ' + ky).trim(), viTri: m.index, thoChuoi: m[0] });
  }
  return ra;
}

/* ==========================================================================
   04_ROBOTS.js
   ========================================================================== */
/**
 * 04_ROBOTS.js — robots.txt reading, per RFC 9309. Pure functions; the fetch itself
 * lives in the network layer.
 *
 * Policy, and it is not configurable:
 *   - every path we fetch is checked first;
 *   - Crawl-delay is honoured when it is longer than our own minimum;
 *   - robots.txt 4xx (missing) => allowed; 5xx or unreachable => we do NOT crawl.
 */

/** Parse robots.txt text into groups. */
function phanTichRobots(vanBan) {
  var kq = { nhom: {}, sitemap: [] };
  var dong = String(vanBan || '').split(/\r\n|\r|\n/);
  var uaHienTai = [];
  var dangDocUA = false;

  for (var i = 0; i < dong.length; i++) {
    var d = dong[i];
    var vtC = d.indexOf('#');
    if (vtC >= 0) d = d.substring(0, vtC);
    d = d.trim();
    if (d === '') continue;
    var vt = d.indexOf(':');
    if (vt < 0) continue;
    var khoa = d.substring(0, vt).trim().toLowerCase();
    var giaTri = d.substring(vt + 1).trim();

    if (khoa === 'user-agent') {
      if (!dangDocUA) { uaHienTai = []; dangDocUA = true; }
      var ua = giaTri.toLowerCase();
      uaHienTai.push(ua);
      if (!kq.nhom[ua]) kq.nhom[ua] = { allow: [], disallow: [], crawlDelay: null };
      continue;
    }
    if (khoa === 'sitemap') { kq.sitemap.push(giaTri); continue; }

    dangDocUA = false;
    if (uaHienTai.length === 0) continue;
    for (var j = 0; j < uaHienTai.length; j++) {
      var n = kq.nhom[uaHienTai[j]];
      if (khoa === 'disallow') n.disallow.push(giaTri);
      else if (khoa === 'allow') n.allow.push(giaTri);
      else if (khoa === 'crawl-delay') {
        var so = parseFloat(giaTri.replace(',', '.'));
        if (isFinite(so) && so >= 0) n.crawlDelay = so;
      }
    }
  }
  return kq;
}

/** The product token of our User-Agent, lowercased ("durahomestorescanner"). */
function tokenUserAgent(ua) {
  var m = /^([^\/\s]+)/.exec(String(ua || '').trim());
  return m ? m[1].toLowerCase() : '';
}

/** Pick the group that applies to us: an exact agent match beats '*'. */
function chonNhomRobots(robots, ua) {
  var token = tokenUserAgent(ua);
  var ten = Object.keys(robots.nhom);
  var tot = null;
  for (var i = 0; i < ten.length; i++) {
    if (ten[i] !== '*' && token !== '' && (token === ten[i] || token.indexOf(ten[i]) === 0)) {
      tot = robots.nhom[ten[i]];
    }
  }
  if (tot) return tot;
  return robots.nhom['*'] || null;
}

/** Turn a robots path pattern (with * and $) into a regex. */
function mauRobotsThanhRegex(mau) {
  var s = String(mau);
  var ketThuc = false;
  if (s.charAt(s.length - 1) === '$') { ketThuc = true; s = s.substring(0, s.length - 1); }
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (c === '*') out += '.*';
    else out += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + out + (ketThuc ? '$' : ''));
}

/** Length of the matched rule, for longest-match-wins. -1 when it does not match. */
function doDaiKhopRobots(mau, duongDan) {
  if (mau === '') return -1;
  try {
    if (mauRobotsThanhRegex(mau).test(duongDan)) return mau.replace(/\$$/, '').length;
  } catch (e) { return -1; }
  return -1;
}

/**
 * May we fetch this path?
 * @return {{duoc:boolean, lyDo:string, crawlDelay:(number|null)}}
 */
function duocPhepLay(robots, duongDan, ua) {
  if (!robots) return { duoc: true, lyDo: 'khong_co_robots', crawlDelay: null };
  var nhom = chonNhomRobots(robots, ua);
  if (!nhom) return { duoc: true, lyDo: 'robots_khong_co_nhom_ap_dung', crawlDelay: null };

  var dd = duongDan === '' ? '/' : duongDan;
  var choPhep = -1, cam = -1, mauCam = '';
  for (var i = 0; i < nhom.allow.length; i++) {
    var a = doDaiKhopRobots(nhom.allow[i], dd);
    if (a > choPhep) choPhep = a;
  }
  for (var j = 0; j < nhom.disallow.length; j++) {
    var b = doDaiKhopRobots(nhom.disallow[j], dd);
    if (b > cam) { cam = b; mauCam = nhom.disallow[j]; }
  }
  if (cam >= 0 && cam > choPhep) {
    return { duoc: false, lyDo: 'robots.txt cấm đường dẫn này (Disallow: ' + mauCam + ')', crawlDelay: nhom.crawlDelay };
  }
  return { duoc: true, lyDo: '', crawlDelay: nhom.crawlDelay };
}

/* ==========================================================================
   05_MANG_LUOI.js
   ========================================================================== */
/**
 * 05_MANG_LUOI.js — THE ONLY PLACE THAT TOUCHES THE NETWORK.
 *
 * Everything else in this project takes text and returns objects. When UrlFetchApp is
 * replaced (Apps Script will change, or this moves to another runtime), this file is the
 * only one that has to be rewritten.
 *
 * Rules enforced here, all of them non-negotiable:
 *   - robots.txt is read once per origin and obeyed for every path;
 *   - at least `do_tre_giua_2_yeu_cau_ms` between two requests to the same host, and more
 *     when robots.txt asks for more;
 *   - the tool identifies itself with a contact address in the User-Agent;
 *   - 429/503 => exponential backoff, then give up;
 *   - 3 consecutive failures on a host => that host is dropped for the rest of the scan;
 *   - a 403 or a bot challenge is a NO. We record it and stop. We do not rotate the
 *     User-Agent, we do not retry from another angle, we do not call private endpoints.
 */

var TU_CHOI = {
  ROBOTS: 'ROBOTS',
  CHAN: 'CHAN',
  LOI_MANG: 'LOI_MANG',
  QUA_GIOI_HAN: 'QUA_GIOI_HAN',
  DUNG_HOST: 'DUNG_HOST',
  URL_HONG: 'URL_HONG'
};

/** Per-scan network context. Counters live here so they survive a resume. */
function taoBoiCanhMang(caiDat) {
  return {
    caiDat: caiDat || docCaiDatMacDinh(),
    demYeuCau: {},        // host -> number of requests this scan
    loiLienTiep: {},      // host -> consecutive failures
    hostDaDung: {},       // host -> reason
    lanCuoiMs: {},        // host -> timestamp of last request
    robots: {},           // origin -> {robots, crawlDelay, trangThai}
    nhatKy: []            // short audit trail, shown in CHAN_DOAN
  };
}

function ghiNhatKyMang(bc, dong) {
  bc.nhatKy.push(dong);
  if (bc.nhatKy.length > 200) bc.nhatKy.shift();
}

/** Signatures of anti-bot interstitials. Detecting one means we stop, not that we try harder. */
var DAU_HIEU_THU_THACH = [
  'cf-browser-verification', '_cf_chl', 'cf_chl_opt', 'just a moment...',
  'checking your browser', 'attention required! | cloudflare', 'ddos protection by',
  'captcha-delivery', 'geo.captcha-delivery.com', 'px-captcha', 'are you a human',
  'incapsula incident id', 'access denied', 'request unsuccessful. incapsula',
  'verify you are human', 'enable javascript and cookies to continue'
];

function laTrangThuThach(noiDung, maTrangThai) {
  var s = String(noiDung || '').substring(0, 20000).toLowerCase();
  for (var i = 0; i < DAU_HIEU_THU_THACH.length; i++) {
    if (s.indexOf(DAU_HIEU_THU_THACH[i]) >= 0) return DAU_HIEU_THU_THACH[i];
  }
  if (maTrangThai === 403) return 'HTTP 403';
  return '';
}

function tuChoi(loai, lyDo, them) {
  var r = { ok: false, tuChoi: { loai: loai, lyDo: lyDo }, maTrangThai: 0, noiDung: '', urlCuoi: '' };
  if (them) for (var k in them) if (Object.prototype.hasOwnProperty.call(them, k)) r[k] = them[k];
  return r;
}

/** Make sure robots.txt for this origin is loaded. Never recurses into layNoiDung. */
function damBaoRobots(bc, origin) {
  if (Object.prototype.hasOwnProperty.call(bc.robots, origin)) return bc.robots[origin];
  var ket = { robots: null, trangThai: 0, choPhepTatCa: true, lyDo: '' };
  var hostRb = tachUrl(origin);
  var tenHost = hostRb ? hostRb.host : origin;
  choLichSu(bc, tenHost, null);
  bc.demYeuCau[tenHost] = (bc.demYeuCau[tenHost] || 0) + 1;
  var tl = goiMangTho(bc, origin + '/robots.txt');
  ket.trangThai = tl.maTrangThai;
  if (tl.loi) {
    // Unreachable robots.txt: RFC 9309 says treat as full disallow. We do.
    ket.choPhepTatCa = false;
    ket.lyDo = 'Không đọc được robots.txt (' + tl.loi + ') — theo RFC 9309 thì không được quét.';
  } else if (tl.maTrangThai >= 500) {
    ket.choPhepTatCa = false;
    ket.lyDo = 'robots.txt trả về lỗi máy chủ ' + tl.maTrangThai + ' — theo RFC 9309 thì không được quét.';
  } else if (tl.maTrangThai >= 400) {
    ket.choPhepTatCa = true;
    ket.lyDo = 'Không có robots.txt (' + tl.maTrangThai + ') — được phép quét.';
  } else {
    ket.robots = phanTichRobots(tl.noiDung);
    ket.lyDo = 'Đã đọc robots.txt.';
  }
  bc.robots[origin] = ket;
  ghiNhatKyMang(bc, 'robots ' + origin + ' -> ' + ket.trangThai + ' ' + ket.lyDo);
  return ket;
}

/** Wait until the per-host politeness delay has elapsed. */
function choLichSu(bc, host, crawlDelay) {
  var toiThieu = Number(bc.caiDat.do_tre_giua_2_yeu_cau_ms) || 1500;
  if (toiThieu < 1500) toiThieu = 1500;
  if (crawlDelay !== null && crawlDelay !== undefined && crawlDelay * 1000 > toiThieu) {
    toiThieu = Math.ceil(crawlDelay * 1000);
  }
  var truoc = bc.lanCuoiMs[host];
  var bayGio = Date.now();
  if (truoc) {
    var conThieu = toiThieu - (bayGio - truoc);
    if (conThieu > 0) Utilities.sleep(conThieu);
  }
  bc.lanCuoiMs[host] = Date.now();
}

/**
 * Raw HTTP with manual redirect following, so the final URL is known.
 * No policy here — policy is in layNoiDung.
 */
function goiMangTho(bc, url, soLanChuyenHuong) {
  var lan = soLanChuyenHuong || 0;
  var ua = String(bc.caiDat.user_agent || 'DurahomeStoreScanner/1.0 (+lien-he@durahome.vn)');
  try {
    var tl = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: false,
      validateHttpsCertificates: true,
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.6'
      }
    });
    var ma = tl.getResponseCode();
    var headers = tl.getAllHeaders ? tl.getAllHeaders() : {};
    if (ma >= 300 && ma < 400 && lan < 5) {
      var loc = headers['Location'] || headers['location'];
      if (loc) {
        if (Object.prototype.toString.call(loc) === '[object Array]') loc = loc[loc.length - 1];
        var tiep = ghepUrl(url, loc);
        if (tiep) return goiMangTho(bc, tiep, lan + 1);
      }
    }
    var kieu = headers['Content-Type'] || headers['content-type'] || '';
    if (Object.prototype.toString.call(kieu) === '[object Array]') kieu = kieu[0];
    return {
      loi: null,
      maTrangThai: ma,
      noiDung: tl.getContentText(),
      kieuNoiDung: String(kieu || ''),
      urlCuoi: url
    };
  } catch (e) {
    return { loi: String(e && e.message ? e.message : e), maTrangThai: 0, noiDung: '', kieuNoiDung: '', urlCuoi: url };
  }
}

/**
 * The one fetch entry point.
 * @param {string} url
 * @param {{boiCanh:Object, boQuaRobots:boolean, nhan:string}} tuyChon
 * @return {{ok:boolean, maTrangThai:number, noiDung:string, kieuNoiDung:string,
 *           urlCuoi:string, tuChoi:(Object|null)}}
 */
function layNoiDung(url, tuyChon) {
  tuyChon = tuyChon || {};
  var bc = tuyChon.boiCanh;
  if (!bc) throw new Error('layNoiDung: thiếu boiCanh — mọi lần gọi mạng phải đi kèm bối cảnh của lần quét.');

  var ch = chuanHoaUrl(url);
  if (!ch.ok) return tuChoi(TU_CHOI.URL_HONG, ch.lyDo);
  var host = ch.host;

  if (bc.hostDaDung[host]) return tuChoi(TU_CHOI.DUNG_HOST, bc.hostDaDung[host]);

  var tran = Number(bc.caiDat.gioi_han_yeu_cau_moi_host) || 500;
  if ((bc.demYeuCau[host] || 0) >= tran) {
    return tuChoi(TU_CHOI.QUA_GIOI_HAN, 'Đã chạm trần ' + tran + ' lượt gọi cho tên miền ' + host + ' trong lần quét này.');
  }

  var crawlDelay = null;
  if (!tuyChon.boQuaRobots) {
    var rb = damBaoRobots(bc, ch.origin);
    if (!rb.choPhepTatCa && !rb.robots) return tuChoi(TU_CHOI.ROBOTS, rb.lyDo);
    var phep = duocPhepLay(rb.robots, ch.duongDan, bc.caiDat.user_agent);
    crawlDelay = phep.crawlDelay;
    if (!phep.duoc) return tuChoi(TU_CHOI.ROBOTS, phep.lyDo + ' (' + ch.url + ')');
  }

  var lanThu = 0;
  var choBackoff = 2000;
  while (lanThu < 3) {
    lanThu++;
    choLichSu(bc, host, crawlDelay);
    bc.demYeuCau[host] = (bc.demYeuCau[host] || 0) + 1;
    var tl = goiMangTho(bc, ch.url);
    ghiNhatKyMang(bc, (tuyChon.nhan || 'lay') + ' ' + ch.url + ' -> ' + (tl.loi ? 'LOI ' + tl.loi : tl.maTrangThai));

    if (tl.loi) {
      demLoi(bc, host);
      if (lanThu >= 3 || bc.hostDaDung[host]) {
        return tuChoi(TU_CHOI.LOI_MANG, 'Lỗi mạng: ' + tl.loi, { maTrangThai: 0 });
      }
      Utilities.sleep(choBackoff); choBackoff *= 2;
      continue;
    }

    if (tl.maTrangThai === 429 || tl.maTrangThai === 503) {
      demLoi(bc, host);
      if (lanThu >= 3) {
        return tuChoi(TU_CHOI.CHAN,
          'Máy chủ trả về ' + tl.maTrangThai + ' (giới hạn tần suất) sau ' + lanThu + ' lần thử. Đã dừng, không thử vòng khác.',
          { maTrangThai: tl.maTrangThai });
      }
      Utilities.sleep(choBackoff); choBackoff *= 2;
      continue;
    }

    var thuThach = laTrangThuThach(tl.noiDung, tl.maTrangThai);
    if (thuThach) {
      bc.hostDaDung[host] = 'Trang chặn truy cập tự động (' + thuThach + '). Công cụ dừng tại đây theo đúng thiết kế.';
      return tuChoi(TU_CHOI.CHAN, bc.hostDaDung[host], { maTrangThai: tl.maTrangThai });
    }

    if (tl.maTrangThai >= 400) {
      // A 404/410 is a definite answer ("that endpoint does not exist here"), not a failure.
      // The ladder produces those by design while probing, so they must not count towards
      // the consecutive-failure limit — otherwise probing rung 1 and 2 would stop the host
      // before rung 3 ever runs.
      if (tl.maTrangThai >= 500 || tl.maTrangThai === 408) demLoi(bc, host);
      else bc.loiLienTiep[host] = 0;
      return tuChoi(TU_CHOI.LOI_MANG, 'Máy chủ trả về HTTP ' + tl.maTrangThai, { maTrangThai: tl.maTrangThai, noiDung: tl.noiDung });
    }

    bc.loiLienTiep[host] = 0;
    return {
      ok: true,
      maTrangThai: tl.maTrangThai,
      noiDung: tl.noiDung,
      kieuNoiDung: tl.kieuNoiDung,
      urlCuoi: tl.urlCuoi,
      tuChoi: null
    };
  }
  return tuChoi(TU_CHOI.LOI_MANG, 'Không lấy được nội dung sau 3 lần thử.');
}

function demLoi(bc, host) {
  bc.loiLienTiep[host] = (bc.loiLienTiep[host] || 0) + 1;
  var tran = Number(bc.caiDat.so_loi_lien_tiep_toi_da) || 3;
  if (bc.loiLienTiep[host] >= tran) {
    bc.hostDaDung[host] = 'Đã ' + bc.loiLienTiep[host] + ' lỗi liên tiếp trên ' + host + ' — dừng tên miền này cho hết lần quét.';
  }
}

/** Fetch and JSON.parse in one step. Never throws on bad JSON. */
function layJson(url, tuyChon) {
  var tl = layNoiDung(url, tuyChon);
  if (!tl.ok) return { ok: false, tuChoi: tl.tuChoi, maTrangThai: tl.maTrangThai, dulieu: null, noiDung: '' };
  var s = String(tl.noiDung || '').replace(/^﻿/, '').trim();
  if (s === '') return { ok: false, tuChoi: { loai: TU_CHOI.LOI_MANG, lyDo: 'Nội dung rỗng' }, maTrangThai: tl.maTrangThai, dulieu: null, noiDung: '' };
  try {
    return { ok: true, tuChoi: null, maTrangThai: tl.maTrangThai, dulieu: JSON.parse(s), noiDung: tl.noiDung, urlCuoi: tl.urlCuoi };
  } catch (e) {
    return { ok: false, tuChoi: { loai: TU_CHOI.LOI_MANG, lyDo: 'Không phải JSON hợp lệ' }, maTrangThai: tl.maTrangThai, dulieu: null, noiDung: tl.noiDung };
  }
}

/* ==========================================================================
   06_HTML.js
   ========================================================================== */
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

/* ==========================================================================
   07_BOC_TACH.js
   ========================================================================== */
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

/* ==========================================================================
   08_KET_LUAN.js
   ========================================================================== */
/**
 * 08_KET_LUAN.js — the verdict. The most important output of this tool.
 *
 * It is COMPUTED from the rows that were actually produced. There is no code path that
 * can return CAO without having counted filled cells first. If you change this file,
 * run test/ket_luan.test.js and test/dot_bien.test.js before committing.
 */

/** Rows are useless without these four, so CAO requires all four at >= 95%. */
var TRUONG_LOI = ['ma_ngoai', 'url_san_pham', 'ten', 'gia_ban'];

var NGUONG = {
  CAO: 0.95,
  TRUNG_BINH: 0.70,
  THIEU_NHIEU: 0.50
};

function coGiaTri(v) {
  return !(v === null || v === undefined || v === '');
}

/**
 * Accumulator. A scan can be cut in half by the 6-minute wall and resumed in another
 * execution, so the verdict cannot be computed from "the rows in memory" — it is computed
 * from counters that are carried across executions in the saved cursor.
 */
function taoTichLuy() {
  var dem = {};
  for (var i = 0; i < TRUONG_SAN_PHAM.length; i++) dem[TRUONG_SAN_PHAM[i]] = 0;
  return { tong: 0, dem: dem, lyDoThieu: {}, canhBao: {} };
}

/** Count a batch of rows into the accumulator. This is the only place fill rates come from. */
function congTichLuy(tichLuy, hang) {
  for (var j = 0; j < hang.length; j++) {
    tichLuy.tong++;
    for (var k = 0; k < TRUONG_SAN_PHAM.length; k++) {
      var tr = TRUONG_SAN_PHAM[k];
      if (coGiaTri(hang[j][tr])) {
        tichLuy.dem[tr]++;
      } else {
        var l = hang[j]._thieu && hang[j]._thieu[tr] ? String(hang[j]._thieu[tr]) : 'khong_ro_ly_do';
        l = l.replace(/\s*\([^)]*\)\s*$/, '');
        if (!tichLuy.lyDoThieu[tr]) tichLuy.lyDoThieu[tr] = {};
        tichLuy.lyDoThieu[tr][l] = (tichLuy.lyDoThieu[tr][l] || 0) + 1;
      }
    }
    var cb = hang[j]._canhBao || [];
    for (var c = 0; c < cb.length; c++) tichLuy.canhBao[cb[c]] = (tichLuy.canhBao[cb[c]] || 0) + 1;
  }
  return tichLuy;
}

function coGiaTri(v) {
  return !(v === null || v === undefined || v === '');
}

/** Top reasons a field stayed empty, for the ly_do column. */
function lyDoHayGap(tichLuy, truong, toiDa) {
  var m = tichLuy.lyDoThieu[truong] || {};
  var ds = Object.keys(m).map(function (k) { return { lyDo: k, so: m[k] }; });
  ds.sort(function (a, b) { return b.so - a.so; });
  return ds.slice(0, toiDa || 3);
}

/**
 * Verdict from a finished, in-memory row set. Thin wrapper — the real work is below.
 * @param {Array} hang rows actually extracted
 * @param {string} bacDung which rung produced them
 * @param {{lyDo:string}|null} thatBai set when the ladder ended at rung 6
 */
function tinhKetLuan(hang, bacDung, thatBai) {
  return tinhKetLuanTuTichLuy(congTichLuy(taoTichLuy(), hang || []), bacDung, thatBai);
}

/**
 * Compute the verdict from measured counters.
 * @return {{ketLuan, tyLeCoGia, tyLeCoMa, truongThieuNhieu, lyDo, tyLe, soSp, cau}}
 */
function tinhKetLuanTuTichLuy(tichLuy, bacDung, thatBai) {
  var tong = tichLuy.tong;
  var tyLe = {};
  for (var i = 0; i < TRUONG_SAN_PHAM.length; i++) {
    tyLe[TRUONG_SAN_PHAM[i]] = tong === 0 ? 0 : tichLuy.dem[TRUONG_SAN_PHAM[i]] / tong;
  }
  var tyLeCoGia = tyLe.gia_ban;
  var tyLeCoMa = tyLe.ma_ngoai;

  var thieu = [];
  for (var t = 0; t < TRUONG_SAN_PHAM.length; t++) {
    if (tong > 0 && tyLe[TRUONG_SAN_PHAM[t]] < NGUONG.THIEU_NHIEU) {
      thieu.push({ truong: TRUONG_SAN_PHAM[t], tyLe: tyLe[TRUONG_SAN_PHAM[t]] });
    }
  }
  thieu.sort(function (a, b) { return a.tyLe - b.tyLe; });
  var chuoiThieu = thieu.map(function (x) {
    return x.truong + ' (' + Math.round(x.tyLe * 100) + '%)';
  }).join(', ');

  if (tong === 0 || bacDung === BAC.BAC_6_KHONG_QUET_DUOC || !bacDung) {
    return {
      ketLuan: KET_LUAN.KHONG_QUET_DUOC,
      tyLeCoGia: 0,
      tyLeCoMa: 0,
      truongThieuNhieu: 'tất cả (không có dòng nào)',
      lyDo: thatBai && thatBai.lyDo ? thatBai.lyDo : 'Không tìm được sản phẩm nào ở bất kỳ bậc nào của thang dò.',
      tyLe: tyLe,
      soSp: 0,
      cau: CAU_KET_LUAN.KHONG_QUET_DUOC
    };
  }

  var laBacApi = (bacDung === BAC.BAC_1_PRODUCTS_JSON || bacDung === BAC.BAC_2_WOO_STORE_API);
  var laBacCauTruc = (bacDung === BAC.BAC_3_SITEMAP_LD || bacDung === BAC.BAC_4_TRANG_DON_LD);

  var ketLuan;
  var lyDo = [];
  lyDo.push('Đọc được ' + tong + ' dòng ở ' + tenBacTiengViet(bacDung) + '.');
  lyDo.push('Tỷ lệ có giá: ' + (tyLeCoGia * 100).toFixed(1) + '%.');

  if (tyLeCoGia < NGUONG.TRUNG_BINH) {
    ketLuan = KET_LUAN.THAP;
    lyDo.push('Dưới 70% số dòng có giá nên kết luận bị hạ xuống THẤP.');
  } else if (bacDung === BAC.BAC_5_HTML_DOAN) {
    ketLuan = KET_LUAN.THAP;
    lyDo.push('Dữ liệu do đoán từ HTML (bậc 5) nên trần kết luận là THẤP.');
  } else if (laBacApi) {
    var duLoi = true;
    var thieuLoi = [];
    for (var j = 0; j < TRUONG_LOI.length; j++) {
      if (tyLe[TRUONG_LOI[j]] < NGUONG.CAO) {
        duLoi = false;
        thieuLoi.push(TRUONG_LOI[j] + ' ' + Math.round(tyLe[TRUONG_LOI[j]] * 100) + '%');
      }
    }
    if (duLoi) {
      ketLuan = KET_LUAN.CAO;
      lyDo.push('Lấy thẳng từ API sản phẩm của nền tảng, đủ 95% cho cả mã, tên, link và giá.');
    } else {
      ketLuan = KET_LUAN.TRUNG_BINH;
      lyDo.push('Tuy lấy từ API nhưng có trường lõi chưa đủ 95%: ' + thieuLoi.join(', ') + '.');
    }
  } else if (laBacCauTruc) {
    ketLuan = KET_LUAN.TRUNG_BINH;
    lyDo.push('Dữ liệu đọc từ thẻ dữ liệu có cấu trúc trên trang web (bậc 3–4), không phải API.');
  } else {
    ketLuan = KET_LUAN.THAP;
    lyDo.push('Nguồn không xác định được độ tin cậy nên hạ xuống THẤP.');
  }

  if (chuoiThieu !== '') lyDo.push('Trường trống nhiều: ' + chuoiThieu + '.');
  var lyDoGia = lyDoHayGap(tichLuy, 'gia_ban', 2);
  if (lyDoGia.length) {
    lyDo.push('Lý do thiếu giá hay gặp nhất: ' + lyDoGia.map(function (x) { return x.lyDo + ' × ' + x.so; }).join('; ') + '.');
  }
  var khoaCb = Object.keys(tichLuy.canhBao || {});
  if (khoaCb.length) {
    lyDo.push('Cảnh báo: ' + khoaCb.slice(0, 2).map(function (k) { return k + ' × ' + tichLuy.canhBao[k]; }).join('; ') + '.');
  }

  return {
    ketLuan: ketLuan,
    tyLeCoGia: tyLeCoGia,
    tyLeCoMa: tyLeCoMa,
    truongThieuNhieu: chuoiThieu === '' ? '(không có)' : chuoiThieu,
    lyDo: lyDo.join(' '),
    tyLe: tyLe,
    soSp: tong,
    cau: CAU_KET_LUAN[ketLuan]
  };
}

function tenBacTiengViet(bac) {
  switch (bac) {
    case BAC.BAC_1_PRODUCTS_JSON: return 'bậc 1 (API products.json của nền tảng)';
    case BAC.BAC_2_WOO_STORE_API: return 'bậc 2 (WooCommerce Store API)';
    case BAC.BAC_3_SITEMAP_LD: return 'bậc 3 (sitemap + dữ liệu có cấu trúc)';
    case BAC.BAC_4_TRANG_DON_LD: return 'bậc 4 (dữ liệu có cấu trúc của một trang)';
    case BAC.BAC_5_HTML_DOAN: return 'bậc 5 (đoán từ HTML)';
    case BAC.BAC_6_KHONG_QUET_DUOC: return 'bậc 6 (không quét được)';
    default: return 'không rõ bậc';
  }
}

/** What the operator should do next, per verdict. Shown in the UI and in HUONG-DAN.md. */
function viecCanLam(ketLuan) {
  switch (ketLuan) {
    case KET_LUAN.CAO:
      return 'Dùng được ngay. Vẫn nên liếc qua cột tien_te: nếu trống thì đơn vị tiền chưa được xác minh.';
    case KET_LUAN.TRUNG_BINH:
      return 'Mở 3 dòng bất kỳ, bấm vào url_san_pham, so giá trên trang với cột gia_ban. Khớp cả 3 thì dùng được.';
    case KET_LUAN.THAP:
      return 'Coi đây là đầu mối, chưa phải dữ liệu. Kiểm chứng tay từng dòng trước khi đưa vào bất kỳ quyết định giá nào.';
    default:
      return 'Không có dòng nào được ghi. Đọc cột ly_do trong bảng LAN_QUET để biết vì sao và đi đường chính thức (API của nền tảng hoặc xuất dữ liệu tay).';
  }
}

/* ==========================================================================
   09_THANG.js
   ========================================================================== */
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

/* ==========================================================================
   10_GHI_BANG.js
   ========================================================================== */
/**
 * 10_GHI_BANG.js — THE ONLY PLACE THAT WRITES TO THE SHEET.
 *
 * One function takes a whole batch and makes exactly one setValues() call. There is no
 * appendRow() anywhere in this project: appendRow inside a loop is what turns a 400-row
 * scan into a 6-minute timeout.
 *
 * SAN_PHAM and LAN_QUET are append-only. A previous scan's rows are never touched.
 */

var KHOA_ID_BANG = 'ID_BANG_TINH';

function layBangTinh() {
  var ss = null;
  try { ss = SpreadsheetApp.getActive(); } catch (e) { ss = null; }
  if (ss) return ss;
  var id = '';
  try { id = PropertiesService.getScriptProperties().getProperty(KHOA_ID_BANG) || ''; } catch (e) { id = ''; }
  if (id) return SpreadsheetApp.openById(id);
  throw new Error('Không tìm thấy bảng tính. Hãy gắn script vào một Google Sheet, hoặc đặt thuộc tính ' +
                  KHOA_ID_BANG + ' bằng ID của bảng tính.');
}

/** Get a sheet, creating it with its header row if it does not exist. */
function layHoacTaoBang(ten, cot) {
  var ss = layBangTinh();
  var b = ss.getSheetByName(ten);
  if (!b) {
    b = ss.insertSheet(ten);
    b.getRange(1, 1, 1, cot.length).setValues([cot]);
    b.setFrozenRows(1);
  } else if (b.getLastRow() === 0) {
    b.getRange(1, 1, 1, cot.length).setValues([cot]);
    b.setFrozenRows(1);
  }
  return b;
}

/** A leading =, +, - or @ would be read as a formula. Keep it as text. */
function antoanChoO(v) {
  if (typeof v !== 'string') return v;
  if (v.length && '=+-@'.indexOf(v.charAt(0)) >= 0) return "'" + v;
  return v;
}

/**
 * THE WRITER. One batch, one setValues, append-only.
 * @param {string} tenBang
 * @param {Array<Array>} loHang
 * @param {Array<string>} cot
 * @return {number} first row written (1-based), or 0 when nothing was written
 */
function ghiLo(tenBang, loHang, cot) {
  if (!loHang || loHang.length === 0) return 0;
  var b = layHoacTaoBang(tenBang, cot);
  var sach = [];
  for (var i = 0; i < loHang.length; i++) {
    var d = [];
    for (var j = 0; j < cot.length; j++) d.push(antoanChoO(loHang[i][j] === undefined ? '' : loHang[i][j]));
    sach.push(d);
  }
  var dong = b.getLastRow() + 1;
  b.getRange(dong, 1, sach.length, cot.length).setValues(sach);
  return dong;
}

function nhanThoiGian(d) {
  var ngay = d || new Date();
  try {
    return Utilities.formatDate(ngay, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');
  } catch (e) {
    return ngay.toISOString().replace('T', ' ').substring(0, 19);
  }
}

/** Row object -> array in SAN_PHAM column order. */
function hangSanPhamThanhMang(tt, hang, thoiDiem) {
  var d = [];
  for (var i = 0; i < COT_SAN_PHAM.length; i++) {
    var c = COT_SAN_PHAM[i];
    if (c === 'ma_lan_quet') d.push(tt.maLanQuet);
    else if (c === 'ngay_quet') d.push(thoiDiem);
    else if (c === 'nguon_url') d.push(tt.url || tt.urlNhap);
    else if (c === 'ten_mien') d.push(tt.host);
    else if (c === 'nen_tang') d.push(tt.nenTang || '');
    else d.push(hang[c] === undefined || hang[c] === null ? '' : hang[c]);
  }
  return d;
}

/**
 * Write one batch of product rows. De-duplicates by ma_ngoai within the scan so that a
 * resumed scan cannot write the same variant twice.
 * @return {{soDaGhi:number, hangDaGhi:Array}}
 */
function ghiSanPham(tt, hang) {
  var lo = [];
  var giuLai = [];
  var t = nhanThoiGian();
  for (var i = 0; i < hang.length; i++) {
    var ma = hang[i].ma_ngoai;
    var khoa = ma === '' ? ('__trong__' + tt.soDaGhi + '_' + i) : String(ma);
    if (tt.daGhiMa[khoa]) continue;
    tt.daGhiMa[khoa] = 1;
    giuLai.push(hang[i]);
    lo.push(hangSanPhamThanhMang(tt, hang[i], t));
  }
  if (lo.length === 0) return { soDaGhi: 0, hangDaGhi: [] };
  ghiLo(TEN_BANG.SAN_PHAM, lo, COT_SAN_PHAM);
  tt.soDaGhi += lo.length;
  return { soDaGhi: lo.length, hangDaGhi: giuLai };
}

/** Write the single LAN_QUET row for a finished scan. Called exactly once per scan. */
function ghiLanQuet(tt, kl) {
  if (tt.daGhiLanQuet) return 0;
  var d = [];
  for (var i = 0; i < COT_LAN_QUET.length; i++) {
    var c = COT_LAN_QUET[i];
    if (c === 'ma_lan_quet') d.push(tt.maLanQuet);
    else if (c === 'bat_dau') d.push(nhanThoiGian(new Date(tt.batDau)));
    else if (c === 'ket_thuc') d.push(nhanThoiGian());
    else if (c === 'url_nhap') d.push(tt.urlNhap);
    else if (c === 'loai_url') d.push(tt.loaiUrl);
    else if (c === 'nen_tang') d.push(tt.nenTang || '(không nhận diện được)');
    else if (c === 'bac_thang_dung') d.push(tt.bacDung || BAC.BAC_6_KHONG_QUET_DUOC);
    else if (c === 'so_sp') d.push(kl.soSp);
    else if (c === 'ty_le_co_gia') d.push(Math.round(kl.tyLeCoGia * 1000) / 10);
    else if (c === 'truong_thieu_nhieu') d.push(kl.truongThieuNhieu);
    else if (c === 'ket_luan') d.push(kl.ketLuan);
    else if (c === 'ly_do') d.push(catLyDo(kl.lyDo + ' | ' + tt.lyDoThatBai.join(' | ')));
    else if (c === 'nguoi_quet') d.push(tt.nguoiQuet || '');
    else d.push('');
  }
  ghiLo(TEN_BANG.LAN_QUET, [d], COT_LAN_QUET);
  tt.daGhiLanQuet = true;
  return 1;
}

function catLyDo(s) {
  var t = String(s || '').replace(/\s*\|\s*$/, '');
  return t.length > 4000 ? t.substring(0, 4000) + '…' : t;
}

/**
 * Derived tabs (THAY_DOI, BAO_CAO) are rebuilt, not appended: they are disposable views
 * over the snapshots, so stacking yesterday's copy under today's would just create a
 * second, wrong source of truth. SAN_PHAM and LAN_QUET remain strictly append-only.
 *
 * Takes a ragged 2-D array and pads it to the widest row.
 * @return {number} rows written
 */
function ghiDeBang(tenBang, loHang) {
  var rong = 1;
  for (var i = 0; i < loHang.length; i++) rong = Math.max(rong, loHang[i].length);
  var ss = layBangTinh();
  var b = ss.getSheetByName(tenBang);
  if (!b) b = ss.insertSheet(tenBang);
  else b.clear();
  if (loHang.length === 0) return 0;
  var sach = [];
  for (var j = 0; j < loHang.length; j++) {
    var d = [];
    for (var k = 0; k < rong; k++) {
      var v = loHang[j][k];
      d.push(antoanChoO(v === undefined || v === null ? '' : v));
    }
    sach.push(d);
  }
  b.getRange(1, 1, sach.length, rong).setValues(sach);
  return sach.length;
}

/* ------------------------------------------------------------------ CAI_DAT */

function docCaiDatMacDinh() {
  var o = {};
  for (var i = 0; i < CAI_DAT_MAC_DINH.length; i++) o[CAI_DAT_MAC_DINH[i][0]] = CAI_DAT_MAC_DINH[i][1];
  return o;
}

/** Settings from the CAI_DAT sheet, layered over the defaults. Creates the sheet if needed. */
function docCaiDat() {
  var o = docCaiDatMacDinh();
  var b;
  try {
    b = layHoacTaoBang(TEN_BANG.CAI_DAT, COT_CAI_DAT);
  } catch (e) {
    return o;
  }
  if (b.getLastRow() < 2) {
    ghiLo(TEN_BANG.CAI_DAT, CAI_DAT_MAC_DINH, COT_CAI_DAT);
    return o;
  }
  var gt = b.getRange(2, 1, b.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < gt.length; i++) {
    var k = String(gt[i][0]).trim();
    if (k === '') continue;
    var v = gt[i][1];
    if (v === '' || v === null) continue;
    o[k] = v;
  }
  // Politeness floor is not negotiable, whatever the sheet says.
  if (!(Number(o.do_tre_giua_2_yeu_cau_ms) >= 1500)) o.do_tre_giua_2_yeu_cau_ms = 1500;
  return o;
}

/** Make sure every tab exists, with headers and default settings. Safe to run repeatedly. */
function taoCacBangNeuThieu() {
  layHoacTaoBang(TEN_BANG.SAN_PHAM, COT_SAN_PHAM);
  layHoacTaoBang(TEN_BANG.LAN_QUET, COT_LAN_QUET);
  layHoacTaoBang(TEN_BANG.HANG_DOI, COT_HANG_DOI);
  var cd = layHoacTaoBang(TEN_BANG.CAI_DAT, COT_CAI_DAT);
  if (cd.getLastRow() < 2) ghiLo(TEN_BANG.CAI_DAT, CAI_DAT_MAC_DINH, COT_CAI_DAT);
  return true;
}

/* ------------------------------------------------------------------ HANG_DOI */

/**
 * The queue's status column is the one place we update an existing cell: it is scan
 * bookkeeping, not scan data. SAN_PHAM and LAN_QUET stay append-only.
 */
function danhDauHangDoi(dong, trangThai, maLanQuet, ghiChu) {
  var b = layHoacTaoBang(TEN_BANG.HANG_DOI, COT_HANG_DOI);
  b.getRange(dong, 3, 1, 3).setValues([[trangThai, maLanQuet || '', ghiChu || '']]);
}

/** Mark every queue row for this URL, used when a resumed scan finally finishes. */
function danhDauHangDoiTheoUrl(url, trangThai, maLanQuet, ghiChu) {
  var b;
  try { b = layHoacTaoBang(TEN_BANG.HANG_DOI, COT_HANG_DOI); } catch (e) { return 0; }
  if (b.getLastRow() < 2) return 0;
  var gt = b.getRange(2, 1, b.getLastRow() - 1, COT_HANG_DOI.length).getValues();
  var dem = 0;
  for (var i = 0; i < gt.length; i++) {
    if (String(gt[i][1]) !== String(url)) continue;
    if (String(gt[i][2]) === 'XONG') continue;
    b.getRange(i + 2, 3, 1, 3).setValues([[trangThai, maLanQuet || '', ghiChu || '']]);
    dem++;
  }
  return dem;
}

/* ==========================================================================
   11_QUET.js
   ========================================================================== */
/**
 * 11_QUET.js — the driver: time budget, cursor, resume, queue.
 *
 * Apps Script hard-stops at about 6 minutes. This file works for 4.5 minutes, commits the
 * batch it has, saves a cursor in PropertiesService, exits cleanly and schedules a trigger
 * to continue. A resumed scan keeps the SAME ma_lan_quet, and on resume it rebuilds the
 * list of already-written ids FROM THE SHEET, so a scan that died between the write and
 * the cursor save still cannot produce duplicates.
 */

var KHOA_CON = 'CON_QUET';        // the cursor
var KHOA_TIEN_DO = 'TIEN_DO';     // progress line for the UI
var HAM_TIEP_TUC = 'TIEP_TUC_QUET';

function thuocTinhScript() {
  return PropertiesService.getScriptProperties();
}

function taoMaLanQuet() {
  var d = new Date();
  function p(n, r) { var s = String(n); while (s.length < (r || 2)) s = '0' + s; return s; }
  var ngau = Math.floor(Math.random() * 46656).toString(36);
  return 'LQ-' + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + '-' +
         p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + '-' + ngau;
}

/** Cursor is JSON; transient keys (starting with _) are dropped. */
function luuCon(tt) {
  var sao = {};
  var k = Object.keys(tt);
  for (var i = 0; i < k.length; i++) {
    if (k[i].charAt(0) === '_') continue;
    sao[k[i]] = tt[k[i]];
  }
  thuocTinhScript().setProperty(KHOA_CON, JSON.stringify(sao));
}

function docCon() {
  var s = thuocTinhScript().getProperty(KHOA_CON);
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

function xoaCon() {
  thuocTinhScript().deleteProperty(KHOA_CON);
}

function capNhatTienDo(tt, ghiChu, xong) {
  var td = {
    maLanQuet: tt ? tt.maLanQuet : '',
    url: tt ? tt.urlNhap : '',
    bac: tt ? (tt.bacDung || tt.giaiDoan) : '',
    soSp: tt ? tt.soDaGhi : 0,
    ghiChu: ghiChu || '',
    xong: !!xong,
    luc: new Date().toISOString()
  };
  try { thuocTinhScript().setProperty(KHOA_TIEN_DO, JSON.stringify(td)); } catch (e) { /* progress is best-effort */ }
  return td;
}

function docTienDo() {
  var s = '';
  try { s = thuocTinhScript().getProperty(KHOA_TIEN_DO) || ''; } catch (e) { s = ''; }
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

/* ------------------------------------------------- reading back what was written */

/**
 * Read back the rows already written for this scan. This is the authority on what exists,
 * used on resume so that a lost cursor can never cause a duplicate or a miscount.
 */
function docHangDaGhi(maLanQuet) {
  var kq = { tong: 0, ma: {}, dem: {} };
  for (var i = 0; i < TRUONG_SAN_PHAM.length; i++) kq.dem[TRUONG_SAN_PHAM[i]] = 0;
  var b;
  try { b = layHoacTaoBang(TEN_BANG.SAN_PHAM, COT_SAN_PHAM); } catch (e) { return kq; }
  var lastRow = b.getLastRow();
  if (lastRow < 2) return kq;
  var gt = b.getRange(2, 1, lastRow - 1, COT_SAN_PHAM.length).getValues();
  var viTriMa = COT_SAN_PHAM.indexOf('ma_lan_quet');
  for (var r = 0; r < gt.length; r++) {
    if (String(gt[r][viTriMa]) !== String(maLanQuet)) continue;
    kq.tong++;
    for (var c = 0; c < COT_SAN_PHAM.length; c++) {
      var ten = COT_SAN_PHAM[c];
      if (TRUONG_SAN_PHAM.indexOf(ten) < 0) continue;
      var v = gt[r][c];
      if (!(v === null || v === undefined || v === '')) kq.dem[ten]++;
      if (ten === 'ma_ngoai' && v !== '') kq.ma[String(v)] = 1;
    }
  }
  return kq;
}

/** On resume, trust the sheet over the cursor for counts and ids. */
function napLaiTuBang(tt) {
  var daCo = docHangDaGhi(tt.maLanQuet);
  tt.daGhiMa = daCo.ma;
  tt.soDaGhi = daCo.tong;
  tt.tichLuy.tong = daCo.tong;
  tt.tichLuy.dem = daCo.dem;
  return daCo.tong;
}

/* ------------------------------------------------------------------ the loop */

/**
 * Run the ladder until it finishes or the time budget runs out.
 * @param {Object} tt scan state
 * @param {Object} bc network context
 * @param {{batDauMs:number, nganSachMs:number, duTruMs:number}} gio
 * @return {{xong:boolean, tt:Object, ketLuan:(Object|null), ghiChu:string}}
 */
function chayVongQuet(tt, bc, gio) {
  var batDauMs = gio.batDauMs !== undefined ? gio.batDauMs : Date.now();
  var nganSach = gio.nganSachMs || 270000;
  var duTru = gio.duTruMs !== undefined ? gio.duTruMs : 45000;
  var lo = [];
  var ghiChu = tt.ghiChu || '';
  var xong = false;

  while (true) {
    if (Date.now() - batDauMs > nganSach - duTru) {
      ghiChu = 'Tạm dừng do gần hết 6 phút của Apps Script. Đã lưu vị trí, sẽ chạy tiếp.';
      break;
    }
    var buoc;
    try {
      buoc = buocQuet(tt, bc);
    } catch (e) {
      themLyDo(tt, 'Lỗi khi chạy bậc ' + tt.giaiDoan + ': ' + (e && e.message ? e.message : e));
      tt.bacDung = tt.bacDung || BAC.BAC_6_KHONG_QUET_DUOC;
      tt.giaiDoan = GIAI_DOAN.XONG;
      buoc = { hang: [], xong: true, ghiChu: 'Gặp lỗi, dừng lần quét.' };
    }
    ghiChu = buoc.ghiChu || ghiChu;
    tt.ghiChu = ghiChu;
    if (buoc.hang && buoc.hang.length) {
      for (var i = 0; i < buoc.hang.length; i++) lo.push(buoc.hang[i]);
    }
    tt.mangLuoi = { demYeuCau: bc.demYeuCau, hostDaDung: bc.hostDaDung, loiLienTiep: bc.loiLienTiep };
    capNhatTienDo(tt, ghiChu, false);

    if (lo.length >= 250) {
      lo = xaLo(tt, lo);
      luuCon(tt);
    }
    if (buoc.xong || tt.giaiDoan === GIAI_DOAN.XONG) { xong = true; break; }
  }

  xaLo(tt, lo);

  if (!xong) {
    luuCon(tt);
    return { xong: false, tt: tt, ketLuan: null, ghiChu: ghiChu };
  }

  var kl = tinhKetLuanTuTichLuy(tt.tichLuy, tt.bacDung, { lyDo: tt.lyDoThatBai.join(' | ') });
  tt.ketThuc = new Date().toISOString();
  ghiLanQuet(tt, kl);
  xoaCon();
  capNhatTienDo(tt, 'Xong: ' + kl.ketLuan + ' — ' + kl.cau, true);
  return { xong: true, tt: tt, ketLuan: kl, ghiChu: ghiChu };
}

/** Commit a batch: write it, then count exactly what was written. Order matters. */
function xaLo(tt, lo) {
  if (!lo || lo.length === 0) return [];
  var kq = ghiSanPham(tt, lo);
  congTichLuy(tt.tichLuy, kq.hangDaGhi);
  return [];
}

/* --------------------------------------------------------------- entry flows */

function boiCanhTuTrangThai(tt, caiDat) {
  var bc = taoBoiCanhMang(caiDat);
  if (tt.mangLuoi) {
    bc.demYeuCau = tt.mangLuoi.demYeuCau || {};
    bc.hostDaDung = tt.mangLuoi.hostDaDung || {};
    bc.loiLienTiep = tt.mangLuoi.loiLienTiep || {};
  }
  return bc;
}

/** Start a scan for one URL. Returns the verdict when it finished inside this execution. */
function batDauQuet(url, nguoiQuet, tuyChon) {
  tuyChon = tuyChon || {};
  var caiDat = tuyChon.caiDat || docCaiDat();
  var tt = taoTrangThaiQuet(url, nguoiQuet || caiDat.nguoi_quet || '', taoMaLanQuet());
  luuCon(tt);
  var bc = boiCanhTuTrangThai(tt, caiDat);
  var kq = chayVongQuet(tt, bc, {
    batDauMs: tuyChon.batDauMs !== undefined ? tuyChon.batDauMs : Date.now(),
    nganSachMs: tuyChon.nganSachMs !== undefined ? tuyChon.nganSachMs : (Number(caiDat.ngan_sach_chay_ms) || 270000),
    duTruMs: tuyChon.duTruMs
  });
  if (!kq.xong) datLichTiepTuc();
  return kq;
}

/** Continue a scan that was cut off. Same ma_lan_quet, no duplicates, no gaps. */
function tiepTucQuet(tuyChon) {
  tuyChon = tuyChon || {};
  var tt = tuyChon.trangThai || docCon();
  if (!tt) return { xong: true, tt: null, ketLuan: null, ghiChu: 'Không có lần quét nào đang dở.' };
  if (!tt.tichLuy) tt.tichLuy = taoTichLuy();
  var caiDat = tuyChon.caiDat || docCaiDat();
  napLaiTuBang(tt);
  themLyDo(tt, 'Đã chạy tiếp sau khi tạm dừng; số liệu đã nạp lại từ bảng SAN_PHAM (' + tt.soDaGhi + ' dòng).');
  var bc = boiCanhTuTrangThai(tt, caiDat);
  var kq = chayVongQuet(tt, bc, {
    batDauMs: tuyChon.batDauMs !== undefined ? tuyChon.batDauMs : Date.now(),
    nganSachMs: tuyChon.nganSachMs !== undefined ? tuyChon.nganSachMs : (Number(caiDat.ngan_sach_chay_ms) || 270000),
    duTruMs: tuyChon.duTruMs
  });
  if (!kq.xong) datLichTiepTuc();
  else if (kq.ketLuan) danhDauHangDoiTheoUrl(tt.urlNhap, 'XONG', tt.maLanQuet, kq.ketLuan.ketLuan);
  return kq;
}

/* ------------------------------------------------------------------- triggers */

function datLichTiepTuc() {
  try {
    xoaLichTiepTuc();
    ScriptApp.newTrigger(HAM_TIEP_TUC).timeBased().after(30 * 1000).create();
    return true;
  } catch (e) {
    return false;
  }
}

function xoaLichTiepTuc() {
  try {
    var ds = ScriptApp.getProjectTriggers();
    for (var i = 0; i < ds.length; i++) {
      if (ds[i].getHandlerFunction() === HAM_TIEP_TUC) ScriptApp.deleteTrigger(ds[i]);
    }
  } catch (e) { /* no trigger scope in some contexts */ }
}

/* ---------------------------------------------------------------- the queue */

/** Queue many URLs at once (the "Dán nhiều link" mode). */
function xepHangNhieuUrl(vanBan) {
  var ds = tachNhieuUrl(vanBan);
  var lo = [];
  var t = nhanThoiGian();
  var hopLe = 0;
  for (var i = 0; i < ds.length; i++) {
    if (ds[i].ok) { lo.push([t, ds[i].url, 'CHO', '', '']); hopLe++; }
    else lo.push([t, ds[i].url, 'LOI', '', ds[i].lyDo]);
  }
  if (lo.length) ghiLo(TEN_BANG.HANG_DOI, lo, COT_HANG_DOI);
  return { tong: ds.length, hopLe: hopLe };
}

/** Next pending URL in the queue, or null. */
function layUrlChoTrongHangDoi() {
  var b = layHoacTaoBang(TEN_BANG.HANG_DOI, COT_HANG_DOI);
  if (b.getLastRow() < 2) return null;
  var gt = b.getRange(2, 1, b.getLastRow() - 1, COT_HANG_DOI.length).getValues();
  for (var i = 0; i < gt.length; i++) {
    if (String(gt[i][2]) === 'CHO') return { dong: i + 2, url: String(gt[i][1]) };
  }
  return null;
}

/**
 * One unit of operator-visible work: continue an unfinished scan, else start the next
 * queued URL, else say there is nothing to do.
 */
function quetTiepMotViec(tuyChon) {
  tuyChon = tuyChon || {};
  var dangDo = docCon();
  if (dangDo) return tiepTucQuet(tuyChon);
  var tiep = layUrlChoTrongHangDoi();
  if (!tiep) return { xong: true, tt: null, ketLuan: null, ghiChu: 'Hàng đợi trống.' };
  danhDauHangDoi(tiep.dong, 'DANG_QUET', '', '');
  var kq = batDauQuet(tiep.url, tuyChon.nguoiQuet, tuyChon);
  if (kq.xong && kq.ketLuan) {
    danhDauHangDoi(tiep.dong, 'XONG', kq.tt.maLanQuet, kq.ketLuan.ketLuan);
  } else if (kq.tt) {
    danhDauHangDoi(tiep.dong, 'DANG_QUET', kq.tt.maLanQuet, 'đang chạy tiếp');
  }
  return kq;
}

/* ==========================================================================
   12_THAY_DOI.js
   ========================================================================== */
/**
 * 12_THAY_DOI.js — the derived diff tab.
 *
 * Snapshots in SAN_PHAM are the source of truth and are never modified. THAY_DOI is
 * derived and disposable: it is rebuilt from the two most recent scans of the same
 * nguon_url. Delete the tab at any time and nothing is lost.
 */

/** Group SAN_PHAM rows by ma_lan_quet for one source URL, newest scan first. */
function docSnapshotTheoUrl(nguonUrl) {
  var b = layHoacTaoBang(TEN_BANG.SAN_PHAM, COT_SAN_PHAM);
  if (b.getLastRow() < 2) return [];
  var gt = b.getRange(2, 1, b.getLastRow() - 1, COT_SAN_PHAM.length).getValues();
  var iMa = COT_SAN_PHAM.indexOf('ma_lan_quet');
  var iUrl = COT_SAN_PHAM.indexOf('nguon_url');
  var iNgay = COT_SAN_PHAM.indexOf('ngay_quet');
  var nhom = {};
  var thuTu = [];
  for (var r = 0; r < gt.length; r++) {
    if (String(gt[r][iUrl]) !== String(nguonUrl)) continue;
    var ma = String(gt[r][iMa]);
    if (!nhom[ma]) { nhom[ma] = { maLanQuet: ma, ngay: String(gt[r][iNgay]), hang: [] }; thuTu.push(ma); }
    var o = {};
    for (var c = 0; c < COT_SAN_PHAM.length; c++) o[COT_SAN_PHAM[c]] = gt[r][c];
    nhom[ma].hang.push(o);
  }
  var ds = thuTu.map(function (m) { return nhom[m]; });
  ds.sort(function (a, b2) { return a.ngay < b2.ngay ? 1 : (a.ngay > b2.ngay ? -1 : 0); });
  return ds;
}

/**
 * Diff two snapshots by ma_ngoai.
 * @return {Array<Object>} change records
 */
function soSanhSnapshot(cu, moi) {
  var mapCu = {};
  for (var i = 0; i < cu.hang.length; i++) {
    var k = String(cu.hang[i].ma_ngoai);
    if (k !== '') mapCu[k] = cu.hang[i];
  }
  var mapMoi = {};
  for (var j = 0; j < moi.hang.length; j++) {
    var k2 = String(moi.hang[j].ma_ngoai);
    if (k2 !== '') mapMoi[k2] = moi.hang[j];
  }
  var ra = [];
  var khoaMoi = Object.keys(mapMoi);
  for (var m = 0; m < khoaMoi.length; m++) {
    var kk = khoaMoi[m];
    var b = mapMoi[kk];
    var a = mapCu[kk];
    if (!a) { ra.push(banGhiThayDoi(moi, cu, b, null, 'MOI')); continue; }
    var gCu = a.gia_ban === '' ? null : Number(a.gia_ban);
    var gMoi = b.gia_ban === '' ? null : Number(b.gia_ban);
    if (gCu !== null && gMoi !== null && gCu !== gMoi) {
      ra.push(banGhiThayDoi(moi, cu, b, a, gMoi > gCu ? 'TANG_GIA' : 'GIAM_GIA'));
    } else if (String(a.con_hang) !== String(b.con_hang) && String(b.con_hang) !== '') {
      ra.push(banGhiThayDoi(moi, cu, b, a, b.con_hang === 'CON' ? 'CON_HANG_LAI' : 'HET_HANG'));
    }
  }
  var khoaCu = Object.keys(mapCu);
  for (var n = 0; n < khoaCu.length; n++) {
    if (!mapMoi[khoaCu[n]]) ra.push(banGhiThayDoi(moi, cu, null, mapCu[khoaCu[n]], 'MAT'));
  }
  return ra;
}

function banGhiThayDoi(moi, cu, hMoi, hCu, loai) {
  var gCu = hCu && hCu.gia_ban !== '' ? Number(hCu.gia_ban) : '';
  var gMoi = hMoi && hMoi.gia_ban !== '' ? Number(hMoi.gia_ban) : '';
  var chenh = (gCu !== '' && gMoi !== '') ? gMoi - gCu : '';
  var pt = (chenh !== '' && gCu) ? Math.round((chenh / gCu) * 1000) / 10 : '';
  return {
    ngay_so_sanh: nhanThoiGian(),
    nguon_url: (hMoi || hCu).nguon_url,
    ma_ngoai: (hMoi || hCu).ma_ngoai,
    ten: (hMoi || hCu).ten,
    loai_thay_doi: loai,
    gia_cu: gCu,
    gia_moi: gMoi,
    chenh_lech: chenh,
    phan_tram: pt,
    con_hang_cu: hCu ? hCu.con_hang : '',
    con_hang_moi: hMoi ? hMoi.con_hang : '',
    lan_quet_cu: cu.maLanQuet,
    lan_quet_moi: moi.maLanQuet
  };
}

/** Rebuild THAY_DOI for one source URL from its two most recent scans. */
function taoBangThayDoi(nguonUrl) {
  var ds = docSnapshotTheoUrl(nguonUrl);
  if (ds.length < 2) {
    return { ok: false, lyDo: 'Cần ít nhất 2 lần quét cùng một địa chỉ để so sánh. Hiện có ' + ds.length + '.' , so: 0 };
  }
  var thayDoi = soSanhSnapshot(ds[1], ds[0]);
  var lo = thayDoi.map(function (t) {
    return COT_THAY_DOI.map(function (c) { return t[c] === undefined ? '' : t[c]; });
  });
  // Derived tab: rebuilt every time, so it can never drift from the snapshots it describes.
  ghiDeBang(TEN_BANG.THAY_DOI, [COT_THAY_DOI].concat(lo));
  return {
    ok: true,
    so: lo.length,
    lanQuetCu: ds[1].maLanQuet,
    lanQuetMoi: ds[0].maLanQuet,
    lyDo: lo.length === 0 ? 'Hai lần quét giống hệt nhau — không có thay đổi nào.' : ''
  };
}

/* ==========================================================================
   13_GIAO_DIEN.js
   ========================================================================== */
/**
 * 13_GIAO_DIEN.js — server side of the sidebar / web app.
 * Every string that reaches the operator is Vietnamese.
 */

/**
 * Web app entry point — the full dashboard. Deploying is OPTIONAL: the same UI opens as a
 * dialog from the spreadsheet menu (MO_BANG_DIEU_KHIEN), which needs no deployment at all.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Bang')
    .evaluate()
    .setTitle('Bảng điều khiển quét cửa hàng')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function napHtml(ten) {
  return HtmlService.createHtmlOutputFromFile(ten).getContent();
}

/** Spreadsheet menu. */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Quét cửa hàng')
      .addItem('Mở bảng điều khiển', 'MO_BANG_DIEU_KHIEN')
      .addItem('Mở thanh quét nhanh', 'MO_BANG_QUET')
      .addItem('Quét một link', 'QUET_MOT_LINK')
      .addItem('Chạy tiếp lần quét đang dở', 'TIEP_TUC_QUET')
      .addSeparator()
      .addItem('Chẩn đoán', 'CHAN_DOAN')
      .addItem('So sánh 2 lần quét gần nhất', 'SO_SANH_HAI_LAN_QUET')
      .addToUi();
  } catch (e) { /* no UI when run from the editor or a trigger */ }
}

/** Human-readable summary of a finished scan, for the sidebar and for alerts. */
function tomTatChoNguoiDung(kq) {
  if (!kq || !kq.tt) return { xong: true, tieuDe: 'Không có việc gì để làm.', chiTiet: '' };
  var tt = kq.tt;
  if (!kq.xong || !kq.ketLuan) {
    return {
      xong: false,
      maLanQuet: tt.maLanQuet,
      tieuDe: 'Đang quét…',
      chiTiet: (kq.ghiChu || '') + ' Đã ghi ' + tt.soDaGhi + ' dòng. Lần quét sẽ tự chạy tiếp trong khoảng 30 giây.',
      ketLuan: '', viecCanLam: ''
    };
  }
  var kl = kq.ketLuan;
  return {
    xong: true,
    maLanQuet: tt.maLanQuet,
    tieuDe: kl.cau,
    ketLuan: kl.ketLuan,
    nenTang: tt.nenTang || '(không nhận diện được)',
    bac: tenBacTiengViet(tt.bacDung),
    soSp: kl.soSp,
    tyLeCoGia: Math.round(kl.tyLeCoGia * 1000) / 10,
    truongThieuNhieu: kl.truongThieuNhieu,
    viecCanLam: viecCanLam(kl.ketLuan),
    lyDo: kl.lyDo,
    chiTiet: 'Nền tảng: ' + (tt.nenTang || 'không rõ') + ' · ' + tenBacTiengViet(tt.bacDung) +
             ' · ' + kl.soSp + ' dòng · ' + (Math.round(kl.tyLeCoGia * 1000) / 10) + '% có giá.'
  };
}

/** Called from the sidebar: scan one URL now. */
function uiQuetMotLink(url) {
  if (!url || String(url).trim() === '') return { loi: 'Chưa nhập địa chỉ.' };
  taoCacBangNeuThieu();
  var dangDo = docCon();
  if (dangDo) {
    return { loi: 'Đang có một lần quét dở (' + dangDo.maLanQuet + ' — ' + dangDo.urlNhap +
                  '). Bấm "Chạy tiếp" cho xong đã, hoặc dùng chế độ dán nhiều link để xếp hàng.' };
  }
  var kq = batDauQuet(String(url).trim(), Session_email());
  return tomTatChoNguoiDung(kq);
}

function Session_email() {
  try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
}

function uiChayTiep() {
  taoCacBangNeuThieu();
  return tomTatChoNguoiDung(quetTiepMotViec({ nguoiQuet: Session_email() }));
}

function uiTienDo() {
  var td = docTienDo();
  var con = docCon();
  return {
    tienDo: td,
    dangDo: con ? { maLanQuet: con.maLanQuet, url: con.urlNhap, soDaGhi: con.soDaGhi, giaiDoan: con.giaiDoan } : null,
    hangDoi: demHangDoi()
  };
}

function demHangDoi() {
  try {
    var b = layHoacTaoBang(TEN_BANG.HANG_DOI, COT_HANG_DOI);
    if (b.getLastRow() < 2) return { cho: 0, xong: 0, loi: 0 };
    var gt = b.getRange(2, 3, b.getLastRow() - 1, 1).getValues();
    var d = { cho: 0, xong: 0, loi: 0 };
    for (var i = 0; i < gt.length; i++) {
      var s = String(gt[i][0]);
      if (s === 'CHO' || s === 'DANG_QUET') d.cho++;
      else if (s === 'XONG') d.xong++;
      else if (s === 'LOI') d.loi++;
    }
    return d;
  } catch (e) { return { cho: 0, xong: 0, loi: 0 }; }
}

function uiXepHang(vanBan) {
  taoCacBangNeuThieu();
  var kq = xepHangNhieuUrl(vanBan);
  return { thongBao: 'Đã xếp hàng ' + kq.hopLe + '/' + kq.tong + ' địa chỉ. Bấm "Chạy tiếp" để quét từng cái một.' };
}

function uiLinkBang() {
  try {
    var ss = layBangTinh();
    var b = ss.getSheetByName(TEN_BANG.SAN_PHAM);
    return ss.getUrl() + (b ? '#gid=' + b.getSheetId() : '');
  } catch (e) { return ''; }
}

/** Platforms this tool refuses to pretend it can scan, shown in the UI. */
function uiSanKhongQuetDuoc() {
  var ra = [];
  for (var i = 0; i < HOST_KHONG_QUET_DUOC.length; i++) {
    ra.push({ ten: HOST_KHONG_QUET_DUOC[i].ten, lyDo: HOST_KHONG_QUET_DUOC[i].lyDo, loiRa: HOST_KHONG_QUET_DUOC[i].loiRa });
  }
  return ra;
}

/* ==========================================================================
   14_TU_KIEM_TRA.js
   ========================================================================== */
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

/* ==========================================================================
   15_TRUY_VAN.js
   ========================================================================== */
/**
 * 15_TRUY_VAN.js — the query engine behind the UI.
 *
 * Everything except docKhoDuLieu() is pure: rows in, rows out. That is what makes the
 * whole query layer testable without a sheet and reusable if the storage ever moves.
 *
 * The rule that matters here: a QUERY IS NEVER MORE TRUSTWORTHY THAN ITS WEAKEST SCAN.
 * Every result carries tomTatTinCay(), which is the worst verdict among the scans that
 * contributed rows — so a table mixing CAO rows with THAP rows reads THAP, not CAO.
 */

/** Columns the UI never needs in bulk — dropped to keep the payload small. */
var COT_BO_QUA_KHI_TRUY_VAN = ['mo_ta_ngan'];

/** Hard ceiling on rows sent to the browser in one response. Aggregates still cover everything. */
var TRAN_DONG_GUI_UI = 3000;

/**
 * Read SAN_PHAM + LAN_QUET once and join the scan verdict onto every product row.
 * The only function in this file that touches the sheet.
 */
function docKhoDuLieu() {
  var lanQuet = docBangLanQuet();
  var b = layHoacTaoBang(TEN_BANG.SAN_PHAM, COT_SAN_PHAM);
  var hang = [];
  var lastRow = b.getLastRow();
  if (lastRow >= 2) {
    var gt = b.getRange(2, 1, lastRow - 1, COT_SAN_PHAM.length).getValues();
    for (var r = 0; r < gt.length; r++) {
      var o = {};
      for (var c = 0; c < COT_SAN_PHAM.length; c++) o[COT_SAN_PHAM[c]] = gt[r][c];
      if (String(o.ma_lan_quet) === '') continue;
      var lq = lanQuet[String(o.ma_lan_quet)];
      o._ket_luan = lq ? lq.ket_luan : '';
      o._bac = lq ? lq.bac_thang_dung : '';
      hang.push(o);
    }
  }
  return { hang: hang, lanQuet: lanQuet, tong: hang.length };
}

/** LAN_QUET as {ma_lan_quet: {...}}. */
function docBangLanQuet() {
  var b = layHoacTaoBang(TEN_BANG.LAN_QUET, COT_LAN_QUET);
  var ra = {};
  var lastRow = b.getLastRow();
  if (lastRow < 2) return ra;
  var gt = b.getRange(2, 1, lastRow - 1, COT_LAN_QUET.length).getValues();
  for (var r = 0; r < gt.length; r++) {
    var o = {};
    for (var c = 0; c < COT_LAN_QUET.length; c++) o[COT_LAN_QUET[c]] = gt[r][c];
    if (String(o.ma_lan_quet) === '') continue;
    ra[String(o.ma_lan_quet)] = o;
  }
  return ra;
}

/* ------------------------------------------------------------------- filtering */

function taoBoLocRong() {
  return {
    maLanQuet: [], tenMien: [], thuongHieu: [], danhMuc: [], nenTang: [], ketLuan: [],
    conHang: '', giaTu: null, giaDen: null, coGia: false, tuKhoa: '', chiMoiNhat: true
  };
}

function coTrongDanhSach(ds, v) {
  if (!ds || ds.length === 0) return true;
  return ds.indexOf(String(v)) >= 0;
}

/**
 * For each nguon_url keep only the newest scan. Without this, scanning a store twice
 * silently doubles every product in every table and every average.
 */
function locLanQuetMoiNhat(hang) {
  var moiNhat = {};
  for (var i = 0; i < hang.length; i++) {
    var u = String(hang[i].nguon_url);
    var ng = String(hang[i].ngay_quet);
    if (!moiNhat[u] || ng > moiNhat[u].ngay) moiNhat[u] = { ngay: ng, ma: String(hang[i].ma_lan_quet) };
  }
  var ra = [];
  for (var j = 0; j < hang.length; j++) {
    var u2 = String(hang[j].nguon_url);
    if (moiNhat[u2] && moiNhat[u2].ma === String(hang[j].ma_lan_quet)) ra.push(hang[j]);
  }
  return ra;
}

/** Apply a filter set. Pure. */
function locHang(hang, boLoc) {
  var bl = boLoc || taoBoLocRong();
  var ds = bl.chiMoiNhat ? locLanQuetMoiNhat(hang) : hang;
  var tuKhoa = String(bl.tuKhoa || '').trim().toLowerCase();
  var ra = [];
  for (var i = 0; i < ds.length; i++) {
    var h = ds[i];
    if (!coTrongDanhSach(bl.maLanQuet, h.ma_lan_quet)) continue;
    if (!coTrongDanhSach(bl.tenMien, h.ten_mien)) continue;
    if (!coTrongDanhSach(bl.thuongHieu, h.thuong_hieu)) continue;
    if (!coTrongDanhSach(bl.danhMuc, h.danh_muc)) continue;
    if (!coTrongDanhSach(bl.nenTang, h.nen_tang)) continue;
    if (!coTrongDanhSach(bl.ketLuan, h._ket_luan)) continue;
    if (bl.conHang && String(h.con_hang) !== bl.conHang) continue;

    var gia = laSo(h.gia_ban) ? Number(h.gia_ban) : null;
    if (bl.coGia && gia === null) continue;
    if (bl.giaTu !== null && bl.giaTu !== undefined && bl.giaTu !== '' && (gia === null || gia < Number(bl.giaTu))) continue;
    if (bl.giaDen !== null && bl.giaDen !== undefined && bl.giaDen !== '' && (gia === null || gia > Number(bl.giaDen))) continue;

    if (tuKhoa !== '') {
      var kho = (String(h.ten) + ' ' + String(h.sku) + ' ' + String(h.thuong_hieu) + ' ' +
                 String(h.danh_muc) + ' ' + String(h.phien_ban)).toLowerCase();
      if (kho.indexOf(tuKhoa) < 0) continue;
    }
    ra.push(h);
  }
  return ra;
}

function laSo(v) {
  if (v === null || v === undefined || v === '') return false;
  var n = Number(v);
  return isFinite(n);
}

/** Sort rows. Empty cells always sort last, whichever direction. */
function sapXepHang(hang, cot, giamDan) {
  var ds = hang.slice();
  ds.sort(function (a, b) {
    var x = a[cot], y = b[cot];
    var xRong = (x === null || x === undefined || x === '');
    var yRong = (y === null || y === undefined || y === '');
    if (xRong && yRong) return 0;
    if (xRong) return 1;
    if (yRong) return -1;
    var so = laSo(x) && laSo(y);
    var kq = so ? (Number(x) - Number(y)) : String(x).localeCompare(String(y), 'vi');
    return giamDan ? -kq : kq;
  });
  return ds;
}

/* ----------------------------------------------------------------- statistics */

/** Descriptive stats over a numeric list. Returns nulls (never 0) when there is no data. */
function thongKeSo(ds) {
  var so = [];
  for (var i = 0; i < ds.length; i++) if (laSo(ds[i])) so.push(Number(ds[i]));
  if (so.length === 0) return { n: 0, min: null, max: null, trungVi: null, trungBinh: null, p25: null, p75: null, tong: null };
  so.sort(function (a, b) { return a - b; });
  var tong = 0;
  for (var j = 0; j < so.length; j++) tong += so[j];
  return {
    n: so.length,
    min: so[0],
    max: so[so.length - 1],
    trungVi: phanVi(so, 0.5),
    p25: phanVi(so, 0.25),
    p75: phanVi(so, 0.75),
    trungBinh: Math.round((tong / so.length) * 100) / 100,
    tong: tong
  };
}

/** Linear-interpolated percentile over a pre-sorted array. */
function phanVi(daSapXep, p) {
  if (daSapXep.length === 0) return null;
  if (daSapXep.length === 1) return daSapXep[0];
  var vt = (daSapXep.length - 1) * p;
  var duoi = Math.floor(vt);
  var tren = Math.ceil(vt);
  if (duoi === tren) return daSapXep[duoi];
  return Math.round((daSapXep[duoi] + (daSapXep[tren] - daSapXep[duoi]) * (vt - duoi)) * 100) / 100;
}

/** Group rows by a column and describe gia_ban within each group. */
function gomNhomTheoGia(hang, cotNhom, tuyChon) {
  var tc = tuyChon || {};
  var nhom = {};
  var thuTu = [];
  for (var i = 0; i < hang.length; i++) {
    var k = String(hang[i][cotNhom] === undefined || hang[i][cotNhom] === '' ? '(không ghi)' : hang[i][cotNhom]);
    if (!nhom[k]) { nhom[k] = []; thuTu.push(k); }
    nhom[k].push(hang[i]);
  }
  var ra = [];
  for (var j = 0; j < thuTu.length; j++) {
    var ds = nhom[thuTu[j]];
    var gia = ds.map(function (h) { return h.gia_ban; });
    var tk = thongKeSo(gia);
    var conHang = 0;
    for (var k2 = 0; k2 < ds.length; k2++) if (String(ds[k2].con_hang) === 'CON') conHang++;
    ra.push({
      nhom: thuTu[j],
      soDong: ds.length,
      soCoGia: tk.n,
      tyLeCoGia: ds.length === 0 ? 0 : tk.n / ds.length,
      min: tk.min, p25: tk.p25, trungVi: tk.trungVi, p75: tk.p75, max: tk.max,
      trungBinh: tk.trungBinh,
      soConHang: conHang,
      tienTe: tienTeChinh(ds)
    });
  }
  ra.sort(function (a, b) { return b.soDong - a.soDong; });
  if (tc.toiDa && ra.length > tc.toiDa) return ra.slice(0, tc.toiDa);
  return ra;
}

/** The currency that actually appears in these rows. '' when mixed or unknown — never assumed. */
function tienTeChinh(hang) {
  var thay = {};
  for (var i = 0; i < hang.length; i++) {
    var t = String(hang[i].tien_te || '').trim();
    if (t !== '') thay[t] = (thay[t] || 0) + 1;
  }
  var khoa = Object.keys(thay);
  if (khoa.length === 0) return '';
  if (khoa.length === 1) return khoa[0];
  khoa.sort(function (a, b) { return thay[b] - thay[a]; });
  return khoa[0] + ' (+' + (khoa.length - 1) + ' đơn vị khác)';
}

/** Histogram buckets over gia_ban. Bucket width is a round number, not an arbitrary split. */
function chiaKhoangGia(hang, soKhoangMongMuon) {
  var so = [];
  for (var i = 0; i < hang.length; i++) if (laSo(hang[i].gia_ban)) so.push(Number(hang[i].gia_ban));
  if (so.length === 0) return { khoang: [], min: null, max: null, buoc: null };
  so.sort(function (a, b) { return a - b; });
  var min = so[0], max = so[so.length - 1];
  if (min === max) {
    return { khoang: [{ tu: min, den: min, so: so.length, nhan: dinhDangSo(min) }], min: min, max: max, buoc: 0 };
  }
  var n = soKhoangMongMuon || 12;
  var buoc = lamTronBuoc((max - min) / n);
  var batDau = Math.floor(min / buoc) * buoc;
  var khoang = [];
  for (var v = batDau; v <= max; v += buoc) {
    khoang.push({ tu: v, den: v + buoc, so: 0, nhan: dinhDangSo(v) + '–' + dinhDangSo(v + buoc) });
    if (khoang.length > 200) break;
  }
  for (var j = 0; j < so.length; j++) {
    var vt = Math.floor((so[j] - batDau) / buoc);
    if (vt < 0) vt = 0;
    if (vt >= khoang.length) vt = khoang.length - 1;
    khoang[vt].so++;
  }
  return { khoang: khoang, min: min, max: max, buoc: buoc };
}

/** Round a raw step up to 1/2/5 × 10^n so axis labels are readable. */
function lamTronBuoc(tho) {
  if (!(tho > 0)) return 1;
  var mu = Math.pow(10, Math.floor(Math.log(tho) / Math.LN10));
  var tyLe = tho / mu;
  var chon = tyLe <= 1 ? 1 : (tyLe <= 2 ? 2 : (tyLe <= 5 ? 5 : 10));
  return chon * mu;
}

function dinhDangSo(n) {
  if (n === null || n === undefined || n === '') return '';
  var s = String(Math.round(Number(n)));
  var ra = '';
  var dem = 0;
  for (var i = s.length - 1; i >= 0; i--) {
    ra = s.charAt(i) + ra;
    dem++;
    if (dem % 3 === 0 && i > 0) ra = '.' + ra;
  }
  return ra;
}

/* --------------------------------------------------------- trust propagation */

var THU_TU_KET_LUAN = ['CAO', 'TRUNG_BINH', 'THAP', 'KHONG_QUET_DUOC'];

/** Worst verdict wins. A table mixing CAO and THAP rows is a THAP table. */
function ketLuanXauNhat(ds) {
  var xau = -1;
  for (var i = 0; i < ds.length; i++) {
    var vt = THU_TU_KET_LUAN.indexOf(String(ds[i]));
    if (vt > xau) xau = vt;
  }
  return xau < 0 ? '' : THU_TU_KET_LUAN[xau];
}

/**
 * Trust summary for any set of rows: which scans produced them, what each scan's verdict
 * was, the worst one, and the measured price fill of THIS selection (not of the scan).
 */
function tomTatTinCay(hang, banDoLanQuet) {
  var theoLanQuet = {};
  var coGia = 0;
  for (var i = 0; i < hang.length; i++) {
    var ma = String(hang[i].ma_lan_quet);
    if (!theoLanQuet[ma]) {
      var lq = banDoLanQuet ? banDoLanQuet[ma] : null;
      theoLanQuet[ma] = {
        maLanQuet: ma,
        ketLuan: lq ? String(lq.ket_luan) : String(hang[i]._ket_luan || ''),
        bac: lq ? String(lq.bac_thang_dung) : String(hang[i]._bac || ''),
        url: String(hang[i].nguon_url),
        ngay: String(hang[i].ngay_quet),
        soDong: 0
      };
    }
    theoLanQuet[ma].soDong++;
    if (laSo(hang[i].gia_ban)) coGia++;
  }
  var ds = Object.keys(theoLanQuet).map(function (k) { return theoLanQuet[k]; });
  ds.sort(function (a, b) { return b.soDong - a.soDong; });
  var dem = { CAO: 0, TRUNG_BINH: 0, THAP: 0, KHONG_QUET_DUOC: 0, '': 0 };
  for (var j = 0; j < ds.length; j++) {
    var k2 = dem[ds[j].ketLuan] === undefined ? '' : ds[j].ketLuan;
    dem[k2]++;
  }
  var xauNhat = ketLuanXauNhat(ds.map(function (x) { return x.ketLuan; }));
  return {
    soDong: hang.length,
    soLanQuet: ds.length,
    lanQuet: ds,
    dem: dem,
    ketLuan: xauNhat,
    tyLeCoGia: hang.length === 0 ? 0 : coGia / hang.length,
    cau: cauTinCay(xauNhat, ds, hang.length),
    viecCanLam: xauNhat === '' ? '' : viecCanLam(xauNhat)
  };
}

function cauTinCay(xauNhat, dsLanQuet, soDong) {
  if (soDong === 0) return 'Không có dòng nào khớp bộ lọc.';
  if (dsLanQuet.length === 1) {
    return 'Dữ liệu đến từ 1 lần quét, kết luận ' + (xauNhat || 'không rõ') + '. ' + (CAU_KET_LUAN[xauNhat] || '');
  }
  var dem = {};
  for (var i = 0; i < dsLanQuet.length; i++) {
    var k = dsLanQuet[i].ketLuan || 'không rõ';
    dem[k] = (dem[k] || 0) + 1;
  }
  var mo = Object.keys(dem).map(function (k) { return dem[k] + '×' + k; }).join(', ');
  return 'Dữ liệu trộn từ ' + dsLanQuet.length + ' lần quét (' + mo + '). ' +
         'Cả bảng này chỉ đáng tin ở mức thấp nhất trong số đó: ' + (xauNhat || 'không rõ') + '.';
}

/** Distinct values for the filter dropdowns, with counts. */
function mucChonLoc(hang) {
  function dem(cot) {
    var m = {};
    for (var i = 0; i < hang.length; i++) {
      var v = String(hang[i][cot] === undefined || hang[i][cot] === '' ? '' : hang[i][cot]);
      if (v === '') continue;
      m[v] = (m[v] || 0) + 1;
    }
    var ds = Object.keys(m).map(function (k) { return { gia_tri: k, so: m[k] }; });
    ds.sort(function (a, b) { return b.so - a.so || a.gia_tri.localeCompare(b.gia_tri, 'vi'); });
    return ds.slice(0, 300);
  }
  return {
    tenMien: dem('ten_mien'),
    thuongHieu: dem('thuong_hieu'),
    danhMuc: dem('danh_muc'),
    nenTang: dem('nen_tang'),
    ketLuan: dem('_ket_luan')
  };
}

/** Rows -> CSV. Excel-safe: BOM is added by the client, cells are quoted. */
function hangThanhCsv(cot, hang) {
  function o(v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    if (/["\n,;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  var d = [cot.map(o).join(',')];
  for (var i = 0; i < hang.length; i++) {
    var r = [];
    for (var j = 0; j < cot.length; j++) r.push(o(hang[i][cot[j]]));
    d.push(r.join(','));
  }
  return d.join('\n');
}

/* ==========================================================================
   16_BAO_CAO.js
   ========================================================================== */
/**
 * 16_BAO_CAO.js — the report builder. Pure: it takes an already-loaded data store and a
 * report definition, and returns a report object (columns, rows, chart data, stat tiles,
 * trust summary, warnings). Nothing here reads the sheet or the network.
 *
 * Two design rules, both inherited from the scanner itself:
 *   1. A report never looks more confident than the weakest scan feeding it.
 *   2. The report says out loud what would make it wrong — mixed currencies, snapshots
 *      taken weeks apart, groups too small for a median to mean anything.
 */

var LOAI_BAO_CAO = [
  { ma: 'BANG_GIA', ten: 'Bậc thang giá theo nhóm',
    moTa: 'Nhóm sản phẩm theo thương hiệu / danh mục / cửa hàng rồi xem khoảng giá: thấp nhất, trung vị, cao nhất.',
    thamSo: [{ khoa: 'nhomTheo', nhan: 'Nhóm theo', kieu: 'chon',
               chon: [['thuong_hieu', 'Thương hiệu'], ['danh_muc', 'Danh mục'], ['ten_mien', 'Cửa hàng'], ['nen_tang', 'Nền tảng']] }] },
  { ma: 'PHAN_BO_GIA', ten: 'Phân bố giá',
    moTa: 'Đếm số sản phẩm trong từng khoảng giá. Dùng để thấy thị trường đang dồn ở mức giá nào.',
    thamSo: [] },
  { ma: 'SO_SANH_DOI_THU', ten: 'So sánh cửa hàng theo danh mục',
    moTa: 'Bảng chéo: mỗi dòng một danh mục, mỗi cột một cửa hàng, ô là giá trung vị. Đánh dấu nơi rẻ nhất.',
    thamSo: [{ khoa: 'nhomTheo', nhan: 'Dòng là', kieu: 'chon',
               chon: [['danh_muc', 'Danh mục'], ['thuong_hieu', 'Thương hiệu']] }] },
  { ma: 'THAY_DOI', ten: 'Thay đổi giữa 2 lần quét',
    moTa: 'So 2 lần quét gần nhất của cùng một địa chỉ: tăng giá, giảm giá, mới, mất, hết hàng.',
    thamSo: [{ khoa: 'nguonUrl', nhan: 'Địa chỉ đã quét', kieu: 'chon_url' }] },
  { ma: 'CHAT_LUONG', ten: 'Chất lượng dữ liệu theo lần quét',
    moTa: 'Mỗi lần quét một dòng: kết luận, bậc thang, và tỷ lệ điền của từng cột. Đây là bảng để soi khi nghi ngờ số liệu.',
    thamSo: [] }
];

var NGUONG_NHOM_NHO = 5;          // fewer rows than this and a median means little
var NGUONG_NGAY_LECH = 14;        // snapshots this many days apart are not "the same moment"

function docNgay(s) {
  if (!s) return null;
  var t = String(s).trim().replace(' ', 'T');
  var d = new Date(t);
  return isFinite(d.getTime()) ? d : null;
}

function soNgayLech(a, b) {
  var x = docNgay(a), y = docNgay(b);
  if (!x || !y) return null;
  return Math.abs(x.getTime() - y.getTime()) / 86400000;
}

/**
 * The honesty layer. Every warning here is a reason the numbers above it could be wrong.
 *
 * It does NOT repeat the trust verdict: every screen and every export that shows these
 * warnings also shows tomTatTinCay() right above them, and printing the same sentence
 * twice trains people to stop reading it.
 *
 * @return {Array<{muc:string, cau:string}>} muc: 'nang' | 'vua' | 'nhe'
 */
function canhBaoDuLieu(hang, tinCay, tuyChon) {
  var tc = tuyChon || {};
  var ra = [];

  var tienTe = {};
  var soCoGia = 0;
  for (var i = 0; i < hang.length; i++) {
    if (!laSo(hang[i].gia_ban)) continue;
    soCoGia++;
    var t = String(hang[i].tien_te || '').trim();
    var khoaT = t === '' ? '(trống)' : t;
    tienTe[khoaT] = (tienTe[khoaT] || 0) + 1;
  }
  var khoaTt = Object.keys(tienTe);
  var khacTrong = khoaTt.filter(function (k) { return k !== '(trống)'; });
  if (khacTrong.length > 1) {
    ra.push({ muc: 'nang', cau: 'Đang trộn ' + khacTrong.length + ' đơn vị tiền tệ (' + khacTrong.join(', ') +
      '). Mọi con số trung bình / trung vị bên dưới đều VÔ NGHĨA cho tới khi bạn lọc về một đơn vị.' });
  }
  if (tienTe['(trống)'] && soCoGia > 0) {
    var tyLeTrong = tienTe['(trống)'] / soCoGia;
    if (tyLeTrong > 0.2) {
      ra.push({ muc: 'vua', cau: Math.round(tyLeTrong * 100) + '% số dòng có giá nhưng KHÔNG xác minh được đơn vị tiền tệ. ' +
        'Công cụ không mặc định VND; nếu bạn chắc chắn đây là VND thì phần suy luận đó là của bạn, không phải của dữ liệu.' });
    }
  }

  if (hang.length > 0) {
    var tyLeGia = soCoGia / hang.length;
    if (tyLeGia < 0.7) {
      ra.push({ muc: 'nang', cau: 'Chỉ ' + Math.round(tyLeGia * 100) + '% số dòng trong lát cắt này có giá. ' +
        'Mọi thống kê giá bên dưới chỉ tính trên phần đó, không đại diện cho cả tập.' });
    }
  }

  if (tinCay && tinCay.lanQuet && tinCay.lanQuet.length > 1) {
    var som = null, muon = null;
    for (var j = 0; j < tinCay.lanQuet.length; j++) {
      var ng = tinCay.lanQuet[j].ngay;
      if (!som || String(ng) < String(som)) som = ng;
      if (!muon || String(ng) > String(muon)) muon = ng;
    }
    var lech = soNgayLech(som, muon);
    if (lech !== null && lech > NGUONG_NGAY_LECH) {
      ra.push({ muc: 'vua', cau: 'Các lần quét trong lát cắt này cách nhau tới ' + Math.round(lech) + ' ngày (' +
        String(som).substring(0, 10) + ' → ' + String(muon).substring(0, 10) + '). ' +
        'Đây là so sánh giữa các thời điểm khác nhau, không phải một lát cắt thị trường tại một thời điểm.' });
    }
  }

  if (tc.nhomNho && tc.nhomNho.length) {
    ra.push({ muc: 'nhe', cau: tc.nhomNho.length + ' nhóm có dưới ' + NGUONG_NHOM_NHO +
      ' sản phẩm (' + tc.nhomNho.slice(0, 5).join(', ') + (tc.nhomNho.length > 5 ? '…' : '') +
      '). Trung vị của nhóm nhỏ như vậy dễ lệch — đọc cột "số dòng" trước khi kết luận.' });
  }
  if (tc.themCanhBao) for (var k = 0; k < tc.themCanhBao.length; k++) ra.push(tc.themCanhBao[k]);
  return ra;
}

/** Build a report. `kho` is the output of docKhoDuLieu(); nothing here touches the sheet. */
function taoBaoCao(dinhNghia, kho) {
  var dn = dinhNghia || {};
  var ma = dn.ma || 'BANG_GIA';
  var boLoc = dn.boLoc || taoBoLocRong();
  var thamSo = dn.thamSo || {};
  var hang = locHang(kho.hang, boLoc);
  var tinCay = tomTatTinCay(hang, kho.lanQuet);

  switch (ma) {
    case 'BANG_GIA': return baoCaoBangGia(hang, tinCay, thamSo, boLoc);
    case 'PHAN_BO_GIA': return baoCaoPhanBoGia(hang, tinCay, thamSo, boLoc);
    case 'SO_SANH_DOI_THU': return baoCaoSoSanhDoiThu(hang, tinCay, thamSo, boLoc);
    case 'THAY_DOI': return baoCaoThayDoi(kho, tinCay, thamSo, boLoc);
    case 'CHAT_LUONG': return baoCaoChatLuong(kho, hang, tinCay, boLoc);
    default:
      return { ma: ma, tieuDe: 'Không có loại báo cáo này', cot: [], hang: [], tomTat: [],
               tinCay: tinCay, canhBao: [{ muc: 'nang', cau: 'Mã báo cáo không hợp lệ: ' + ma }], bieuDo: null };
  }
}

function tile(nhan, giaTri, phu) {
  return { nhan: nhan, gia_tri: giaTri, phu: phu || '' };
}

function nhanCot(c) {
  var m = {
    thuong_hieu: 'Thương hiệu', danh_muc: 'Danh mục', ten_mien: 'Cửa hàng', nen_tang: 'Nền tảng',
    ten: 'Tên', gia_ban: 'Giá bán', gia_goc: 'Giá gốc', con_hang: 'Còn hàng', sku: 'SKU',
    phien_ban: 'Phiên bản', tien_te: 'Tiền tệ', ma_ngoai: 'Mã ngoài', url_san_pham: 'Link',
    ngay_quet: 'Ngày quét', ma_lan_quet: 'Lần quét', nguon_url: 'Địa chỉ đã quét',
    so_luong_ton: 'Tồn kho', danh_gia_sao: 'Điểm ĐG', so_luot_danh_gia: 'Lượt ĐG',
    so_da_ban: 'Đã bán', anh_chinh: 'Ảnh', _ket_luan: 'Kết luận'
  };
  return m[c] || c;
}

/* ------------------------------------------------------------- 1. BANG_GIA */

function baoCaoBangGia(hang, tinCay, thamSo, boLoc) {
  var cotNhom = thamSo.nhomTheo || 'thuong_hieu';
  var nhom = gomNhomTheoGia(hang, cotNhom);
  var nhomNho = nhom.filter(function (n) { return n.soCoGia > 0 && n.soCoGia < NGUONG_NHOM_NHO; })
                    .map(function (n) { return n.nhom; });
  var tk = thongKeSo(hang.map(function (h) { return h.gia_ban; }));

  // Chọn 12 nhóm nhiều sản phẩm nhất, RỒI xếp theo trung vị để biểu đồ đọc ra một bậc thang.
  var veDuoc = nhom.filter(function (n) { return n.min !== null; }).slice(0, 12);
  veDuoc.sort(function (a, b) { return b.trungVi - a.trungVi; });
  var bieuDo = veDuoc.length === 0 ? null : {
    kieu: 'thanh_khoang',
    tieuDe: 'Khoảng giá theo ' + nhanCot(cotNhom).toLowerCase() + ' — 12 nhóm nhiều sản phẩm nhất, xếp theo trung vị',
    donVi: tienTeChinh(hang),
    diem: veDuoc.map(function (n) {
      return { nhan: n.nhom, min: n.min, giua: n.trungVi, max: n.max, so: n.soDong };
    })
  };

  return {
    ma: 'BANG_GIA',
    tieuDe: 'Bậc thang giá theo ' + nhanCot(cotNhom).toLowerCase(),
    moTa: 'Mỗi dòng là một ' + nhanCot(cotNhom).toLowerCase() + '. Khi so sánh hãy dùng cột TRUNG VỊ, không dùng trung bình: một sản phẩm đắt bất thường kéo lệch trung bình.',
    cot: [
      { khoa: 'nhom', nhan: nhanCot(cotNhom), kieu: 'chu' },
      { khoa: 'soDong', nhan: 'Số dòng', kieu: 'so' },
      { khoa: 'tyLeCoGia', nhan: '% có giá', kieu: 'phanTram' },
      { khoa: 'min', nhan: 'Thấp nhất', kieu: 'tien' },
      { khoa: 'p25', nhan: '25%', kieu: 'tien' },
      { khoa: 'trungVi', nhan: 'Trung vị', kieu: 'tien' },
      { khoa: 'p75', nhan: '75%', kieu: 'tien' },
      { khoa: 'max', nhan: 'Cao nhất', kieu: 'tien' },
      { khoa: 'soConHang', nhan: 'Còn hàng', kieu: 'so' },
      { khoa: 'tienTe', nhan: 'Tiền tệ', kieu: 'chu' }
    ],
    hang: nhom,
    bieuDo: bieuDo,
    tomTat: [
      tile('Số dòng', dinhDangSo(hang.length), tinCay.soLanQuet + ' lần quét'),
      tile('Có giá', Math.round(tinCay.tyLeCoGia * 100) + '%', tk.n + ' dòng có giá'),
      tile('Giá trung vị', tk.trungVi === null ? '—' : dinhDangSo(tk.trungVi), tienTeChinh(hang)),
      tile('Khoảng giá', tk.min === null ? '—' : (dinhDangSo(tk.min) + ' – ' + dinhDangSo(tk.max)), tienTeChinh(hang)),
      tile('Số nhóm', String(nhom.length), nhanCot(cotNhom).toLowerCase())
    ],
    tinCay: tinCay,
    canhBao: canhBaoDuLieu(hang, tinCay, { nhomNho: nhomNho })
  };
}

/* --------------------------------------------------------- 2. PHAN_BO_GIA */

function baoCaoPhanBoGia(hang, tinCay, thamSo, boLoc) {
  var kq = chiaKhoangGia(hang, 12);
  var tk = thongKeSo(hang.map(function (h) { return h.gia_ban; }));
  var dong = kq.khoang.map(function (k) {
    return { khoang: k.nhan, tu: k.tu, den: k.den, so: k.so, tyLe: tk.n === 0 ? 0 : k.so / tk.n };
  });
  return {
    ma: 'PHAN_BO_GIA',
    tieuDe: 'Phân bố giá',
    moTa: 'Số sản phẩm trong từng khoảng giá. Chỉ tính ' + tk.n + ' dòng đọc được giá.',
    cot: [
      { khoa: 'khoang', nhan: 'Khoảng giá', kieu: 'chu' },
      { khoa: 'so', nhan: 'Số sản phẩm', kieu: 'so' },
      { khoa: 'tyLe', nhan: 'Tỷ lệ', kieu: 'phanTram' }
    ],
    hang: dong,
    bieuDo: dong.length === 0 ? null : {
      kieu: 'cot',
      tieuDe: 'Số sản phẩm theo khoảng giá',
      donVi: tienTeChinh(hang),
      diem: dong.map(function (d) { return { nhan: d.khoang, gia_tri: d.so, tu: d.tu, den: d.den }; })
    },
    tomTat: [
      tile('Dòng có giá', dinhDangSo(tk.n), 'trong ' + dinhDangSo(hang.length) + ' dòng'),
      tile('Trung vị', tk.trungVi === null ? '—' : dinhDangSo(tk.trungVi), tienTeChinh(hang)),
      tile('25% rẻ nhất dưới', tk.p25 === null ? '—' : dinhDangSo(tk.p25), tienTeChinh(hang)),
      tile('25% đắt nhất trên', tk.p75 === null ? '—' : dinhDangSo(tk.p75), tienTeChinh(hang)),
      tile('Bước chia', kq.buoc === null ? '—' : dinhDangSo(kq.buoc), 'mỗi cột')
    ],
    tinCay: tinCay,
    canhBao: canhBaoDuLieu(hang, tinCay, {})
  };
}

/* ---------------------------------------------------- 3. SO_SANH_DOI_THU */

function baoCaoSoSanhDoiThu(hang, tinCay, thamSo, boLoc) {
  var cotNhom = thamSo.nhomTheo || 'danh_muc';
  var demMien = {};
  var demNhom = {};
  var o = {};                       // {nhom: {mien: [prices]}}
  for (var i = 0; i < hang.length; i++) {
    if (!laSo(hang[i].gia_ban)) continue;
    var m = String(hang[i].ten_mien || '(không rõ)');
    var nRaw = hang[i][cotNhom];
    var n = String(nRaw === '' || nRaw === undefined || nRaw === null ? '(không ghi)' : nRaw);
    demMien[m] = (demMien[m] || 0) + 1;
    demNhom[n] = (demNhom[n] || 0) + 1;
    if (!o[n]) o[n] = {};
    if (!o[n][m]) o[n][m] = [];
    o[n][m].push(Number(hang[i].gia_ban));
  }
  var dsMien = Object.keys(demMien).sort(function (a, b) { return demMien[b] - demMien[a]; }).slice(0, 8);
  var dsNhom = Object.keys(demNhom).sort(function (a, b) { return demNhom[b] - demNhom[a]; }).slice(0, 40);

  var cot = [{ khoa: 'nhom', nhan: nhanCot(cotNhom), kieu: 'chu' }];
  for (var j = 0; j < dsMien.length; j++) cot.push({ khoa: 'c' + j, nhan: dsMien[j], kieu: 'tien' });
  cot.push({ khoa: 'reNhat', nhan: 'Rẻ nhất', kieu: 'chu' });

  var dong = [];
  for (var k2 = 0; k2 < dsNhom.length; k2++) {
    var r = { nhom: dsNhom[k2] };
    var reNhat = null, tenReNhat = '';
    for (var m2 = 0; m2 < dsMien.length; m2++) {
      var ds = o[dsNhom[k2]] ? o[dsNhom[k2]][dsMien[m2]] : null;
      if (!ds || ds.length === 0) { r['c' + m2] = null; continue; }
      ds.sort(function (a, b) { return a - b; });
      var tv = phanVi(ds, 0.5);
      r['c' + m2] = tv;
      r['_n' + m2] = ds.length;
      if (reNhat === null || tv < reNhat) { reNhat = tv; tenReNhat = dsMien[m2]; }
    }
    r.reNhat = tenReNhat === '' ? '—' : ('↓ ' + tenReNhat);
    r._reNhatCot = tenReNhat;
    dong.push(r);
  }

  var them = [];
  if (dsMien.length < 2) {
    them.push({ muc: 'vua', cau: 'Lát cắt này chỉ có ' + dsMien.length + ' cửa hàng nên không có gì để so sánh. ' +
      'Bỏ bớt bộ lọc, hoặc quét thêm cửa hàng khác rồi mở lại báo cáo này.' });
  }
  if (Object.keys(demMien).length > 8) {
    them.push({ muc: 'nhe', cau: 'Có ' + Object.keys(demMien).length + ' cửa hàng, bảng chỉ hiện 8 cửa hàng nhiều dòng nhất.' });
  }
  them.push({ muc: 'nhe', cau: 'Hai cửa hàng chỉ so được với nhau khi bán thứ giống nhau. Danh mục do chính họ tự đặt tên, ' +
    'nên "Nhà tắm" của cửa hàng A có thể không cùng phạm vi với "Nhà tắm" của cửa hàng B.' });

  return {
    ma: 'SO_SANH_DOI_THU',
    tieuDe: 'So sánh cửa hàng theo ' + nhanCot(cotNhom).toLowerCase(),
    moTa: 'Ô là GIÁ TRUNG VỊ của cửa hàng đó trong nhóm đó. Ô trống nghĩa là cửa hàng không có sản phẩm nào đọc được giá trong nhóm.',
    cot: cot,
    hang: dong,
    bieuDo: null,
    tomTat: [
      tile('Cửa hàng', String(Object.keys(demMien).length), 'hiện ' + dsMien.length + ' cột'),
      tile(nhanCot(cotNhom), String(Object.keys(demNhom).length), 'hiện ' + dsNhom.length + ' dòng'),
      tile('Dòng có giá', dinhDangSo(hang.filter(function (h) { return laSo(h.gia_ban); }).length), 'dùng để tính'),
      tile('Tiền tệ', tienTeChinh(hang) || '(không rõ)', 'trong lát cắt')
    ],
    tinCay: tinCay,
    canhBao: canhBaoDuLieu(hang, tinCay, { themCanhBao: them })
  };
}

/* ------------------------------------------------------------ 4. THAY_DOI */

function baoCaoThayDoi(kho, tinCayChung, thamSo, boLoc) {
  var url = thamSo.nguonUrl || '';
  var theoLan = {};
  var thuTu = [];
  for (var i = 0; i < kho.hang.length; i++) {
    var h = kho.hang[i];
    if (String(h.nguon_url) !== String(url)) continue;
    var ma = String(h.ma_lan_quet);
    if (!theoLan[ma]) { theoLan[ma] = { maLanQuet: ma, ngay: String(h.ngay_quet), hang: [] }; thuTu.push(ma); }
    theoLan[ma].hang.push(h);
  }
  var ds = thuTu.map(function (m) { return theoLan[m]; });
  ds.sort(function (a, b) { return a.ngay < b.ngay ? 1 : (a.ngay > b.ngay ? -1 : 0); });

  if (ds.length < 2) {
    return {
      ma: 'THAY_DOI',
      tieuDe: 'Thay đổi giữa 2 lần quét',
      moTa: url === '' ? 'Hãy chọn một địa chỉ đã quét.' : url,
      cot: [], hang: [], bieuDo: null, tomTat: [],
      tinCay: tomTatTinCay(ds.length ? ds[0].hang : [], kho.lanQuet),
      canhBao: [{ muc: 'vua', cau: 'Địa chỉ này mới có ' + ds.length + ' lần quét. Cần ít nhất 2 lần quét cùng một địa chỉ mới so sánh được. ' +
                                   'Hãy quét lại địa chỉ đó rồi mở lại báo cáo.' }]
    };
  }

  var thayDoi = soSanhSnapshot(ds[1], ds[0]);
  var hangGop = ds[0].hang.concat(ds[1].hang);
  var tinCay = tomTatTinCay(hangGop, kho.lanQuet);
  var dem = { TANG_GIA: 0, GIAM_GIA: 0, MOI: 0, MAT: 0, HET_HANG: 0, CON_HANG_LAI: 0 };
  for (var j = 0; j < thayDoi.length; j++) {
    if (dem[thayDoi[j].loai_thay_doi] !== undefined) dem[thayDoi[j].loai_thay_doi]++;
  }
  var lech = soNgayLech(ds[1].ngay, ds[0].ngay);
  var them = [];
  if (lech !== null && lech < 0.5) {
    them.push({ muc: 'vua', cau: 'Hai lần quét cách nhau chưa tới nửa ngày. Chênh lệch thấy được nhiều khả năng là ' +
      'khuyến mãi theo giờ, không phải một lần đổi giá thật.' });
  }
  if (thayDoi.length === 0) {
    them.push({ muc: 'nhe', cau: 'Hai lần quét giống hệt nhau — không có thay đổi nào.' });
  }
  if (dem.MAT > 0) {
    them.push({ muc: 'nhe', cau: dem.MAT + ' dòng "MẤT" không chắc là sản phẩm bị gỡ: cũng có thể lần quét sau ' +
      'chạm trần số trang, hoặc cửa hàng đổi mã sản phẩm. Kiểm cột số dòng của 2 lần quét trước khi kết luận.' });
  }

  return {
    ma: 'THAY_DOI',
    tieuDe: 'Thay đổi: ' + url,
    moTa: 'So ' + String(ds[1].ngay).substring(0, 16) + ' → ' + String(ds[0].ngay).substring(0, 16) +
          (lech === null ? '' : ' (cách nhau ' + (lech < 1 ? Math.round(lech * 24) + ' giờ' : Math.round(lech) + ' ngày') + ')'),
    cot: [
      { khoa: 'loai_thay_doi', nhan: 'Thay đổi', kieu: 'chu' },
      { khoa: 'ten', nhan: 'Tên', kieu: 'chu' },
      { khoa: 'ma_ngoai', nhan: 'Mã ngoài', kieu: 'chu' },
      { khoa: 'gia_cu', nhan: 'Giá cũ', kieu: 'tien' },
      { khoa: 'gia_moi', nhan: 'Giá mới', kieu: 'tien' },
      { khoa: 'chenh_lech', nhan: 'Chênh lệch', kieu: 'tien' },
      { khoa: 'phan_tram', nhan: '%', kieu: 'so' },
      { khoa: 'con_hang_cu', nhan: 'Kho cũ', kieu: 'chu' },
      { khoa: 'con_hang_moi', nhan: 'Kho mới', kieu: 'chu' }
    ],
    hang: thayDoi,
    bieuDo: null,
    tomTat: [
      tile('Tăng giá', String(dem.TANG_GIA), 'sản phẩm'),
      tile('Giảm giá', String(dem.GIAM_GIA), 'sản phẩm'),
      tile('Mới', String(dem.MOI), 'so với lần trước'),
      tile('Mất', String(dem.MAT), 'không còn thấy'),
      tile('Hết hàng', String(dem.HET_HANG), 'chuyển sang hết')
    ],
    tinCay: tinCay,
    canhBao: canhBaoDuLieu(hangGop, tinCay, { themCanhBao: them })
  };
}

/* ---------------------------------------------------------- 5. CHAT_LUONG */

function baoCaoChatLuong(kho, hangDaLoc, tinCay, boLoc) {
  var theoLan = {};
  for (var i = 0; i < kho.hang.length; i++) {
    var h = kho.hang[i];
    var ma = String(h.ma_lan_quet);
    if (!theoLan[ma]) theoLan[ma] = [];
    theoLan[ma].push(h);
  }
  var dong = [];
  var khoa = Object.keys(theoLan);
  for (var j = 0; j < khoa.length; j++) {
    var ds = theoLan[khoa[j]];
    var lq = kho.lanQuet[khoa[j]] || {};
    var r = {
      ma_lan_quet: khoa[j],
      ngay: String(ds[0].ngay_quet),
      nguon_url: String(ds[0].nguon_url),
      ket_luan: String(lq.ket_luan || ''),
      bac: String(lq.bac_thang_dung || ''),
      nen_tang: String(ds[0].nen_tang || ''),
      soDong: ds.length
    };
    for (var t = 0; t < TRUONG_SAN_PHAM.length; t++) {
      var tr = TRUONG_SAN_PHAM[t];
      var co = 0;
      for (var k = 0; k < ds.length; k++) {
        var v = ds[k][tr];
        if (!(v === null || v === undefined || v === '')) co++;
      }
      r['fill_' + tr] = ds.length === 0 ? 0 : co / ds.length;
    }
    dong.push(r);
  }
  dong.sort(function (a, b) { return a.ngay < b.ngay ? 1 : (a.ngay > b.ngay ? -1 : 0); });

  var cot = [
    { khoa: 'ket_luan', nhan: 'Kết luận', kieu: 'ket_luan' },
    { khoa: 'ngay', nhan: 'Ngày quét', kieu: 'chu' },
    { khoa: 'nguon_url', nhan: 'Địa chỉ', kieu: 'chu' },
    { khoa: 'nen_tang', nhan: 'Nền tảng', kieu: 'chu' },
    { khoa: 'bac', nhan: 'Bậc', kieu: 'chu' },
    { khoa: 'soDong', nhan: 'Số dòng', kieu: 'so' }
  ];
  var truongQuanTrong = ['gia_ban', 'ten', 'ma_ngoai', 'tien_te', 'con_hang', 'sku', 'thuong_hieu', 'danh_muc'];
  for (var q = 0; q < truongQuanTrong.length; q++) {
    cot.push({ khoa: 'fill_' + truongQuanTrong[q], nhan: '% ' + truongQuanTrong[q], kieu: 'phanTram' });
  }

  var demKl = { CAO: 0, TRUNG_BINH: 0, THAP: 0, KHONG_QUET_DUOC: 0 };
  for (var d2 = 0; d2 < dong.length; d2++) if (demKl[dong[d2].ket_luan] !== undefined) demKl[dong[d2].ket_luan]++;

  return {
    ma: 'CHAT_LUONG',
    tieuDe: 'Chất lượng dữ liệu theo lần quét',
    moTa: 'Bảng này KHÔNG chịu tác động của bộ lọc ở trên — nó luôn hiện toàn bộ lịch sử quét, vì đây là sổ tin cậy.',
    cot: cot,
    hang: dong,
    bieuDo: null,
    tomTat: [
      tile('Tổng lần quét', String(dong.length), ''),
      tile('CAO', String(demKl.CAO), 'dùng được ngay'),
      tile('TRUNG BÌNH', String(demKl.TRUNG_BINH), 'kiểm tay 3 dòng'),
      tile('THẤP', String(demKl.THAP), 'phải kiểm chứng'),
      tile('KHÔNG QUÉT ĐƯỢC', String(demKl.KHONG_QUET_DUOC), 'không có dòng nào')
    ],
    tinCay: tomTatTinCay(kho.hang, kho.lanQuet),
    canhBao: (demKl.THAP + demKl.KHONG_QUET_DUOC) === 0 ? [] : [{
      muc: 'nhe',
      cau: 'Có ' + (demKl.THAP + demKl.KHONG_QUET_DUOC) + ' lần quét ở mức THẤP hoặc KHÔNG QUÉT ĐƯỢC. ' +
           'Nếu chúng nằm trong lát cắt bạn đang dùng để ra quyết định, hãy lọc chúng ra.'
    }]
  };
}

/** Report -> flat rows for the sheet / CSV export. */
function baoCaoThanhMang(bc) {
  var cot = bc.cot.map(function (c) { return c.nhan; });
  var lo = [];
  for (var i = 0; i < bc.hang.length; i++) {
    var d = [];
    for (var j = 0; j < bc.cot.length; j++) {
      var v = bc.hang[i][bc.cot[j].khoa];
      if (v === null || v === undefined) v = '';
      if (bc.cot[j].kieu === 'phanTram' && v !== '') v = Math.round(Number(v) * 1000) / 10;
      d.push(v);
    }
    lo.push(d);
  }
  return { cot: cot, hang: lo };
}

/* ==========================================================================
   17_API_GIAO_DIEN.js
   ========================================================================== */
/**
 * 17_API_GIAO_DIEN.js — everything the browser calls with google.script.run.
 *
 * Each function is one round trip, so each one returns everything the screen needs.
 * Filtering and aggregation happen HERE, over the whole table; only the visible page of
 * rows travels to the browser. That way the numbers on screen are computed over all
 * matching rows even when the table shows the first 3.000.
 */

/** One call on page load: settings, filter options, scan list, totals. */
function apiKhoiTao() {
  taoCacBangNeuThieu();
  var kho = docKhoDuLieu();
  var lanQuet = [];
  var khoa = Object.keys(kho.lanQuet);
  for (var i = 0; i < khoa.length; i++) {
    var lq = kho.lanQuet[khoa[i]];
    lanQuet.push({
      ma_lan_quet: String(lq.ma_lan_quet),
      bat_dau: String(lq.bat_dau),
      url_nhap: String(lq.url_nhap),
      loai_url: String(lq.loai_url),
      nen_tang: String(lq.nen_tang),
      bac: String(lq.bac_thang_dung),
      so_sp: Number(lq.so_sp) || 0,
      ty_le_co_gia: Number(lq.ty_le_co_gia) || 0,
      truong_thieu_nhieu: String(lq.truong_thieu_nhieu),
      ket_luan: String(lq.ket_luan),
      ly_do: String(lq.ly_do),
      nguoi_quet: String(lq.nguoi_quet)
    });
  }
  lanQuet.sort(function (a, b) { return a.bat_dau < b.bat_dau ? 1 : (a.bat_dau > b.bat_dau ? -1 : 0); });

  var urlDaQuet = {};
  for (var j = 0; j < kho.hang.length; j++) {
    var u = String(kho.hang[j].nguon_url);
    if (!urlDaQuet[u]) urlDaQuet[u] = { url: u, soLan: {}, soDong: 0 };
    urlDaQuet[u].soLan[String(kho.hang[j].ma_lan_quet)] = 1;
    urlDaQuet[u].soDong++;
  }
  var dsUrl = Object.keys(urlDaQuet).map(function (u) {
    return { url: u, soLanQuet: Object.keys(urlDaQuet[u].soLan).length, soDong: urlDaQuet[u].soDong };
  });
  dsUrl.sort(function (a, b) { return b.soLanQuet - a.soLanQuet || b.soDong - a.soDong; });

  return {
    tongDong: kho.tong,
    lanQuet: lanQuet,
    url: dsUrl,
    mucChon: mucChonLoc(kho.hang),
    loaiBaoCao: LOAI_BAO_CAO,
    cotSanPham: COT_SAN_PHAM.map(function (c) { return { khoa: c, nhan: nhanCot(c) }; }),
    tranDong: TRAN_DONG_GUI_UI,
    sanKhongQuetDuoc: uiSanKhongQuetDuoc(),
    linkBang: uiLinkBang(),
    nguoiDung: Session_email(),
    dangQuetDo: docCon() ? { maLanQuet: docCon().maLanQuet, url: docCon().urlNhap } : null
  };
}

/**
 * The data tab. Filters over everything, returns one page of rows plus aggregates and the
 * trust summary computed over the WHOLE match, not the page.
 */
function apiTruyVan(boLoc, sapXep, trang, moiTrang) {
  var kho = docKhoDuLieu();
  var hang = locHang(kho.hang, boLoc || taoBoLocRong());
  var cotSap = (sapXep && sapXep.cot) ? sapXep.cot : 'ngay_quet';
  var daSap = sapXepHang(hang, cotSap, sapXep ? !!sapXep.giamDan : true);

  var kt = Math.max(1, Math.min(Number(moiTrang) || 100, 500));
  var soTrang = Math.max(1, Math.ceil(daSap.length / kt));
  var t = Math.max(1, Math.min(Number(trang) || 1, soTrang));
  var batDau = (t - 1) * kt;
  var trangHang = daSap.slice(batDau, batDau + kt);

  var gon = [];
  for (var i = 0; i < trangHang.length; i++) {
    var o = {};
    for (var c = 0; c < COT_SAN_PHAM.length; c++) {
      var ten = COT_SAN_PHAM[c];
      if (COT_BO_QUA_KHI_TRUY_VAN.indexOf(ten) >= 0) continue;
      o[ten] = trangHang[i][ten];
    }
    o._ket_luan = trangHang[i]._ket_luan;
    gon.push(o);
  }

  var tk = thongKeSo(hang.map(function (h) { return h.gia_ban; }));
  var tinCay = tomTatTinCay(hang, kho.lanQuet);
  return {
    hang: gon,
    tongKhop: hang.length,
    tongTatCa: kho.tong,
    trang: t,
    soTrang: soTrang,
    moiTrang: kt,
    thongKe: tk,
    tienTe: tienTeChinh(hang),
    tinCay: tinCay,
    canhBao: canhBaoDuLieu(hang, tinCay, {}),
    tomTat: [
      { nhan: 'Dòng khớp', gia_tri: dinhDangSo(hang.length), phu: 'trong ' + dinhDangSo(kho.tong) + ' dòng' },
      { nhan: 'Có giá', gia_tri: Math.round(tinCay.tyLeCoGia * 100) + '%', phu: tk.n + ' dòng' },
      { nhan: 'Trung vị', gia_tri: tk.trungVi === null ? '—' : dinhDangSo(tk.trungVi), phu: tienTeChinh(hang) },
      { nhan: 'Thấp – cao', gia_tri: tk.min === null ? '—' : (dinhDangSo(tk.min) + ' – ' + dinhDangSo(tk.max)), phu: tienTeChinh(hang) },
      { nhan: 'Lần quét', gia_tri: String(tinCay.soLanQuet), phu: 'góp dữ liệu' }
    ]
  };
}

/** The report tab. */
function apiBaoCao(dinhNghia) {
  var kho = docKhoDuLieu();
  return taoBaoCao(dinhNghia, kho);
}

/** Write the current report to the BAO_CAO tab, warnings and all. */
function apiXuatBaoCaoRaSheet(dinhNghia) {
  var bc = apiBaoCao(dinhNghia);
  var phang = baoCaoThanhMang(bc);
  var lo = [];
  lo.push([bc.tieuDe]);
  lo.push([bc.moTa || '']);
  lo.push(['Dựng lúc', nhanThoiGian(), 'bởi', Session_email()]);
  lo.push(['Kết luận tin cậy', bc.tinCay.ketLuan || '(không rõ)', bc.tinCay.cau]);
  lo.push(['Việc cần làm', bc.tinCay.viecCanLam || '']);
  for (var i = 0; i < bc.canhBao.length; i++) {
    lo.push(['Cảnh báo (' + bc.canhBao[i].muc + ')', bc.canhBao[i].cau]);
  }
  lo.push(['Bộ lọc', motaBoLoc(dinhNghia ? dinhNghia.boLoc : null)]);
  lo.push([]);
  lo.push(phang.cot);
  for (var j = 0; j < phang.hang.length; j++) lo.push(phang.hang[j]);
  var soDong = ghiDeBang(TEN_BANG.BAO_CAO, lo);

  var link = '';
  try {
    var ss = layBangTinh();
    var b = ss.getSheetByName(TEN_BANG.BAO_CAO);
    link = ss.getUrl() + (b ? '#gid=' + b.getSheetId() : '');
  } catch (e) { link = ''; }
  return {
    soDong: soDong,
    link: link,
    thongBao: 'Đã ghi báo cáo "' + bc.tieuDe + '" (' + bc.hang.length + ' dòng) vào thẻ ' + TEN_BANG.BAO_CAO +
              '. Thẻ này được dựng lại mỗi lần xuất, nên đừng sửa tay vào đó.'
  };
}

function motaBoLoc(bl) {
  if (!bl) return '(không lọc)';
  var ph = [];
  if (bl.chiMoiNhat) ph.push('chỉ lần quét mới nhất của mỗi địa chỉ');
  if (bl.tenMien && bl.tenMien.length) ph.push('cửa hàng: ' + bl.tenMien.join(', '));
  if (bl.thuongHieu && bl.thuongHieu.length) ph.push('thương hiệu: ' + bl.thuongHieu.join(', '));
  if (bl.danhMuc && bl.danhMuc.length) ph.push('danh mục: ' + bl.danhMuc.join(', '));
  if (bl.ketLuan && bl.ketLuan.length) ph.push('kết luận: ' + bl.ketLuan.join(', '));
  if (bl.maLanQuet && bl.maLanQuet.length) ph.push('lần quét: ' + bl.maLanQuet.join(', '));
  if (bl.conHang) ph.push('kho: ' + bl.conHang);
  if (bl.coGia) ph.push('chỉ dòng có giá');
  if (bl.giaTu !== null && bl.giaTu !== undefined && bl.giaTu !== '') ph.push('giá từ ' + bl.giaTu);
  if (bl.giaDen !== null && bl.giaDen !== undefined && bl.giaDen !== '') ph.push('giá đến ' + bl.giaDen);
  if (bl.tuKhoa) ph.push('từ khoá "' + bl.tuKhoa + '"');
  return ph.length ? ph.join(' · ') : '(không lọc)';
}

/** CSV of the current selection (all matching rows, not just the visible page). */
function apiXuatCsvDuLieu(boLoc, sapXep) {
  var kho = docKhoDuLieu();
  var hang = locHang(kho.hang, boLoc || taoBoLocRong());
  var cotSap = (sapXep && sapXep.cot) ? sapXep.cot : 'ngay_quet';
  hang = sapXepHang(hang, cotSap, sapXep ? !!sapXep.giamDan : true);
  var cot = COT_SAN_PHAM.slice();
  return {
    ten: 'san_pham_' + nhanThoiGian().replace(/[: ]/g, '-') + '.csv',
    soDong: hang.length,
    csv: hangThanhCsv(cot, hang)
  };
}

/** CSV of the current report. */
function apiXuatCsvBaoCao(dinhNghia) {
  var bc = apiBaoCao(dinhNghia);
  var phang = baoCaoThanhMang(bc);
  var hang = phang.hang.map(function (d) {
    var o = {};
    for (var i = 0; i < phang.cot.length; i++) o[phang.cot[i]] = d[i];
    return o;
  });
  return {
    ten: 'bao_cao_' + bc.ma + '_' + nhanThoiGian().replace(/[: ]/g, '-') + '.csv',
    soDong: hang.length,
    // The trust line rides along inside the file: a report pasted into a deck must not
    // lose the sentence that says how much to trust it.
    csv: 'Kết luận tin cậy,' + (bc.tinCay.ketLuan || '') + '\n' +
         '"' + String(bc.tinCay.cau).replace(/"/g, '""') + '"\n\n' +
         hangThanhCsv(phang.cot, hang)
  };
}
