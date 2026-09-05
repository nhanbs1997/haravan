# Workflow xử lý Ticket → Theme → Draft Reply

Workflow này nối 5 bước đã thống nhất nhưng giữ hai cổng thủ công: đăng nhập shop và
gửi phản hồi khách hàng.

Mỗi lượt chạy phải dùng một browser session và tạo một cửa sổ trình duyệt mới dành riêng
cho workflow trước khi mở các tab. Tất cả tab của cùng một ticket (Helpdesk, Inside,
storefront/admin và các tab kiểm tra cần thiết) phải được mở trong cùng cửa sổ mới đó.
Inside chỉ dùng một tab duy nhất, được điều hướng tuần tự cho từng Org ID; không mở
nhiều tab Inside. Agent không claim hoặc điều hướng các tab đang mở trong browser hiện
tại của người dùng, không đóng tab hiện tại và không trộn tab của ticket vào cửa sổ
người dùng đang làm việc. Nếu công cụ không tạo
được browser window độc lập, dùng session/tab mới được cấp cho workflow, giữ nguyên các
tab hiện tại của người dùng và ghi nhận fallback này trong context.

## Cách dùng rút gọn

Đầu vào xử lý có thể là Ticket ID (gửi trực tiếp/kèm văn bản) hoặc file `yeucau.docx` được đặt trong workspace.

Khi người dùng dán hoặc lưu yêu cầu vào file `yeucau.docx` (file Word `.docx`), agent sẽ sử dụng công cụ `read_file` để tự động đọc và trích xuất nội dung văn bản từ `yeucau.docx`. Toàn bộ nội dung yêu cầu trong file `yeucau.docx` được lấy làm phạm vi chỉnh sửa chính.

Người dùng chỉ cần gửi Ticket ID, hoặc Ticket ID kèm yêu cầu bổ sung cần xử lý:

```text
83670
```

```text
83537 Phải mất 5 giây mới bấm tìm kiếm được khi sử dụng mobile, sửa để vừa load website tìm kiếm được liền #search-header
```

Với snapshot/Tab Ticket, agent chỉ đọc view theo mục 1.1 và cập nhật các giá trị nhìn
thấy trực tiếp. Với yêu cầu xử lý theme, agent mở và đọc ticket, tìm website/admin URL
hoặc Org ID, tra Inside khi cần, fetch đúng theme về workspace, xử lý yêu cầu, kiểm tra
thay đổi và tạo bản nháp phản hồi.
Người dùng chỉ cần đăng nhập khi phiên Helpdesk/Haravan yêu cầu; bước gửi phản hồi luôn
dừng lại để người dùng tự kiểm tra và tự nhấn Reply.

Khi có phần chữ sau Ticket ID, phần đó được lưu thành `additionalRequest` và trở thành
phạm vi chỉnh sửa duy nhất. Nội dung ticket gốc chỉ dùng làm bối cảnh; agent không tự
sửa các lỗi khác, không refactor ngoài phạm vi và không thêm mục ngoài yêu cầu đó vào
`changes.json`. Nếu cần truyền qua runner local, có thể dùng:

```powershell
npm.cmd run ticket:prepare -- -ContextPath .ticket-workflow\incoming-83537.json -AdditionalRequest "Phải mất 5 giây mới bấm tìm kiếm được khi sử dụng mobile, sửa để vừa load website tìm kiếm được liền #search-header"
```

Kiểm tra cách parser tách ID và yêu cầu bổ sung mà không fetch theme:

```powershell
npm.cmd run ticket:parse -- -TicketId "83537 Phải mất 5 giây mới bấm tìm kiếm được khi sử dụng mobile, sửa để vừa load website tìm kiếm được liền #search-header"
```

Nếu yêu cầu bổ sung không rõ, mâu thuẫn hoặc không thể xác định file/phạm vi an toàn,
workflow phải dừng để hỏi lại; không tự suy diễn thêm.

URL ticket vẫn được chấp nhận, nhưng không còn là đầu vào bắt buộc.

### Fast Path khi chạy lặp

Mặc định `ticket:prepare` tái sử dụng theme local trong 30 phút nếu đủ ba điều kiện:
theme có đủ thư mục cần thiết, chữ ký metadata của file không đổi và Org ID/Theme ID/
website khớp context. Khi dùng Fast Path, workflow bỏ qua backup và fetch/pull remote,
giúp chạy lại ticket hoặc tạo lại context nhanh hơn. Cache chỉ lưu thời điểm, định danh
theme, URL nguồn và chữ ký metadata; không lưu mật khẩu, token hay cookie.

Khi cần bắt buộc lấy bản mới nhất từ remote, dùng:

```powershell
npm.cmd run ticket:prepare -- -ContextPath .ticket-workflow\incoming-86528.json -ForceFetch
```

Có thể đổi thời gian tái sử dụng cho một lượt chạy, ví dụ 60 phút:

```powershell
npm.cmd run ticket:prepare -- -ContextPath .ticket-workflow\incoming-86528.json -ReuseMinutes 60
```

Nếu context đã có Org ID và Theme ID hợp lệ, runner dùng trực tiếp hai giá trị đó và bỏ
qua bước đọc lại HTML storefront để giảm một lượt kiểm tra mạng. Khi CLI gặp lỗi asset
trùng nhưng đã ghi một theme hoàn chỉnh vào `shops/tmp_pull`, workflow dùng bản staging
đó làm cầu nối và không retry pull hàng loạt không cần thiết.

## 1. Tạo context từ ticket

### 1.1. Chế độ snapshot chỉ đọc view

Khi yêu cầu là snapshot danh sách hoặc cập nhật Tab Ticket, agent chỉ đọc tab:

```text
https://support.haravan.com/helpdesk/tickets?view=VIEW-HD+Ticket-153
```

Ở chế độ này, trước hết chỉ lấy các giá trị đang hiển thị trực tiếp trong danh sách (ID,
Subject, Status và các cột metadata nếu người dùng đã bật). Nếu `Haravan Org ID` trống
nhưng `Khách hàng (Customer)` hiển thị dạng `Tên tài khoản - Org ID`, dùng số Org ID
đó. Nếu Customer trên view cũng không có Org ID, được mở detail tương ứng trong browser
workflow và chỉ đọc nút `Khách hàng (Customer)` để lấy số Org ID; không đọc Activity,
email hoặc nội dung yêu cầu. Có Org ID rồi thì tra `https://inside.haravan.com/shops/<org_id>`
trên cùng một tab Inside dùng chung, điều hướng lần lượt theo từng Org ID, để lấy link quản
trị và tên shop. Nếu Link quản trị hoặc Tên shop đang trống, cập nhật đúng các trường còn
thiếu trong Tab Ticket bằng giá trị Inside trả về; không ghi đè giá trị đã có và không tự
dựng URL khi Inside không có liên kết hợp lệ. Nếu cả hai nguồn đều không có Org ID, giữ
trống và báo rõ; chế độ này không dùng để tạo context fetch theme.

### 1.2. Tạo context cho luồng xử lý theme

Chỉ dùng luồng này khi người dùng yêu cầu fetch/chỉnh sửa theme; không dùng cho snapshot
hoặc cập nhật Tab Ticket. Đây là luồng nội bộ/fallback khi agent cần lấy context thủ công.
Agent chạy helper trong
browser session mới của workflow, không dùng phiên trình duyệt hiện tại của người dùng.

Mở ticket trong Helpdesk, mở Developer Console và chạy toàn bộ file:

```text
ticket-workflow-console.js
```

Helper chỉ đọc DOM, nội dung Activity, link website/admin và Org ID rồi copy một JSON
context vào clipboard. Nếu chưa có link web/admin nhưng đã có Org ID, agent tạo hoặc tái
sử dụng đúng một tab Inside trong cùng browser workflow, điều hướng tab đó tới:

```text
https://inside.haravan.com/shops/<org_id>
```

Đọc Link web/MyHaravan và tên shop từ Inside rồi bổ sung lần lượt vào `websiteUrl`,
`adminUrl` và `shopName` trong context. Nếu Inside không trả liên kết hợp lệ thì dừng
và báo rõ Org ID cần kiểm tra lại. Sheet tài khoản chỉ là nguồn tra cứu để người dùng
tự đăng nhập; credential không được đưa vào context hoặc workspace.

## 2. Fetch theme về workspace

Lưu JSON context thành một file tạm trong `.ticket-workflow/`, ví dụ
`.ticket-workflow/incoming-86528.json`, rồi chạy:

```powershell
npm.cmd run ticket:prepare -- -ContextPath .ticket-workflow\incoming-86528.json
```

Runner sẽ:

- kiểm tra Ticket ID, website, Org ID và Theme ID;
- dùng `Get-ShopIdsFromUrl` để đọc cả `cdn.hstatic.net` và `theme.hstatic.net`;
- kiểm tra `haravan whoiam` trước; nếu Org ID đã có trong phiên thì tự xác nhận Haravan CLI
  và tiếp tục, không mở login lại; chỉ dừng để người dùng login đúng Organization nếu
  Org ID chưa có trong phiên;
- nếu không dùng được Fast Path, backup shop hiện có trước khi pull;
- sau mỗi thao tác workflow, tự dọn các file backup và thư mục theme trong `backups/`
  hoặc `shops/` đã quá 24 giờ; giữ shop đang thao tác và backup vừa tạo trong lượt hiện tại;
- gọi luồng `add-shop.ps1` hiện có để fetch/pull theme (hoặc tái sử dụng theme local theo
  Fast Path); khi context đã có Org ID và Theme ID, truyền trực tiếp cặp này để fetch
  đúng theme trong ticket, không suy luận lại theme đang active trên storefront;
- tạo `.ticket-workflow/<ticket_id>/context.json`, `README.md` và `changes.json`;
- lưu `originalRequestText`, `additionalRequest`, `scopeMode` và
  `implementationScope` trong context để khóa phạm vi xử lý;
- không lưu password/token và không chạy Reply.

Khi chạy `npm.cmd run add:shop` hoặc bước fetch của ticket, workflow luôn kiểm tra phiên
Haravan CLI trước. Phiên đã login được tự xác nhận bằng danh sách Organization từ
`haravan whoiam`; lệnh `haravan login` chỉ được mở khi chưa có Organization nào được
CLI xác nhận. Nếu đã login nhưng sai Organization, workflow vẫn dừng để chọn đúng tài
khoản, không tự dùng nhầm org.

Nếu thiếu website/admin link nhưng context có Org ID, agent phải hoàn tất Inside lookup
trước khi gọi runner: dùng một tab Inside duy nhất, lần lượt đọc
`https://inside.haravan.com/shops/<org_id>`, lấy Link
web/MyHaravan và tên shop, rồi bổ sung `websiteUrl`, `adminUrl`, `shopName`. Runner chỉ
dừng khi thiếu Org ID hoặc Inside không có liên kết hợp lệ; không tự đoán website từ
Org ID.

## 3. Xử lý yêu cầu

Đọc yêu cầu trong file `README.md`, xác định entry point/theme file, sửa đúng
`implementationScope`, rồi verification theo `AGENTS.md`. Nếu theme code đã sửa và
kiểm tra đạt, lập danh sách đúng các file vừa chỉnh rồi chạy backup/push chọn lọc:

Trong theme code không ghi chú bằng Ticket ID, tên workflow, tên agent hoặc ngày xử
lý. Comment mới chỉ được thêm khi giải thích logic cần bảo trì; comment định danh
ticket phải được loại bỏ trước bước backup/push.

```powershell
npm.cmd run agent:push -- -ShopPath "<shop-path>" -Files "templates/product.liquid,assets/product_style.scss.liquid"
```

Runner chỉ backup và push các file trong `-Files`. Sau khi Haravan xác nhận thành công,
runner tự stage/commit đúng các file đó vào Git và tự `git push` nếu repository/remote
đã được cấu hình trong nhóm `git` của `.haravan-workflow.json`. Chỉ dùng `-All` khi có
yêu cầu rõ ràng để push toàn bộ theme.

Thiết lập Git một lần tại workspace (không đưa token/mật khẩu vào file cấu hình):

```powershell
git init
git remote add origin <URL-repository>
```

Nếu Git repository nằm ở vị trí khác, đặt đường dẫn tương đối hoặc tuyệt đối vào
`git.repositoryPath`. Có thể đổi remote/nhánh bằng `git.remote` và `git.branch`; đặt
`git.push` là `false` nếu chỉ muốn lưu commit local. Khi chưa có repository hoặc remote,
Haravan vẫn được push như bình thường và runner in cảnh báo để bổ sung cấu hình sau.

Sau khi xử lý, cập nhật `changes.json` chỉ với các thay đổi thuộc phạm vi đã yêu cầu:

```json
[
  {
    "title": "Nội dung yêu cầu 1",
    "details": "Kết quả đã chỉnh sửa",
    "screenshots": ["C:\\path\\to\\screenshot.png"],
    "setupInstructions": "Thiết lập > ..."
  }
]
```

`screenshots` và `setupInstructions` là tùy chọn.

## 4. Tạo bản nháp phản hồi

```powershell
npm.cmd run ticket:draft -- -TicketId 86528
```

Draft được tạo tại `.ticket-workflow/86528/draft-reply.md` theo format:

```text
Hi anh/chị,

Yêu cầu đã được chỉnh sửa ạ

1. Nội dung yêu cầu 1
   Kết quả chỉnh sửa
   Ảnh chỉnh sửa: screenshot.png
   Hướng dẫn vào thiết lập: Thiết lập > ...
```

Chỉ copy bản nháp để kiểm tra. Workflow không mở Reply, không nhập vào editor và
không gửi thông tin ra Helpdesk.

## 5. Kiểm tra trạng thái

```powershell
npm.cmd run ticket:status -- -TicketId 86528
```

`replyMode` luôn là `draft-only` và `replySent` luôn là `false` do workflow local không
có thao tác gửi phản hồi.
