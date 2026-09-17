/**
 * 00_MENU.js — BẮT ĐẦU Ở ĐÂY.
 *
 * Bốn hàm đầu tiên dưới đây không cần tham số: chọn tên hàm trên thanh công cụ của
 * trình soạn thảo Apps Script rồi bấm ▶ là chạy được.
 *
 *   MO_BANG_QUET()          — mở bảng điều khiển (ô nhập link + nút Quét)
 *   QUET_MOT_LINK()         — quét một link ngay
 *   TIEP_TUC_QUET()         — chạy tiếp lần quét bị ngắt giữa chừng (trigger cũng gọi hàm này)
 *   CHAN_DOAN()             — tự kiểm tra: bảng, cài đặt, bộ đọc số, phân loại URL
 *   SO_SANH_HAI_LAN_QUET()  — dựng bảng THAY_DOI từ 2 lần quét gần nhất
 *
 * Mọi lệnh gọi SpreadsheetApp.getUi() đều được bọc try/catch vì nó ném lỗi khi chạy từ
 * trình soạn thảo hoặc từ trigger.
 */

/** Mở bảng quét (thanh bên). Chạy được cả khi không có giao diện. */
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
