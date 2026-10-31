# Batch 144 booking báo cáo và cọc — 31/10/2026

## Mục tiêu đã đổi

Người dùng cho phép thêm 144 booking báo cáo COMPLETED, có cọc, tổng thanh toán gần 3.045.000đ.
Không còn ràng buộc đúng 72 khoản hoặc đúng tuyệt đối 3.045.000đ. Giữ nguyên mọi dữ liệu cũ,
không tạo hồ sơ/chuyên viên mới và không thực hiện nghiệp vụ thanh toán trên booking vận hành.

## Baseline và kế hoạch

Đọc nguồn production lúc `2026-10-31T08:52:16.891183400Z`, giờ Việt Nam 15:52:16.
Khoảng mục tiêu `[01/10/2026 00:00, 01/11/2026 00:00)`, UTC+7;
tất cả khoản mới ghi nhận từ 02/10 trở đi nên phạm vi 02–31/10 có cùng tổng thanh toán.

| Đại lượng | Trước | Bổ sung | Dự kiến sau |
|---|---:|---:|---:|
| Thu online xác minh | 1.215.458đ | 0đ | 1.215.458đ |
| Cọc báo cáo gồm hai nguồn | 1.169.458đ | 1.829.750đ | 2.999.208đ |
| Thanh toán đủ | 46.000đ | 0đ | 46.000đ |
| Tổng thanh toán báo cáo | 1.215.458đ | 1.829.750đ | 3.045.208đ |
| Khoản thanh toán / booking có thanh toán | 36 / 36 | 144 / 144 | 180 / 180 |
| Booking COMPLETED, snapshot cohort tháng | 147 | 144 | 291 |

Chênh lệch mục tiêu: +208đ. Giá từ catalog, không thay giá/phí/voucher hoặc điều chỉnh phần dư vào receipt.
Giá trị dịch vụ mới 36.595.000đ; cọc 1.829.750đ (5%); còn tại salon 34.765.250đ.
Giá trị dịch vụ COMPLETED của cohort tháng dự kiến 39.640.000đ, không phải tổng thanh toán.
Khoản metadata mô phỏng cũ 1.430.000đ tiếp tục không tự chuyển thành receipt hoặc cộng lại.

Payload mới nằm ở hàng `beautylink-report-payments-144-20261031-v1` trong bảng phục hồi hiện có.
Hàng cũ `beautylink-presentation-20261031` giữ nguyên byte/hash. Mỗi khoản mới source=SIMULATED,
không có orderCode, paymentLinkID, signature, webhook hay verified receipt.
Không có 144 booking mới trong bảng `bookings` vận hành; đây là hồ sơ báo cáo riêng.

## Kiểm tra đã thực hiện

- Dry-run operator đọc lại DB, hash baseline/reference/lịch thật/receipts: VALIDATED 144/144.
- Validator kiểm tra khách, salon, dịch vụ, chuyên viên/assignment, giá/duration, giờ làm/nghỉ,
  ngoại lệ, lịch bận thật + lịch báo cáo cũ + lịch mới, tạo → cọc → hẹn → hoàn thành và mốc chốt.
- Browser Chromium 1440px và 390px, Spring/JWT/API/H2 cô lập có 144 bản ghi:
  đối chiếu toàn bộ receipt với booking, mở cùng record từ Thanh toán và Lịch đặt cho ra cùng chi tiết;
  chart DAY/WEEK/MONTH khớp tổng, ngày lọc làm thay đổi tổng; CSV báo cáo có 144 khoản mô phỏng,
  CSV PayOS không có chúng; không lỗi API 5xx/JS hoặc tràn ngang toàn trang.
- Integration test: API ADMIN yêu cầu quyền, SUPPLIER chỉ thấy salon sở hữu kể cả gửi salonId khác;
  tổng/cọc/trả đủ/salon/pagination khớp, verified summary/revenue không đổi;
  marker rollback loại batch khỏi view nhưng vẫn giữ payload audit.
- Unit tests: công thức quote khớp PaymentQuoteService; từ chối ID trùng, orphan, sai supplier,
  phần dư giả, field PayOS, verified giả, giờ nghỉ/xung đột và thời điểm không hợp lệ.

## Trạng thái thực thi

- Code, công cụ dry-run và kiểm tra desktop/mobile: đã thực hiện.
- Apply production và chạy lại no-op: CHƯA thực hiện tại thời điểm lập tài liệu này.
- Deploy bản mới lên beautylink.cloud: CHƯA thực hiện tại thời điểm lập tài liệu này.
- Chưa thay đổi giao dịch/booking vận hành, tài khoản, bảng giá, PayOS hoặc audit/backup thật.

Tài liệu sẽ được cập nhật bằng kết quả apply/deploy thực tế; số dự kiến không phải xác nhận đã ghi nhận thanh toán ngoài hệ thống.
