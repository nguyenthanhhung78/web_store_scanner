/**
 * test/harness.js — loads the Apps Script sources into a sandbox with fake Google
 * services. Tests NEVER touch the network: UrlFetchApp is a routing table over fixtures.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const THU_MUC_SRC = path.join(__dirname, '..', 'src');
const THU_MUC_FIXTURE = path.join(__dirname, 'fixtures');

function docFixture(ten) {
  return fs.readFileSync(path.join(THU_MUC_FIXTURE, ten), 'utf8');
}

/* ------------------------------------------------------------ fake spreadsheet */

function taoSheet(ten, id, nhatKyGhi) {
  const du = [];
  function baoDam(r, c) {
    while (du.length < r) du.push([]);
    for (let i = 0; i < r; i++) while (du[i].length < c) du[i].push('');
  }
  const sheet = {
    getName: () => ten,
    getSheetId: () => id,
    setFrozenRows: () => sheet,
    clear() { du.length = 0; return sheet; },
    clearContents() { du.length = 0; return sheet; },
    getLastRow() {
      let last = 0;
      for (let i = 0; i < du.length; i++) {
        if (du[i].some(v => v !== '' && v !== null && v !== undefined)) last = i + 1;
      }
      return last;
    },
    getLastColumn() {
      let m = 0;
      for (const r of du) m = Math.max(m, r.length);
      return m;
    },
    getRange(row, col, numRows, numCols) {
      const nr = numRows === undefined ? 1 : numRows;
      const nc = numCols === undefined ? 1 : numCols;
      return {
        setValues(vals) {
          if (vals.length !== nr) throw new Error('setValues: số dòng không khớp');
          if (nhatKyGhi) nhatKyGhi.push({ bang: ten, dongDau: row, soDong: nr, soCot: nc });
          baoDam(row + nr - 1, col + nc - 1);
          for (let i = 0; i < nr; i++) {
            if (vals[i].length !== nc) throw new Error('setValues: số cột không khớp');
            for (let j = 0; j < nc; j++) du[row - 1 + i][col - 1 + j] = vals[i][j];
          }
          return this;
        },
        getValues() {
          baoDam(row + nr - 1, col + nc - 1);
          const ra = [];
          for (let i = 0; i < nr; i++) ra.push(du[row - 1 + i].slice(col - 1, col - 1 + nc));
          return ra;
        },
        setValue(v) { return this.setValues([[v]]); },
        getValue() { return this.getValues()[0][0]; }
      };
    },
    _du: du
  };
  return sheet;
}

function taoBangTinh(nhatKyGhi) {
  const sheets = [];
  let nextId = 1;
  return {
    getName: () => 'Bảng quét thử',
    getUrl: () => 'https://docs.google.com/spreadsheets/d/THU/edit',
    getSheetByName: (t) => sheets.find(s => s.getName() === t) || null,
    insertSheet(t) { const s = taoSheet(t, nextId++, nhatKyGhi); sheets.push(s); return s; },
    getSheets: () => sheets,
    _sheets: sheets
  };
}

/* ------------------------------------------------------------------ the sandbox */

/**
 * tuyChon:
 *   maGop      — nạp dist/TAT_CA.gs thay cho từng tệp src/
 *   ungDungMang— thay UrlFetchApp giả bằng một bản thật (xem tools/quet_that.js)
 *   dongHoThat — dùng đồng hồ thật và sleep thật, thay cho đồng hồ giả
 */
function taoMoiTruong(tuyChon = {}) {
  const nhatKyGhi = [];
  const bangTinh = taoBangTinh(nhatKyGhi);
  const props = {};
  const dinhTuyen = [];       // [{mau, traLoi}]
  const nhatKyGoi = [];
  const dongHo = { goc: Date.parse('2026-09-17T08:00:00Z'), lech: 0 };

  class NgayGia extends Date {
    constructor(...a) { if (a.length === 0) super(dongHo.goc + dongHo.lech); else super(...a); }
    static now() { return dongHo.goc + dongHo.lech; }
  }

  function traLoiCho(url) {
    for (const r of dinhTuyen) {
      if (typeof r.mau === 'string' ? r.mau === url : r.mau.test(url)) {
        return typeof r.traLoi === 'function' ? r.traLoi(url) : r.traLoi;
      }
    }
    return { code: 404, body: 'Not found' };
  }

  function nguThat(ms) {
    if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  }

  const sandbox = {
    console,
    Date: tuyChon.dongHoThat ? Date : NgayGia,
    Logger: { log: (...a) => { if (tuyChon.onLog) tuyChon.onLog(a.join(' ')); } },
    Utilities: {
      sleep(ms) { if (tuyChon.dongHoThat) nguThat(ms); else dongHo.lech += ms; },
      formatDate(d, tz, fmt) {
        const iso = new Date(d.getTime() + 7 * 3600 * 1000).toISOString();
        return iso.replace('T', ' ').substring(0, 19);
      },
      getUuid: () => 'uuid-' + Math.random().toString(36).slice(2)
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props[k] === undefined ? null : props[k]),
        setProperty: (k, v) => { props[k] = String(v); },
        deleteProperty: (k) => { delete props[k]; },
        getProperties: () => Object.assign({}, props)
      })
    },
    SpreadsheetApp: {
      getActive: () => bangTinh,
      openById: () => bangTinh,
      getUi: () => { throw new Error('Không có giao diện khi chạy từ trình soạn thảo.'); }
    },
    Session: { getActiveUser: () => ({ getEmail: () => 'nguoi-thu@durahome.vn' }) },
    ScriptApp: {
      newTrigger: () => ({ timeBased: () => ({ after: () => ({ create: () => ({}) }) }) }),
      getProjectTriggers: () => []
    },
    HtmlService: {
      createHtmlOutputFromFile: () => ({ setTitle: () => ({ setWidth: () => ({}) }) }),
      createTemplateFromFile: () => ({ evaluate: () => ({ setTitle: () => ({ addMetaTag: () => ({}) }) }) })
    },
    UrlFetchApp: tuyChon.ungDungMang ? {
      // Bọc bản mạng thật để vẫn ghi được nhật ký gọi (dùng cho kiểm thử và cho báo cáo).
      fetch(url, opt) {
        try {
          const tl = tuyChon.ungDungMang.fetch(url, opt);
          nhatKyGoi.push({ url, opt, code: tl.getResponseCode() });
          return tl;
        } catch (e) {
          nhatKyGoi.push({ url, opt, code: 0, loi: String(e && e.message ? e.message : e) });
          throw e;
        }
      }
    } : {
      fetch(url, opt) {
        dongHo.lech += 300;                       // pretend the network took 300ms
        const tl = traLoiCho(url);
        nhatKyGoi.push({ url, opt, code: tl.code });
        if (tl.nem) throw new Error(tl.nem);
        const headers = Object.assign({ 'Content-Type': tl.kieu || 'text/html; charset=utf-8' }, tl.headers || {});
        return {
          getResponseCode: () => tl.code,
          getContentText: () => (tl.body === undefined ? '' : tl.body),
          getAllHeaders: () => headers
        };
      }
    }
  };
  const ctx = vm.createContext(sandbox);

  if (tuyChon.maGop) {
    // Nạp bản đã đóng gói (dist/TAT_CA.gs) thay cho từng tệp trong src/,
    // để chứng minh bản gộp chạy y hệt bản gốc.
    vm.runInContext(tuyChon.maGop, ctx, { filename: 'dist/TAT_CA.gs' });
  } else {
    const tep = fs.readdirSync(THU_MUC_SRC).filter(f => f.endsWith('.js')).sort();
    for (const f of tep) {
      const ma = fs.readFileSync(path.join(THU_MUC_SRC, f), 'utf8');
      vm.runInContext(ma, ctx, { filename: 'src/' + f });
    }
  }

  return {
    g: sandbox,
    bangTinh,
    props,
    nhatKyGoi,
    nhatKyGhi,
    dongHo,
    /** Route a URL (string or RegExp) to a canned response. Later routes are added first-match. */
    dinhTuyen(mau, traLoi) { dinhTuyen.push({ mau, traLoi }); return this; },
    /** Same, but wins over routes registered earlier (used to change a fixture mid-test). */
    dinhTuyenTruoc(mau, traLoi) { dinhTuyen.unshift({ mau, traLoi }); return this; },
    /** Rows written to a tab, as objects. */
    docBang(ten) {
      const s = bangTinh.getSheetByName(ten);
      if (!s || s.getLastRow() < 2) return [];
      const cot = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
      const vals = s.getRange(2, 1, s.getLastRow() - 1, cot.length).getValues();
      return vals.map(r => {
        const o = {};
        cot.forEach((c, i) => { o[c] = r[i]; });
        return o;
      });
    }
  };
}

module.exports = { taoMoiTruong, docFixture, THU_MUC_FIXTURE };
