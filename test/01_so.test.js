'use strict';
const { nhom, kiemTra, that, bang } = require('./kt');
const { taoMoiTruong } = require('./harness');
const g = taoMoiTruong().g;

nhom('Bộ đọc số tiếng Việt — từ chối chứ không đoán', () => {
  // Bảng trong đặc tả, lấy thẳng từ src/14_TU_KIEM_TRA.js để chỉ có MỘT nguồn sự thật.
  for (const h of g.BANG_SO_VIET_NAM) {
    kiemTra(`"${h.vao}" → ${h.gia === null ? 'null (' + h.ghi + ')' : h.gia}`, () => {
      const kq = g.phanTichGiaNguoiDoc(h.vao);
      bang(kq.gia, h.gia, `phanTichGiaNguoiDoc("${h.vao}")`);
      if (h.gia !== null && h.tienTe !== undefined) bang(kq.tienTe, h.tienTe, 'tiền tệ');
      if (h.gia === null) that(kq.lyDo !== '', 'phải có lý do khi từ chối');
    });
  }

  kiemTra('"3.5" tuyệt đối không được thành 35', () => {
    bang(g.phanTichGiaNguoiDoc('3.5').gia, null);
    bang(g.phanTichGiaNguoiDoc('3,5').gia, null);
  });

  kiemTra('không có ký hiệu tiền tệ thì KHÔNG mặc định VND', () => {
    const kq = g.phanTichGiaNguoiDoc('250.000');
    bang(kq.gia, 250000);
    bang(kq.tienTe, null, 'tiền tệ phải là null, không được đoán VND');
    bang(kq.lyDo, 'khong_thay_ky_hieu_tien_te');
  });

  kiemTra('ghi lại đúng ký hiệu đã bóc', () => {
    const kq = g.phanTichGiaNguoiDoc('1.250.000₫');
    bang(kq.daBo, '₫');
    bang(kq.tienTe, 'VND');
  });

  kiemTra('giá âm bị từ chối', () => bang(g.phanTichGiaNguoiDoc('-250.000').gia, null));
});

nhom('Bộ đọc số của máy (API JSON) tách bạch với bộ đọc của người', () => {
  kiemTra('"259000.00" là 259000 theo hợp đồng của API', () => {
    bang(g.phanTichSoMay('259000.00').gia, 259000);
  });
  kiemTra('cùng chuỗi đó thì bộ đọc của người TỪ CHỐI', () => {
    bang(g.phanTichGiaNguoiDoc('259000.00').gia, null);
  });
  kiemTra('"1.250.000" không phải số máy', () => {
    bang(g.phanTichSoMay('1.250.000').gia, null);
  });
  kiemTra('null/rỗng trả null kèm lý do', () => {
    bang(g.phanTichSoMay(null).gia, null);
    that(g.phanTichSoMay('').lyDo !== '', 'phải có lý do');
  });
});

nhom('Số nguyên và điểm đánh giá', () => {
  kiemTra('"1.234" lượt đánh giá → 1234', () => bang(g.phanTichSoNguyen('1.234').so, 1234));
  kiemTra('"abc" → null', () => bang(g.phanTichSoNguyen('abc').so, null));
  kiemTra('"4.5" sao → 4.5', () => bang(g.phanTichSao('4.5').sao, 4.5));
  kiemTra('"9" sao → null (ngoài khoảng 0–5)', () => bang(g.phanTichSao('9').sao, null));
});

nhom('Cảnh báo giá khó tin', () => {
  kiemTra('3.5 VND bị đánh dấu khó tin chứ không bị sửa', () => {
    const kq = g.phanTichGiaLinhHoat('3.5', 'VND');
    bang(kq.gia, 3.5, 'không được tự nhân lên');
    that(kq.canhBao !== '', 'phải có cảnh báo');
  });
});
