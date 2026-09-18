# Điểm mù — những chỗ công cụ này nói không đủ

Viết thẳng, không tô hồng. Đọc trước khi dùng số liệu cho quyết định giá.
Thứ tự: nguy hiểm nhất trước.

---

## A. Điểm mù lớn nhất: kết luận đo ĐỘ ĐẦY, không đo ĐỘ ĐÚNG

`CAO` nghĩa là **"ô nào cũng có dữ liệu và dữ liệu lấy thẳng từ API của nền tảng"**.
Nó **không** nghĩa là "giá này đúng với giá khách phải trả".

Nếu website ghi sai giá trong dữ liệu của chính họ, hoặc giá trong API khác giá hiển thị trên
trang, công cụ vẫn ghi `CAO`. Không có cách nào phát hiện điều đó mà không mở trang ra xem.

**Hệ quả thực tế:** với quyết định giá quan trọng, hãy mở tay 3 dòng để đối chiếu — kể cả khi
kết luận là `CAO`. Kết luận giúp bạn biết *mức độ cần nghi ngờ*, không thay bạn kiểm chứng.

---

## B. Những loại giá công cụ không bao giờ nhìn thấy

1. **Giá chỉ hiện sau khi bấm "Thêm vào giỏ".** Nhiều nhà phân phối và hàng thương hiệu cao
   cấp giấu giá theo cách này. `products.json` trả về giá niêm yết, còn giá thật chỉ xuất hiện
   ở bước giỏ hàng. Công cụ không bao giờ thêm hàng vào giỏ.
2. **Giá thành viên / giá đăng nhập.** Công cụ không đăng nhập bao giờ, nên luôn nhìn thấy giá
   khách vãng lai. Cửa hàng B2B hoặc có hạng thành viên sẽ bị đọc sai một cách có hệ thống.
3. **Flash sale theo khung giờ.** Quét lúc 9h và lúc 21h cho hai kết quả khác nhau, cả hai đều
   "đúng" tại thời điểm đó. Bảng `THAY_DOI` sẽ báo `GIAM_GIA` cho một đợt sale kéo dài 2 tiếng
   y như một lần giảm giá thật.
4. **Giá theo vùng / theo tiền tệ khách.** Shopify Markets, và nhiều nền tảng khác, đổi giá
   theo IP người xem. Công cụ đi từ IP trung tâm dữ liệu của Google (thường ở nước ngoài), nên
   có thể nhận giá của thị trường khác chứ không phải giá khách Việt Nam nhìn thấy.
5. **Mã giảm giá, combo, mua 2 tặng 1, phí vận chuyển.** Giá thật khách trả khác cột `gia_ban`.
   Công cụ không mô hình hoá khuyến mãi. Hai cửa hàng cùng giá niêm yết có thể chênh nhau 20%
   sau phí ship.
6. **`gia_goc` (giá gạch ngang) thường là giá neo bịa.** Rất nhiều cửa hàng Việt Nam đặt
   `compare_at_price` cao gấp rưỡi mãi mãi. Đừng tính "% giảm giá" từ cột này rồi tin.
7. **Giá theo số lượng / giá sỉ theo bậc.** Không có trong API công khai nào.

---

## C. Tồn kho và số bán

8. **`so_luong_ton` gần như luôn trống.** `products.json` công khai không trả tồn kho.
   WooCommerce chỉ trả khi cửa hàng bật hiển thị. Cột này trống không phải lỗi.
9. **`con_hang` là trạng thái, không phải số lượng.** `CON` có thể là 1 cái hoặc 10.000 cái.
10. **Con số tồn kho khi có thì thường là con số marketing.** "Chỉ còn 3 sản phẩm" là chiêu
    tạo khan hiếm, không phải dữ liệu kho. Công cụ ghi lại đúng thứ nền tảng công bố; nó không
    biết con số đó có thật hay không.
11. **`so_da_ban` luôn trống.** Chỉ các sàn (Shopee/Lazada/TikTok) công bố số này, mà đó đúng
    là những nơi công cụ không quét được. Cột này tồn tại vì đặc tả yêu cầu, và nó sẽ trống
    cho tới khi có nguồn hợp lệ.

---

## D. Tiền tệ

12. **Không có ký hiệu thì cột `tien_te` bỏ trống** — kể cả tên miền `.vn`. Đây là lựa chọn có
    chủ ý: đoán VND từ tên miền là bịa. Nhưng hệ quả là nhiều lần quét bậc 1 có cột `tien_te`
    trống, dù người đọc "biết thừa" đó là VND.
13. **Ký hiệu không định danh được tiền tệ.** `$` có thể là USD, SGD, AUD, CAD. Công cụ ghi
    `USD` khi thấy `$`, và **điều đó có thể sai** với website Singapore hay Úc.
14. **`đ` và `₫` ổn, nhưng một số theme viết `VNĐ`, `vnd`, `Đ`** — đã xử lý; theme viết kiểu
    khác nữa thì không.

---

## E. Sai lệch từ chính cách lấy dữ liệu

15. **Bậc 5 (đoán từ HTML) ghép giá với **link gần nhất phía trước**.** Đó là phỏng đoán. Một
    trang có giá khuyến mãi của sản phẩm khác nằm chen giữa sẽ bị ghép sai. Vì vậy bậc 5 luôn
    bị đóng trần ở `THAP`.
16. **Giá theo khoảng bị bỏ trống, không chọn đại diện.** Sản phẩm biến thể trong WooCommerce
    Store API (`price_range`) và `AggregateOffer` trong JSON-LD chỉ có giá thấp nhất–cao nhất.
    Công cụ để trống kèm lý do thay vì lấy giá thấp nhất. Điều này **kéo tỷ lệ có giá xuống**
    và hạ kết luận — đúng như mong muốn, nhưng có thể gây bất ngờ.
17. **WooCommerce Store API không trả giá từng biến thể** ở endpoint danh sách. Cửa hàng Woo
    nhiều biến thể sẽ ra một dòng cho mỗi sản phẩm, không phải mỗi biến thể — khác với cửa
    hàng Shopify/Haravan. **Không so trực tiếp số dòng giữa hai nền tảng được.**
18. **JSON-LD có thể sai hoặc cũ.** Nó do theme sinh ra; có theme chép nguyên mẫu, quên cập
    nhật giá khi có khuyến mãi. Bậc 3–4 vì thế chỉ tối đa `TRUNG_BINH`.
19. **Sitemap có thể cũ**: chứa sản phẩm đã gỡ, thiếu sản phẩm mới. Bậc 3 lấy theo sitemap nên
    thừa hưởng nguyên sai lệch đó.
20. **`products.json` chỉ có sản phẩm đã xuất bản lên kênh Online Store.** Sản phẩm ẩn, sản
    phẩm chỉ bán ở kênh khác, hoặc bản nháp sẽ không xuất hiện. "Cửa hàng có 200 sản phẩm"
    theo công cụ có thể khác con số trong trang quản trị của họ.
21. **Trần 20 trang (mặc định).** Cửa hàng 5.000 sản phẩm sẽ bị cắt. Kết luận vẫn tính trên
    phần lấy được, nên có thể `CAO` cho một danh mục **không đầy đủ**. Xem `so_sp` so với quy
    mô cửa hàng bạn biết, và tăng `gioi_han_trang` nếu cần.
22. **Chống trùng theo `ma_ngoai` trong một lần quét.** Nếu một cửa hàng dùng lại cùng một mã
    cho hai sản phẩm khác nhau (hiếm, nhưng có ở site tự code), dòng thứ hai sẽ bị bỏ.
23. **Dán link danh mục của nền tảng không phải Shopify/Haravan/Sapo thì công cụ đọc cả cửa
    hàng.** Chỉ `/collections/{tên}` mới lọc được đúng danh mục. Với `/product-category/...`
    của WooCommerce hay danh mục tự code, bậc 1–3 đều đọc theo cả cửa hàng; công cụ ghi rõ
    điều này vào cột `ly_do`, nhưng nếu bạn chỉ nhìn cột `so_sp` thì sẽ hiểu nhầm.
24. **Một lần quét dài không phải một khoảnh khắc.** Quét 3.000 dòng mất 15–20 phút vì có độ
    trễ lịch sự 1,5 giây. Giá ở dòng đầu và dòng cuối là hai thời điểm khác nhau.

---

## F. Môi trường và hạ tầng

25. **Toàn bộ mục 8 của HUONG-DAN.md**: Shopee, TikTok Shop, Lazada, Tiki, Amazon, AliExpress,
    Taobao, 1688 — không quét được, và sẽ không bao giờ quét được từ Apps Script. Đây không
    phải lỗi cần sửa; đó là giới hạn của nền tảng.
26. **Website nào dựng trang bằng JavaScript đều rơi vào cùng tình trạng**, kể cả website nhỏ
    dùng React/Vue. Công cụ nhận ra và trả `KHONG_QUET_DUOC` chứ không trả bảng trống.
27. **Nhiều website phục vụ nội dung khác cho IP trung tâm dữ liệu** — có nơi trả trang rút
    gọn, có nơi trả giá khác. Không có cách nào biết điều này từ phía công cụ.
28. **`robots.txt` trả lỗi 5xx thì công cụ không quét gì cả** (theo RFC 9309). Một website có
    `robots.txt` chập chờn sẽ ra `KHONG_QUET_DUOC` dù trang sản phẩm vẫn truy cập được.
29. **Hạn mức Apps Script**: tài khoản Google Workspace thường có ~20.000 lượt `UrlFetchApp`
    mỗi ngày và ~90 phút chạy script mỗi ngày. Quét vài cửa hàng lớn trong một ngày là chạm
    trần. Khi chạm trần, lần quét sẽ lỗi giữa chừng — vị trí vẫn được lưu, hôm sau chạy tiếp.
30. **Dòng trạng thái có thể chậm vài giây** so với thực tế, vì nó đọc từ
    `PropertiesService` ở một lần chạy khác.
31. **Trigger chạy tiếp cần quyền `ScriptApp`.** Nếu người dùng không cấp, lần quét dài sẽ
    dừng lại chờ bấm **Chạy tiếp** bằng tay (dữ liệu không mất).

---

## H. Điểm mù của bảng điều khiển và báo cáo

36. **Kết luận tin cậy lan theo nguyên tắc “tệ nhất thắng”.** Một lần quét `THAP` lọt vào
    lát cắt là cả bảng thành `THAP`, dù 95% dòng đến từ nguồn `CAO`. Điều này đúng về mặt
    logic nhưng **tạo áp lực lọc bỏ nguồn xấu chỉ để nhìn thấy chữ CAO**. Nếu bạn thấy
    mình đang làm vậy, hãy dừng lại và hỏi: bỏ nguồn đó ra thì bảng còn trả lời được câu
    hỏi ban đầu không?
37. **Báo cáo không kiểm tra hai cửa hàng có bán cùng thứ hay không.** “Danh mục” là do
    chính cửa hàng đặt tên. “Thảm phòng tắm” của A có thể gồm cả thảm chùi chân ngoài
    trời, của B thì không. Bảng so sánh vẫn cho ra một con số trung vị trông rất gọn gàng.
38. **Trung vị của nhóm dưới 5 sản phẩm gần như vô nghĩa.** Công cụ có cảnh báo, nhưng
    con số vẫn hiện ra và vẫn xuất được sang slide.
39. **Chỉ có 5 loại báo cáo cố định.** Không có chỗ tự viết công thức, không có bảng chéo
    tuỳ ý. Cần thứ khác thì xuất CSV rồi làm trong Sheet.
40. **Mỗi lần bấm “Áp dụng” là đọc lại toàn bộ bảng `SAN_PHAM`.** Khoảng 1–3 giây ở mức
    10.000 dòng, chậm dần sau đó. Trên 30.000 dòng thì nên tách bảng tính theo quý.
41. **Bảng chỉ hiện tối đa 3.000 dòng mỗi lần trả về**, nhưng mọi con số thống kê được
    tính trên TOÀN BỘ dòng khớp. Con số và bảng có thể “không khớp mắt” — con số mới đúng.
42. **Thẻ `BAO_CAO` bị dựng lại mỗi lần xuất.** Sửa tay vào đó là mất khi xuất lần sau.
    Muốn giữ thì sao chép sang thẻ khác.
43. **Bộ lọc “Chỉ lần quét mới nhất mỗi địa chỉ” bật sẵn.** Tắt nó đi mà không để ý thì mỗi
    sản phẩm sẽ xuất hiện một lần cho mỗi lần quét, và mọi trung bình đều sai — theo hướng
    khó phát hiện, vì bảng vẫn trông bình thường.
44. **Hộp thoại bảng điều khiển bị giới hạn bởi cửa sổ trình duyệt.** Màn hình nhỏ thì bảng
    phải cuộn ngang. Muốn rộng hơn thì triển khai ứng dụng web (`doGet`) và mở ở tab riêng.
45. **Biểu đồ luôn bắt đầu từ 0.** Khoảng giá 500k–520k vì thế trông gần như nhau. Đây là
    lựa chọn có chủ ý (cắt trục làm chênh lệch trông to hơn thực tế), nhưng nó khiến các
    khác biệt nhỏ khó thấy — hãy đọc cột trung vị trong bảng thay vì ước lượng bằng mắt.

---

## G. Những gì cố tình KHÔNG làm

46. Không đăng nhập, không vượt tường phí, không giải thử thách chống bot, không đổi
    User-Agent để thử lại, không gọi API nội bộ của sàn, không dùng proxy.
47. Không thu thập dữ liệu cá nhân: không tên người đánh giá, không nội dung đánh giá, không
    số điện thoại, không địa chỉ. Chỉ lấy điểm trung bình và số lượt — là số tổng hợp.
48. Không quét song song nhiều địa chỉ: hàng đợi chạy lần lượt, để giữ độ trễ lịch sự.
49. Không tự sửa dữ liệu "trông sai". Giá 3,5 VND được ghi kèm cảnh báo, không bị nhân lên
    1.000 lần.
