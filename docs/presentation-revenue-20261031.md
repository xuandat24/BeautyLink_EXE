# Đối soát dữ liệu trình bày BeautyLink — 31/10/2026

## Yêu cầu mới nhất: khôi phục bộ dữ liệu trước đây trên chính database hiện tại

Sau bản phát hành dùng dữ liệu thật, người dùng đã xác nhận muốn giữ lại bộ dữ liệu trình bày trước đây, chỉ điều chỉnh tiền để tổng là 3.045.000đ, có ngày cao/thấp. Không thay bằng bộ 10 đơn; không tạo database hoặc website khác. Phương án mới và đối soát được ghi tại [scripts/presentation-recovery/README.md](../scripts/presentation-recovery/README.md). Các mục bên dưới là bằng chứng của môi trường cô lập trước đó, **không phải kết quả production của lần khôi phục mới**. Chỉ công bố đã nhập/deploy sau khi kiểm tra thực tế.

Ghi nhận dưới đây thuộc giai đoạn kiểm thử cô lập. Sau đó người dùng đã chọn cập nhật **beautylink.cloud với giao diện/cách tính mới, dùng dữ liệu thật**. Bản phát hành không mang bộ dữ liệu 3.045.000đ vào production và không bảo đảm production hiển thị số tiền này; seed H2 vẫn chỉ nằm trong test classpath.

## Phạm vi và định nghĩa

Mục tiêu đã được xác nhận: **3.045.000 VNĐ**, thay cho mức 3.000.000 VNĐ xuất hiện ở một số mục yêu cầu ban đầu.

Chỉ triển khai và kiểm tra trên `jdbc:h2:mem:beautylink-presentation`, profile `test,presentation`, giao diện `http://127.0.0.1:5173`. Không triển khai production, không kết nối hay ghi vào Railway/MySQL sản xuất. Dừng tiến trình thì dữ liệu trong bộ nhớ mất; khởi động lại tái tạo cùng kế hoạch.

- Backend Admin trước sửa: `revenue` là tổng tiền online của giao dịch `PaymentTransaction.PAID` đầu tiên theo booking, có `paidAt`, không cần đối soát thủ công; lọc theo `paidAt`, giờ Việt Nam. Booking hủy vẫn có thể có tiền thực thu; `COMPLETED` không phải điều kiện của khoản thu. Không phải giá trị dịch vụ, lợi nhuận đối tác hay hoa hồng.
- Giao diện trình bày cũ: lớp frontend thay số liệu bằng hoa hồng 1.906.000đ và số lượng cố định. Đây không phải baseline tài chính đã xác minh. Lớp ghi đè Admin đã được ngắt khỏi API chạy thật.
- Supplier trước sửa: cộng mọi đơn không hủy, kể cả đơn chưa hoàn thành. Nay chỉ cộng `Booking.totalAmount` của `COMPLETED`, trên toàn bộ lịch sử của chính supplier.
- `completedServiceValue` mới: tổng `Booking.totalAmount` của các đơn `COMPLETED` có khách `CUSTOMER`, theo cohort `createdAt` trong khoảng lọc, giờ Việt Nam; cùng cohort với số đơn hoàn thành. Không suy số đơn từ tiền, không lấy cọc 5% làm giá trị thanh toán đủ. Đây là giá trị gộp của dịch vụ hoàn thành, không phải doanh thu thuần sau hoàn tiền; `paymentStatus` không thay đổi định nghĩa giá trị dịch vụ này.
- Thẻ “Doanh thu”, biểu đồ và giá trị theo salon dùng `completedServiceValue`. “Cách tính” nêu rõ đây là **tổng giá trị dịch vụ**, không phải tiền thực thu.
- Tiền online thật vẫn nằm trong trường `revenue`, bảng thanh toán/CSV và “Tổng thu online xác minh theo paidAt”, không bị cộng thêm khoản mô phỏng.

## Baseline và hồ sơ bổ sung

Baseline đã đo trong **cơ sở dữ liệu cô lập mới**, sau khi chạy seed catalog có sẵn: **0đ, 0 đơn hoàn thành, 0 giao dịch PayOS**. Chưa truy cập tài khoản admin/database production nên không khẳng định baseline production. Không nhập, tạo lại hay thay thế bộ 80 khách/24 chuyên viên được nhắc tới; bộ đó không có trong seed của bản mã nguồn này.

Tái sử dụng `DevelopmentDataSeeder` và `PartnerCatalogSeeder`. Bộ bổ sung booking không tạo customer, supplier, service hay practitioner mới. Giá lấy nguyên từ service đã seed; nếu danh mục thay đổi làm tổng lệch, dừng và rollback thay vì sửa giá/đơn để ép tổng. Tất cả chín đơn bắt đầu 09:00, ngày dịch vụ khác nhau. Ngày tạo là 10:00 ngày trước đó, giờ Việt Nam.

| Mã đơn | Salon | Dịch vụ | Ngày tạo | Ngày dịch vụ | Kết thúc | Giá trị VNĐ |
| --- | --- | --- | --- | --- | --- | ---: |
| BL26100001 | Lumière Beauty House | Makeup trong trẻo cá nhân | 04/10 | 05/10/2026 | 10:30 | 450.000 |
| BL26100002 | Lumière Beauty House | Cắt & tạo kiểu cá nhân | 06/10 | 07/10/2026 | 10:15 | 380.000 |
| BL26100003 | Lumière Beauty House | Massage thư giãn toàn thân | 08/10 | 09/10/2026 | 10:30 | 620.000 |
| BL26100004 | Lumière Beauty House | Chăm sóc da phục hồi | 11/10 | 12/10/2026 | 10:30 | 580.000 |
| BL26100005 | Thẩm mỹ Hiền Trần | Điều trị mụn | 15/10 | 16/10/2026 | 10:15 | 500.000 |
| BL26100006 | Trang Tuti | Nối mi | 18/10 | 19/10/2026 | 10:15 | 300.000 |
| BL26100007 | Trang Tuti | Uốn mi | 20/10 | 21/10/2026 | 10:00 | 150.000 |
| BL26100008 | Trang Tuti | Gội đầu cặp | 22/10 | 23/10/2026 | 09:40 | 35.000 |
| BL26100009 | Trang Tuti | Gội đầu thường | 25/10 | 26/10/2026 | 09:30 | 30.000 |
| **Tổng** | | | | **9 đơn hoàn thành** | | **3.045.000** |

Các ID khóa ngoại lấy từ hồ sơ đã tồn tại trong H2, không bịa ID để ghép bảng. Người thực hiện được chọn trong supplier tương ứng và phải hỗ trợ service; kiểm tra lịch làm, giờ nghỉ, ngoại lệ và giao nhau của cả khách lẫn chuyên viên. Chạy lại không tạo trùng mã đơn; baseline không nhận diện được thì dừng, không ghi đè.

Thêm ba đơn riêng chưa hoàn thành để kiểm tra phân bố trạng thái: `BL26101001` PENDING (02/11), `BL26101002` CONFIRMED (03/11), `BL26101003` CANCELLED (04/11), mỗi đơn 450.000đ tại Lumière. Tổng booking hiện tại **12**, hoàn thành **9**. Những đơn này không đóng góp giá trị dịch vụ hoàn thành. Đơn PENDING tuân theo thời hạn giữ chỗ thật; không vô hiệu hóa cơ chế hết hạn.

## Biến động và đối soát

- Giá trị theo ngày tạo: 450.000 → 380.000 → 620.000 → 580.000 → 500.000 → 300.000 → 150.000 → 35.000 → 30.000đ ở những ngày tương ứng trong bảng; các ngày còn lại 0đ. Có ngày cao, thấp và không phát sinh, không chỉnh dữ liệu biểu đồ độc lập.
- Theo supplier: Lumière **2.030.000đ / 4 đơn hoàn thành**; Hiền Trần **500.000đ / 1 đơn**; Trang Tuti **515.000đ / 4 đơn**. Tổng **3.045.000đ / 9 đơn**.
- Ngày, tuần (bắt đầu thứ Hai), tháng: tổng `completedServiceValue` luôn **3.045.000đ** cho cùng kỳ 01–31/10/2026. Tổng booking trong các bucket bằng tổng booking của cùng khoảng lọc.
- Thu online xác minh: **0đ**. Giao dịch/biên nhận PayOS: **0**. Không ngụ ý toàn bộ giá trị dịch vụ đã được thu.

## Tính mô phỏng và an toàn

Chín booking hoàn thành là mô phỏng trong H2 dùng cho trình bày. Seed đi qua `PENDING → CONFIRMED → COMPLETED`, gọi chính `BookingService.complete` sau giờ kết thúc. `PARTIALLY_PAID` chỉ là trạng thái thanh toán mô phỏng để kiểm tra lifecycle trong cơ sở dữ liệu dùng một lần; không có số tiền thu xác minh, payment link, transaction ID, chữ ký hay webhook giả. Không ghi `PaymentTransaction`.

Server chỉ có trong **test classpath**, không được đóng gói vào JAR production. Kiểm tra profile và URL kết nối H2 trong bộ nhớ trước seed; từ chối `prod`, MySQL và database trên đĩa. PayOS, webhook registration và email giao dịch không được cấu hình/gửi trong môi trường này. Không thêm badge hay panel debug vào giao diện.

## Chạy và đăng nhập cục bộ

Yêu cầu JDK 21 trở lên (đặt `JAVA_HOME`), Maven, Node và `npm ci` trong frontend.

Terminal 1, từ thư mục repository:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-presentation.ps1
```

Terminal 2:

```powershell
cd frontend
npm run presentation
```

Mở http://127.0.0.1:5173/#login. Tài khoản **chỉ tồn tại trong H2 cục bộ**: Admin `0900000004`, Supplier Lumière `0900000002`, Customer `0900000001`; mật khẩu seed cục bộ `BeautyLinkTest123!`. Đây không phải thông tin đăng nhập production.

Mode `presentation` ép API về proxy `/api` → localhost:8080 và tắt lớp frontend tạo số liệu cũ, kể cả khi máy có biến môi trường cũ. Admin lấy nguyên danh sách, số lượng và tổng từ Spring.

## Bằng chứng kiểm tra

- Kết quả: **192 kiểm thử frontend qua**, lint TypeScript và build mode presentation qua. **225 kiểm thử backend khác nhau qua** trong các bộ liên quan; **1 trường hợp MySQL** được bỏ qua vì không có cấu hình DB test đó. Không thay bằng kết nối production.
- `PresentationDatasetTest`: tổng chính xác; giá/khóa ngoại/đội ngũ/thời gian; lịch không trùng; count từ record; ngày cao/thấp/0; ngày/tuần/tháng; tổng supplier; không tạo customer/practitioner hay payment; idempotence; baseline không nhận diện thì không ghi.
- `PresentationIsolationTest`: từ chối profile prod và URL MySQL trước khi chạy câu lệnh SQL.
- Các bộ hồi quy Auth, Booking, Payment và Admin chạy trên DB test riêng. Kiểm tra MySQL phụ thuộc biến môi trường bị bỏ qua nếu chưa cấu hình, không truy cập production thay thế.
- Frontend: kiểm thử tổng từ API, không lấy hoa hồng/cọc làm giá trị hoàn thành; đã bỏ hai đoạn chữ yêu cầu.
- `frontend/tests/presentationRevenueSmoke.mjs`: đăng nhập thực qua Spring, không mock Admin API; desktop 1920 và mobile 390; Admin/booking history/Supplier; đối soát ngày–tuần–tháng; không tràn ngang và không lỗi JS.
- Ảnh: `backend/target/presentation/admin-1920.png`, `admin-390.png`, `supplier-1920.png`, `supplier-390.png`. Báo cáo máy đọc: `backend/target/presentation/reconciliation.json`. Không lưu token/cookie trong artifact.

Không thực hiện deploy, thay đổi biến môi trường hosting, migration hay bất kỳ production write nào. Không xóa dữ liệu giao dịch, audit hoặc backup.
