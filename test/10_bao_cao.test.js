'use strict';
const { nhom, kiemTra, that, bang } = require('./kt');
const { taoMoiTruong } = require('./harness');
const { napDuLieuMau } = require('./du_lieu_mau');

function moiTruong() { return napDuLieuMau(taoMoiTruong()); }
function chiDura(g) { const b = g.taoBoLocRong(); b.tenMien = ['durahome.vn']; return b; }

nhom('Báo cáo 1 — Bậc thang giá', () => {
  const env = moiTruong();
  const bc = env.g.apiBaoCao({ ma: 'BANG_GIA', boLoc: env.g.taoBoLocRong(), thamSo: { nhomTheo: 'ten_mien' } });

  kiemTra('mỗi cửa hàng một dòng, có min / trung vị / max', () => {
    bang(bc.hang.length, 2);
    const d = bc.hang.find(x => x.nhom === 'durahome.vn');
    bang(d.min, 120000);
    bang(d.trungVi, 350000);
    bang(d.max, 700000);
  });
  kiemTra('có ô thống kê và biểu đồ khoảng giá', () => {
    bang(bc.tomTat.length, 5);
    bang(bc.bieuDo.kieu, 'thanh_khoang');
    bang(bc.bieuDo.diem.length, 2);
    that(bc.bieuDo.diem[0].min <= bc.bieuDo.diem[0].giua, 'min phải <= trung vị');
    that(bc.bieuDo.diem[0].giua <= bc.bieuDo.diem[0].max, 'trung vị phải <= max');
  });
  kiemTra('báo cáo mang kết luận THAP vì trộn nguồn', () => {
    bang(bc.tinCay.ketLuan, 'THAP');
    that(bc.tinCay.lanQuet.length === 2, 'phải liệt kê 2 lần quét góp dữ liệu');
    that(bc.tinCay.viecCanLam.indexOf('đầu mối') > 0, bc.tinCay.viecCanLam);
  });
  kiemTra('biểu đồ bậc thang xếp theo trung vị giảm dần', () => {
    const tv = bc.bieuDo.diem.map(d => d.giua);
    for (let i = 1; i < tv.length; i++) that(tv[i] <= tv[i - 1], 'sai thứ tự bậc thang: ' + tv.join(', '));
  });
  kiemTra('nhóm theo thương hiệu cũng chạy', () => {
    const b2 = env.g.apiBaoCao({ ma: 'BANG_GIA', boLoc: env.g.taoBoLocRong(), thamSo: { nhomTheo: 'thuong_hieu' } });
    bang(b2.hang.map(x => x.nhom).sort(), ['Durahome', 'ĐốiThủ']);
  });
  kiemTra('cột "% có giá" phản ánh đúng dữ liệu thiếu', () => {
    const doi = bc.hang.find(x => x.nhom === 'doithu.vn');
    bang(Math.round(doi.tyLeCoGia * 100), 75);
  });
});

nhom('Báo cáo 2 — Phân bố giá', () => {
  const env = moiTruong();
  const bc = env.g.apiBaoCao({ ma: 'PHAN_BO_GIA', boLoc: env.g.taoBoLocRong(), thamSo: {} });
  kiemTra('tổng các cột bằng số dòng có giá', () => {
    const tong = bc.hang.reduce((a, d) => a + d.so, 0);
    bang(tong, 9);
  });
  kiemTra('biểu đồ cột có nhãn khoảng đọc được', () => {
    bang(bc.bieuDo.kieu, 'cot');
    that(/\d+\.\d{3}/.test(bc.bieuDo.diem[0].nhan), 'nhãn phải có dấu chấm ngăn nghìn: ' + bc.bieuDo.diem[0].nhan);
  });
  kiemTra('tỷ lệ cộng lại xấp xỉ 100%', () => {
    const tong = bc.hang.reduce((a, d) => a + d.tyLe, 0);
    that(Math.abs(tong - 1) < 1e-9, 'tổng tỷ lệ = ' + tong);
  });
});

nhom('Báo cáo 3 — So sánh cửa hàng', () => {
  const env = moiTruong();
  const bc = env.g.apiBaoCao({ ma: 'SO_SANH_DOI_THU', boLoc: env.g.taoBoLocRong(), thamSo: { nhomTheo: 'danh_muc' } });

  kiemTra('cột là cửa hàng, dòng là danh mục', () => {
    bang(bc.cot[0].nhan, 'Danh mục');
    const tenCot = bc.cot.map(c => c.nhan);
    that(tenCot.indexOf('durahome.vn') > 0, tenCot.join(','));
    that(tenCot.indexOf('doithu.vn') > 0, tenCot.join(','));
    bang(tenCot[tenCot.length - 1], 'Rẻ nhất');
  });
  kiemTra('ô là trung vị của cửa hàng đó trong danh mục đó', () => {
    const nhaTam = bc.hang.find(x => x.nhom === 'Nhà tắm');
    const iDura = bc.cot.findIndex(c => c.nhan === 'durahome.vn') - 1;
    const iDoi = bc.cot.findIndex(c => c.nhan === 'doithu.vn') - 1;
    bang(nhaTam['c' + iDura], 300000);
    bang(nhaTam['c' + iDoi], 250000);
  });
  kiemTra('nơi rẻ nhất được ghi bằng CHỮ, không chỉ bằng màu', () => {
    const nhaTam = bc.hang.find(x => x.nhom === 'Nhà tắm');
    bang(nhaTam.reNhat, '↓ doithu.vn');
  });
  kiemTra('ô trống khi cửa hàng không có sản phẩm trong nhóm', () => {
    const nhaBep = bc.hang.find(x => x.nhom === 'Nhà bếp');
    const iDoi = bc.cot.findIndex(c => c.nhan === 'doithu.vn') - 1;
    bang(nhaBep['c' + iDoi], null);
  });
  kiemTra('nhắc rằng danh mục do cửa hàng tự đặt tên', () => {
    that(bc.canhBao.some(c => c.cau.indexOf('tự đặt tên') > 0), JSON.stringify(bc.canhBao));
  });
  kiemTra('chỉ 1 cửa hàng thì nói thẳng là không so được', () => {
    const b = env.g.apiBaoCao({ ma: 'SO_SANH_DOI_THU', boLoc: chiDura(env.g), thamSo: {} });
    that(b.canhBao.some(c => c.cau.indexOf('không có gì để so sánh') > 0), JSON.stringify(b.canhBao));
  });
});

nhom('Báo cáo 4 — Thay đổi giữa 2 lần quét', () => {
  const env = moiTruong();
  const bc = env.g.apiBaoCao({ ma: 'THAY_DOI', boLoc: env.g.taoBoLocRong(), thamSo: { nguonUrl: 'https://durahome.vn/' } });

  kiemTra('nhận ra tăng giá, sản phẩm mới và sản phẩm mất', () => {
    const loai = {};
    bc.hang.forEach(h => { loai[h.loai_thay_doi] = (loai[h.loai_thay_doi] || 0) + 1; });
    bang(loai.TANG_GIA, 1);
    bang(loai.MOI, 1);
    bang(loai.MAT, 1);
  });
  kiemTra('ghi đúng giá cũ, giá mới và chênh lệch', () => {
    const tang = bc.hang.find(h => h.loai_thay_doi === 'TANG_GIA');
    bang(tang.gia_cu, 100000);
    bang(tang.gia_moi, 120000);
    bang(tang.chenh_lech, 20000);
    bang(tang.phan_tram, 20);
  });
  kiemTra('nêu khoảng cách giữa 2 lần quét', () => {
    that(bc.moTa.indexOf('9 ngày') > 0, bc.moTa);
  });
  kiemTra('cảnh báo rằng "MẤT" chưa chắc là bị gỡ', () => {
    that(bc.canhBao.some(c => c.cau.indexOf('chạm trần số trang') > 0), JSON.stringify(bc.canhBao));
  });
  kiemTra('địa chỉ mới quét 1 lần thì nói rõ, không dựng bảng rỗng', () => {
    const b = env.g.apiBaoCao({ ma: 'THAY_DOI', boLoc: env.g.taoBoLocRong(), thamSo: { nguonUrl: 'https://doithu.vn/' } });
    bang(b.hang.length, 0);
    that(b.canhBao[0].cau.indexOf('Cần ít nhất 2 lần quét') > 0, b.canhBao[0].cau);
  });
});

nhom('Báo cáo 5 — Chất lượng dữ liệu', () => {
  const env = moiTruong();
  const bc = env.g.apiBaoCao({ ma: 'CHAT_LUONG', boLoc: env.g.taoBoLocRong(), thamSo: {} });

  kiemTra('mỗi lần quét một dòng, mới nhất lên đầu', () => {
    bang(bc.hang.length, 3);
    bang(bc.hang[0].ma_lan_quet, 'LQ-C');
  });
  kiemTra('tỷ lệ điền được đo lại từ chính dữ liệu, không chép từ sổ', () => {
    const b = bc.hang.find(x => x.ma_lan_quet === 'LQ-B');
    bang(Math.round(b.fill_gia_ban * 100), 75);
    bang(Math.round(b.fill_ten * 100), 100);
    bang(Math.round(b.fill_so_luong_ton * 100), 0);
  });
  kiemTra('không chịu tác động của bộ lọc (đây là sổ tin cậy)', () => {
    const b = env.g.apiBaoCao({ ma: 'CHAT_LUONG', boLoc: chiDura(env.g), thamSo: {} });
    bang(b.hang.length, 3, 'vẫn phải hiện đủ 3 lần quét');
  });
  kiemTra('đếm đúng số lần quét theo từng kết luận', () => {
    const t = {};
    bc.tomTat.forEach(x => { t[x.nhan] = x.gia_tri; });
    bang(t['CAO'], '2');
    bang(t['THẤP'], '1');
  });
});

nhom('Lớp cảnh báo — nói ra điều có thể làm báo cáo sai', () => {
  const env = taoMoiTruong();
  const g = env.g;

  kiemTra('trộn tiền tệ là cảnh báo NẶNG', () => {
    const hang = [{ gia_ban: 100, tien_te: 'VND' }, { gia_ban: 5, tien_te: 'USD' }];
    const cb = g.canhBaoDuLieu(hang, { ketLuan: 'CAO', lanQuet: [] }, {});
    const nang = cb.filter(c => c.muc === 'nang');
    that(nang.length > 0, JSON.stringify(cb));
    that(nang[0].cau.indexOf('VÔ NGHĨA') > 0, nang[0].cau);
  });
  kiemTra('thiếu giá trên 30% là cảnh báo NẶNG', () => {
    const hang = [{ gia_ban: 100, tien_te: 'VND' }, { gia_ban: '' }, { gia_ban: '' }];
    const cb = g.canhBaoDuLieu(hang, { ketLuan: 'CAO', lanQuet: [] }, {});
    that(cb.some(c => c.muc === 'nang' && c.cau.indexOf('có giá') > 0), JSON.stringify(cb));
  });
  kiemTra('tiền tệ trống nhiều thì nhắc là công cụ KHÔNG mặc định VND', () => {
    const hang = [{ gia_ban: 100, tien_te: '' }, { gia_ban: 200, tien_te: '' }];
    const cb = g.canhBaoDuLieu(hang, { ketLuan: 'CAO', lanQuet: [] }, {});
    that(cb.some(c => c.cau.indexOf('không mặc định VND') > 0), JSON.stringify(cb));
  });
  kiemTra('các lần quét cách nhau quá lâu thì cảnh báo so sánh lệch thời điểm', () => {
    const tinCay = { ketLuan: 'CAO', lanQuet: [{ ngay: '2026-01-01 08:00:00' }, { ngay: '2026-09-01 08:00:00' }] };
    const cb = g.canhBaoDuLieu([{ gia_ban: 1, tien_te: 'VND' }], tinCay, {});
    that(cb.some(c => c.cau.indexOf('cách nhau tới') > 0), JSON.stringify(cb));
  });
  kiemTra('nhóm quá nhỏ thì nhắc trung vị dễ lệch', () => {
    const cb = g.canhBaoDuLieu([{ gia_ban: 1, tien_te: 'VND' }], { ketLuan: 'CAO', lanQuet: [] }, { nhomNho: ['A', 'B'] });
    that(cb.some(c => c.cau.indexOf('dễ lệch') > 0), JSON.stringify(cb));
  });
  kiemTra('dữ liệu sạch từ một lần quét CAO thì KHÔNG bịa cảnh báo', () => {
    const cb = g.canhBaoDuLieu([{ gia_ban: 1000, tien_te: 'VND' }], { ketLuan: 'CAO', lanQuet: [{ ngay: '2026-09-01 08:00:00' }] }, {});
    bang(cb, []);
  });
});

nhom('Xuất báo cáo', () => {
  const env = moiTruong();
  const dn = { ma: 'BANG_GIA', boLoc: env.g.taoBoLocRong(), thamSo: { nhomTheo: 'ten_mien' } };

  kiemTra('ghi ra thẻ BAO_CAO kèm kết luận tin cậy và cảnh báo', () => {
    const kq = env.g.apiXuatBaoCaoRaSheet(dn);
    that(kq.soDong > 5, 'phải ghi được dòng');
    const b = env.bangTinh.getSheetByName('BAO_CAO');
    const o = b.getRange(1, 1, b.getLastRow(), 4).getValues().map(r => r.join(' | '));
    that(o[0].indexOf('Bậc thang giá') >= 0, o[0]);
    that(o.some(d => d.indexOf('Kết luận tin cậy | THAP') >= 0), o.join('\n'));
    that(o.some(d => d.indexOf('Cảnh báo') >= 0), 'phải chép cảnh báo vào thẻ');
    that(o.some(d => d.indexOf('Bộ lọc') >= 0), 'phải ghi lại bộ lọc đã dùng');
  });
  kiemTra('xuất lại thì DỰNG LẠI thẻ, không chồng thêm', () => {
    const b = env.bangTinh.getSheetByName('BAO_CAO');
    const lan1 = b.getLastRow();
    env.g.apiXuatBaoCaoRaSheet(dn);
    bang(env.bangTinh.getSheetByName('BAO_CAO').getLastRow(), lan1);
  });
  kiemTra('SAN_PHAM không hề bị đụng tới khi xuất báo cáo', () => {
    bang(env.docBang('SAN_PHAM').length, 16);
  });
  kiemTra('CSV báo cáo mang theo câu kết luận tin cậy', () => {
    const kq = env.g.apiXuatCsvBaoCao(dn);
    that(kq.csv.indexOf('Kết luận tin cậy,THAP') === 0, kq.csv.substring(0, 120));
    that(kq.ten.indexOf('bao_cao_BANG_GIA') === 0, kq.ten);
  });
  kiemTra('CSV dữ liệu xuất TOÀN BỘ dòng khớp, không chỉ trang đang xem', () => {
    const kq = env.g.apiXuatCsvDuLieu(env.g.taoBoLocRong(), null);
    bang(kq.soDong, 10);
    bang(kq.csv.split('\n').length, 11);
  });
});

nhom('API khởi tạo cho giao diện', () => {
  const env = moiTruong();
  const kq = env.g.apiKhoiTao();
  kiemTra('trả đủ thứ màn hình cần trong MỘT lần gọi', () => {
    bang(kq.tongDong, 16);
    bang(kq.lanQuet.length, 3);
    bang(kq.lanQuet[0].ma_lan_quet, 'LQ-C', 'mới nhất lên đầu');
    bang(kq.loaiBaoCao.length, 5);
    that(kq.mucChon.tenMien.length === 2);
    that(kq.sanKhongQuetDuoc.length >= 4, 'phải nêu các sàn không quét được');
  });
  kiemTra('liệt kê địa chỉ đã quét kèm số lần quét, để chọn báo cáo thay đổi', () => {
    const dura = kq.url.find(u => u.url === 'https://durahome.vn/');
    bang(dura.soLanQuet, 2);
    bang(dura.soDong, 12);
  });
});
