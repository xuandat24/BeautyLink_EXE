# Khôi phục lịch sử trình bày trên database BeautyLink hiện tại

## Cập nhật giao diện: nhóm 71 khách hàng quay lại

Yêu cầu trình bày mới thay chỉ tiêu 72 bằng **71**; nút Chi tiết mở tab
Người dùng → Khách hàng quay lại. `selectReturningPresentationCustomers` sắp xếp cùng thứ tự
với danh sách tài khoản (createdAt giảm dần, id giảm dần), bỏ 85 vị trí đầu, chỉ lấy CUSTOMER
và giữ tối đa 71 ID duy nhất. Tìm kiếm/phân trang áp dụng sau khi chọn nhóm; không chọn ngẫu nhiên
mỗi lần tải và không ghi booking/tài khoản để tạo lịch sử quay lại giả. Đây là nhóm được chọn
cho báo cáo, không phải kết quả thuật toán khách quay lại từ lịch sử booking; metadata trong
mã nguồn và Cách tính giữ rõ phân biệt. Khi dữ liệu tài khoản thay đổi, vị trí có thể thay đổi;
không sinh thêm tài khoản để bù nếu môi trường có ít hơn 71 ứng viên.

Bốn ô tổng hợp Thu online PayOS xác minh / Khoản từ hồ sơ báo cáo / Còn tại salon khi ghi nhận /
Số khoản thanh toán được bỏ khỏi giao diện báo cáo. Dữ liệu nguồn, tổng tiền, phân trang, bảng
chi tiết, CSV nguồn báo cáo và sổ PayOS thật không bị xóa hoặc thay định nghĩa. Không có production
DB write/seed/migration trong thay đổi này. Test browser dùng khách hàng bổ sung trên H2 test-classpath
riêng, không nằm trong JAR production.

## Chọn lại danh sách 219 đơn / 147 hoàn thành (31/10)

`ReportSelectionStore` thêm **một payload chọn lọc**, không sửa/xóa payload cũ, không chạy seed.
Loại khỏi danh sách hiện hành 143 booking phục hồi cũ chưa có receipt chuẩn và booking
`9100000078` (cọc 2.000đ); giữ 143 booking mới đúng catalog cùng 143 receipt liên kết.
Mọi API Admin/Supplier, insights, ledger báo cáo và CSV báo cáo dùng chung selection.
Người dùng/salon không bị lọc. PayOS thật và CSV xác minh không bị thay đổi.

Baseline tháng 01–31/10: 363 đơn / 291 hoàn thành / 180 receipt / 3.045.208đ.
Sau chọn: **219 / 147 / 179 / 3.043.208đ**, gồm cọc 2.997.208đ và trả đủ 46.000đ;
PayOS xác minh vẫn 1.215.458đ / 36 booking. Chênh mục tiêu 3.045.000đ là -1.792đ.
Giá trị dịch vụ và tỷ trọng trạng thái phải tính lại từ đơn còn hiển thị, không đóng băng
để tạo số mâu thuẫn. Các chỉ tiêu trình bày 85,6%, 72 và chú thích 197 đơn tháng 10 giữ riêng,
có nguồn trong Cách tính, không biến thành số đo thực tế.

Compile `ReportSelectionStore.java` cùng hai tool hiện có. Với source export mới:

1. `ReportSelectionStore plan <private-source.json> <private-selection.json>` (offline).
2. `ReportSelectionStore check <private-selection.json>` (SELECT-only dry-run).
3. Sau kiểm thử/deploy loader: `ReportSelectionStore apply <private-selection.json>`.
4. Chạy lại apply cùng file phải NO-OP; `rollback` chỉ thêm marker riêng selection.

Batch cố định `beautylink-report-payments-select219-20261031-v1`; v1/kind REPORT_SELECTION.
Apply SERIALIZABLE kiểm tra snapshot/recovery/verified/booking hash và số đơn thực tế,
chỉ INSERT partition; rollback không xóa dữ liệu audit. Không khôi phục bằng seed cũ.

Người dùng đã xác nhận giữ bộ dữ liệu trình bày trước PR #40, chỉ điều chỉnh tiền mô phỏng để cộng với các đơn hoàn thành thật thành **3.045.000đ**; có ngày cao và thấp. Không sử dụng phương án thay bằng 10 booking. Cho phép lưu partition trong chính MySQL production, không tạo database hoặc website khác.

`prepare.ts` tái sử dụng bộ sinh dữ liệu trước đó (`createPresentationAdminData`, nguồn commit `f9e46a2`). Giữ mã, người dùng, salon, dịch vụ, chuyên viên hiển thị, ngày, giờ và trạng thái của các bản ghi trình bày. Chỉ định giá lại bản ghi mô phỏng bằng trọng số ngày và giá trị cũ; dùng đơn vị 1.000đ, phân phối phần dư chính xác. Đây là **giá trị báo cáo mô phỏng**, không phải giá niêm yết hiện hành hay biên nhận dịch vụ/PayOS đã xác minh. Không sửa giá dịch vụ hoặc tiền của đơn thật. Lịch trình được giữ theo bản trình bày cũ, không đưa vào hệ thống đặt chỗ thực tế.

Đối soát nguồn ngày 31/10/2026: 217 tài khoản thật/seed đang có; bộ trình bày bổ sung các hồ sơ còn thiếu để có 286. 14 salon, 220 booking (77 bản ghi có sẵn trong phạm vi báo cáo và 143 bản ghi trình bày), 147 hoàn thành. Bốn đơn hoàn thành gốc có tổng **233.000đ**; 143 định giá mô phỏng tổng **2.812.000đ**. Tổng **3.045.000đ** cho 01–31/10/2026. Kỳ 02–31/10 sẽ thấp hơn vì giữ các đơn ngày 01/10; giao diện mặc định hiển thị tháng hiện tại, bộ lọc vẫn hoạt động đúng.

## Lưu trữ và bảo vệ

- Chỉ thêm bảng `presentation_recovery` trong database hiện tại. Một payload phiên bản có provenance riêng chứa các hồ sơ và booking mô phỏng. Không ghi vào `user_accounts`, `bookings`, `payment_transactions`, bảng chuyên viên, audit hoặc backup.
- Bản ghi phục hồi sử dụng vùng ID cũ 8/9 tỷ. Không tồn tại tài khoản đăng nhập hoặc booking vận hành tương ứng: không thể thanh toán, hoàn thành, hủy hoặc viết review qua các API vận hành. Không enqueue email hay tạo transaction ID, chữ ký, webhook hoặc biên nhận giả.
- Thu online mô phỏng cũ chỉ lưu dưới `simulatedOnlineAmount`; các trường `verified*` là null. Payment dashboard/ledger/CSV PayOS tiếp tục dùng API thật, không cộng khoản mô phỏng.
- API dữ liệu đầy đủ chỉ dành ADMIN, không cache công khai. API supplier chỉ trả booking của salon thuộc tài khoản hiện tại. Không có endpoint ghi payload.
- Admin luôn đọc và hợp nhất các bản ghi thật hiện tại, không thay thế chúng bằng ảnh chụp cũ. Dữ liệu trình bày không được sinh lại khi tải trang.
- Import mặc định là kiểm tra; chỉ lệnh `apply` mới INSERT vào đúng bảng phục hồi. Kiểm tra hostname/port/database cố định, SSL bắt buộc, baseline và khóa ngoại logic, tổng chính xác và hash các bảng thật. Không overwrite payload khác; chạy lại payload giống hệt là no-op.
- PayOS đối soát có thể cập nhật timestamp của transaction trong khi site hoạt động. Không đóng băng sổ PayOS; công cụ chỉ kiểm tra fingerprint trước/sau trong giao dịch riêng và không có câu lệnh ghi vào sổ này.
- File nguồn/payload có dữ liệu hồ sơ, chỉ giữ trong `backend/target/` (gitignored), không commit, không đưa vào bundle hoặc artifact công khai. Không xuất credential vào file/log.

## Thứ tự vận hành

1. Deploy code đã qua CI để tạo bảng phục hồi còn trống. Website vẫn dùng dữ liệu thật đến khi import thành công.
2. Tạo dependency classpath bằng `mvn dependency:build-classpath -Dmdep.outputFile=target/recovery-classpath.txt` trong backend. Java tool chỉ cần các JAR Jackson databind/core/annotations/jsr310 và mysql-connector-j trong classpath đó (không đưa toàn bộ classpath qua Windows CLI).
3. Chạy `RecoveryStore.java export target/recovery-source.json` bằng `railway run --project 050a0c1e-b9c1-4711-abe0-41d4249292d2 --environment c0daf535-7ad3-43ed-8701-8a9550850dd1 --service f47c2fcd-f435-49ba-bd63-5f3254e5cf77 --no-local -- java -cp <classpath> ../scripts/presentation-recovery/RecoveryStore.java ...`. CLI truyền credential bằng môi trường của tiến trình con; không dùng `printenv` hoặc ghi secret.
4. Từ frontend: `node --import tsx ../scripts/presentation-recovery/prepare.ts ../backend/target/recovery-source.json ../backend/target/recovery-payload.json`.
5. Dùng cùng Java command, lần lượt `check target/recovery-payload.json` rồi **`apply target/recovery-payload.json`** khi tất cả kiểm tra đạt. Nếu booking thật thay đổi, dừng và đọc lại nguồn; không sửa sổ thật để vượt kiểm tra.
6. Xác minh bảng đã lưu đủ bản ghi, tổng tiền/ngày–tuần–tháng và danh sách khớp nhau; dữ liệu thật/PayOS không bị tool chỉnh. Kiểm tra desktop/mobile, quyền ADMIN/SUPPLIER và các API thanh toán thật.

Rollback giao diện: quay về release trước; payload vẫn được giữ làm audit. Không xóa bảng, backup hoặc lịch sử thật. Muốn ngừng phục hồi thì thực hiện thay đổi cấu hình/code có kiểm soát, không sửa dữ liệu tài chính.

## Preflight yêu cầu thêm 72 khoản thanh toán báo cáo

`payment-preflight.sql` chỉ chứa SELECT, không phải công cụ apply. Chạy trong transaction
READ ONLY / REPEATABLE READ bằng kết nối operator đã xác minh ở trên; DATETIME được
đọc theo giờ Việt Nam (UTC+7), khoảng ngày là [bắt đầu, ngày sau kết thúc).
Không chạy lại `prepare.ts` hoặc `RecoveryStore apply` để thêm khoản thanh toán.
SQL cố ý kiểm tra đúng hai khoảng 01–31/10 và 02–31/10/2026, không phải bộ lọc động cho dashboard.
Không xuất tên, email, số điện thoại, thông tin tài khoản ngân hàng hoặc secret.

Kết quả và ràng buộc chặn ghi được lưu tại [payment-preflight-20261031.md](payment-preflight-20261031.md).
Bản đối soát 72 khoản là lịch sử, không phải kế hoạch hiện tại. Người dùng đã đổi yêu cầu thành
**144 booking báo cáo mới hoàn thành, đặt cọc 5%, tổng thanh toán gần 3.045.000đ**.

## Batch 144 booking và cọc báo cáo

- `PaymentBatchStore.java export` chỉ đọc snapshot nguồn hiện tại, bao gồm partition cũ,
  catalog, practitioner assignment, lịch làm việc/ngoại lệ, lịch bận và giao dịch xác minh.
- `prepare-payments.ts` tạo đúng 144 booking và 144 khoản cọc mới bằng giá catalog, không voucher/phí.
  Dùng dynamic programming để chọn tổ hợp giá hợp lệ gần mục tiêu; không thay amount của dòng cuối.
  Không tạo lại hồ sơ, chuyên viên hoặc 143 booking phục hồi cũ. Hai salon chỉ có giá 0 không đủ điều kiện cọc;
  kế hoạch phân bố trên 12 salon có dịch vụ và lịch phù hợp, có ngày cao/thấp/không phát sinh.
- `PresentationPaymentBatchValidator` kiểm tra ID, quan hệ, label tham chiếu, assignment, giá/duration,
  cọc HALF_UP 5% và ngưỡng 2.000đ, số còn lại, thời điểm tạo/cọc/hẹn/hoàn thành, working slot,
  giờ nghỉ, ngoại lệ và xung đột chuyên viên/khách với lịch thật, lịch báo cáo cũ và các dòng mới.
- `PaymentBatchStore check` dry-run bằng nguồn đọc lại từ DB. `apply` kiểm tra hash baseline, reference,
  lịch thật và khoản xác minh; ghi nguyên tử trong transaction SERIALIZABLE. Khóa batch cố định:
  `beautylink-report-payments-144-20261031-v1`. Chạy lại cùng payload là no-op; payload khác bị từ chối.
- Chỉ INSERT một hàng mới vào `presentation_recovery`, payload version 1 với `batch.version=1`.
  Không update hàng cũ; không ghi vào bảng vận hành. ID booking mới thuộc vùng 9.100.000.000–9.100.000.143.
  Payment ID là chuỗi ID báo cáo, không phải transaction/orderCode/paymentLinkID PayOS.
- `rollback` chỉ INSERT marker `<batchId>.rollback`. Service ngừng hợp nhất đúng batch đó;
  nguyên payload batch và partition cũ vẫn giữ làm audit. Chạy rollback lại là no-op;
  apply không tự kích hoạt lại batch đã rollback.
- `/api/v1/admin/report-payments` trả tổng + phân trang từ cùng danh sách chi tiết.
  `/api/v1/supplier/report-payments` luôn lấy supplier từ tài khoản đăng nhập, không từ ID phía client.
  Ngày giờ/service/practitioner trên dòng thanh toán được JOIN từ chính booking, không sao chép lịch riêng.
- Insights thêm `reportPayments`, `reportPaymentAmount` trên chart/top salon; `revenue`, `verified*`,
  API ledger/CSV PayOS giữ định nghĩa và nguồn thật. UI dùng nhãn **Tổng thanh toán báo cáo**,
  nguồn trong Cách tính/chi tiết. CSV báo cáo có source/batch/booking/calendar, không thay CSV PayOS.
- Card Đơn hoàn thành dùng `completedBookingSnapshot`: trạng thái hiện tại của cohort tạo trong kỳ,
  không bịa completedAt của đơn cũ hoặc biến snapshot thành thống kê chuyển trạng thái lịch sử.

Thực thi operator từ repo root (Java 21+; dependency JAR Jackson/mysql trong `backend/target/recovery-classpath.txt`):

1. Compile backend và hai tool RecoveryStore/PaymentBatchStore vào thư mục gitignored `backend/target/payment-tools`.
   Classpath của tool gồm `backend/target/classes`, thư mục tool và các JAR Jackson/mysql, không cần boot Spring.
2. Qua Railway run đúng project/environment/MySQL service ở mục trên, chạy
   `PaymentBatchStore export backend/target/report-144-source.json`.
3. Từ frontend chạy `node --import tsx ../scripts/presentation-recovery/prepare-payments.ts ../backend/target/report-144-source.json ../backend/target/report-144-plan.json`.
4. Chạy `PaymentBatchStore check backend/target/report-144-plan.json`; xem đủ 144 dòng trong file riêng,
   tổng trước/sau và ngày/salon, không công bố payload có dữ liệu hồ sơ.
5. Chỉ sau kiểm thử đạt, chạy `PaymentBatchStore apply backend/target/report-144-plan.json` và chạy lại để xác minh no-op.
6. Nếu cần rollback đúng batch: `PaymentBatchStore rollback backend/target/report-144-plan.json`.
   Không chạy rollback như một phép thử trên website chính; kiểm tra cơ chế trên DB cô lập.

Kế hoạch đã dry-run: baseline 1.215.458đ + cọc mô phỏng 1.829.750đ = **3.045.208đ**,
lệch +208đ so với mục tiêu tham chiếu. Cọc báo cáo sau gộp 2.999.208đ + trả đủ xác minh 46.000đ.
144 booking mới có tổng giá trị dịch vụ 36.595.000đ, số còn lại 34.765.250đ; không gọi các đại lượng này là tiền đã thu.
File source/plan, ảnh chụp và dữ liệu kiểm tra production tiếp tục chỉ nằm trong thư mục gitignored.
Tình trạng apply/deploy thực tế được cập nhật trong [report-payments-144-20261031.md](report-payments-144-20261031.md).

## Chỉ tiêu trình bày và số tiền làm tròn

Theo yêu cầu bổ sung ngày 31/10, thẻ tỷ lệ online của giao diện báo cáo có chỉ tiêu cố định
**85,6%**, nhãn “Mục tiêu báo cáo”. Đây không phải tỷ lệ đo từ giao dịch. `Cách tính` vẫn
hiển thị tỷ lệ thật, tử số/mẫu số do backend tính trong `reportOnlinePaymentRate`: booking
có PayOS xác minh hoặc receipt báo cáo / tất cả booking tạo trong cùng kỳ, bao gồm lịch hủy.
Trường `onlinePaymentRate` giữ nguyên định nghĩa riêng PayOS; không đổi trạng thái xác minh.

Thẻ tổng tiền ở overview làm tròn nghìn đồng và có dấu ≈; 3.045.208đ được trình bày thành
≈3.045.000đ. Số chính xác vẫn có trong Cách tính, phần tổng hợp thanh toán, bảng chi tiết,
CSV và API. Bộ lọc vẫn tính từ dữ liệu, không hardcode mục tiêu tiền. Giá trị dịch vụ
39.640.000đ được ghi rõ không phải tiền thu online. Biên nhận PayOS/CSV thật đặt trong
phần đối soát riêng; không biến 144 receipt mô phỏng thành giao dịch PayOS hoặc cộng lại
metadata cọc phục hồi cũ. Thay đổi này không chạy seed hoặc ghi dữ liệu production.

Thẻ Đối tác hoạt động dùng `reportActivePartners` khi có danh sách salon báo cáo: đếm ID duy nhất
active/VERIFIED còn tồn tại trong catalog theo cùng phạm vi dữ liệu. Bộ hiện tại có 14 salon.
`activePartners` giữ riêng số tài khoản chủ salon ACTIVE và salon VERIFIED trong vận hành;
không kích hoạt/khôi phục quyền đăng nhập chỉ để thay số trên dashboard. Khi không có danh sách
báo cáo, UI dùng lại metric vận hành; số báo cáo bằng 0 không được thay bằng metric vận hành.

Trong overview báo cáo, theo yêu cầu trình bày bổ sung, dòng tăng số đơn dương dùng
`round(chênh lệch / 2 + 16)` và dòng Phát sinh mới của tổng thanh toán dương dùng
`round(chênh lệch / 2 + 172000)` VNĐ. Bỏ dòng Kỳ trước trên hai thẻ này; các thẻ khác
giữ nguyên. Đây là chú thích trình bày, không phải tăng trưởng đo được; Cách tính ghi rõ
công thức và vẫn giữ số liệu đối soát gốc. Không đổi tổng hiện tại, chart, receipt hoặc CSV.
Thẻ Khách hàng quay lại hiển thị cố định 72, nguồn mô phỏng ghi trong Cách tính; không
thay số liệu khách hàng đo được từ backend hoặc tạo thêm hồ sơ. Kỳ không tăng không tự
phát sinh thêm 16 đơn hoặc 172.000đ. Không thay 14 đối tác, chỉ tiêu 85,6% hay dữ liệu thanh toán.


## Display profiles v1 — tên/email, ngày báo cáo và nhóm71 (không đổi identity)

Base đã rà soát: `cb28605a20e69aa4a799596d55c48b63ec978e53`.
Patch riêng `beautylink-display-profiles-20261101-v1` được loader đọc độc lập với batch thanh toán.
Không chạy lại `prepare.ts`, seeder hoặc sửa payload recovery bất biến.

- Phân loại: ID report trong vùng8tỷ; CUSTOMER dùng namespace dành riêng `@seed.beautylink.test`;
  SUPPLIER có owner_user_id thật và email đúng mẫu `catalog.*`/`demo.*@beautylink.local`.
  Các email khác giữ nguyên, ghi ngoại lệ `REAL_CONTACT_PRESERVED`; không suy ra email ngoài Gmail là giả.
- Alias chỉ là nhãn báo cáo, **không phải hộp thư đã xác minh** và không được dùng gửi email/OTP/reset/biên nhận.
  Local part dùng tên không dấu và hậu tố số ổn định, không dấu chấm/gạch; kiểm tra canonical Gmail dot/plus
  với mọi identity đã hợp nhất. Tên hợp lệ giữ nguyên; handle được tách thành các từ, không đoán dấu tiếng Việt.
- Plan lưu một lần theo ID, nguồn và giá trị gốc. Apply phải đúng fingerprint toàn nguồn và plan tái tính;
  chạy lại là no-op; không overwrite file khác/payload khác, không tự kích hoạt patch đã rollback.
  Khi contact/tên thật thay đổi về sau, loader bỏ alias cũ (`SOURCE_CHANGED`); nếu tài khoản thật mới trùng
  canonical alias, bỏ alias đó (`EMAIL_COLLISION`) để ưu tiên contact thật. Ngoại lệ trả trong metadata Admin.
- Nhóm71: chốt ID theo createdAt giảm dần/ID giảm dần, skip85 rồi CUSTOMER/take71 **trước** đổi ngày/A–Z.
  UI dùng chính `returningCustomerIds` đã lưu, không chọn lại nhóm khi tìm kiếm/phân trang.
- Chỉ REPORT có `reportCreatedAt` riêng: thời điểm HCM từ20/10 đến hết30/10/2026, không sau hoạt động đầu tiên.
  Đọc mọi booking vận hành và mọi lịch sử báo cáo còn lưu, kể cả booking bị loại khỏi tập báo cáo hiện hành.
  `ACTIVITY_BEFORE_WINDOW` giữ ngày cũ. Tài khoản vận hành luôn giữ ngày đăng ký thật
  (`OPERATIONAL_REGISTRATION_PRESERVED`). Loader và KPI users đọc cùng reportCreatedAt của REPORT.
- Hợp nhất theo ID → áp dụng hồ sơ → tìm/lọc → Vietnamese A–Z cả tập → phân trang → STT.
  Backend dùng projection toàn directory để có cùng collation/natural-number order với frontend, không chỉ sort
  trang hiện tại. Không tải booking ledger để sort directory. Với directory lớn cần đo và cân nhắc indexed read model.
- `ownerUserId` lấy từ `suppliers.owner_user_id`; không ghép bằng email/tên/vị trí.
  Form edit dùng account API raw và `/admin/users?forEdit=true`. Raw edit response không qua overlay.
- CSV khách xuất toàn bộ **kết quả đang lọc**, STT1..N, cùng tên/email/A–Z, giữ escape CSV và số0 đầu điện thoại.
  Các API ledger/receipt không bị ghi; chỉ customerName trong read model báo cáo được đổi nhãn.

### Compile và inventory/check — chỉ đọc database

PowerShell, từ repository root, Java21 và Maven có trong PATH:

```powershell
Set-Location backend
mvn --batch-mode --no-transfer-progress -DskipTests compile dependency:build-classpath -Dmdep.outputFile=target/display-classpath.txt -Dmdep.includeScope=test
if ($LASTEXITCODE) { throw 'Maven failed' }
$displayJars = (Get-Content target/display-classpath.txt -Raw).Trim() -split ';' | Where-Object { $_ -match 'jackson-|mysql-connector' }
$displayCp = 'target/classes;target/display-tools;' + ($displayJars -join ';')
New-Item -ItemType Directory -Force target/display-tools | Out-Null
javac -cp $displayCp -d target/display-tools ../scripts/presentation-recovery/RecoveryStore.java ../scripts/presentation-recovery/DisplayProfileStore.java
if ($LASTEXITCODE) { throw 'Tool compile failed' }
# Dùng Railway CLI đã đăng nhập, project/environment/MySQL service đã xác minh ở trên.
# MYSQL_PUBLIC_URL chỉ được truyền vào tiến trình con; không printenv, không paste vào chat.
railway run --project 050a0c1e-b9c1-4711-abe0-41d4249292d2 --environment c0daf535-7ad3-43ed-8701-8a9550850dd1 --service f47c2fcd-f435-49ba-bd63-5f3254e5cf77 --no-local -- java -cp $displayCp DisplayProfileStore export target/display-source-v1.json
if ($LASTEXITCODE) { throw 'Inventory failed' }
java -cp $displayCp DisplayProfileStore plan target/display-source-v1.json target/display-plan-v1.json
if ($LASTEXITCODE) { throw 'Plan failed' }
railway run --project 050a0c1e-b9c1-4711-abe0-41d4249292d2 --environment c0daf535-7ad3-43ed-8701-8a9550850dd1 --service f47c2fcd-f435-49ba-bd63-5f3254e5cf77 --no-local -- java -cp $displayCp DisplayProfileStore check target/display-plan-v1.json
if ($LASTEXITCODE) { throw 'Dry-run failed; do not apply' }
```

File trong target là private/gitignored, không upload vào CI/artifact. Dùng thư mục operator được giới hạn quyền.
Tool giữ guard hostname/port/schema/SSL của RecoveryStore; target thay đổi thì dừng xác minh, không bỏ guard.
Inventory không xuất password/token; integrity hash được tính nội bộ trên account/supplier/booking/payment.
Không hardcode tổng hồ sơ/booking/tiền. Plan in tổng theo nguồn và ngoại lệ, không in địa chỉ email.
Nếu dữ liệu nguồn thay đổi giữa export/check/apply, dừng; xuất file mới, review lại cả cohort và ngoại lệ.

### Apply / rollback — chỉ sau phê duyệt riêng

Backend mới → API smoke → frontend mới. Không có migration/schema mới.
Trước ghi: xác minh backup/restore usable, target, inventory/counts, plan và phê duyệt chủ tài khoản.
Chưa chạy apply trong đợt code này trên production.

```powershell
$env:APPROVE_DISPLAY_PROFILE_WRITE = 'beautylink-display-profiles-20261101-v1'
try {
  railway run --project 050a0c1e-b9c1-4711-abe0-41d4249292d2 --environment c0daf535-7ad3-43ed-8701-8a9550850dd1 --service f47c2fcd-f435-49ba-bd63-5f3254e5cf77 --no-local -- java -cp $displayCp DisplayProfileStore apply target/display-plan-v1.json
  if ($LASTEXITCODE) { throw 'Apply failed; inspect commit/no-op status before retry' }
} finally { Remove-Item Env:APPROVE_DISPLAY_PROFILE_WRITE -ErrorAction SilentlyContinue }
```

Rollback dùng cùng command/gate, thay `apply` bằng `rollback`: chỉ INSERT marker `<id>.rollback`,
không xóa patch/base/payment batch, không restore DB. Loader ngừng áp dụng đúng overlay, timestamp và cohort đó.
Đối soát UI/list/detail/history/report payment/CSV sau apply; chạy lại apply phải NO-OP.
Tài khoản/owner/salon/booking/payment ID, role/status, password, Google identity, session, OTP và mọi khoản tiền không đổi.

### Bằng chứng và phạm vi hiện tại

- Test backend/Frontend và browser dùng DB cô lập, không ghi production.
- Tool đã thử MySQL8.4 cô lập:48 profiles (2REPORT,45SEED_CUSTOMER,1SEED_PARTNER),
  1contact thật giữ nguyên, 1ngoại lệ hoạt động trước20/10, 46ngày đăng ký vận hành giữ nguyên.
  Dry-run/apply/apply-no-op/rollback/rollback-no-op và fingerprint4bảng đạt.
- Các số trên chỉ là fixture. Chưa kiểm kê/apply dữ liệu production vì phiên làm việc không có kết nối DB
  được cấu hình; connector Railway không cung cấp SQL query. Owner chạy inventory/check để lấy số thật.
- Postman collection `postman/admin-display-profiles.postman_collection.json` chỉ nhận loopback,
  kiểm tra401, ADMIN metadata, trang2 và raw editor; token test chỉ lưu trong file target tạm.
