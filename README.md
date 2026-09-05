# Haravan theme workflow

Quy trình này quản lý nhiều Haravan Organization/theme trong cùng một VS Code
workspace, với mỗi shop nằm trong một thư mục và có kết nối CLI riêng. Toàn bộ
workspace được đồng bộ giữa các máy bằng Google Drive; Git là lớp lưu trữ phiên bản
tùy chọn cho các file code đã được push lên Haravan.

## Đồng bộ bằng Google Drive

Đặt toàn bộ thư mục `Haravan` bên trong **My Drive** và chọn
**Available offline / Có thể sử dụng khi không có mạng** trong Google Drive for
desktop. Thư mục `backups/`, code theme, scripts và cấu hình VS Code sẽ được đồng
bộ cùng nhau.

Trước khi đổi máy:

1. Dừng `Haravan: Start` bằng `Ctrl+C`.
2. Chờ Google Drive báo đồng bộ hoàn tất.
3. Đóng VS Code trên máy cũ.

Trên máy mới:

1. Cài Google Drive for desktop, VS Code và Node.js 16 trở lên.
2. Chờ toàn bộ thư mục `Haravan` tải xong và đặt ở chế độ available offline.
3. Mở đúng thư mục `Haravan` từ Google Drive trong VS Code.
4. Chạy `npm.cmd run setup`.
5. Chạy `npm.cmd run add:shop`; workflow sẽ tự xác nhận phiên Haravan CLI đã đăng nhập,
   chỉ mở login khi chưa có Organization hợp lệ.

Không sao chép file xác thực `%USERPROFILE%\.haravan-cli.json` giữa hai máy.
Không chạy `theme dev` cho cùng một shop trên hai máy cùng lúc.

## Lưu trữ Git tự động

Sau mỗi lần `agent:push` đẩy code thành công lên Haravan, workflow tự commit đúng các
file vừa đẩy và tự `git push` lên remote đã cấu hình. Thiết lập repository một lần tại
workspace:

```powershell
git init
git remote add origin <URL-repository>
```

Nhóm `git` trong `.haravan-workflow.json` điều khiển tính năng này:

```json
{
  "git": {
    "enabled": true,
    "repositoryPath": "",
    "remote": "origin",
    "branch": "",
    "push": true,
    "commitMessagePrefix": "Haravan theme"
  }
}
```

Để trống `repositoryPath` để workflow tự tìm repository từ thư mục shop; nếu repository
ở nơi khác, điền đường dẫn tương đối hoặc tuyệt đối. Workflow không tự khởi tạo repo,
không tự đoán URL remote và không lưu credential. Nếu thiếu Git/repository/remote, code
vẫn được push lên Haravan; trạng thái Git sẽ được cảnh báo rõ trong terminal. Dùng
`-SkipGit` cho một lượt cần bỏ qua lưu Git.

## Làm việc trực tiếp trong VS Code

Mở thư mục dự án:

```powershell
code .
```

Nhấn `Ctrl+Shift+B` để chạy `Haravan: Start`. Sau khi chọn shop, workflow tự
động backup code local, tải code mới nhất của đúng remote theme, backup trạng
thái vừa tải và mới bắt đầu `theme dev`.

Tại menu, có thể:

- Nhập số shop để bắt đầu code.
- Hoặc nhập trực tiếp Organization ID (`org_id`) để chọn shop.
- Có thể nhập trực tiếp Theme ID (`theme_id`).
- Nhập `A` để đăng nhập và thêm shop hoặc theme mới.

Nếu chưa có shop, workflow tự mở đăng nhập. Sau khi đăng nhập, nó hiển thị các
Organization để nhập `org_id`, sau đó hiển thị danh sách theme và yêu cầu nhập
`theme_id`. Một Organization có thể kết nối nhiều theme. Nếu nhập `org_id` có nhiều
theme, workflow sẽ hỏi tiếp theme cần chỉnh sửa.

Mỗi shop nằm trong thư mục:

```text
shops/<org_id> - <theme_id> - <tên theme> - <email đăng nhập>/
```

Mỗi thư mục có kết nối riêng. Mỗi lần lưu file, CLI ghi trực tiếp lên remote theme
của shop đang chọn. Nhấn `Ctrl+C` để dừng.

## Backup và khôi phục khi sửa sai

Mỗi lần chạy `Haravan: Start`, workflow tự backup code local **trước khi pull**,
tải code mới nhất từ remote theme, rồi backup thêm trạng thái mới **trước khi**
chạy `theme dev`. Task `Haravan: Pull latest shop` cũng tự backup trước khi pull,
vì thao tác này có thể ghi đè file local. Nếu code không thay đổi so với bản gần
nhất trong vòng 24 giờ, workflow dùng lại bản đó để tránh tốn dung lượng. Bản quá
24 giờ không được dùng lại: workflow phải tạo thành công hoặc xác nhận một backup còn
trong hạn trước khi dọn dữ liệu cũ.

Backup nằm trong workspace Google Drive, không tạo bản sao theme trong Haravan:

```text
backups/<org_id> - <theme_id>/<thời gian>-<lý do>.zip
```

Sau khi có thao tác workflow, hệ thống dọn đệ quy `backups/` và xóa các **file backup**
cùng các thư mục theme đã quá 24 giờ; thư mục backup rỗng sau đó cũng được dọn. Theme
đang thao tác và backup vừa tạo trong lượt hiện tại được bảo vệ. Cơ chế này chạy khi
một workflow được sử dụng; nó không phải lịch nền của Windows nên không tự chạy vào
thời điểm không có workflow nào được mở.

Khi AI sửa theme, auto-push phải nhận đúng danh sách file đã chỉnh để backup và push
chọn lọc:

```powershell
npm.cmd run agent:push -- -ShopPath "<shop-path>" -Files "templates/product.liquid,assets/product_style.scss.liquid"
```

Không dùng `-All` trong luồng thông thường; cờ này chỉ dành cho trường hợp cần push
toàn bộ theme và phải chỉ rõ.

Muốn chủ động tạo thêm một bản, vào **Terminal → Run Task...** và chọn
`Haravan: Backup selected shop`.

Khi sửa sai:

1. Vào **Terminal → Run Task...**.
2. Chọn `Haravan: Restore selected shop`.
3. Chọn đúng shop và bản backup, sau đó nhập `RESTORE`.

Trước khi khôi phục, workflow tự backup trạng thái hiện tại thêm một lần để có
thể quay lại. Các file code thay đổi được đẩy lại lên đúng remote theme bằng
`theme push-only`. Nếu bản code sai có tạo thêm file mới, nên để `Haravan: Start`
đang chạy lúc restore để CLI đồng bộ cả thao tác xóa file; nếu không, workflow sẽ
liệt kê các file remote cần xóa thủ công trong Haravan Admin.

Khi cần đóng gói, vào **Terminal → Run Task...** và chọn
`Haravan: Export selected shop`.

Khi có người khác sửa theme từ máy khác hoặc trong Haravan Admin, dừng
`Haravan: Start` bằng `Ctrl+C` rồi chạy `Haravan: Pull latest shop`; workflow sẽ
tự tải code remote mới nhất, backup trạng thái mới rồi bắt đầu `theme dev` ngay
cho shop đó mà không cần chọn lại. Nếu chỉ muốn cập nhật local mà không code
tiếp, nhấn `Ctrl+C` ngay sau khi `theme dev` khởi động. Các file local tương ứng
sẽ được thay bằng bản remote mới nhất, còn trạng thái cũ đã được lưu trong backup.

## Pull nhiều website theo danh sách URL

Khi cần tải nhiều theme về local nhưng muốn tự đăng nhập đúng tài khoản cho từng
website, chạy:

```powershell
npm.cmd run pull:many
```

Sau đó dán từng URL website, mỗi dòng một URL, rồi nhấn Enter ở dòng trống. URL có
thể là storefront hoặc link `/admin`; workflow sẽ chuẩn hoá về homepage để tìm
`org_id`/`theme_id` từ CDN theme.

Với mỗi URL, workflow sẽ:

1. Kiểm tra Organization tương ứng đã có trong phiên Haravan chưa.
2. Nếu chưa có, dừng để bạn đăng nhập thủ công đúng tài khoản rồi nhấn Enter để
   kiểm tra lại.
3. Tạo backup local nếu theme đó đã có trong workspace.
4. Gọi `add-shop.ps1` để pull theme về thư mục `shops/`.
5. Chuyển sang URL tiếp theo và cuối cùng in bảng kết quả `Pulled/Skipped/Failed`.

Có thể chuẩn bị file URL, mỗi dòng một website, rồi chạy:

```powershell
npm.cmd run pull:many -- -UrlFile .\urls.txt
```

Workspace đã tạo sẵn file `urls.txt`. Để tự động pull mỗi khi lưu danh sách URL,
mở một terminal riêng và chạy:

```powershell
npm.cmd run pull:watch
```

Sau đó thêm nhiều URL vào `urls.txt` rồi lưu file. Watcher sẽ đợi file ổn định,
chạy batch pull một lần cho nội dung mới và tiếp tục theo dõi. Nếu file chỉ có
comment hoặc đang trống, watcher không pull.

Workflow này chỉ pull, không chạy `theme dev`, không push code và không lưu mật
khẩu. Nếu tài khoản chưa đăng nhập hoặc URL không lấy được theme ID, dòng đó sẽ
được ghi `Skipped`/`Failed` và workflow tiếp tục website kế tiếp.

Khi muốn dọn dẹp workspace và chỉ làm việc với 1 shop duy nhất, vào **Terminal → Run Task...** và chọn `Haravan: Clean local shops` (hoặc chạy `npm run clean`). Thao tác này chỉ xóa các thư mục code ở máy local, không hề ảnh hưởng hay push gì lên Haravan Admin remote.

Khi VS Code đề nghị cài extension được khuyến nghị, có thể cài Liquid language
support để có syntax highlighting. Không cần extension riêng của Haravan.

Workflow không tạo bản sao theme trên Haravan. Thông tin đăng nhập Haravan vẫn
được lưu riêng trên từng máy nên cần đăng nhập lại khi chuyển máy.

## Xử lý Ticket theo workflow

Khi cần xử lý ticket, chỉ cần gửi Ticket ID, ví dụ `83670`; URL ticket vẫn được chấp
nhận. Có thể thêm yêu cầu cần làm ngay sau ID, ví dụ `83537 sửa tốc độ tìm kiếm mobile
ở #search-header`. Phần bổ sung này là phạm vi chỉnh sửa duy nhất; workflow không tự
sửa các lỗi khác trong ticket. Workflow tại [`WORKFLOW-TICKET.md`](WORKFLOW-TICKET.md)
sẽ tự đọc ticket, tìm website/Org ID, tự tra Inside theo Org ID khi ticket thiếu link
website, fetch đúng theme, xử lý đúng phạm vi và tạo bản
nháp phản hồi. Người dùng chỉ cần đăng nhập khi phiên yêu cầu; phản hồi Helpdesk luôn ở
chế độ `draft-only`, không tự nhấn Reply hoặc gửi email. Mỗi lượt workflow dùng browser
session/cửa sổ mới và không điều hướng hoặc đóng các tab đang mở của người dùng. Lookup
Inside dùng đúng một tab được tái sử dụng tuần tự cho các Org ID, không mở nhiều tab Inside.

Khi chạy lại cùng theme trong tối đa 30 phút, workflow tự dùng theme local nếu metadata
file không đổi, nên bỏ qua backup và fetch/pull. Dùng `-ForceFetch` để lấy bản remote mới
nhất hoặc `-ReuseMinutes <số phút>` để đổi thời gian tái sử dụng cho một lượt chạy.
