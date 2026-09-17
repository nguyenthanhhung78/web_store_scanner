/**
 * 13_GIAO_DIEN.js — server side of the sidebar / web app.
 * Every string that reaches the operator is Vietnamese.
 */

/** Web app entry point. Deploy as "Ứng dụng web" if you want a full-page UI. */
function doGet() {
  return HtmlService.createTemplateFromFile('BangQuet')
    .evaluate()
    .setTitle('Quét cửa hàng — Durahome')
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
      .addItem('Mở bảng quét', 'MO_BANG_QUET')
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
