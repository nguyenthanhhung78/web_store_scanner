'use strict';
/**
 * Bản đóng gói dist/ là thứ người cài thật sự dán vào Apps Script.
 * Nếu nó lạc hậu so với src/ thì mọi bản sửa lỗi đều vô nghĩa, nên kiểm ở đây.
 */
const fs = require('fs');
const path = require('path');
const { nhom, kiemTra, that, bang } = require('./kt');
const { taoMoiTruong, docFixture } = require('./harness');
const { dungNoiDungGop, TEP_HTML } = require('../tools/dong_goi');

const GOC = path.join(__dirname, '..');
const DIST = path.join(GOC, 'dist');

nhom('Bản đóng gói dist/ không được lạc hậu so với src/', () => {
  kiemTra('dist/TAT_CA.gs khớp với nội dung sinh ra từ src/', () => {
    that(fs.existsSync(path.join(DIST, 'TAT_CA.gs')), 'chưa có dist/TAT_CA.gs — chạy: npm run dong-goi');
    const tren_dia = fs.readFileSync(path.join(DIST, 'TAT_CA.gs'), 'utf8');
    bang(tren_dia === dungNoiDungGop(), true,
      'dist/ đã cũ so với src/. Chạy `npm run dong-goi` rồi commit lại.');
  });
  TEP_HTML.forEach(f => {
    kiemTra('dist/' + f + ' khớp src/' + f, () => {
      bang(fs.readFileSync(path.join(DIST, f), 'utf8') === fs.readFileSync(path.join(GOC, 'src', f), 'utf8'), true,
        'dist/' + f + ' đã cũ. Chạy `npm run dong-goi`.');
    });
  });
  kiemTra('dist/appsscript.json khớp src/', () => {
    bang(fs.readFileSync(path.join(DIST, 'appsscript.json'), 'utf8') ===
         fs.readFileSync(path.join(GOC, 'src', 'appsscript.json'), 'utf8'), true);
  });
});

nhom('Bản đóng gói chạy y hệt bản gốc', () => {
  const maGop = fs.readFileSync(path.join(DIST, 'TAT_CA.gs'), 'utf8');

  kiemTra('nạp được vào một phạm vi toàn cục duy nhất, không xung đột tên', () => {
    const env = taoMoiTruong({ maGop: maGop });
    that(typeof env.g.MO_BANG_DIEU_KHIEN === 'function', 'thiếu hàm vào cửa');
    that(typeof env.g.apiTruyVan === 'function', 'thiếu API giao diện');
    that(typeof env.g.layNoiDung === 'function', 'thiếu tầng mạng');
  });

  kiemTra('tự kiểm tra trong bản gộp vẫn đạt hết', () => {
    const kt = taoMoiTruong({ maGop: maGop }).g.chayTuKiemTra();
    bang(kt.loi, []);
    that(kt.tong >= 30);
  });

  kiemTra('quét đầu-cuối trên bản gộp cho kết quả y hệt bản gốc', () => {
    function chay(tuyChon) {
      const env = taoMoiTruong(tuyChon);
      env.dinhTuyen(/robots\.txt$/, { code: 404, body: '' });
      env.dinhTuyen(/products\.json\?limit=250&page=1$/,
        { code: 200, body: docFixture('bac1_shopify_products.json'), kieu: 'application/json' });
      env.dinhTuyen(/products\.json/, { code: 200, body: '{"products":[]}', kieu: 'application/json' });
      env.dinhTuyen(/.*/, { code: 200, body: docFixture('trang_chu_shopify.html') });
      const kq = env.g.batDauQuet('https://durahome.vn', 'kiem.thu@durahome.vn');
      return {
        ketLuan: kq.ketLuan.ketLuan,
        soSp: kq.ketLuan.soSp,
        bac: kq.tt.bacDung,
        tyLe: kq.ketLuan.tyLeCoGia,
        soDongGhi: env.docBang('SAN_PHAM').length
      };
    }
    const goc = chay({});
    const gop = chay({ maGop: maGop });
    bang(gop, goc, 'bản gộp phải cho kết quả giống hệt bản gốc');
    bang(gop.ketLuan, 'CAO');
    bang(gop.soDongGhi, 20);
  });

  kiemTra('báo cáo trên bản gộp cũng chạy', () => {
    const env = taoMoiTruong({ maGop: maGop });
    env.g.taoCacBangNeuThieu();
    const bc = env.g.apiBaoCao({ ma: 'CHAT_LUONG', boLoc: env.g.taoBoLocRong(), thamSo: {} });
    bang(bc.ma, 'CHAT_LUONG');
    bang(bc.hang.length, 0, 'chưa quét gì thì bảng rỗng, không lỗi');
  });
});
