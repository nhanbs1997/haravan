# Workspace Rules & Learning Protocol

Đây là workflow dùng chung cho các yêu cầu liên quan đến website/theme Haravan trong
workspace này. Profile đọc hiểu code reusable nằm tại
[`.agents/rules/haravan-code-reader.md`](file:///c:/Users/Admin/Documents/0/.agents/rules/haravan-code-reader.md).

## 0. Tóm tắt yêu cầu trước khi làm

Với mỗi yêu cầu của người dùng, trước khi dùng tool hoặc chỉnh sửa file, luôn gửi một
tóm tắt ngắn bằng tiếng Việt theo mẫu:

```text
Tóm tắt yêu cầu: <mục tiêu cần đạt>
Phạm vi dự kiến: <shop/theme/file hoặc phần code liên quan>
Kiểm tra cần thực hiện: <syntax/build/visual/manual>
Giả định hoặc rủi ro: <nêu ngắn gọn, hoặc “Không có”>
```

Nếu đây chỉ là yêu cầu đọc, giải thích hoặc kiểm tra, không tự ý sửa file, push code
hay thay đổi dữ liệu remote.

### Quy trình xử lý Ticket / Yêu cầu → Theme → Bản nháp phản hồi

Đầu vào là Ticket ID hoặc yêu cầu được người dùng gửi trực tiếp trong cuộc trò chuyện.
Người dùng cũng có thể thêm yêu cầu cần xử lý ngay sau Ticket ID,
ví dụ: `83537 Phải mất 5 giây mới bấm tìm kiếm được khi sử dụng mobile, sửa để vừa
load website tìm kiếm được liền #search-header`. Đọc quy trình chi tiết tại
[`WORKFLOW-TICKET.md`](WORKFLOW-TICKET.md) và tự điều phối các bước còn lại:

1. Nếu yêu cầu là snapshot danh sách hoặc cập nhật Tab Ticket, áp dụng chế độ view-first
   `VIEW-HD Ticket-153` được nêu bên dưới; chỉ mở detail/Inside theo fallback Org ID hẹp
   được quy định ở đó. Nếu yêu cầu là
   xử lý theme, đọc nội dung ticket, lấy website/admin link và Org ID; khi thiếu
   website/admin link nhưng có Org ID thì mở `https://inside.haravan.com/shops/<org_id>`
   trong tab Inside của workflow, lấy Link web/MyHaravan và tên shop rồi bổ sung vào
   context. Chỉ dừng khi ticket không có Org ID hoặc Inside không trả được liên kết hợp lệ.
2. Kiểm tra `haravan whoiam`; nếu phiên đã đăng nhập đúng Organization thì tự xác nhận
   Haravan CLI và tiếp tục fetch, không mở login lại. Nếu chưa có hoặc sai Organization,
   tự mở `haravan login`, ưu tiên đăng nhập Google bằng `html.tech@haravan.com`.
   Trên trang Accounts phải bấm Sign in with Google, không dùng form email Haravan
   (Continue trên form đó gửi OTP).
   Nếu Google không vào được (chưa liên kết, sai Organization, hoặc không có phiên
   Google), bấm **Đăng nhập bằng mật khẩu**, tra đúng shop trong sheet tài khoản theo
   mục đăng nhập của `WORKFLOW-TICKET.md` và điền tài khoản/mật khẩu. Sau khi đăng nhập, nếu trang
   xin quyền Haravan CLI hiện nút `Đồng Ý` thì tự bấm ngay, không hỏi người dùng;
   có thể chạy [`haravan-cli-consent-click.js`](haravan-cli-consent-click.js) trên
   trang đó. Kiểm tra lại `haravan whoiam`
   và chỉ fetch về `shops/` khi đúng Organization. Nếu gặp OTP/CAPTCHA, thiếu quyền
   đọc sheet hoặc không xác định được đúng tài khoản thì nhờ người dùng hỗ trợ. Khi
   chạy lại trong thời gian ngắn, runner được tái sử dụng theme local tối đa 30 phút nếu
   metadata file không đổi; dùng `-ForceFetch` khi bắt buộc lấy bản remote mới nhất.
3. Gắn context ticket với thư mục theme, xử lý yêu cầu và verification theo các rule
   Haravan bên dưới. Nếu đầu vào có phần yêu cầu bổ sung sau Ticket ID, phần đó là
   phạm vi chỉnh sửa duy nhất; nội dung ticket gốc chỉ dùng để hiểu bối cảnh và kiểm
   tra không làm sai yêu cầu.
4. Tạo draft reply theo format khách hàng yêu cầu, kèm ảnh/hướng dẫn thiết lập nếu có.

Quy tắc cửa sổ trình duyệt: trước thao tác đầu tiên của mỗi lượt xử lý ticket, phải
khởi tạo một browser session và một cửa sổ trình duyệt mới dành riêng cho workflow.
Chỉ sau khi cửa sổ mới đã được tạo mới được mở tab Helpdesk, Inside, storefront/admin
hoặc tab kiểm tra; tất cả các tab của cùng ticket phải nằm trong cửa sổ mới đó.
Không được mở tab mới, điều hướng tab, claim tab hoặc lấy lại tab từ cửa sổ hiện tại
của người dùng. Trong cửa sổ workflow chỉ được tạo một tab Inside dùng chung; các Org ID
phải được tra tuần tự bằng cách điều hướng lại tab này, không mở thêm nhiều tab Inside.
Nếu công cụ không tạo được cửa sổ trình duyệt độc lập, phải dừng trước khi mở tab và
báo rõ cho người dùng; không dùng session/tab trong cửa sổ hiện tại làm phương án thay thế.

Chỉ được đọc mật khẩu đúng shop từ sheet được người dùng chỉ định để đăng nhập;
không lưu mật khẩu/token vào workspace, context, log hoặc phản hồi.
Đây là workflow có điểm dừng bắt buộc: không
nhấn Reply, không nhập nội dung vào editor, không gửi email/tin nhắn. Chỉ cung cấp bản
nháp để người dùng tự kiểm tra và tự gửi.

Quy tắc phạm vi: không tự sửa các lỗi khác nhìn thấy trong ticket, không refactor ngoài
phạm vi và không đưa thay đổi không được yêu cầu vào `changes.json` hoặc danh sách file
push. Nếu yêu cầu bổ sung mơ hồ hoặc xung đột với ticket gốc, dừng để xác nhận trước
khi sửa.

Chế độ snapshot `VIEW-HD Ticket-153`: khi người dùng yêu cầu đọc/snapshot danh sách
ticket hoặc cập nhật Tab Ticket, bắt đầu bằng các dòng đang hiển thị trong tab
`https://support.haravan.com/helpdesk/tickets?view=VIEW-HD+Ticket-153`. Nếu cột
`Haravan Org ID` trống nhưng cột `Khách hàng (Customer)` đang hiển thị chuỗi tên tài
khoản kèm số Org ID, được dùng số đó làm fallback. Nếu Customer cũng không hiển thị
Org ID, chỉ được mở detail tương ứng trong browser workflow và đọc riêng nút
`Khách hàng (Customer)` để lấy số Org ID; không đọc Activity/nội dung ticket. Sau khi
có Org ID hợp lệ, nếu cột Link quản trị hoặc Tên shop đang trống thì tra tuần tự trên
một tab Inside dùng chung tại `https://inside.haravan.com/shops/<org_id>`, đọc chính xác
Link quản trị/MyHaravan và tên shop rồi bổ sung vào các ô còn thiếu của Tab Ticket.
Giữ nguyên giá trị đã có; không tự dựng link khi Inside không trả liên kết hợp lệ. Không
đọc mật khẩu, không suy đoán Org ID khi cả view và Customer đều thiếu, và phải báo rõ
trường còn trống.

## 1. Đọc hiểu code Haravan trước khi sửa

1. Đọc [`.agents/rules/learned_knowledge.md`](file:///c:/Users/Admin/Documents/0/.agents/rules/learned_knowledge.md)
   và profile Haravan Code Reader.
2. Xác định shop đang dùng trong `shops/` qua `_haravan-backup.json` hoặc
   `.haravan-cli_local.json`; không hard-code tên shop nếu có thể tự phát hiện.
3. Tìm entry point và các file liên quan bằng `rg`: `layout/theme.liquid`,
   `templates/index.liquid`, template đích, snippets, assets, config và locales.
4. Truy vết các quan hệ Liquid/HTML/JS trước khi sửa: `{% render %}`, `{% include %}`,
   `asset_url`, `data-action`, selector DOM, state, API và LocalStorage.
5. Ghi rõ file và mốc code liên quan trong phần tóm tắt/kế hoạch để tránh sửa nhầm
   theme hoặc nhầm một nhánh render.
6. Khi yêu cầu là tạo hoặc cập nhật `config/settings_schema.json`, gắn visual editor
   (`setting-id` / `setting-type`), hoặc schema giao diện theme, đọc và làm theo
   [`.cursor/skills/haravan-settings-schema/SKILL.md`](.cursor/skills/haravan-settings-schema/SKILL.md)
   trước khi sửa. Schema là UI thiết lập cho phần việc đó; không thêm field mới vào
   `config/settings.html` trừ khi người dùng yêu cầu.

## 2. Thực hiện chỉnh sửa

Tiến hành sửa đổi đúng phạm vi yêu cầu, giữ nguyên giao diện đẹp mắt, tối ưu
performance và không phá vỡ logic hiện tại. Ưu tiên thay đổi nhỏ, có thể kiểm chứng,
và giữ tương thích với Liquid/Haravan CLI. Không chèn comment chỉ để ghi Ticket ID,
workflow, tên agent hoặc ngày xử lý vào theme code; trước khi push phải rà soát và
loại bỏ các comment định danh như vậy. Chỉ giữ comment mô tả logic thật sự cần thiết
cho việc bảo trì.

## 3. Kiểm tra (Verification)

Sau khi sửa code:

- Kiểm tra cú pháp JavaScript bằng cách bóc tách đúng khối `<script>` và chạy
  `node --check`.
- Nếu đụng `settings_schema.json` hoặc attribute visual editor, chạy
  `node .cursor/skills/haravan-settings-schema/scripts/audit-settings-schema.mjs <theme-root>`
  và chỉ push khi audit không còn ERROR.
- Kiểm tra Liquid/HTML/CSS theo phạm vi thay đổi; chạy build/check hiện có nếu project
  cung cấp.
- Rà soát diff và các đường dẫn asset, selector, event handler, state/API liên quan.
- Nếu thay đổi UI, kiểm tra responsive và hành vi trên trạng thái chính.

## 4. GitHub workspace, Auto-Push & Backup

GitHub repository [`nhanbs1997/haravan`](https://github.com/nhanbs1997/haravan) là nguồn
mã nguồn chính của workflow. Mọi thao tác chọn shop, fetch/pull, backup, restore và
push phải chạy từ bản checkout này; không dùng Google Drive hoặc một remote Git khác
làm nguồn làm việc. Workflow kiểm tra `origin`, URL repository và nhánh `main` trước
khi thao tác. Nếu working tree sạch, workflow tự `git pull --ff-only`; nếu đang có
thay đổi chưa commit, workflow giữ nguyên chúng và cảnh báo để tránh ghi đè.

Chỉ sau khi **theme code** đã được sửa và verification đạt, chạy push theo đúng danh sách file vừa chỉnh:

```powershell
npm.cmd run agent:push -- -ShopPath "<shop-path>" -Files "templates/product.liquid,assets/product_style.scss.liquid"
```

Script [`scripts/agent-push.ps1`](file:///c:/Users/Admin/Documents/0/scripts/agent-push.ps1)
sẽ:

- Tự detect shop đang dùng qua `_haravan-backup.json` hoặc `.haravan-cli_local.json`.
- Chỉ backup các file được truyền qua `-Files`; backup được lưu vào `backups/` với nhãn `before-agent-push-selected`.
- Không tự động xóa backup hoặc thư mục theme theo tuổi. Theme và backup được giữ lại
  để GitHub checkout có thể đối chiếu; chỉ lệnh dọn dẹp thủ công do người dùng gọi mới
  xóa dữ liệu local.
- Chỉ push các file đó lên Haravan remote bằng `theme push-only`.
- Sau khi Haravan xác nhận push thành công, `agent:push` tự stage và commit đúng các
  file đó vào Git repository và `git push origin main` lên GitHub đã cấu hình.
- `-All` là chế độ ngoại lệ, phải chỉ rõ khi thật sự cần push toàn theme; không dùng mặc định.
- Backup chọn lọc chỉ băm các file được chọn; không quét/hash toàn bộ theme khi chạy
  `agent:push` với `-Files`.

Backup chọn lọc chỉ dùng để đối chiếu/khôi phục các file đã chọn; không dùng nó cho thao tác
restore toàn bộ theme. Không chạy push nếu chưa xác định được danh sách file thay đổi.

Cấu hình lưu Git nằm trong `.haravan-workflow.json` ở nhóm `git`:

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

`repositoryPath` dùng `.` để cố định checkout workspace; `remoteUrl` phải là repository
GitHub trên. Nếu thiếu repository, sai remote, sai nhánh hoặc GitHub chưa sẵn sàng,
workflow dừng trước thao tác Haravan để tránh tạo thay đổi ngoài nguồn kiểm soát.
`-SkipGit` không được phép trong workflow này.

Không chạy auto-push khi chỉ đọc code, lập kế hoạch, hoặc chỉ chỉnh sửa tài liệu
workflow như `AGENTS.md`, `.agents/**`, `README.md` hay script local không nằm trong
theme.

## 5. Học code & ghi chép bài học

Sau mỗi lần phân tích hoặc chỉnh sửa code Haravan có kết quả kiểm chứng:

- Rút ra các fact đã xác minh về cấu trúc file, sơ đồ dữ liệu, hàm tiện ích, render,
  event binding, API và quy chuẩn thiết kế.
- Cập nhật vào [`.agents/rules/learned_knowledge.md`](file:///c:/Users/Admin/Documents/0/.agents/rules/learned_knowledge.md)
  theo format:

```markdown
### [YYYY-MM-DD] <tiêu đề công việc>
- **Tóm tắt yêu cầu**: ...
- **File/điểm code**: ...
- **Thay đổi hoặc phát hiện đã xác minh**: ...
- **Kiểm tra**: ...
- **Bài học dùng lại lần sau**: ...
```

Chỉ ghi kiến thức có bằng chứng từ code hoặc kết quả kiểm tra; đánh dấu rõ các giả
định cần xác minh và không ghi secret, token hay dữ liệu cá nhân.
