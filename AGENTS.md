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

### Quy trình xử lý Ticket / Yêu cầu (yeucau.docx) → Theme → Bản nháp phản hồi

Đầu vào có thể là Ticket ID hoặc người dùng dán yêu cầu trực tiếp vào file `yeucau.docx`.
Người dùng cũng có thể thêm yêu cầu cần xử lý ngay sau Ticket ID,
ví dụ: `83537 Phải mất 5 giây mới bấm tìm kiếm được khi sử dụng mobile, sửa để vừa
load website tìm kiếm được liền #search-header`. Đọc quy trình chi tiết tại
[`WORKFLOW-TICKET.md`](WORKFLOW-TICKET.md) và tự điều phối các bước còn lại:

- Khi có file `yeucau.docx` trong workspace hoặc thư mục xử lý, agent sử dụng `read_file` để đọc trực tiếp nội dung file Word `.docx` (công cụ tự động bóc tách text) và lấy toàn bộ nội dung yêu cầu trong đó để làm phạm vi xử lý.

1. Nếu yêu cầu là snapshot danh sách hoặc cập nhật Tab Ticket, áp dụng chế độ view-first
   `VIEW-HD Ticket-153` được nêu bên dưới; chỉ mở detail/Inside theo fallback Org ID hẹp
   được quy định ở đó. Nếu yêu cầu là
   xử lý theme, đọc nội dung ticket, lấy website/admin link và Org ID; khi thiếu
   website/admin link nhưng có Org ID thì mở `https://inside.haravan.com/shops/<org_id>`
   trong tab Inside của workflow, lấy Link web/MyHaravan và tên shop rồi bổ sung vào
   context. Chỉ dừng khi ticket không có Org ID hoặc Inside không trả được liên kết hợp lệ.
2. Kiểm tra `haravan whoiam`; nếu phiên đã đăng nhập đúng Organization thì tự xác nhận
   Haravan CLI và tiếp tục fetch, không mở login lại. Nếu chưa có hoặc sai Organization,
   dừng để người dùng đăng nhập/chọn đúng tài khoản trước khi fetch về `shops/`. Khi
   chạy lại trong thời gian ngắn, runner được tái sử dụng theme local tối đa 30 phút nếu
   metadata file không đổi; dùng `-ForceFetch` khi bắt buộc lấy bản remote mới nhất.
3. Gắn context ticket với thư mục theme, xử lý yêu cầu và verification theo các rule
   Haravan bên dưới. Nếu đầu vào có phần yêu cầu bổ sung sau Ticket ID, phần đó là
   phạm vi chỉnh sửa duy nhất; nội dung ticket gốc chỉ dùng để hiểu bối cảnh và kiểm
   tra không làm sai yêu cầu.
4. Tạo draft reply theo format khách hàng yêu cầu, kèm ảnh/hướng dẫn thiết lập nếu có.

Quy tắc phiên trình duyệt: mỗi lượt xử lý ticket phải khởi tạo một browser session và
một cửa sổ trình duyệt mới dành riêng cho workflow. Tất cả tab Helpdesk, Inside,
storefront/admin và tab kiểm tra của cùng ticket phải nằm trong cùng cửa sổ mới đó.
Trong đó chỉ được tạo một tab Inside dùng chung; các Org ID phải được tra tuần tự bằng
cách điều hướng lại tab này, không mở thêm nhiều tab Inside.
Không claim, tái sử dụng, điều hướng, đóng hoặc thay đổi các tab đang mở trong browser
hiện tại của người dùng; không trộn tab ticket vào cửa sổ người dùng. Nếu công cụ chỉ
hỗ trợ tab trong một session đã được cấp, phải tạo tab mới trong session workflow, giữ
nguyên các tab người dùng và ghi nhận việc dùng fallback trong context ticket.

Đây là workflow có điểm dừng bắt buộc: không đọc/lưu mật khẩu vào workspace và không
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
- Kiểm tra Liquid/HTML/CSS theo phạm vi thay đổi; chạy build/check hiện có nếu project
  cung cấp.
- Rà soát diff và các đường dẫn asset, selector, event handler, state/API liên quan.
- Nếu thay đổi UI, kiểm tra responsive và hành vi trên trạng thái chính.

## 4. Auto-Push & Backup

Chỉ sau khi **theme code** đã được sửa và verification đạt, chạy push theo đúng danh sách file vừa chỉnh:

```powershell
npm.cmd run agent:push -- -ShopPath "<shop-path>" -Files "templates/product.liquid,assets/product_style.scss.liquid"
```

Script [`scripts/agent-push.ps1`](file:///c:/Users/Admin/Documents/0/scripts/agent-push.ps1)
sẽ:

- Tự detect shop đang dùng qua `_haravan-backup.json` hoặc `.haravan-cli_local.json`.
- Chỉ backup các file được truyền qua `-Files`; backup được lưu vào `backups/` với nhãn `before-agent-push-selected`.
- Chỉ dùng lại backup trùng nội dung nếu backup đó được tạo trong vòng 24 giờ. Sau khi
  có thao tác workflow, tự dọn các file backup và thư mục theme trong `backups/` hoặc
  `shops/` đã quá 24 giờ; giữ shop đang thao tác và backup vừa tạo trong lượt hiện tại.
- Chỉ push các file đó lên Haravan remote bằng `theme push-only`.
- Sau khi Haravan xác nhận push thành công, `agent:push` tự stage và commit đúng các
  file đó vào Git repository; nếu `.haravan-workflow.json` có remote hợp lệ thì tự
  `git push` lên remote tương ứng.
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
    "repositoryPath": "",
    "remote": "origin",
    "branch": "",
    "push": true,
    "commitMessagePrefix": "Haravan theme"
  }
}
```

`repositoryPath` để trống sẽ tự tìm Git repository từ thư mục shop. Nếu workspace
chưa là Git repository hoặc chưa có remote, workflow vẫn giữ nguyên commit local (nếu
đã tạo) và in cảnh báo; không tự khởi tạo repository, không tự đoán URL remote và
không làm gián đoạn push lên Haravan. Dùng `-SkipGit` cho một lượt cần bỏ qua lưu Git.

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
