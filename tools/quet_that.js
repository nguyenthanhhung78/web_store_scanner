/**
 * tools/quet_that.js — chạy ĐÚNG mã của công cụ, nhưng gọi MẠNG THẬT.
 *
 *   node tools/quet_that.js <địa-chỉ> [--trang 20] [--ua "Ten/1.0 (+email@cua-ban)"]
 *
 * Dùng để:
 *   - thử một địa chỉ thật trước khi cài vào Google Sheet;
 *   - kiểm chứng rằng thang dò, bộ bóc tách và kết luận chạy đúng ngoài đời, chứ không
 *     chỉ chạy đúng trên dữ liệu mẫu.
 *
 * Nó KHÔNG phải bản để dùng hằng ngày: không ghi vào Google Sheet, không có giao diện,
 * kết quả in ra màn hình và một tệp CSV. Bản dùng thật là bản chạy trong Apps Script.
 *
 * Mọi quy tắc lịch sự vẫn nguyên: đọc robots.txt, chờ tối thiểu 1,5 giây giữa 2 lần gọi
 * cùng một tên miền, lùi dần khi bị 429/503, dừng tên miền sau 3 lỗi liên tiếp, và dừng
 * hẳn khi gặp trang chặn truy cập tự động.
 *
 * HÃY ĐẶT --ua thành email liên hệ thật của bạn trước khi quét site của người khác.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { taoMoiTruong } = require('../test/harness');

/** UrlFetchApp thật, dựng trên curl (curl gọi mạng đồng bộ — Node thì không). */
function mangThat() {
  const thuMuc = fs.mkdtempSync(path.join(os.tmpdir(), 'quet-that-'));
  let dem = 0;
  return {
    fetch(url, opt) {
      dem++;
      const tepThan = path.join(thuMuc, 'than-' + dem);
      const tepDau = path.join(thuMuc, 'dau-' + dem);
      const args = ['-sS', '--compressed', '--max-time', '45',
                    '-o', tepThan, '-D', tepDau, '-w', '%{http_code}'];
      // Công cụ TỰ đi theo chuyển hướng (để biết URL cuối), nên curl không được đi thay.
      const h = (opt && opt.headers) || {};
      for (const k of Object.keys(h)) args.push('-H', k + ': ' + h[k]);
      args.push(url);

      let ma;
      try {
        ma = parseInt(execFileSync('curl', args, { encoding: 'utf8', timeout: 60000 }).trim(), 10);
      } catch (e) {
        const loi = String((e.stderr || e.message || '')).trim().split('\n').pop();
        throw new Error('curl: ' + (loi || 'không gọi được'));
      }
      const than = fs.existsSync(tepThan) ? fs.readFileSync(tepThan, 'utf8') : '';
      const dauTho = fs.existsSync(tepDau) ? fs.readFileSync(tepDau, 'utf8') : '';
      const dau = {};
      dauTho.split(/\r?\n/).forEach(d => {
        const vt = d.indexOf(':');
        if (vt > 0) dau[d.substring(0, vt).trim()] = d.substring(vt + 1).trim();
      });
      return {
        getResponseCode: () => (isFinite(ma) ? ma : 0),
        getContentText: () => than,
        getAllHeaders: () => dau
      };
    },
    donDep() { try { fs.rmSync(thuMuc, { recursive: true, force: true }); } catch (e) { /* kệ */ } }
  };
}

function docThamSo(argv) {
  const ra = { url: '', trang: null, ua: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--trang') ra.trang = Number(argv[++i]);
    else if (argv[i] === '--ua') ra.ua = argv[++i];
    else if (!ra.url) ra.url = argv[i];
  }
  return ra;
}

function chay(ts) {
  const mang = mangThat();
  const env = taoMoiTruong({ ungDungMang: mang, dongHoThat: true });
  const g = env.g;
  g.taoCacBangNeuThieu();

  const caiDat = g.docCaiDatMacDinh();
  if (ts.trang) caiDat.gioi_han_trang = ts.trang;
  if (ts.ua) caiDat.user_agent = ts.ua;

  console.log('Địa chỉ : ' + ts.url);
  const pl = g.phanLoaiUrl(ts.url);
  console.log('Loại URL: ' + pl.loai + (pl.san ? '  ← ' + pl.san.ten + ': KHÔNG QUÉT ĐƯỢC' : ''));
  console.log('Tên miền: ' + pl.host);
  console.log('User-Agent: ' + caiDat.user_agent);
  console.log('Trần: ' + caiDat.gioi_han_trang + ' trang, ' + caiDat.gioi_han_yeu_cau_moi_host +
              ' lượt/tên miền, chờ ' + caiDat.do_tre_giua_2_yeu_cau_ms + 'ms giữa 2 lần gọi.');
  console.log('─'.repeat(78));

  const batDau = Date.now();
  let kq;
  try {
    kq = g.batDauQuet(ts.url, 'quet_that.js', { caiDat: caiDat });
  } finally {
    mang.donDep();
  }
  const giay = ((Date.now() - batDau) / 1000).toFixed(1);

  console.log('\nNhật ký mạng:');
  env.nhatKyGoi.forEach(x => console.log('  ' + x.code + '  ' + x.url));

  if (!kq.xong) {
    console.log('\nChưa xong trong một lượt chạy (' + giay + 's). Đã ghi ' + kq.tt.soDaGhi + ' dòng.');
    console.log('Trong Apps Script thì nó sẽ tự chạy tiếp; ở đây hãy tăng --trang hoặc chạy lại.');
  }

  const kl = kq.ketLuan;
  const sp = env.docBang('SAN_PHAM');
  console.log('\n' + '═'.repeat(78));
  if (kl) {
    console.log('KẾT LUẬN : ' + kl.ketLuan + '   (' + g.CAU_KET_LUAN[kl.ketLuan] + ')');
    console.log('Nền tảng : ' + (kq.tt.nenTang || '(không nhận diện được)'));
    console.log('Bậc dùng : ' + g.tenBacTiengViet(kq.tt.bacDung));
    console.log('Số dòng  : ' + kl.soSp + '      Tỷ lệ có giá: ' + (kl.tyLeCoGia * 100).toFixed(1) + '%');
    console.log('Trống nhiều: ' + kl.truongThieuNhieu);
    console.log('Việc cần làm: ' + g.viecCanLam(kl.ketLuan));
    console.log('\nLý do (bản ghi tin cậy):\n  ' + String(kl.lyDo).replace(/\. /g, '.\n  '));
  }
  if (kq.tt.lyDoThatBai.length) {
    console.log('\nĐã thử và trượt:');
    kq.tt.lyDoThatBai.forEach(l => console.log('  - ' + l));
  }
  console.log('═'.repeat(78));
  console.log('Chạy hết ' + giay + ' giây, ' + env.nhatKyGoi.length + ' lượt gọi mạng.');

  if (sp.length) {
    const cot = ['ten', 'phien_ban', 'gia_ban', 'gia_goc', 'tien_te', 'con_hang', 'sku', 'ma_ngoai'];
    console.log('\n10 dòng đầu:');
    sp.slice(0, 10).forEach(h => {
      console.log('  ' + cot.map(c => (h[c] === '' ? '·' : String(h[c]))).join(' | '));
    });
    const tenCsv = 'ket_qua_' + (kq.tt.maLanQuet || 'quet') + '.csv';
    fs.writeFileSync(tenCsv, '﻿' + g.hangThanhCsv(g.COT_SAN_PHAM, sp));
    console.log('\nĐã ghi ' + sp.length + ' dòng vào ' + tenCsv);
  }
  return { kq, sp, env };
}

if (require.main === module) {
  const ts = docThamSo(process.argv);
  if (!ts.url) {
    console.error('Cách dùng: node tools/quet_that.js <địa-chỉ> [--trang 20] [--ua "Ten/1.0 (+email)"]');
    process.exit(2);
  }
  const { kq } = chay(ts);
  process.exit(kq.ketLuan && kq.ketLuan.ketLuan !== 'KHONG_QUET_DUOC' ? 0 : 1);
}

module.exports = { chay, mangThat };
