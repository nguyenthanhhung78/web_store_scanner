'use strict';
/**
 * Kiểm thử đột biến: cố tình làm hỏng MỘT bộ đọc rồi đòi hỏi kết luận phải tụt xuống.
 * Nếu kết luận vẫn giữ nguyên CAO thì phần tính kết luận chỉ là đồ trang trí.
 * Mỗi ca in ra "trước" và "sau" để có thể đọc bằng mắt trong báo cáo.
 */
const { nhom, kiemTra, that, bang } = require('./kt');
const { taoMoiTruong, docFixture } = require('./harness');

const bc = { url: 'https://durahome.vn/', origin: 'https://durahome.vn', tienTe: 'VND' };
const du = () => JSON.parse(docFixture('bac1_shopify_products.json'));

function ketLuanCua(g) {
  const hang = g.bocTachProductsJson(du(), bc);
  return { kl: g.tinhKetLuan(hang, g.BAC.BAC_1_PRODUCTS_JSON, null), soDong: hang.length };
}

nhom('Đột biến — làm hỏng bộ đọc thì kết luận PHẢI tụt', () => {

  kiemTra('nền (xanh): không đột biến → CAO, 20 dòng, 100% có giá', () => {
    const g = taoMoiTruong().g;
    const r = ketLuanCua(g);
    console.log('        [nền]  kết luận=' + r.kl.ketLuan + ' dòng=' + r.soDong +
                ' giá=' + (r.kl.tyLeCoGia * 100).toFixed(1) + '%');
    bang(r.kl.ketLuan, 'CAO');
    bang(r.soDong, 20);
  });

  kiemTra('đột biến A (đỏ): hỏng bộ đọc giá → CAO tụt xuống THAP', () => {
    const g = taoMoiTruong().g;
    const truoc = ketLuanCua(g).kl.ketLuan;
    g.phanTichSoMay = function () { return { gia: null, lyDo: 'DOT_BIEN: bộ đọc giá bị hỏng' }; };
    const sau = ketLuanCua(g).kl;
    console.log('        [A]    trước=' + truoc + ' → sau=' + sau.ketLuan +
                ' (giá ' + (sau.tyLeCoGia * 100).toFixed(1) + '%)');
    bang(truoc, 'CAO');
    bang(sau.ketLuan, 'THAP');
    bang(sau.tyLeCoGia, 0);
    that(sau.lyDo.indexOf('DOT_BIEN') > 0, 'lý do phải nêu nguyên nhân thiếu giá: ' + sau.lyDo);
  });

  kiemTra('đột biến B (đỏ): hỏng bộ đọc TÊN → CAO tụt xuống TRUNG_BINH', () => {
    const g = taoMoiTruong().g;
    const truoc = ketLuanCua(g).kl.ketLuan;
    const datGoc = g.dat;
    g.dat = function (hang, truong, giaTri, lyDo) {
      if (truong === 'ten') return datGoc(hang, truong, '', 'DOT_BIEN: bộ đọc tên bị hỏng');
      return datGoc(hang, truong, giaTri, lyDo);
    };
    const sau = ketLuanCua(g).kl;
    console.log('        [B]    trước=' + truoc + ' → sau=' + sau.ketLuan +
                ' (tên ' + (sau.tyLe.ten * 100).toFixed(1) + '%, giá vẫn ' + (sau.tyLeCoGia * 100).toFixed(1) + '%)');
    bang(truoc, 'CAO');
    bang(sau.ketLuan, 'TRUNG_BINH');
    bang(sau.tyLe.ten, 0);
    bang(sau.tyLeCoGia, 1, 'giá vẫn đủ — chỉ tên hỏng');
  });

  kiemTra('đột biến C (đỏ): hỏng bộ đọc mã ngoài → CAO tụt xuống TRUNG_BINH', () => {
    const g = taoMoiTruong().g;
    const truoc = ketLuanCua(g).kl.ketLuan;
    const datGoc = g.dat;
    g.dat = function (hang, truong, giaTri, lyDo) {
      if (truong === 'ma_ngoai') return datGoc(hang, truong, '', 'DOT_BIEN: bộ đọc mã bị hỏng');
      return datGoc(hang, truong, giaTri, lyDo);
    };
    const sau = ketLuanCua(g).kl;
    console.log('        [C]    trước=' + truoc + ' → sau=' + sau.ketLuan +
                ' (mã ' + (sau.tyLeCoMa * 100).toFixed(1) + '%)');
    bang(sau.ketLuan, 'TRUNG_BINH');
    bang(sau.tyLeCoMa, 0);
  });

  kiemTra('đột biến D (đỏ): bộ bóc tách trả về rỗng → KHONG_QUET_DUOC, không phải CAO 0 dòng', () => {
    const g = taoMoiTruong().g;
    g.bocTachProductsJson = function () { return []; };
    const hang = g.bocTachProductsJson(du(), bc);
    const kl = g.tinhKetLuan(hang, g.BAC.BAC_1_PRODUCTS_JSON, { lyDo: 'DOT_BIEN: bộ bóc tách trả rỗng' });
    console.log('        [D]    dòng=' + hang.length + ' → kết luận=' + kl.ketLuan);
    bang(kl.ketLuan, 'KHONG_QUET_DUOC');
  });

  kiemTra('xanh trở lại: môi trường mới không dính đột biến', () => {
    const g = taoMoiTruong().g;
    const r = ketLuanCua(g);
    console.log('        [xanh] kết luận=' + r.kl.ketLuan + ' dòng=' + r.soDong);
    bang(r.kl.ketLuan, 'CAO');
    bang(r.soDong, 20);
  });
});
