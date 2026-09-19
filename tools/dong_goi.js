/**
 * tools/dong_goi.js — gộp 18 tệp mã trong src/ thành MỘT tệp để dán vào Apps Script.
 *
 *   npm run dong-goi
 *
 * Vì sao: Apps Script không có "import". Mọi tệp .js trong một dự án dùng chung một phạm vi
 * toàn cục, nên nối chúng lại theo đúng thứ tự tên tệp cho ra kết quả y hệt — mà người cài
 * chỉ phải dán 1 lần thay vì 18 lần.
 *
 * Tệp HTML thì Apps Script bắt buộc để riêng, nên vẫn là 4 tệp.
 * Kết quả nằm trong dist/ và ĐƯỢC commit vào kho mã, để người không rành kỹ thuật chỉ cần
 * mở GitHub, bấm copy, rồi dán. test/12_dong_goi.test.js canh cho dist/ không lạc hậu so
 * với src/.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const GOC = path.join(__dirname, '..');
const SRC = path.join(GOC, 'src');
const DIST = path.join(GOC, 'dist');

const TEP_HTML = ['Bang.html', 'Bang_CSS.html', 'Bang_JS.html', 'BangQuet.html'];

function dungNoiDungGop() {
  const tep = fs.readdirSync(SRC).filter(f => f.endsWith('.js')).sort();
  const phan = [];
  phan.push([
    '/**',
    ' * TAT_CA.gs — TOÀN BỘ mã của công cụ quét cửa hàng, gộp thành một tệp.',
    ' *',
    ' * KHÔNG SỬA TRỰC TIẾP TỆP NÀY. Nó được sinh ra từ thư mục src/ bằng lệnh',
    ' * `npm run dong-goi`. Sửa ở đây thì lần sinh sau sẽ mất.',
    ' *',
    ' * Thứ tự gộp = thứ tự tên tệp trong src/, đúng như Apps Script nạp.',
    ' * Gồm ' + tep.length + ' tệp: ' + tep.join(', '),
    ' */',
    ''
  ].join('\n'));
  for (const f of tep) {
    phan.push('\n/* ' + '='.repeat(74) + '\n   ' + f + '\n   ' + '='.repeat(74) + ' */\n');
    phan.push(fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\s*$/, '') + '\n');
  }
  return phan.join('');
}

function dongGoi() {
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST);
  const ra = [];
  fs.writeFileSync(path.join(DIST, 'TAT_CA.gs'), dungNoiDungGop());
  ra.push('TAT_CA.gs');
  for (const f of TEP_HTML) {
    fs.copyFileSync(path.join(SRC, f), path.join(DIST, f));
    ra.push(f);
  }
  fs.copyFileSync(path.join(SRC, 'appsscript.json'), path.join(DIST, 'appsscript.json'));
  ra.push('appsscript.json');
  return ra;
}

if (require.main === module) {
  const ra = dongGoi();
  console.log('Đã đóng gói vào dist/:');
  ra.forEach(f => {
    const kb = Math.round(fs.statSync(path.join(DIST, f)).size / 102.4) / 10;
    console.log('  - ' + f + '  (' + kb + ' KB)');
  });
  console.log('\nNgười cài chỉ cần dán ' + ra.length + ' tệp này vào Apps Script.');
}

module.exports = { dungNoiDungGop, dongGoi, TEP_HTML };
