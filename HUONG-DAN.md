# Công cụ quét cửa hàng — Hướng dẫn sử dụng

Dán **một địa chỉ bất kỳ** (trang chủ cửa hàng, trang danh mục, hay trang một sản phẩm).
Công cụ tự dò xem đó là nền tảng gì, lấy được bao nhiêu dữ liệu thì lấy, ghi vào Google Sheet,
rồi **nói thật** phần dữ liệu đó đáng tin tới đâu.

> Không có danh sách đối thủ cài sẵn. Không có "bộ đọc riêng" cho từng website.
> Địa chỉ nào cũng được, kể cả website chưa ai từng quét.

---

## 1. Ba điều cần biết trước khi dùng

1. **Cột `ket_luan` quan trọng hơn số dòng lấy được.** 40 dòng kèm kết luận `THAP` không dùng
   để ra quyết định giá được; 5 dòng kèm `CAO` thì dùng được.
2. **Ô trống là ô trống thật.** Công cụ không bao giờ điền `0`, `N/A`, hay mượn giá của biến thể
   khác. Ô trống nghĩa là nguồn không có, và lý do được ghi lại.
3. **Shopee, TikTok Shop, Lazada, Tiki: KHÔNG quét được.** Không phải "quét được một ít" —
   là không. Xem mục 8.

---

## 2. Cài đặt (làm một lần, khoảng 10 phút)

> **Chưa cài thì chưa có gì để mở.** Mã nguồn nằm trên GitHub; bảng điều khiển chỉ xuất
> hiện sau khi bạn dán mã vào một Google Sheet của chính mình. Không có đường link sẵn để
> bấm vào.

Bạn chỉ phải dán **6 tệp**, tất cả nằm sẵn trong thư mục **`dist/`** của kho mã.

### Bước 1 — Tạo Sheet và mở Apps Script
1. Tạo một Google Sheet mới, đặt tên ví dụ `Quét cửa hàng — Durahome`.
2. Menu **Tiện ích mở rộng → Apps Script**. Một tab mới mở ra, đó là trình soạn thảo.
3. Bấm ⚙ **Cài đặt dự án** (bên trái) → tích **“Hiện tệp kê khai appsscript.json trong
   trình chỉnh sửa”**. Quay lại mục **Trình chỉnh sửa** (biểu tượng `< >`).

### Bước 2 — Dán 6 tệp

Mở thư mục `dist/` trên GitHub, mở từng tệp, bấm nút **Copy raw file**, rồi dán vào
Apps Script theo bảng sau:

| # | Tệp trong `dist/` | Trong Apps Script bấm | Đặt tên là | Ghi chú |
|---|---|---|---|---|
| 1 | `appsscript.json` | mở tệp `appsscript.json` có sẵn | (đã có sẵn) | **xoá hết** nội dung cũ rồi dán đè |
| 2 | `TAT_CA.gs` | mở tệp `Code.gs` có sẵn | đổi tên thành `TAT_CA` | **xoá hết** nội dung cũ rồi dán đè |
| 3 | `Bang.html` | **+ → HTML** | `Bang` | |
| 4 | `Bang_CSS.html` | **+ → HTML** | `Bang_CSS` | |
| 5 | `Bang_JS.html` | **+ → HTML** | `Bang_JS` | |
| 6 | `BangQuet.html` | **+ → HTML** | `BangQuet` | |

**Lưu ý về tên tệp HTML:** Apps Script tự thêm đuôi `.html`, nên khi nó hỏi tên bạn gõ
`Bang`, **không** gõ `Bang.html`. Gõ sai tên thì giao diện sẽ báo lỗi “file not found”.

Bấm 💾 **Lưu dự án**.

### Bước 3 — Cấp quyền một lần
1. Trên thanh công cụ, ô chọn hàm → chọn **`CHAN_DOAN`** → bấm ▶ **Chạy**.
2. Google hỏi quyền: **Xem lại quyền → chọn tài khoản → Nâng cao → Chuyển đến … (không an
   toàn) → Cho phép**. (Cảnh báo này xuất hiện với mọi script tự viết chưa qua thẩm định
   của Google; đây là mã của chính bạn.)
3. Mở **Nhật ký thực thi** ở dưới. Nếu thấy dòng `Tự kiểm tra: 33/33 mục đạt` là xong.

### Bước 4 — Mở bảng điều khiển
1. Quay lại tab **Google Sheet**, **tải lại trang (F5)**. Chờ vài giây.
2. Trên thanh menu xuất hiện mục mới: **Quét cửa hàng**.
3. **Quét cửa hàng → Mở bảng điều khiển.**

Cửa sổ mở ra chính là 4 thẻ: **Quét · Dữ liệu · Báo cáo · Lần quét**.

### Không thấy menu “Quét cửa hàng”?

| Hiện tượng | Nguyên nhân hay gặp | Cách xử lý |
|---|---|---|
| Không có menu sau khi lưu | Chưa tải lại Sheet | Bấm F5 trên tab Google Sheet, chờ 5–10 giây |
| Vẫn không có | Chưa chạy hàm nào nên chưa cấp quyền | Làm lại Bước 3 |
| Menu có, bấm vào thì báo lỗi `file not found` | Tên tệp HTML sai (gõ `Bang.html` thay vì `Bang`) | Đổi tên tệp trong Apps Script |
| Hộp thoại mở ra nhưng trắng trơn | Thiếu một trong 3 tệp `Bang`, `Bang_CSS`, `Bang_JS` | Kiểm đủ 6 tệp ở Bước 2 |
| Báo lỗi quyền khi bấm nút | Chưa cấp đủ quyền | Chạy lại `CHAN_DOAN` rồi bấm Cho phép |
| Script gắn vào Sheet khác với Sheet đang mở | Mở Apps Script từ Drive chứ không từ Sheet | Luôn mở bằng **Tiện ích mở rộng → Apps Script** từ chính Sheet đó |

Nếu vẫn kẹt: chạy hàm **`CHAN_DOAN`** trong trình soạn thảo và đọc **Nhật ký thực thi** —
nó nói rõ thiếu bảng nào, cài đặt nào sai, có lần quét nào đang dở.

### Muốn xem giao diện TRƯỚC khi cài?

Trong kho mã chạy `npm run xem-truoc` rồi mở tệp `xem_truoc.html` bằng trình duyệt. Nó dựng
đúng giao diện thật trên **dữ liệu bịa**, không cần Google, không cần cài gì. Trang có một
dải đỏ nhắc rằng mọi con số trong đó là giả.

### Cách khác — dùng clasp (cho người quen dòng lệnh)

```bash
npm i -g @google/clasp
clasp login
clasp create --type sheets --title "Quét cửa hàng — Durahome" --rootDir src
clasp push
```
Cách này đẩy thẳng từ `src/` (18 tệp lẻ), không cần bản gộp trong `dist/`.

---

## 3. Quét một link

**Cách thường dùng:** menu **Quét cửa hàng → Mở bảng quét**, dán địa chỉ, bấm **Quét**.

**Cách trong trình soạn thảo:** chọn hàm `QUET_MOT_LINK` rồi bấm ▶.

Trong lúc quét, dòng trạng thái cho biết đang thử bậc nào và đã lấy được bao nhiêu dòng.
Quét xong, kết luận hiện ra kèm việc cần làm.

**Dán nhiều link:** dán vào ô lớn (mỗi dòng một địa chỉ) → **Xếp vào hàng đợi** → bấm
**Chạy tiếp** cho từng địa chỉ. Công cụ quét lần lượt, không quét song song.

---

## 3b. Bảng điều khiển — làm việc ngay trên giao diện

Menu **Quét cửa hàng → Mở bảng điều khiển**. Có 4 thẻ:

### Thẻ “Quét”
Ô nhập link, nút **Quét**, ô dán nhiều link, và danh sách các sàn không quét được.

### Thẻ “Dữ liệu” — lọc và xem
Một hàng lọc duy nhất nằm trên cùng, áp dụng cho cả thẻ Dữ liệu lẫn thẻ Báo cáo:

| Bộ lọc | Dùng khi |
|---|---|
| Cửa hàng / Thương hiệu / Danh mục | thu hẹp về đúng thứ đang cần so |
| Kết luận lần quét | ví dụ chỉ lấy dòng từ lần quét `CAO` |
| Kho | chỉ xem hàng còn bán |
| Giá từ / đến | cắt bỏ phụ kiện rẻ tiền hoặc hàng cao cấp lạc loài |
| Tìm trong tên / SKU | gõ “thảm”, “DH-001” |
| **Chỉ lần quét mới nhất mỗi địa chỉ** | **bật sẵn.** Tắt đi thì bạn sẽ thấy cả lịch sử, và mỗi sản phẩm xuất hiện nhiều lần — mọi con số trung bình sẽ sai |
| Chỉ dòng có giá | khi cần tính toán, không cần đếm |

Bấm tiêu đề cột để sắp xếp. Ô nào nguồn không có sẽ ghi *trống* — không bao giờ ghi 0.
**Tải CSV** xuất TOÀN BỘ dòng khớp bộ lọc (không phải chỉ trang đang xem).

### Thẻ “Báo cáo” — 5 báo cáo dựng sẵn

| Báo cáo | Trả lời câu hỏi |
|---|---|
| **Bậc thang giá theo nhóm** | “Thương hiệu / danh mục / cửa hàng này đang bán ở khoảng giá nào?” |
| **Phân bố giá** | “Thị trường đang dồn ở mức giá nào?” |
| **So sánh cửa hàng theo danh mục** | “Ai đang rẻ hơn ở nhóm hàng nào?” |
| **Thay đổi giữa 2 lần quét** | “Tuần này ai đổi giá, ai hết hàng, ai gỡ sản phẩm?” |
| **Chất lượng dữ liệu theo lần quét** | “Số liệu tôi đang nhìn đáng tin tới đâu?” |

Mỗi báo cáo có: ô số tổng quan, **khối độ tin cậy**, danh sách cảnh báo, biểu đồ (nếu có)
và bảng số liệu. Hai nút xuất:
- **Ghi ra Google Sheet** — ghi vào thẻ `BAO_CAO`, kèm cả kết luận tin cậy và cảnh báo.
  Thẻ này được **dựng lại** mỗi lần xuất, đừng sửa tay vào đó.
- **Tải CSV** — tệp CSV mở được bằng Excel, dòng đầu là câu kết luận tin cậy.

### Thẻ “Lần quét”
Sổ tin cậy: mỗi lần quét một dòng. Bấm vào dòng để xem đầy đủ lý do.

### Quy tắc quan trọng nhất của giao diện

> **Lát cắt bạn đang xem chỉ đáng tin bằng lần quét TỆ NHẤT góp dữ liệu vào đó.**

Trộn 2 lần quét `CAO` với 1 lần quét `THAP` thì cả bảng hiện `THAP`. Đó không phải lỗi —
đó là sự thật về dữ liệu bạn đang nhìn. Muốn lên lại `CAO` thì **lọc bỏ nguồn `THAP`**
(bộ lọc “Kết luận lần quét”), chứ đừng nhắm mắt cho qua.

---

## 4. Đọc kết luận — phần quan trọng nhất

Kết luận **được đo**, không phải được nói cho hay: nó tính từ tỷ lệ ô có dữ liệu trên chính
những dòng vừa ghi.

| Kết luận | Nghĩa là | Bạn phải làm gì |
|---|---|---|
| **CAO** | Lấy thẳng từ API sản phẩm của nền tảng (bậc 1–2), ≥95% số dòng có đủ mã, tên, link và giá | Dùng được ngay. Vẫn nên liếc cột `tien_te`: trống nghĩa là đơn vị tiền chưa được xác minh |
| **TRUNG_BINH** | Đọc từ thẻ dữ liệu trên trang web (bậc 3–4), hoặc từ API nhưng có trường lõi chưa đủ 95% | **Mở 3 dòng bất kỳ**, bấm vào `url_san_pham`, so giá trên trang với cột `gia_ban`. Khớp cả 3 thì dùng |
| **THAP** | Đoán từ HTML (bậc 5), hoặc dưới 70% số dòng có giá | Coi là đầu mối, chưa phải dữ liệu. Kiểm chứng tay từng dòng |
| **KHONG_QUET_DUOC** | Không ghi dòng nào | Đọc cột `ly_do` trong bảng `LAN_QUET`. Đi đường chính thức (API nhà bán hoặc xuất dữ liệu tay) |

Kèm theo kết luận luôn có: nền tảng nhận diện được, bậc đã dùng, số sản phẩm, **tỷ lệ % có giá**,
và danh sách những cột trống nhiều kèm phần trăm.

> **Một lần quét không ra gì sẽ không bao giờ trông giống một cửa hàng rỗng.**
> Không có sản phẩm nào thì kết luận luôn là `KHONG_QUET_DUOC` kèm lý do cụ thể, không phải
> `CAO` với 0 dòng.

⚠️ **Giới hạn của kết luận:** nó đo **độ đầy đủ**, không đo **độ đúng**. Nếu một website ghi
sai giá trong dữ liệu của chính nó, công cụ vẫn ghi `CAO`. Vì vậy `TRUNG_BINH` mới bắt kiểm
tay 3 dòng — và với quyết định giá quan trọng, hãy kiểm tay kể cả khi kết luận là `CAO`.

---

## 5. Các bảng trong Sheet

### `SAN_PHAM` — chỉ ghi thêm, mỗi dòng là một biến thể sản phẩm
`ma_lan_quet` · `ngay_quet` · `nguon_url` · `ten_mien` · `nen_tang` · `ma_ngoai` ·
`url_san_pham` · `ten` · `thuong_hieu` · `danh_muc` · `sku` · `phien_ban` · `gia_ban` ·
`gia_goc` · `tien_te` · `con_hang` · `so_luong_ton` · `danh_gia_sao` · `so_luot_danh_gia` ·
`so_da_ban` · `anh_chinh` · `mo_ta_ngan`

- `ma_ngoai`: mã sản phẩm/biến thể của nền tảng; nếu nguồn không có thì lấy đường dẫn URL.
  **Không bao giờ** là số thứ tự dòng hay tên sản phẩm.
- `con_hang`: `CON` / `HET` / trống (trống = nguồn không nói).
- `gia_goc`: giá gạch ngang. Trống khi không có hoặc khi bằng đúng giá bán.

### `LAN_QUET` — sổ tin cậy, mỗi lần quét một dòng
`ma_lan_quet` · `bat_dau` · `ket_thuc` · `url_nhap` · `loai_url` · `nen_tang` ·
`bac_thang_dung` · `so_sp` · `ty_le_co_gia` (%) · `truong_thieu_nhieu` · `ket_luan` ·
`ly_do` · `nguoi_quet`

Đây là bảng cần đọc khi nghi ngờ số liệu. Cột `ly_do` ghi lại từng bậc đã thử và vì sao trượt.

### `CAI_DAT`
| khoá | mặc định | ý nghĩa |
|---|---|---|
| `do_tre_giua_2_yeu_cau_ms` | 1500 | chờ tối thiểu giữa 2 lần gọi cùng tên miền. **Không hạ xuống dưới 1500 được** |
| `gioi_han_yeu_cau_moi_host` | 500 | trần số lượt gọi một tên miền trong một lần quét |
| `gioi_han_trang` | 20 | trần số trang một lần quét |
| `user_agent` | `DurahomeStoreScanner/1.0 (+lien-he@durahome.vn)` | **phải đổi thành email thật** |
| `thoi_gian_cho_ms` | 30000 | ngân sách chờ nội bộ. Lưu ý: Apps Script không cho đặt timeout thật |
| `ngan_sach_chay_ms` | 270000 | chạy 4,5 phút rồi lưu vị trí và thoát (trần Apps Script là 6 phút) |
| `so_loi_lien_tiep_toi_da` | 3 | quá số này thì bỏ hẳn tên miền |
| `nguoi_quet` | (trống) | tên ghi vào cột `nguoi_quet` |

### `HANG_DOI` — danh sách link chờ quét
### `THAY_DOI` — bảng **phái sinh**, dựng lại được bất cứ lúc nào. Xoá đi không mất gì.

---

## 6. Khi lần quét bị ngắt giữa chừng

Apps Script cắt mọi lần chạy ở 6 phút. Công cụ làm việc 4,5 phút, ghi nốt lô đang có, lưu vị
trí, thoát sạch sẽ và **tự đặt lịch chạy tiếp sau 30 giây**.

- Lần quét chạy tiếp **giữ nguyên `ma_lan_quet`** — vẫn là một lần quét.
- Không có dòng trùng, không có dòng thiếu: khi chạy tiếp, công cụ đọc lại chính bảng
  `SAN_PHAM` để biết đã ghi những mã nào.
- Chưa xong thì **chưa có** dòng nào trong `LAN_QUET`. Có dòng `LAN_QUET` nghĩa là đã xong.
- Muốn thúc cho xong ngay: bấm **Chạy tiếp**, hoặc chạy hàm `TIEP_TUC_QUET`.

---

## 7. So sánh hai lần quét

Quét cùng một địa chỉ lần thứ hai (hôm sau, tuần sau), rồi menu
**Quét cửa hàng → So sánh 2 lần quét gần nhất**.

Bảng `THAY_DOI` sẽ có: `TANG_GIA`, `GIAM_GIA`, `MOI`, `MAT`, `HET_HANG`, `CON_HANG_LAI`,
kèm giá cũ, giá mới, chênh lệch và phần trăm.

Ảnh chụp trong `SAN_PHAM` là gốc; bảng so sánh là thứ phái sinh.

---

## 8. Những nơi công cụ này KHÔNG quét được

Apps Script dùng `UrlFetchApp`, **không chạy JavaScript**, và đi từ dải IP trung tâm dữ liệu
của Google. Vì vậy:

| Sàn | Vì sao không được | Đường đi hợp lệ |
|---|---|---|
| **Shopee** | Trang trả về vỏ rỗng, nội dung do JavaScript dựng; chặn IP Google | Shopee Open Platform (tài khoản người bán), Shopee Affiliate API, hoặc xuất tay từ Kênh Người Bán |
| **TikTok Shop** | Cần JavaScript và chữ ký phiên; không có HTML tĩnh chứa giá | TikTok Shop Partner API, hoặc xuất tay từ Seller Center |
| **Lazada** | JavaScript + thử thách chống bot; giới hạn IP | Lazada Open Platform, Lazada Affiliate, hoặc xuất báo cáo từ Seller Center |
| **Tiki** | JavaScript; endpoint dữ liệu là API nội bộ không công khai | Tiki Open API cho nhà bán |
| **Amazon / AliExpress / Taobao / 1688** | Chặn truy cập tự động từ IP trung tâm dữ liệu | API chính thức của sàn hoặc nhà cung cấp dữ liệu có giấy phép |

Dán link các sàn này, công cụ trả lời **ngay lập tức** (không gọi mạng một lần nào) rằng không
quét được và nêu đường đi hợp lệ.

**Công cụ cố tình không có** cách lách: không đổi User-Agent để thử lại, không giải thử thách
chống bot, không gọi API nội bộ của sàn, không đăng nhập, không vượt tường phí. Website chặn
truy cập tự động tức là họ đã nói không — công cụ ghi lại câu trả lời đó rồi đi tiếp.

Tương tự, nếu `robots.txt` cấm, công cụ không lấy gì cả và ghi rõ lý do.

---

## 9. Thang dò 6 bậc (để hiểu cột `bac_thang_dung`)

| Bậc | Cách lấy | Kết luận tối đa |
|---|---|---|
| 1 | `{tên miền}/products.json` — Shopify, Haravan, Sapo | CAO |
| 2 | `{tên miền}/wp-json/wc/store/v1/products` — WooCommerce | CAO |
| 3 | robots.txt → sitemap → từng trang sản phẩm → JSON-LD | TRUNG_BINH |
| 4 | JSON-LD / microdata / Open Graph của một trang | TRUNG_BINH |
| 5 | Đoán từ HTML: số đi kèm ký hiệu tiền tệ, gần một link sản phẩm | THẤP |
| 6 | Không quét được (bị chặn, robots cấm, hoặc trang là vỏ rỗng JavaScript) | KHÔNG_QUÉT_ĐƯỢC |

Công cụ dừng ở **bậc đầu tiên lấy được sản phẩm**.

---

## 10. Cách đọc số tiền

| Nhập vào | Ra | Vì sao |
|---|---|---|
| `1.250.000` | 1250000 | nhóm đúng 3 chữ số |
| `1,250,000` | 1250000 | nhóm đúng 3 chữ số |
| `250.000₫` | 250000 + `VND` | có ký hiệu tiền tệ |
| `1 250 000` | 1250000 | nhóm đúng 3 chữ số |
| `1.250.00` | **trống** | nhóm cuối chỉ 2 chữ số — không đoán |
| `3.5` | **trống** | tuyệt đối không được thành 35 |
| `250k`, `1tr2` | **trống** | viết tắt, chưa có quy tắc nào được viết và kiểm thử |
| `Liên hệ` | **trống** | không phải số |
| `1.250.000₫ - 2.000.000₫` | **trống** | khoảng giá, không tự chọn đầu nào |
| `250.000` (không ký hiệu) | 250000, **cột `tien_te` trống** | không có ký hiệu thì không mặc định là VND |

Riêng dữ liệu từ API JSON (`"259000.00"`) được đọc bằng bộ đọc khác — ở đó dấu chấm **là** dấu
thập phân theo đúng hợp đồng của API. Hai bộ đọc tách bạch, không dùng lẫn.

---

## 11. Kiểm thử (cho người bảo trì)

```bash
npm test          # 311 mục, không gọi mạng một lần nào
npm run kiem-that # kiểm thử qua HTTP THẬT trên 127.0.0.1 (~12 giây)
npm run xem-truoc # dựng xem_truoc.html: xem giao diện bằng trình duyệt thường, không cần Google
npm run dong-goi  # dựng lại dist/ (bản 6 tệp để dán vào Apps Script)
```

### Thử một địa chỉ thật mà chưa cần cài vào Google Sheet

```bash
node tools/quet_that.js "https://tencuahang.vn/collections/all" --ua "TenCuaBan/1.0 (+email@that.cua-ban)"
```

Chạy đúng mã của công cụ nhưng gọi mạng thật, in kết luận ra màn hình và ghi một tệp CSV.
Dùng để thử nhanh một đối thủ mới, hoặc để kiểm chứng khi nghi công cụ đọc sai.
**Nhớ đặt `--ua` thành email liên hệ thật của bạn** trước khi quét website của người khác.

Trong Apps Script, chạy `CHAN_DOAN` để kiểm tra nhanh ngay trên Google: nó chạy lại bảng số
tiếng Việt và bảng phân loại URL, kiểm tra các bảng và cài đặt, và báo nếu có lần quét đang dở.

**Nếu sửa `08_KET_LUAN.js` thì bắt buộc chạy lại `test/04_ket_luan.test.js` và
`test/05_dot_bien.test.js`** trước khi dùng.
**Nếu sửa giao diện** thì chạy `npm run xem-truoc` rồi mở tệp bằng trình duyệt — nhanh hơn
nhiều so với dán lại vào Apps Script để thử.
**Sửa bất cứ thứ gì trong `src/` thì phải chạy `npm run dong-goi` và commit lại `dist/`**,
vì `dist/` mới là thứ người dùng dán vào Apps Script. Bộ kiểm thử sẽ báo đỏ nếu bạn quên.

---

## 12. Giới hạn đã biết

Đọc [DIEM-MU.md](DIEM-MU.md). Đó là danh sách những chỗ công cụ này nói không đủ, viết thẳng,
không tô hồng. Nên đọc trước khi dùng số liệu cho quyết định giá.
