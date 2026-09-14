# Haravan theme workflow

Quy trình này quản lý nhiều Haravan Organization/theme trong cùng một VS Code
workspace, với mỗi shop nằm trong một thư mục và có kết nối CLI riêng. GitHub
`https://github.com/nhanbs1997/haravan.git` là nguồn mã nguồn chính; mọi thao tác
workflow đều bắt đầu từ checkout này và thay đổi đã xác minh được commit/push lên
GitHub sau khi push theme thành công.

## Đồng bộ bằng GitHub

Clone repository trước khi làm việc và luôn mở chính checkout đó trong VS Code:

```powershell
git clone https://github.com/nhanbs1997/haravan.git
cd haravan
git pull --ff-only origin main
```

Workflow tự kiểm tra remote `origin` và nhánh `main`; nếu working tree sạch, nó tự
đồng bộ GitHub trước khi fetch/pull. Khi có thay đổi chưa commit, workflow giữ nguyên
checkout và cảnh báo để người dùng commit/push trước lượt tiếp theo.

Trước khi đổi máy:

1. Dừng `Haravan: Start` bằng `Ctrl+C`.
2. Chạy `git push origin main` và kiểm tra GitHub đã nhận commit.
3. Đóng VS Code trên máy cũ.

Trên máy mới:

1. Cài Git, VS Code và Node.js 16 trở lên.
2. Clone repository `nhanbs1997/haravan` và chạy `git pull --ff-only origin main`.
3. Mở checkout GitHub trong VS Code.
4. Chạy `npm.cmd run setup`.
5. Chạy `npm.cmd run add:shop`; workflow sẽ tự xác nhận phiên Haravan CLI đã đăng nhập,
   chỉ mở login khi chưa có Organization hợp lệ.

Không sao chép file xác thực `%USERPROFILE%\.haravan-cli.json` giữa hai máy.
Không chạy `theme dev` cho cùng một shop trên hai máy cùng lúc.

## Lưu trữ GitHub tự động

Sau mỗi lần `agent:push` đẩy code thành công lên Haravan, workflow tự commit đúng các
file vừa đẩy và tự `git push origin main` lên repository GitHub:

```powershell
git clone https://github.com/nhanbs1997/haravan.git
git remote -v
```

Nhóm `git` trong `.haravan-workflow.json` điều khiển tính năng này:

```json
{
  "git": {
    "enabled": true,
    "repositoryPath": ".",
    "remote": "origin",
    "remoteUrl": "https://github.com/nhanbs1997/haravan.git",
    "requireGitHub": true,
    "pullBeforeWork": true,
    "allowSkipGit": false,
    "branch": "main",
    "push": true,
    "commitMessagePrefix": "Haravan theme"
  }
}
```

Workflow không tự đổi remote, không lưu credential và không cho phép `-SkipGit`. Nếu
checkout/remote/nhánh không đúng GitHub, workflow dừng trước khi ghi lên Haravan.

## Làm việc trực tiếp trong VS Code

Mở thư mục dự án:

```powershell
code .
```

Nhấn `Ctrl+Shift+B` để chạy `Haravan: Start`. Sau khi chọn shop, workflow đồng bộ
GitHub khi checkout sạch, tự động backup code local, tải code mới nhất của đúng remote theme, backup trạng
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
vì thao tác này có thể ghi đè file local. Nếu code không thay đổi, workflow có thể
dùng lại backup có cùng fingerprint để tránh tạo bản trùng; các backup cũ vẫn được giữ
lại và không bị xóa tự động.

Backup nằm trong checkout GitHub tại máy local, không tạo bản sao theme trong Haravan:

```text
backups/<org_id> - <theme_id>/<thời gian>-<lý do>.zip
```

Workflow không còn dọn hoặc xóa backup và thư mục theme theo mốc 24 giờ. Dữ liệu được
giữ lại để đối chiếu với GitHub; chỉ lệnh `npm.cmd run clean` do người dùng chủ động
chạy mới thực hiện dọn local.

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
nháp phản hồi. Người dùng chỉ cần đăng nhập khi phiên yêu cầu OTP/CAPTCHA; sau login,
workflow tự bấm `Đồng Ý` trên trang Haravan CLI. Phản hồi Helpdesk luôn ở
chế độ `draft-only`, không tự nhấn Reply hoặc gửi email. Trước khi mở tab, mỗi lượt
workflow phải tạo browser session và một cửa sổ trình duyệt mới; mọi tab của ticket chỉ
được mở trong cửa sổ đó. Workflow không mở tab mới, điều hướng, claim hoặc tái sử dụng
tab trong cửa sổ hiện tại của người dùng. Lookup Inside dùng đúng một tab trong cửa sổ
workflow, được tái sử dụng tuần tự cho các Org ID, không mở nhiều tab Inside. Nếu không
tạo được cửa sổ độc lập, workflow dừng trước khi mở tab và báo rõ.

Khi chạy lại cùng theme trong tối đa 30 phút, workflow tự dùng theme local nếu metadata
file không đổi, nên bỏ qua backup và fetch/pull. Dùng `-ForceFetch` để lấy bản remote mới
nhất hoặc `-ReuseMinutes <số phút>` để đổi thời gian tái sử dụng cho một lượt chạy.
