# Đối soát yêu cầu thêm 72 thanh toán báo cáo — 31/10/2026

Trạng thái: **KHÔNG KHẢ THI với các ràng buộc hiện tại; chưa apply, chưa deploy**.
Không có 72 bản ghi mới hoặc payload thanh toán mới. Chỉ bổ sung SQL SELECT để tái kiểm tra,
hai kiểm thử chính sách giá và tài liệu này. Không chạy lại seed/prepare/import.

## Nguồn và phạm vi

- Source mới nhất đã đọc: `friend/main` tại `3eca2f387f13ec103f507678f630a9a5b56603ae`.
- Đã đọc README, `prepare.ts`, `RecoveryStore.java`, `PresentationRecoveryService`,
  `AdminDashboardService.paymentSummary`, `PaymentTransactionRepository`, `PaymentQuoteService`,
  `AdminInsightsService`, payment ledger, component dashboard và luồng CSV backend/frontend.
- Đọc MySQL production qua SSL trong transaction READ ONLY, không khởi động Spring với DB production.
- Snapshot đầu: `2026-10-31T08:18:27.450589Z` (15:18:27 giờ Việt Nam).
- Chạy lại SQL đã lưu: `2026-10-31T08:23:01.508259Z` (15:23:01 giờ Việt Nam), cùng kết quả.
- Kỳ tháng: `[2026-10-01 00:00, 2026-11-01 00:00)`, UTC+7.
- Kỳ 30 ngày: `[2026-10-02 00:00, 2026-11-01 00:00)`, UTC+7.
- Đây là hai kỳ lọc theo ngày đã yêu cầu, không phải tuyên bố đã có dữ liệu tương lai đến cuối ngày 31.
  `AdminInsightsService` còn giới hạn kỳ đang diễn ra theo `asOf`; paymentSummary hiện dùng toàn khoảng ngày.

## Baseline từ nguồn hiện tại

Hai kỳ trên có cùng kết quả thanh toán:

| Đại lượng | Số tiền (VNĐ) | Giao dịch chuẩn | Booking duy nhất |
|---|---:|---:|---:|
| Thu online xác minh | 1.215.458 | 36 | 36 |
| Cọc xác minh | 1.169.458 | 34 | 34 |
| Thanh toán đủ | 46.000 | 2 | 2 |

`1.169.458 + 46.000 = 1.215.458`.
Cọc gồm 31 khoản DEPOSIT_05 tổng 1.152.958đ và 3 khoản DEPOSIT_50 lịch sử tổng 16.500đ.
Không tạo mới DEPOSIT_50: `PaymentQuoteService.calculate` từ chối với `POLICY_CHANGED`.

Định nghĩa hiện tại: tổng `PaymentTransaction.amount` của giao dịch PAID có `paidAt`,
không manual review, ID PAID nhỏ nhất của từng booking, CUSTOMER và supplier không demo;
lọc theo `paidAt`. Đây là tiền online gross, chưa trừ hoàn tiền ngoài app, không phải hoa hồng,
không phải tiền còn phải trả tại salon, không phải giá trị dịch vụ hoàn thành.
“36 lịch” là 36 booking duy nhất. Truy vấn hiện đếm 36 transaction chuẩn vì mỗi booking chỉ còn một
transaction sau canonicalization; không phải 71 lượt thử/40 PAID của toàn bộ sổ vận hành.

Không có giao dịch chuẩn ngày 01/10 làm chênh hai kỳ thanh toán này. Không suy ra rằng các
thống kê booking theo `createdAt` cũng bằng nhau: partition có 6 booking tạo ngày 01/10.

## Dữ liệu mô phỏng đã có

- Một payload version 1, ID `beautylink-presentation-20261031`.
- SHA-256: `5471ec094a4a225edd2c2c34f713c9fdd74ac5c349f7440765fe4ea504aaaa56`.
- 143 booking báo cáo / 143 ID duy nhất, 69 hồ sơ báo cáo; chưa có mảng payment batch/receipt.
- Tổng giá trị 143 booking: 2.812.000đ. Cộng 233.000đ của 4 đơn COMPLETED gốc
  thành 3.045.000đ **giá trị dịch vụ**, không phải tổng tiền thanh toán.
- Tổng `simulatedOnlineAmount` cũ: 1.430.000đ. Đây là metadata mô phỏng cũ,
  không có đầy đủ loại/thời điểm/biên nhận thanh toán để tự chuyển thành ledger.
  Các `verifiedOnlineAmount` đều null; paymentSummary, insights tiền xác minh, ledger và CSV không cộng metadata này.
- Do đó phần bổ sung được yêu cầu vẫn là `3.045.000 − 1.215.458 = 1.829.542đ`,
  không tự cộng thêm 1.430.000đ rồi tạo lại cùng các khoản đó.
- Không có orphan service/supplier hoặc sai cặp service–supplier trong 143 booking.
  Kiểm tra này chưa chứng minh đầy đủ customer/practitioner/lịch của một kế hoạch mới.

## Hai chứng minh độc lập khiến yêu cầu không thể đạt

1. **Không đủ giá trị của đúng 72 booking báo cáo hiện có.**
   Giá trị từng booking nằm trong 15.000–30.000đ.
   SQL sắp giảm dần, ổn định theo ID, chọn 72 booking lớn nhất có tổng **1.675.000đ**.
   Ngay cả khi trả đủ tất cả, tổng bổ sung vẫn thiếu **154.542đ** so với 1.829.542đ.
   Bất kỳ khoản cọc nào cũng không thể làm tổng cao hơn trả đủ.
   Trần số học của tổng gộp tương ứng là **2.890.458đ**; đây là upper bound,
   chưa phải batch đã duyệt qua toàn bộ kiểm tra quan hệ/lịch.

2. **Phần lẻ không phù hợp quy tắc giá/cọc.**
   Tất cả giá trị booking báo cáo là bội số 1.000đ. Cọc 5% HALF_UP cho ra 750–1.500đ,
   đều dưới mức tối thiểu 2.000đ của chính sách quote hiện tại; trả đủ là lựa chọn khả dụng.
   Tổng các khoản trả đủ luôn là bội số 1.000đ, trong khi `1.829.542 mod 1.000 = 542`.
   Kể cả chỉ xét công thức 5% mà bỏ qua ngưỡng tối thiểu, các khoản đều là bội số 50đ,
   trong khi `1.829.542 mod 50 = 42`.
   Toàn bộ 122 dịch vụ đang active, không demo, cũng có giá là bội số 1.000đ.
   Các booking vận hành chưa có PAID được kiểm tra cũng có tổng là bội số 1.000đ;
   không dùng chúng để giả lập thanh toán thật hoặc nới phạm vi ghi.

143 giá trị báo cáo đều khác giá catalog hiện hành. README cũ ghi rõ đây là định giá
báo cáo đã phục hồi, không phải giá niêm yết/receipt. Không tự đổi các giá trị cũ sang
catalog hoặc bịa voucher/phí để vượt hai ràng buộc trên. Không nhét 542đ vào dòng cuối.

## Trạng thái dry-run và phương án cần quyết định

Đã thực hiện **preflight/dry-run đối soát và kiểm tra tính khả thi**, chưa tạo kế hoạch 72 dòng
đạt mục tiêu vì không có nghiệm. Chưa triển khai schema payment batch, write transaction,
CAS baseline, idempotency hay rollback: không có batch hợp lệ để ghi hoặc rollback.
SQL preflight chạy lại không đổi dữ liệu; điều này không thay thế kiểm thử idempotency của batch apply.

Phương án giữ nguyên dữ liệu/giá hiện tại:

- Giữ 3.045.000đ ở chỉ số **Tổng giá trị dịch vụ**, tiếp tục để tiền xác minh đúng nguồn hiện tại;
  không gọi số này là tổng thanh toán.
- Nếu vẫn cần đúng 72 receipt báo cáo, phải chọn mục tiêu tiền thấp hơn/khả thi,
  không vượt trần 2.890.458đ khi dùng booking báo cáo hiện có; sau khi xác nhận mới lập
  72 dòng, kiểm tra toàn bộ quan hệ/thời điểm, lưu partition và xây các tổng hợp cùng nguồn.

Giữ đồng thời 72 dòng, toàn bộ booking/giá cũ và tổng thanh toán 3.045.000đ là không thể.
Không tự đổi định nghĩa, baseline thật hoặc một ràng buộc của người dùng để đạt con số.

## Kiểm thử và an toàn

- Backend: **26/26** đạt, 0 lỗi/skip: PaymentQuoteServiceTest (6, gồm 2 test mới),
  AdminDashboardAggregationTest (1), AdminDashboardV2IntegrationTest (18), AdminRevenueCsvTest (1).
  H2/test profile cô lập; gồm canonical PAID, duplicate attempts, phạm vi quyền và dữ liệu phục hồi,
  tổng chart DAY/WEEK/MONTH, source thu xác minh, CSV và quy tắc tiền cọc/rounding.
- Frontend: **29/29** đạt trong adminDashboard/adminV2/adminRefinement/adminDetailSpa/adminComparison;
  gồm CSV phân trang đúng phạm vi, ngày lọc, trạng thái, source backend và request cũ không ghi đè giao diện.
- Không có runtime/frontend/API thay đổi. Chưa chạy browser desktop/mobile cho luồng 72 receipt mới,
  vì luồng đó chưa được triển khai/apply. Không tuyên bố screenshot-ready hoặc đã kiểm thử end-to-end batch.
- Đối chiếu fingerprint 5 nguồn khớp bản trước: bookings, payment_transactions, user_accounts,
  suppliers, nguyên payload phục hồi. Hash tài chính bao gồm amount, remaining, option, status,
  paidAt, link/order references và manual-review; không bao gồm timestamp kỹ thuật của background reconciliation.
- Không gửi email, tạo checkout, gọi PayOS, sửa `verified*`, sửa bảng giá, đổi ngày giao dịch thật,
  xóa audit/backup, thêm tài khoản hoặc booking. Không có production write từ công việc này.
- Số khoản thêm **0**; tổng trước/sau **1.215.458đ**; cọc **1.169.458đ**;
  trả đủ **46.000đ**; booking duy nhất trước/sau **36** trong cả hai kỳ.

Các kiểm tra 72 ID mới, tổng batch, idempotency apply, rollback batch, CSV báo cáo mới và desktop/mobile
cho batch chưa thực hiện, không được đánh dấu đạt. Cần quyết định mục tiêu khả thi trước khi tiếp tục.
