'use strict';
/**
 * test/may_chu_thu.js — một cửa hàng Shopify giả, phục vụ qua HTTP THẬT trên 127.0.0.1.
 *
 * Dùng cho `npm run kiem-that`: chứng minh tools/quet_that.js nói chuyện được với một máy
 * chủ HTTP thật (chuyển hướng, mã trạng thái, header, robots.txt, phân trang) — thứ mà bộ
 * kiểm thử bằng dữ liệu mẫu không chứng minh được.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const FIX = path.join(__dirname, 'fixtures');

function taoMayChu(tuyChon = {}) {
  const nhatKy = [];
  const may = http.createServer((req, res) => {
    nhatKy.push(req.url);
    const ua = req.headers['user-agent'] || '';

    if (req.url === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('User-agent: *\nDisallow: /cart\nDisallow: /checkout\nCrawl-delay: 1\n');
    }
    if (req.url === '/cam') {                       // đường dẫn bị robots.txt cấm
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<html><body>không được phép lấy</body></html>');
    }
    if (req.url === '/cu') {                        // kiểm tra đi theo chuyển hướng
      res.writeHead(301, { Location: '/collections/all' });
      return res.end();
    }
    if (req.url.indexOf('/collections/all/products.json') === 0) {
      const trang = /page=(\d+)/.exec(req.url);
      const n = trang ? Number(trang[1]) : 1;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      if (n > (tuyChon.soTrang || 1)) return res.end('{"products":[]}');
      // Mỗi trang phải là sản phẩm KHÁC nhau, nếu không bộ chống trùng của công cụ sẽ
      // (đúng đắn) bỏ trang sau, và phép thử phân trang thành vô nghĩa.
      const du = JSON.parse(fs.readFileSync(path.join(FIX, 'bac1_shopify_products.json'), 'utf8'));
      du.products.forEach((p) => {
        p.id += n * 100000;
        p.handle = 'trang' + n + '-' + p.handle;
        p.variants.forEach((v) => { v.id += n * 100000; });
      });
      return res.end(JSON.stringify(du));
    }
    if (req.url === '/' || req.url.indexOf('/collections/all') === 0) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(FIX, 'trang_chu_shopify.html'), 'utf8')
        .replace('</head>', '<!-- UA thấy được: ' + ua.replace(/[<>]/g, '') + ' --></head>'));
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('không có');
  });
  return { may, nhatKy };
}

function khoiDong(tuyChon = {}) {
  return new Promise((ok) => {
    const { may, nhatKy } = taoMayChu(tuyChon);
    may.listen(0, '127.0.0.1', () => ok({ may, nhatKy, cong: may.address().port }));
  });
}

/**
 * Chạy như một tiến trình RIÊNG:  node test/may_chu_thu.js [--trang 2]
 * In ra "CONG=<cổng>" rồi đứng chờ.
 *
 * Phải là tiến trình riêng vì tools/quet_that.js gọi curl ĐỒNG BỘ — nó khoá vòng lặp sự
 * kiện của Node, nên một máy chủ nằm cùng tiến trình sẽ không bao giờ trả lời được.
 */
if (require.main === module) {
  var soTrang = 1;
  for (var i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--trang') soTrang = Number(process.argv[++i]);
  }
  khoiDong({ soTrang: soTrang }).then(function (m) {
    process.stdout.write('CONG=' + m.cong + '\n');
  });
}

module.exports = { khoiDong };
