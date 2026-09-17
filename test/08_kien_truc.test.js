'use strict';
/**
 * Ràng buộc kiến trúc: đây là những điều khoản "không được vi phạm" trong đặc tả,
 * kiểm tra thẳng trên mã nguồn để hai năm nữa vẫn còn đúng.
 */
const fs = require('fs');
const path = require('path');
const { nhom, kiemTra, that, bang } = require('./kt');
const { taoMoiTruong, docFixture } = require('./harness');

const THU_MUC = path.join(__dirname, '..', 'src');
const tep = fs.readdirSync(THU_MUC).filter(f => f.endsWith('.js'));
const ma = {};
for (const f of tep) ma[f] = fs.readFileSync(path.join(THU_MUC, f), 'utf8');

function tepChua(chuoi) {
  return tep.filter(f => ma[f].indexOf(chuoi) >= 0);
}

/** Tìm chuỗi trong mã THỰC SỰ chạy, bỏ qua dòng chú thích. */
function tepGoi(chuoi) {
  return tep.filter(f => ma[f].split('\n').some(d => {
    const t = d.trim();
    if (t.indexOf('*') === 0 || t.indexOf('//') === 0) return false;
    return d.indexOf(chuoi) >= 0;
  }));
}

nhom('MỘT tầng mạng duy nhất', () => {
  kiemTra('UrlFetchApp chỉ xuất hiện trong 05_MANG_LUOI.js', () => {
    // (Tên UrlFetchApp có xuất hiện trong vài câu giải thích tiếng Việt cho người dùng;
    //  ở đây kiểm tra lời GỌI thật sự, tức là "UrlFetchApp.".)
    bang(tepGoi('UrlFetchApp.'), ['05_MANG_LUOI.js']);
  });
  kiemTra('không bộ bóc tách nào gọi mạng', () => {
    for (const f of ['06_HTML.js', '07_BOC_TACH.js', '08_KET_LUAN.js', '03_SO.js', '02_URL.js', '04_ROBOTS.js']) {
      that(tepGoi('layNoiDung(').indexOf(f) < 0 && tepGoi('UrlFetchApp.').indexOf(f) < 0, f + ' không được chạm mạng');
    }
  });
  kiemTra('mọi lần gọi mạng đều bắt buộc có bối cảnh (để đếm trần và giữ lịch sự)', () => {
    const env = taoMoiTruong();
    let nem = '';
    try { env.g.layNoiDung('https://a.vn/', {}); } catch (e) { nem = e.message; }
    that(nem.indexOf('boiCanh') > 0, 'phải ném lỗi khi thiếu bối cảnh, nhận: ' + nem);
  });
});

nhom('MỘT nơi ghi bảng duy nhất', () => {
  kiemTra('setValues chỉ xuất hiện trong 10_GHI_BANG.js', () => {
    bang(tepGoi('setValues'), ['10_GHI_BANG.js']);
  });
  kiemTra('không có appendRow ở bất cứ đâu', () => {
    bang(tepGoi('appendRow('), []);
  });
  kiemTra('một lô 20 dòng = đúng MỘT lần setValues', () => {
    const env = taoMoiTruong();
    env.dinhTuyen(/robots\.txt$/, { code: 404, body: '' });
    env.dinhTuyen(/products\.json\?limit=250&page=1$/, { code: 200, body: docFixture('bac1_shopify_products.json'), kieu: 'application/json' });
    env.dinhTuyen(/products\.json/, { code: 200, body: '{"products":[]}', kieu: 'application/json' });
    env.dinhTuyen(/.*/, { code: 200, body: docFixture('trang_chu_shopify.html') });
    env.g.batDauQuet('https://durahome.vn', '');
    const ghiSp = env.nhatKyGhi.filter(x => x.bang === 'SAN_PHAM' && x.dongDau > 1);
    bang(ghiSp.length, 1, 'phải chỉ có 1 lần ghi dữ liệu: ' + JSON.stringify(ghiSp));
    bang(ghiSp[0].soDong, 20);
  });
});

nhom('Chỉ ghi thêm, không sửa dữ liệu cũ', () => {
  kiemTra('lần quét sau ghi xuống dưới, không đụng dòng của lần quét trước', () => {
    const env = taoMoiTruong();
    env.dinhTuyen(/robots\.txt$/, { code: 404, body: '' });
    env.dinhTuyen(/products\.json\?limit=250&page=1$/, { code: 200, body: docFixture('bac1_shopify_products.json'), kieu: 'application/json' });
    env.dinhTuyen(/products\.json/, { code: 200, body: '{"products":[]}', kieu: 'application/json' });
    env.dinhTuyen(/.*/, { code: 200, body: docFixture('trang_chu_shopify.html') });
    env.g.batDauQuet('https://durahome.vn', '');
    env.g.batDauQuet('https://durahome.vn', '');
    bang(env.docBang('SAN_PHAM').length, 40);
    const ghi = env.nhatKyGhi.filter(x => x.bang === 'SAN_PHAM' && x.dongDau > 1).map(x => x.dongDau);
    bang(ghi, [2, 22], 'lô thứ hai phải bắt đầu ngay sau lô thứ nhất');
  });
});

nhom('An toàn khi ghi vào Sheets', () => {
  kiemTra('tên sản phẩm bắt đầu bằng "=" không biến thành công thức', () => {
    const env = taoMoiTruong();
    const du = { products: [{ id: 1, title: '=SUM(A1:A9) Thảm', handle: 'x', variants: [{ id: 2, price: '1000.00', sku: '-A1' }] }] };
    env.dinhTuyen(/robots\.txt$/, { code: 404, body: '' });
    env.dinhTuyen(/products\.json\?limit=250&page=1$/, { code: 200, body: JSON.stringify(du), kieu: 'application/json' });
    env.dinhTuyen(/products\.json/, { code: 200, body: '{"products":[]}', kieu: 'application/json' });
    env.dinhTuyen(/.*/, { code: 200, body: '<html><body><h1>Shop</h1></body></html>' });
    env.g.batDauQuet('https://cthuc.vn', '');
    const sp = env.docBang('SAN_PHAM');
    bang(sp[0].ten, "'=SUM(A1:A9) Thảm");
    bang(sp[0].sku, "'-A1");
  });
});

nhom('Không bịa giá trị', () => {
  kiemTra('hàm dat() không bao giờ ghi 0 hay "N/A" thay cho ô trống', () => {
    const h = taoMoiTruong().g.hangTrong();
    const g = taoMoiTruong().g;
    g.dat(h, 'gia_ban', null, 'khong_co_gia');
    g.dat(h, 'so_luong_ton', undefined, 'khong_co_ton');
    g.dat(h, 'danh_gia_sao', '', 'khong_co_danh_gia');
    bang(h.gia_ban, '');
    bang(h.so_luong_ton, '');
    bang(h.danh_gia_sao, '');
    bang(Object.keys(h._thieu).sort(), ['danh_gia_sao', 'gia_ban', 'so_luong_ton']);
  });
  kiemTra('mỗi ô trống đều có lý do kèm theo', () => {
    const g = taoMoiTruong().g;
    const hang = g.bocTachProductsJson(JSON.parse(docFixture('bac1_shopify_products.json')),
      { url: 'https://a.vn/', origin: 'https://a.vn', tienTe: 'VND' });
    for (const h of hang) {
      for (const truong of g.TRUONG_SAN_PHAM) {
        if (h[truong] === '' ) that(h._thieu[truong] !== undefined, 'ô trống không có lý do: ' + truong);
      }
    }
  });
  kiemTra('giá của biến thể này không được mượn từ biến thể khác', () => {
    const g = taoMoiTruong().g;
    const du = { products: [{ id: 1, title: 'X', handle: 'x', variants: [
      { id: 10, price: '259000.00', sku: 'A' },
      { id: 11, price: null, sku: 'B' }] }] };
    const hang = g.bocTachProductsJson(du, { url: 'https://a.vn/', origin: 'https://a.vn' });
    bang(hang[0].gia_ban, 259000);
    bang(hang[1].gia_ban, '', 'biến thể không có giá thì để trống');
    that(String(hang[1]._thieu.gia_ban).indexOf('khong_doc_duoc_gia') === 0);
  });
});

nhom('Không thu thập dữ liệu cá nhân', () => {
  kiemTra('không có trường nào cho tên người đánh giá hay nội dung đánh giá', () => {
    const g = taoMoiTruong().g;
    const cam = ['reviewer', 'review_body', 'ten_nguoi', 'so_dien_thoai', 'dia_chi', 'email'];
    for (const c of cam) {
      that(g.COT_SAN_PHAM.indexOf(c) < 0, 'cột ' + c + ' không được tồn tại');
    }
  });
  kiemTra('chỉ lấy số tổng hợp của đánh giá (điểm và số lượt)', () => {
    const g = taoMoiTruong().g;
    bang(g.TRUONG_SAN_PHAM.filter(t => t.indexOf('danh_gia') >= 0), ['danh_gia_sao', 'so_luot_danh_gia']);
  });
});

nhom('Tự kiểm tra chạy được ngay trong trình soạn thảo Apps Script', () => {
  kiemTra('chayTuKiemTra() đạt hết', () => {
    const kt = taoMoiTruong().g.chayTuKiemTra();
    bang(kt.loi, []);
    that(kt.tong >= 30, 'phải có ít nhất 30 mục, đang có ' + kt.tong);
  });
  kiemTra('CHAN_DOAN() chạy không lỗi khi không có giao diện', () => {
    const bc = taoMoiTruong().g.CHAN_DOAN();
    that(bc.indexOf('CHẨN ĐOÁN') >= 0);
    that(bc.indexOf('Shopee') > 0, 'phải nêu các sàn không quét được');
  });
  kiemTra('bốn hàm không tham số nằm ở đầu dự án (00_MENU.js)', () => {
    const dau = ma['00_MENU.js'];
    for (const ham of ['function MO_BANG_QUET()', 'function QUET_MOT_LINK()', 'function TIEP_TUC_QUET()', 'function CHAN_DOAN()']) {
      that(dau.indexOf(ham) > 0, 'thiếu ' + ham);
    }
  });
  kiemTra('mọi lần gọi getUi() đều được bọc try/catch', () => {
    for (const f of tep) {
      const dong = ma[f].split('\n');
      dong.forEach((d, i) => {
        if (d.indexOf('getUi()') < 0) return;
        const quanh = dong.slice(Math.max(0, i - 12), i + 3).join('\n');
        that(quanh.indexOf('try') >= 0, f + ':' + (i + 1) + ' gọi getUi() ngoài try/catch');
      });
    }
  });
});
