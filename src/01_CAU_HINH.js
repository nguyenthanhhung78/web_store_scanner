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
