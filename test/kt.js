/** test/kt.js — a very small test registry, so `node test/run.js` needs no dependencies. */
'use strict';
const dsNhom = [];
let nhomHienTai = null;

function nhom(ten, fn) {
  nhomHienTai = { ten, ds: [] };
  dsNhom.push(nhomHienTai);
  fn();
  nhomHienTai = null;
}

function kiemTra(ten, fn) {
  if (!nhomHienTai) throw new Error('kiemTra() phải nằm trong nhom()');
  nhomHienTai.ds.push({ ten, fn });
}

function that(dk, thongBao) {
  if (!dk) throw new Error(thongBao || 'Điều kiện sai');
}

function bang(a, b, thongBao) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error((thongBao || 'Không bằng nhau') + '\n      nhận: ' + x + '\n      chờ : ' + y);
}

function gan(a, b, saiSo, thongBao) {
  if (Math.abs(a - b) > (saiSo === undefined ? 1e-9 : saiSo)) {
    throw new Error((thongBao || 'Lệch quá nhiều') + ' nhận ' + a + ' chờ ' + b);
  }
}

function chay() {
  let dat = 0, hong = 0;
  const loi = [];
  for (const n of dsNhom) {
    console.log('\n■ ' + n.ten);
    for (const t of n.ds) {
      try {
        t.fn();
        dat++;
        console.log('  ✓ ' + t.ten);
      } catch (e) {
        hong++;
        loi.push({ nhom: n.ten, ten: t.ten, e });
        console.log('  ✗ ' + t.ten + '\n      ' + String(e.message).split('\n').join('\n      '));
      }
    }
  }
  console.log('\n─────────────────────────────────────────────');
  console.log(hong === 0 ? `TẤT CẢ ĐẠT: ${dat}/${dat + hong}` : `ĐẠT ${dat}/${dat + hong} — HỎNG ${hong}`);
  return hong;
}

module.exports = { nhom, kiemTra, that, bang, gan, chay };
