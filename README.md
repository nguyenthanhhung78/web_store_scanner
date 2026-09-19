# Công cụ quét cửa hàng (ad-hoc store scanner)

Dán **một địa chỉ bất kỳ** của cửa hàng / danh mục / sản phẩm → công cụ tự dò nền tảng lúc
chạy, lấy dữ liệu sản phẩm, ghi vào Google Sheets, và trả về **một kết luận trung thực** về
mức độ đáng tin của dữ liệu đó.

- 📘 **[HUONG-DAN.md](HUONG-DAN.md)** — cài đặt, cách quét, cách đọc kết luận. **Bắt đầu ở đây.**
- 📦 **[`dist/`](dist/)** — 6 tệp để dán vào Apps Script (đã gộp sẵn). Cài đặt ~10 phút, xem mục 2 của hướng dẫn.
- 🕳 **[DIEM-MU.md](DIEM-MU.md)** — những chỗ công cụ nói không đủ. Đọc trước khi ra quyết định giá.

```bash
npm test          # 302 mục kiểm thử, không gọi mạng lần nào
npm run xem-truoc # dựng xem_truoc.html để xem giao diện bằng trình duyệt thường
npm run dong-goi  # dựng lại dist/ sau khi sửa src/
```

---

## Layout (for maintainers)

Apps Script has no modules: every file shares one global scope and is loaded in filename
order. Two boundaries are load-bearing and enforced by `test/08_kien_truc.test.js`:

- **`src/05_MANG_LUOI.js` is the only file that calls the network.** Every parser takes text
  and returns objects. When `UrlFetchApp` is replaced, nothing else changes.
- **`src/10_GHI_BANG.js` is the only file that writes to the sheet.** One batch, one
  `setValues()`. No `appendRow` anywhere.
- **A result is never more trustworthy than the weakest scan feeding it.**
  `tomTatTinCay()` propagates the worst verdict into every query and every report, and
  `canhBaoDuLieu()` names what would make the numbers wrong. Both are enforced by tests.

| File | Role |
|---|---|
| `src/00_MENU.js` | zero-argument entry points (`MO_BANG_QUET`, `QUET_MOT_LINK`, `TIEP_TUC_QUET`, `CHAN_DOAN`) |
| `src/01_CAU_HINH.js` | sheet schema, verdict values, defaults, unscannable hosts |
| `src/02_URL.js` | URL normalisation + classification (6 kinds) |
| `src/03_SO.js` | Vietnamese price parsing — rejects rather than guesses |
| `src/04_ROBOTS.js` | robots.txt (RFC 9309) |
| `src/05_MANG_LUOI.js` | the single network layer: robots, politeness, backoff, host limits |
| `src/06_HTML.js` | pure HTML/XML readers, JS-shell detection |
| `src/07_BOC_TACH.js` | extractors per rung |
| `src/08_KET_LUAN.js` | verdict, computed from measured fill rates |
| `src/09_THANG.js` | the 6-rung ladder as a resumable state machine |
| `src/10_GHI_BANG.js` | the single sheet writer + settings |
| `src/11_QUET.js` | driver: time budget, cursor, resume, queue |
| `src/12_THAY_DOI.js` | derived diff tab |
| `src/13_GIAO_DIEN.js` | sidebar/web-app server side |
| `src/14_TU_KIEM_TRA.js` | test tables shared by the Node suite and the in-editor self test |
| `src/15_TRUY_VAN.js` | query engine: filter, sort, group, describe, trust propagation |
| `src/16_BAO_CAO.js` | five report builders + the warning layer |
| `src/17_API_GIAO_DIEN.js` | the functions the dashboard calls |
| `src/BangQuet.html` | quick-scan sidebar (Vietnamese) |
| `src/Bang*.html` | the dashboard: page, stylesheet, client script |
| `tools/xem_truoc.js` | renders the dashboard to a plain HTML file for local inspection |
| `tools/dong_goi.js` | bundles the 18 source files into `dist/TAT_CA.gs` so installing is 6 pastes |

All operator-facing strings are Vietnamese; code and comments are English.
