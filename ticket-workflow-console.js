// Ticket workflow helper — chạy trong Console của trang Helpdesk đang mở ticket.
// Chỉ đọc DOM và copy context JSON; không đọc credential, không mở/nhập/gửi Reply.
(() => {
  const CREDENTIAL_SHEET_URL =
    "https://docs.google.com/spreadsheets/u/3/d/1-p-TFACBYSBtpsnER8iFyxevGUGm0a-Jb1KOAIM5r0I/edit?pli=1&gid=450816195#gid=450816195";

  const ticketMatch = location.pathname.match(/\/tickets\/(\d+)/i);
  const ticketId = ticketMatch?.[1] || "";
  // Có thể đặt giá trị này trước khi chạy helper nếu caller đã tách yêu cầu bổ sung
  // từ tin nhắn người dùng. Mặc định để trống để giữ nguyên toàn bộ yêu cầu ticket.
  const additionalRequest = String(
    globalThis.__haravanTicketWorkflowAdditionalRequest || "",
  ).trim();

  const normalizeUrl = (value) => {
    const raw = String(value || "").trim().replace(/[),.;!?]+$/g, "");
    if (!raw) return "";
    try {
      return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).href;
    } catch {
      return "";
    }
  };

  const getRoots = () => {
    const roots = [document];
    for (const frame of document.querySelectorAll("iframe")) {
      try {
        if (frame.contentDocument) roots.push(frame.contentDocument);
      } catch {
        // Bỏ qua iframe khác origin.
      }
    }
    return roots;
  };

  const getRootText = (root) => {
    try {
      return String(root.body?.innerText || "").trim();
    } catch {
      return "";
    }
  };

  const roots = getRoots();
  const bodyText = roots.map(getRootText).filter(Boolean).join("\n\n");
  const links = roots.flatMap((root) =>
    [...root.querySelectorAll("a[href]")].map((anchor) => anchor.href),
  );
  const textUrls = bodyText.match(/(?:https?:\/\/|www\.)[^\s<>'"`]+/gi) || [];
  const candidates = [...new Set([...links, ...textUrls])]
    .map(normalizeUrl)
    .filter(Boolean)
    .filter((value) => {
      try {
        const host = new URL(value).hostname.toLowerCase();
        return ![
          "support.haravan.com",
          "inside.haravan.com",
          "theme.hstatic.net",
          "cdn.hstatic.net",
          "docs.google.com",
          "google.com",
        ].some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
      } catch {
        return false;
      }
    });

  const inputs = [...document.querySelectorAll("input, textarea")];
  const findInput = (pattern) =>
    inputs.find((element) =>
      pattern.test(
        [
          element.getAttribute("placeholder"),
          element.getAttribute("aria-label"),
          element.getAttribute("name"),
          element.value,
        ]
          .filter(Boolean)
          .join(" "),
      ),
    );

  const adminInput = findInput(/myharavan|shop domain|liên kết web/i);
  const orgInput = findInput(/org.?id|haravan org/i);
  const adminUrl = normalizeUrl(adminInput?.value);
  const orgFromField = String(orgInput?.value || "").match(/\d{8,}/)?.[0] || "";
  const orgFromText =
    bodyText.match(/(?:haravan\s+org\s*id|org[_\s-]?id)\D{0,24}(\d{8,15})/i)?.[1] ||
    "";
  const orgId = orgFromField || orgFromText;

  const adminCandidate = candidates.find((value) => {
    try {
      return /\.myharavan\.com$/i.test(new URL(value).hostname);
    } catch {
      return false;
    }
  });
  const websiteUrl = adminUrl || adminCandidate || candidates[0] || "";
  const subject =
    [...document.querySelectorAll('[role="banner"] button, [role="banner"] a')]
      .map((element) => element.textContent.trim())
      .find((value) => value && !/mở|đóng|reply|comment|chuyển|gitlab/i.test(value)) ||
    document.title ||
    "";
  const activityText = roots
    .map(getRootText)
    .find((value) => value.includes("Mô tả") || value.includes("Description")) ||
    bodyText;

  const context = {
    version: 1,
    source: "helpdesk-dom",
    ticketId,
    ticketUrl: location.href,
    subject,
    requestText: activityText,
    additionalRequest,
    scopeMode: additionalRequest
      ? "explicit-additional-request"
      : "ticket-request",
    implementationScope: additionalRequest
      ? `CHỈ ĐƯỢC XỬ LÝ YÊU CẦU BỔ SUNG SAU ĐÂY:\n${additionalRequest}\n\nKhông tự sửa các lỗi hoặc yêu cầu khác trong ticket nếu người dùng chưa chỉ định.`
      : "Xử lý theo toàn bộ yêu cầu đã xác minh trong ticket.",
    websiteUrl,
    adminUrl,
    shopName: "",
    websiteCandidates: candidates,
    orgId,
    insideLookupRequired: !websiteUrl && !!orgId,
    insideLookupUrl: orgId
      ? `https://inside.haravan.com/shops/${orgId}`
      : "https://inside.haravan.com/shops/{org_id}",
    credentialsSheetUrl: CREDENTIAL_SHEET_URL,
    replyMode: "draft-only",
  };

  const json = JSON.stringify(context, null, 2);
  globalThis.__haravanTicketWorkflowContext = context;
  console.log("Haravan ticket workflow context:\n" + json);

  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(json)
      .then(() => console.info("Đã copy context JSON. Không có mật khẩu/token trong context."))
      .catch(() => console.info("Không copy được tự động; hãy copy object vừa log trong Console."));
  }
})();
