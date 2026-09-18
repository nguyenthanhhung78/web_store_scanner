'use strict';
const { nhom, kiemTra, that, bang } = require('./kt');
const { taoMoiTruong } = require('./harness');
const { napDuLieuMau } = require('./du_lieu_mau');

function moiTruong() { return napDuLieuMau(taoMoiTruong()); }

nhom('Đọc kho dữ liệu và gắn kết luận vào từng dòng', () => {
  const env = moiTruong();
  const kho = env.g.docKhoDuLieu();
  kiemTra('đọc đủ 16 dòng của 3 lần quét', () => {
    bang(kho.tong, 16);
    bang(Object.keys(kho.lanQuet).sort(), ['LQ-A', 'LQ-B', 'LQ-C']);
  });
  kiemTra('mỗi dòng mang theo kết luận của lần quét sinh ra nó', () => {
    const b = kho.hang.filter(h => h.ma_lan_quet === 'LQ-B');
    that(b.length > 0);
    that(b.every(h => h._ket_luan === 'THAP'), 'dòng của LQ-B phải mang kết luận THAP');
  });
});

nhom('Lọc', () => {
  const env = moiTruong();
  const kho = env.g.docKhoDuLieu();
  const bl = () => env.g.taoBoLocRong();

  kiemTra('mặc định chỉ lấy lần quét MỚI NHẤT của mỗi địa chỉ', () => {
    const h = env.g.locHang(kho.hang, bl());
    bang(h.length, 10, 'LQ-C (6) + LQ-B (4), bỏ LQ-A vì đã có bản mới hơn');
    that(!h.some(x => x.ma_lan_quet === 'LQ-A'), 'không được lẫn lần quét cũ');
  });
  kiemTra('tắt "chỉ mới nhất" thì thấy cả lịch sử', () => {
    const b = bl(); b.chiMoiNhat = false;
    bang(env.g.locHang(kho.hang, b).length, 16);
  });
  kiemTra('lọc theo cửa hàng', () => {
    const b = bl(); b.tenMien = ['doithu.vn'];
    const h = env.g.locHang(kho.hang, b);
    bang(h.length, 4);
    that(h.every(x => x.ten_mien === 'doithu.vn'));
  });
  kiemTra('lọc theo danh mục và thương hiệu', () => {
    const b = bl(); b.danhMuc = ['Nhà bếp'];
    bang(env.g.locHang(kho.hang, b).length, 1);
    const b2 = bl(); b2.thuongHieu = ['ĐốiThủ'];
    bang(env.g.locHang(kho.hang, b2).length, 4);
  });
  kiemTra('lọc theo khoảng giá — dòng không có giá bị loại khỏi khoảng', () => {
    const b = bl(); b.giaTu = 200000; b.giaDen = 400000;
    const h = env.g.locHang(kho.hang, b);
    that(h.every(x => Number(x.gia_ban) >= 200000 && Number(x.gia_ban) <= 400000));
    bang(h.length, 5);
  });
  kiemTra('lọc "chỉ dòng có giá"', () => {
    const b = bl(); b.coGia = true;
    bang(env.g.locHang(kho.hang, b).length, 9, 'bỏ đúng 1 dòng thiếu giá của LQ-B');
  });
  kiemTra('lọc theo kết luận của lần quét nguồn', () => {
    const b = bl(); b.ketLuan = ['THAP'];
    const h = env.g.locHang(kho.hang, b);
    bang(h.length, 4);
    that(h.every(x => x.ten_mien === 'doithu.vn'));
  });
  kiemTra('lọc theo tình trạng kho', () => {
    const b = bl(); b.conHang = 'HET'; b.chiMoiNhat = false;
    const h = env.g.locHang(kho.hang, b);
    that(h.length > 0);
    that(h.every(x => x.con_hang === 'HET'));
  });
  kiemTra('tìm theo từ khoá, không phân biệt hoa thường', () => {
    const b = bl(); b.tuKhoa = 'ĐỐI THỦ'.toLowerCase();
    bang(env.g.locHang(kho.hang, b).length, 4);
    const b2 = bl(); b2.tuKhoa = 'dh-9';
    bang(env.g.locHang(kho.hang, b2).length, 1);
  });
  kiemTra('nhiều bộ lọc cùng lúc là phép AND', () => {
    const b = bl(); b.tenMien = ['durahome.vn']; b.danhMuc = ['Nhà tắm']; b.coGia = true;
    const h = env.g.locHang(kho.hang, b);
    bang(h.length, 5);
    that(h.every(x => x.ma_lan_quet === 'LQ-C'));
  });
});

nhom('Sắp xếp', () => {
  const env = moiTruong();
  const kho = env.g.docKhoDuLieu();
  kiemTra('sắp theo số, không phải theo chuỗi', () => {
    const h = env.g.sapXepHang(kho.hang.filter(x => x.gia_ban !== ''), 'gia_ban', false);
    const gia = h.map(x => Number(x.gia_ban));
    for (let i = 1; i < gia.length; i++) that(gia[i] >= gia[i - 1], 'sai thứ tự ở vị trí ' + i);
  });
  kiemTra('ô trống luôn xuống cuối, theo cả 2 chiều', () => {
    const tang = env.g.sapXepHang(kho.hang, 'gia_ban', false);
    const giam = env.g.sapXepHang(kho.hang, 'gia_ban', true);
    bang(tang[tang.length - 1].gia_ban, '');
    bang(giam[giam.length - 1].gia_ban, '');
  });
});

nhom('Thống kê — trả null chứ không trả 0 khi không có dữ liệu', () => {
  const g = taoMoiTruong().g;
  kiemTra('trung vị số lẻ và số chẵn phần tử', () => {
    bang(g.thongKeSo([1, 2, 3]).trungVi, 2);
    bang(g.thongKeSo([1, 2, 3, 4]).trungVi, 2.5);
  });
  kiemTra('phân vị 25/75', () => {
    const tk = g.thongKeSo([100, 200, 300, 400, 500]);
    bang(tk.p25, 200);
    bang(tk.p75, 400);
    bang(tk.min, 100);
    bang(tk.max, 500);
  });
  kiemTra('danh sách rỗng → null hết, KHÔNG phải 0', () => {
    const tk = g.thongKeSo([]);
    bang(tk.n, 0);
    bang(tk.min, null);
    bang(tk.trungVi, null);
    bang(tk.trungBinh, null);
  });
  kiemTra('bỏ qua ô trống thay vì coi là 0', () => {
    const tk = g.thongKeSo([100, '', null, 300]);
    bang(tk.n, 2);
    bang(tk.trungBinh, 200);
  });
});

nhom('Gom nhóm và chia khoảng', () => {
  const env = moiTruong();
  const kho = env.g.docKhoDuLieu();
  const hang = env.g.locHang(kho.hang, env.g.taoBoLocRong());

  kiemTra('gom theo cửa hàng ra đúng số dòng và trung vị', () => {
    const n = env.g.gomNhomTheoGia(hang, 'ten_mien');
    const dura = n.find(x => x.nhom === 'durahome.vn');
    const doi = n.find(x => x.nhom === 'doithu.vn');
    bang(dura.soDong, 6);
    bang(dura.trungVi, 350000);
    bang(doi.soDong, 4);
    bang(doi.soCoGia, 3);
    bang(doi.trungVi, 250000);
    bang(Math.round(doi.tyLeCoGia * 100), 75);
  });
  kiemTra('nhóm trống được đặt tên rõ ràng, không bị bỏ im', () => {
    const n = env.g.gomNhomTheoGia([{ thuong_hieu: '', gia_ban: 1000 }], 'thuong_hieu');
    bang(n[0].nhom, '(không ghi)');
  });
  kiemTra('bước chia khoảng là số tròn 1/2/5×10^n', () => {
    bang(env.g.lamTronBuoc(37), 50);
    bang(env.g.lamTronBuoc(12000), 20000);
    bang(env.g.lamTronBuoc(0.7), 1);
  });
  kiemTra('histogram đếm đủ số dòng có giá', () => {
    const kq = env.g.chiaKhoangGia(hang, 6);
    const tong = kq.khoang.reduce((a, k) => a + k.so, 0);
    bang(tong, 9);
    bang(kq.min, 120000);
    bang(kq.max, 700000);
  });
  kiemTra('tiền tệ trộn được nêu rõ chứ không chọn bừa', () => {
    bang(env.g.tienTeChinh([{ tien_te: 'VND' }, { tien_te: 'VND' }]), 'VND');
    bang(env.g.tienTeChinh([{ tien_te: 'VND' }, { tien_te: 'USD' }]), 'VND (+1 đơn vị khác)');
    bang(env.g.tienTeChinh([{ tien_te: '' }]), '');
  });
});

nhom('TIN CẬY LAN TRUYỀN — bảng trộn CAO với THAP thì cả bảng là THAP', () => {
  const env = moiTruong();
  const kho = env.g.docKhoDuLieu();

  kiemTra('chỉ durahome.vn (CAO) → CAO', () => {
    const b = env.g.taoBoLocRong(); b.tenMien = ['durahome.vn'];
    const tc = env.g.tomTatTinCay(env.g.locHang(kho.hang, b), kho.lanQuet);
    bang(tc.ketLuan, 'CAO');
    bang(tc.soLanQuet, 1);
  });
  kiemTra('trộn durahome.vn (CAO) với doithu.vn (THAP) → THAP', () => {
    const tc = env.g.tomTatTinCay(env.g.locHang(kho.hang, env.g.taoBoLocRong()), kho.lanQuet);
    bang(tc.ketLuan, 'THAP', 'kết luận xấu nhất phải thắng');
    bang(tc.soLanQuet, 2);
    that(tc.cau.indexOf('trộn từ 2 lần quét') > 0, tc.cau);
    that(tc.viecCanLam.length > 10, 'phải nói việc cần làm');
  });
  kiemTra('thứ tự xấu dần: CAO < TRUNG_BINH < THAP < KHONG_QUET_DUOC', () => {
    bang(env.g.ketLuanXauNhat(['CAO', 'TRUNG_BINH']), 'TRUNG_BINH');
    bang(env.g.ketLuanXauNhat(['THAP', 'CAO']), 'THAP');
    bang(env.g.ketLuanXauNhat(['KHONG_QUET_DUOC', 'THAP']), 'KHONG_QUET_DUOC');
    bang(env.g.ketLuanXauNhat([]), '');
  });
  kiemTra('không có dòng nào thì nói thẳng là không có', () => {
    const tc = env.g.tomTatTinCay([], kho.lanQuet);
    bang(tc.soDong, 0);
    that(tc.cau.indexOf('Không có dòng nào') === 0, tc.cau);
  });
});

nhom('Danh sách chọn cho bộ lọc', () => {
  const env = moiTruong();
  const kho = env.g.docKhoDuLieu();
  kiemTra('gom giá trị riêng biệt kèm số đếm, nhiều nhất lên trước', () => {
    const mc = env.g.mucChonLoc(kho.hang);
    bang(mc.tenMien[0].gia_tri, 'durahome.vn');
    bang(mc.tenMien[0].so, 12);
    bang(mc.tenMien[1].gia_tri, 'doithu.vn');
    bang(mc.danhMuc.map(x => x.gia_tri).sort(), ['Nhà bếp', 'Nhà tắm']);
  });
});

nhom('Xuất CSV', () => {
  const g = taoMoiTruong().g;
  kiemTra('bọc ngoặc kép khi ô có dấu phẩy, xuống dòng hoặc ngoặc kép', () => {
    const csv = g.hangThanhCsv(['a', 'b'], [{ a: 'x,y', b: 'nói "thế"' }, { a: 'dòng\nmới', b: 1000 }]);
    const d = csv.split('\n');
    bang(d[0], 'a,b');
    bang(d[1], '"x,y","nói ""thế"""');
  });
  kiemTra('ô trống vẫn là ô trống, không thành 0', () => {
    bang(g.hangThanhCsv(['a'], [{ a: '' }, { a: null }]), 'a\n\n');
  });
});

nhom('API truy vấn: số liệu tính trên TOÀN BỘ dòng khớp, không chỉ trang đang xem', () => {
  const env = moiTruong();
  const bl = env.g.taoBoLocRong();
  const kq = env.g.apiTruyVan(bl, { cot: 'gia_ban', giamDan: false }, 1, 3);

  kiemTra('trang 1 chỉ trả 3 dòng', () => bang(kq.hang.length, 3));
  kiemTra('nhưng tổng khớp và thống kê tính trên cả 10 dòng', () => {
    bang(kq.tongKhop, 10);
    bang(kq.soTrang, 4);
    bang(kq.thongKe.n, 9);
    bang(kq.thongKe.trungVi, 300000);
  });
  kiemTra('kết luận tin cậy của truy vấn là THAP vì có trộn doithu.vn', () => {
    bang(kq.tinCay.ketLuan, 'THAP');
    that(kq.tinCay.cau.indexOf('THAP') > 0, kq.tinCay.cau);
    that(kq.tinCay.viecCanLam.length > 10, 'phải kèm việc cần làm');
  });
  kiemTra('câu kết luận KHÔNG bị lặp lại trong danh sách cảnh báo', () => {
    that(!kq.canhBao.some(c => c.cau.indexOf('trộn từ 2 lần quét') >= 0),
      'cảnh báo không được chép lại câu đã có trong khối tin cậy: ' + JSON.stringify(kq.canhBao));
  });
  kiemTra('không gửi cột mô tả dài cho trình duyệt', () => {
    that(kq.hang[0].mo_ta_ngan === undefined, 'mo_ta_ngan phải bị loại khỏi payload');
    that(kq.hang[0].gia_ban !== undefined);
  });
  kiemTra('trang vượt quá thì kẹp về trang cuối, không lỗi', () => {
    const k2 = env.g.apiTruyVan(bl, null, 99, 3);
    bang(k2.trang, 4);
  });
});
