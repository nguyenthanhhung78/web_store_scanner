'use strict';
/**
 * npm run kiem-that — kiểm thử TÍCH HỢP qua HTTP thật trên 127.0.0.1.
 *
 * Tách khỏi `npm test` vì nó chờ thật (1,5 giây giữa 2 lần gọi), mất khoảng 10 giây.
 * Máy chủ thử chạy ở tiến trình riêng: tools/quet_that.js gọi curl đồng bộ nên sẽ khoá
 * vòng lặp sự kiện của chính tiến trình nó đang chạy.
 */
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const { chay } = require('../tools/quet_that');

function doiCong(con) {
  return new Promise((ok, loi) => {
    let dem = '';
    const hetGio = setTimeout(() => loi(new Error('máy chủ thử không khởi động kịp')), 10000);
    con.stdout.on('data', (d) => {
      dem += d.toString();
      const m = /CONG=(\d+)/.exec(dem);
      if (m) { clearTimeout(hetGio); ok(Number(m[1])); }
    });
    con.on('error', loi);
  });
}

(async () => {
  const con = spawn(process.execPath, [path.join(__dirname, 'may_chu_thu.js'), '--trang', '2'],
                    { stdio: ['ignore', 'pipe', 'inherit'] });
  const cong = await doiCong(con);
  const goc = 'http://127.0.0.1:' + cong;

  let hong = 0;
  function kiem(ten, dk, them) {
    console.log((dk ? '  ✓ ' : '  ✗ ') + ten + (dk ? '' : '   → ' + (them === undefined ? '' : them)));
    if (!dk) hong++;
  }

  console.log('\n■ Quét một cửa hàng Shopify giả qua HTTP THẬT (' + goc + ')\n');
  const t0 = Date.now();
  let kq, sp, env;
  try {
    ({ kq, sp, env } = chay({ url: goc + '/cu', ua: 'KiemThuDurahome/1.0 (+kiem-thu@durahome.vn)' }));
  } finally {
    con.kill();
  }
  const giay = (Date.now() - t0) / 1000;
  const daGoi = env.nhatKyGoi.map(x => x.url.replace(goc, ''));

  console.log('');
  kiem('đi theo chuyển hướng 301 /cu → /collections/all', kq.tt.url === goc + '/collections/all', kq.tt.url);
  kiem('phân loại đúng là CATEGORY', kq.tt.loaiUrl === 'CATEGORY', kq.tt.loaiUrl);
  kiem('dừng ở bậc 1 (products.json)', kq.tt.bacDung === 'BAC_1_PRODUCTS_JSON', kq.tt.bacDung);
  kiem('kết luận CAO', kq.ketLuan && kq.ketLuan.ketLuan === 'CAO', kq.ketLuan && kq.ketLuan.ketLuan);
  kiem('đọc đủ 2 trang × 20 dòng = 40 dòng', sp.length === 40, 'được ' + sp.length);
  kiem('nhận diện nền tảng Shopify', kq.tt.nenTang === 'Shopify', kq.tt.nenTang);
  kiem('tiền tệ VND lấy từ Shopify.currency của trang', sp[0] && sp[0].tien_te === 'VND', sp[0] && sp[0].tien_te);
  kiem('giá đọc đúng 259000 (không phải 25900000 hay 259)', sp[0] && Number(sp[0].gia_ban) === 259000, sp[0] && sp[0].gia_ban);
  kiem('ô nguồn không có thì để trống, không điền 0', sp[0] && sp[0].so_luong_ton === '', sp[0] && sp[0].so_luong_ton);
  kiem('đọc robots.txt TRƯỚC khi lấy bất cứ thứ gì', daGoi[0] === '/robots.txt', daGoi[0]);
  kiem('không đụng vào đường dẫn robots.txt cấm', daGoi.every(u => u.indexOf('/cart') < 0));
  kiem('gửi User-Agent có địa chỉ liên hệ',
       env.nhatKyGoi.every(x => /\+kiem-thu@durahome\.vn/.test(x.opt.headers['User-Agent'])));
  kiem('giữ độ trễ lịch sự ≥1,5s mỗi lần gọi (' + daGoi.length + ' lượt, ' + giay.toFixed(1) + 's)',
       giay >= 1.5 * (daGoi.length - 1) * 0.95, giay.toFixed(1) + 's');
  kiem('dừng phân trang khi trang 3 trả về rỗng',
       daGoi.filter(u => u.indexOf('products.json') >= 0).length === 3, daGoi.join(' '));

  console.log('\n' + (hong === 0 ? 'TẤT CẢ ĐẠT — công cụ chạy đúng với một máy chủ HTTP thật.'
                                 : 'HỎNG ' + hong + ' mục'));
  process.exit(hong === 0 ? 0 : 1);
})();
