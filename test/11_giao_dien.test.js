'use strict';
/**
 * Giao diện không chạy được trong Node (không có google.script.run, không có DOM).
 * Nhưng ba loại lỗi hay gặp nhất thì kiểm được thẳng trên mã nguồn:
 *   1. gọi một hàm máy chủ không tồn tại  → nút bấm không làm gì, không báo lỗi rõ
 *   2. gõ sai id phần tử                  → màn hình trắng
 *   3. phụ thuộc CDN bên ngoài            → 2 năm nữa CDN đổi, giao diện hỏng
 */
const fs = require('fs');
const path = require('path');
const { nhom, kiemTra, that, bang } = require('./kt');

const THU_MUC = path.join(__dirname, '..', 'src');
const doc = (f) => fs.readFileSync(path.join(THU_MUC, f), 'utf8');
const HTML = { 'Bang.html': doc('Bang.html'), 'Bang_JS.html': doc('Bang_JS.html'), 'Bang_CSS.html': doc('Bang_CSS.html'), 'BangQuet.html': doc('BangQuet.html') };
const JS = fs.readdirSync(THU_MUC).filter(f => f.endsWith('.js'));
const maJs = JS.map(f => doc(f)).join('\n');

/**
 * Đi dọc chuỗi google.script.run.withSuccessHandler(...).tenHam(...) và lấy ra tên hàm máy
 * chủ. Phải tự quét ngoặc (và bỏ qua chuỗi ký tự) chứ không dùng regex, vì đối số là cả
 * một hàm callback có dấu chấm phẩy và dấu ngoặc bên trong.
 */
function hamMayChuDuocGoi(html) {
  const ra = new Set();
  const MOC = 'google.script.run';
  let vt = html.indexOf(MOC);
  while (vt >= 0) {
    let i = vt + MOC.length;
    for (;;) {
      while (i < html.length && /\s/.test(html[i])) i++;
      if (html[i] !== '.') break;
      i++;
      let ten = '';
      while (i < html.length && /[A-Za-z0-9_$]/.test(html[i])) ten += html[i++];
      while (i < html.length && /\s/.test(html[i])) i++;
      if (html[i] !== '(') break;
      i = boQuaNgoac(html, i);
      if (!/^with(SuccessHandler|FailureHandler|UserObject)$/.test(ten)) ra.add(ten);
    }
    vt = html.indexOf(MOC, vt + MOC.length);
  }
  return [...ra];
}

/** Trả về vị trí ngay sau dấu ')' khớp với dấu '(' ở vị trí i. Bỏ qua chuỗi ký tự. */
function boQuaNgoac(s, i) {
  let sau = 0;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i++;
      while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; }
      continue;
    }
    if (c === '(') sau++;
    else if (c === ')') { sau--; if (sau === 0) return i + 1; }
  }
  return i;
}

nhom('Giao diện gọi đúng hàm máy chủ', () => {
  const goi = [].concat(hamMayChuDuocGoi(HTML['Bang_JS.html']), hamMayChuDuocGoi(HTML['BangQuet.html']));
  kiemTra('có gọi máy chủ và danh sách không rỗng', () => {
    that(goi.length >= 8, 'chỉ tìm thấy ' + goi.length + ' lời gọi: ' + goi.join(', '));
  });
  [...new Set(goi)].forEach(ten => {
    kiemTra('hàm máy chủ ' + ten + '() có thật', () => {
      that(new RegExp('function\\s+' + ten + '\\s*\\(').test(maJs), 'không tìm thấy function ' + ten + ' trong src/*.js');
    });
  });
});

nhom('Không gõ sai id phần tử', () => {
  const idCoSan = new Set();
  // id khai báo tĩnh trong trang, và id do JS tự dựng trong chuỗi innerHTML
  for (const f of ['Bang.html', 'Bang_JS.html']) {
    const re = /id="([A-Za-z0-9_-]+)"/g;
    let m;
    while ((m = re.exec(HTML[f])) !== null) idCoSan.add(m[1]);
  }
  const dung = new Set();
  const re2 = /\bE\('([A-Za-z0-9_-]+)'\)/g;
  let m2;
  while ((m2 = re2.exec(HTML['Bang_JS.html'])) !== null) dung.add(m2[1]);

  kiemTra('mọi E(\'id\') đều trỏ tới một id có thật (' + dung.size + ' id)', () => {
    const thieu = [...dung].filter(x => !idCoSan.has(x));
    bang(thieu, [], 'id không tồn tại: ' + thieu.join(', '));
  });
});

nhom('Không phụ thuộc gì bên ngoài', () => {
  kiemTra('không nạp script hay style từ CDN', () => {
    for (const f of Object.keys(HTML)) {
      that(!/<script[^>]+src=/i.test(HTML[f]), f + ' nạp script ngoài');
      that(!/<link[^>]+href="http/i.test(HTML[f]), f + ' nạp style ngoài');
    }
  });
  kiemTra('biểu đồ vẽ bằng SVG tự viết, không dùng thư viện', () => {
    that(HTML['Bang_JS.html'].indexOf('<svg class="bieu-do"') > 0, 'phải tự dựng SVG');
    that(!/chart\.js|d3\.|plotly/i.test(HTML['Bang_JS.html']), 'không được dùng thư viện biểu đồ');
  });
  kiemTra('các tệp include đều tồn tại', () => {
    const re = /napHtml\('([A-Za-z0-9_]+)'\)/g;
    let m;
    const thieu = [];
    while ((m = re.exec(HTML['Bang.html'])) !== null) {
      if (!fs.existsSync(path.join(THU_MUC, m[1] + '.html'))) thieu.push(m[1]);
    }
    bang(thieu, []);
  });
});

nhom('Bảng màu và nền tối', () => {
  const css = HTML['Bang_CSS.html'];
  kiemTra('dùng đúng bảng màu đã kiểm định (1 tông xanh cho biểu đồ)', () => {
    that(css.indexOf('#86b6ef') > 0 && css.indexOf('#2a78d6') > 0, 'thiếu tông sáng chế độ sáng');
    that(css.indexOf('#184f95') > 0 && css.indexOf('#3987e5') > 0, 'thiếu tông cho nền tối');
  });
  kiemTra('nền tối khai báo ở CẢ hai phạm vi: theo hệ điều hành và theo nút gạt', () => {
    that(css.indexOf('@media (prefers-color-scheme: dark)') > 0, 'thiếu media query');
    that(css.indexOf(':root:where(:not([data-theme="light"]))') > 0, 'thiếu lớp bảo vệ cho nút gạt sáng');
    that(css.indexOf(':root[data-theme="dark"]') > 0, 'thiếu phạm vi nút gạt tối');
  });
  kiemTra('màu trạng thái luôn đi kèm ký hiệu và chữ, không đứng một mình', () => {
    const js = HTML['Bang_JS.html'];
    that(js.indexOf('BIEU_TUONG_KL') > 0, 'phải có ký hiệu kèm màu');
    that(/huy-hieu[\s\S]{0,400}bieu-tuong/.test(js), 'huy hiệu phải chứa ký hiệu');
  });
  kiemTra('số lớn dùng chữ số tỷ lệ, cột số mới dùng chữ số đều nhau', () => {
    that(/\.o-so[\s\S]*?\.so \{[^}]*font-size: 22px/.test(css), 'ô số phải là số lớn');
    that(!/\.o-so[\s\S]{0,200}tabular-nums/.test(css), 'không dùng tabular-nums cho số lớn');
    that(/td\.so, th\.so \{[^}]*tabular-nums/.test(css), 'cột số phải dùng tabular-nums');
  });
  kiemTra('đường lưới là nét liền mảnh, không phải nét đứt', () => {
    that(css.indexOf('.luoi { stroke: var(--duong-luoi); stroke-width: 1; }') > 0);
    that(!/stroke-dasharray/.test(HTML['Bang_JS.html']), 'không được dùng nét đứt cho lưới');
  });
});

nhom('Quy tắc trình bày dữ liệu', () => {
  const js = HTML['Bang_JS.html'];
  kiemTra('ô trống hiện chữ "trống", không hiện 0', () => {
    that(/class="trong"[^>]*>trống</.test(js), 'ô trống phải ghi là trống');
  });
  kiemTra('mỗi bảng đều có khối tin cậy đi kèm', () => {
    that(js.indexOf('veTinCay(E(\'tinCayDuLieu\')') > 0, 'tab dữ liệu thiếu khối tin cậy');
    that(js.indexOf('veTinCay(E(\'tinCayBaoCao\')') > 0, 'tab báo cáo thiếu khối tin cậy');
  });
  kiemTra('biểu đồ nào cũng có bảng số liệu đi kèm', () => {
    that(js.indexOf('veBangBaoCao(bc)') > 0, 'báo cáo phải luôn kèm bảng');
  });
  kiemTra('chỉ có MỘT hàng lọc, chuyển chỗ theo tab', () => {
    that((HTML['Bang.html'].match(/id="khungLoc"/g) || []).length === 1, 'chỉ được có 1 khung lọc');
    that(js.indexOf("E('neoLocDuLieu').appendChild(loc)") > 0, 'khung lọc phải chuyển chỗ');
  });
  kiemTra('giữ kết quả cũ mờ đi khi đang tải lại, không nhấp nháy khung rỗng', () => {
    that(js.indexOf("'khung-bang mo-dan'") > 0, 'phải làm mờ thay vì xoá trắng');
  });
});
