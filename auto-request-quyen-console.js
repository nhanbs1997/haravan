// ========================================
// AUTO REQUEST QUYỀN - CONSOLE TOOL
// Chạy toàn bộ file này trong Console khi đang đăng nhập inside.haravan.com
//
// Lưu ý bảo mật:
// - CSV chỉ được chứa domain và account/email.
// - Tool không đọc, hiển thị hoặc copy mật khẩu.
// - Nếu API trả về "Tên đăng nhập này đã được sử dụng", tool dừng các request tiếp theo
//   của shop đó và không hiển thị dòng "Đã request ...".
// ========================================

(() => {
  const PANEL_ID = "tool-orgid";
  const RESULT_ID = "auto-request-result";
  const TABLE_BODY_ID = "account-table-body";
  const INPUT_ID = "domainInput";
  const BUTTON_ID = "btnRun";

  const ALREADY_REQUESTED_MESSAGE =
    "Tên đăng nhập này đã được sử dụng";

  const REQUEST_URL =
    "https://accounts.haravan.com/api/users/request_access";

  const ADMINS_URL = (orgId) =>
    "https://accounts.haravan.com/api/users/admins?org_id=" +
    encodeURIComponent(orgId);

  const SHOP_URL = (orgId) =>
    "https://inside-api.haravan.com/api/shops/" +
    encodeURIComponent(orgId);

  // Google Sheet CSV đã cấu hình sẵn.
  // CSV phải chỉ gồm domain và account/email, không có password/mật khẩu.
  const SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQDrTmxTWYUfiE-l-ADG_Cyo-sjG6L1ujKCjMJXTbNXJp4zPovMj3t6ErQnbawNTtVqVJZ-Sv8S8eO3/pub?gid=450816195&single=true&output=csv";

  const TARGET_ACCOUNT = "html.tech@haravan.com";
  const TARGET_NAME = "NGUYỄN MINH NHÂN";

  document.getElementById(PANEL_ID)?.remove();

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div id="${PANEL_ID}" style="
        position:fixed;
        bottom:20px;
        left:20px;
        width:520px;
        max-width:calc(100vw - 40px);
        max-height:90vh;
        overflow:auto;
        z-index:999999;
        box-sizing:border-box;
        padding:20px;
        background:#fff;
        border:1px solid #ddd;
        border-radius:10px;
        box-shadow:0 0 18px rgba(0,0,0,.22);
        color:#222;
        font:14px/1.5 Arial,sans-serif;
      ">
        <h3 style="margin:0 0 12px">Auto Request Quyền</h3>

        <label style="display:block;margin-bottom:6px;font-weight:600">
          Domain hoặc Org ID
        </label>

        <textarea id="${INPUT_ID}" rows="5" placeholder="Mỗi dòng một domain/Org ID. Có thể ngăn cách bằng dấu phẩy hoặc dấu chấm phẩy."
          style="
            width:100%;
            padding:10px;
            border:1px solid #ccc;
            border-radius:5px;
            box-sizing:border-box;
            resize:vertical;
            font:inherit;
          "></textarea>

        <button id="${BUTTON_ID}" type="button" style="
          width:100%;
          padding:10px;
          margin-top:10px;
          cursor:pointer;
          border:0;
          background:#1677ff;
          color:#fff;
          border-radius:5px;
          font:inherit;
        ">Chạy</button>

        <div id="sheet-status" style="margin-top:10px;color:#666">
          Đang kiểm tra sheet tài khoản...
        </div>

        <div style="margin-top:14px;overflow:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#f1f5f9">
                <th style="padding:8px;border:1px solid #d9dee5;text-align:left">
                  Link web
                </th>
                <th style="padding:8px;border:1px solid #d9dee5;text-align:left">
                  Tài khoản
                </th>
              </tr>
            </thead>
            <tbody id="${TABLE_BODY_ID}">
              <tr data-empty-row>
                <td colspan="2" style="padding:8px;border:1px solid #d9dee5;color:#777">
                  Chưa có dữ liệu
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div id="${RESULT_ID}" style="margin-top:16px"></div>
      </div>
    `
  );

  const button = document.getElementById(BUTTON_ID);
  const input = document.getElementById(INPUT_ID);
  const box = document.getElementById(RESULT_ID);
  const sheetStatus = document.getElementById("sheet-status");
  const accountTableBody = document.getElementById(TABLE_BODY_ID);

  const htmlEscapeMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) => htmlEscapeMap[character]
    );
  }

  function appendHtml(html) {
    box.insertAdjacentHTML("beforeend", html);
  }

  function setRunning(isRunning) {
    button.disabled = isRunning;
    button.style.opacity = isRunning ? "0.65" : "1";
    button.textContent = isRunning ? "Đang chạy..." : "Chạy";
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(String(value ?? ""));
      alert("Đã copy");
    } catch (error) {
      console.error("Không thể copy", error);
    }
  }

  box.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy-value]");
    if (!copyButton) return;
    copyText(copyButton.getAttribute("data-copy-value"));
  });

  function parseCsv(csvText) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let index = 0; index < csvText.length; index += 1) {
      const character = csvText[index];
      const nextCharacter = csvText[index + 1];

      if (character === '"' && quoted && nextCharacter === '"') {
        cell += '"';
        index += 1;
        continue;
      }

      if (character === '"') {
        quoted = !quoted;
        continue;
      }

      if (character === "," && !quoted) {
        row.push(cell);
        cell = "";
        continue;
      }

      if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && nextCharacter === "\n") index += 1;
        row.push(cell);
        if (row.some((value) => value.trim() !== "")) rows.push(row);
        row = [];
        cell = "";
        continue;
      }

      cell += character;
    }

    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    return rows;
  }

  function normalizeHeader(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function getColumnIndex(headers, patterns) {
    return headers.findIndex((header) =>
      patterns.some((pattern) => header.includes(pattern))
    );
  }

  function getHost(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";

    try {
      const url = new URL(
        /^https?:\/\//i.test(raw) ? raw : "https://" + raw
      );
      return url.hostname.toLowerCase().replace(/^www\./, "");
    } catch (error) {
      return raw
        .replace(/^https?:\/\//i, "")
        .split(/[/?#]/)[0]
        .toLowerCase()
        .replace(/^www\./, "");
    }
  }

  function parseSheetRows(csvText) {
    const rows = parseCsv(csvText);
    if (!rows.length) return [];

    const headers = rows[0].map(normalizeHeader);
    const passwordHeader = headers.find((header) =>
      /(pass|password|mat khau|matkhau)/i.test(header)
    );

    if (passwordHeader) {
      throw new Error(
        "CSV đang chứa cột mật khẩu. Hãy tạo CSV mới chỉ gồm domain và account/email."
      );
    }

    const domainIndex = getColumnIndex(headers, [
      "domain",
      "website",
      "url",
    ]);
    const accountIndex = getColumnIndex(headers, [
      "account",
      "username",
      "user name",
      "email",
      "tai khoan",
    ]);

    if (domainIndex < 0 || accountIndex < 0) {
      throw new Error(
        "CSV phải có header domain/website và account/username/email."
      );
    }

    return rows.slice(1).map((row) => ({
      domain: String(row[domainIndex] ?? "").trim(),
      account: String(row[accountIndex] ?? "").trim(),
    })).filter((item) => item.domain);
  }

  async function loadSheet() {
    if (!SHEET_CSV_URL || SHEET_CSV_URL.startsWith("DAN_")) {
      sheetStatus.textContent =
        "Chưa cấu hình CSV tài khoản (chỉ domain + account/email).";
      return [];
    }

    const response = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Không tải được CSV tài khoản: HTTP " + response.status);
    }

    const csvText = await response.text();
    const rows = parseSheetRows(csvText);
    sheetStatus.textContent =
      "Đã tải " + rows.length + " tài khoản từ CSV.";
    return rows;
  }

  function findSheetAccount(sheetRows, domain) {
    const host = getHost(domain);
    return sheetRows.find((row) => {
      const rowHost = getHost(row.domain);
      return rowHost && (rowHost === host || rowHost.includes(host) || host.includes(rowHost));
    });
  }

  function getAccessToken() {
    const storages = [window.localStorage, window.sessionStorage];

    for (const storage of storages) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key || !key.includes("oidc.user")) continue;

        try {
          const data = JSON.parse(storage.getItem(key));
          if (data?.access_token) return data.access_token;
        } catch (error) {
          // Bỏ qua entry không phải JSON.
        }
      }
    }

    return "";
  }

  async function readJson(response) {
    const text = await response.text();
    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch (error) {
      return { message: text };
    }
  }

  function buildMailHtml(adminName) {
    const safeAdminName = escapeHtml(adminName);

    return `
      <div style="margin-top:10px;padding:10px;background:#fff;border:1px solid #ddd;border-radius:5px">
        Dear anh/chị,<br><br>

        Để có thể hỗ trợ vấn đề trên mong anh/chị vào email ${safeAdminName}
        và tìm tiêu đề mail
        <b>[Haravan] Hỗ trợ cấp quyền truy cập vào trang quản trị ...</b>
        và click vào <b>Cho phép truy cập</b>
        cho tài khoản
        <b style="color:#08589d">${TARGET_ACCOUNT}</b>

        <br><br>

        Nếu không thấy mail anh/chị phân quyền thủ công cho
        ${TARGET_ACCOUNT} theo hướng dẫn
        <a target="_blank" href="https://docs.google.com/document/d/1tn1KrrbXG2Ry-2ya2JRFkCgGWcADa1YyvLW1xPEzKnA/edit?tab=t.0">
          tại đây
        </a>

        <br><br>

        Sau khi cấp quyền anh/chị reply
        <b style="background:yellow">Đã phân quyền</b>
        để em nắm thông tin và chỉnh sửa nhanh nhất ạ
      </div>
    `;
  }

  function appendShopHeader(input, metaData, orgId, domain) {
    appendHtml(`
      <div style="margin-top:16px;padding:10px;background:#eef6ff;border-radius:5px">
        <div><b>Shop đang xử lý</b></div>
        <div>Input: <b>${escapeHtml(input)}</b></div>
        <div>Org ID: <b>${escapeHtml(orgId)}</b></div>
        <div>Shop: <b>${escapeHtml(metaData.name || "")}</b></div>
        <div>Domain: <b>${escapeHtml(domain)}</b></div>
      </div>
    `);
  }

  function appendAccountTableRow(webLink, account) {
    const emptyRow = accountTableBody.querySelector("[data-empty-row]");
    emptyRow?.remove();

    const row = document.createElement("tr");
    const webCell = document.createElement("td");
    const accountCell = document.createElement("td");
    const link = document.createElement("a");

    webCell.style.cssText = "padding:8px;border:1px solid #d9dee5;word-break:break-all";
    accountCell.style.cssText = "padding:8px;border:1px solid #d9dee5;word-break:break-all";

    link.href = webLink;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = webLink;

    webCell.appendChild(link);
    accountCell.textContent = account || "Không tìm thấy";
    row.append(webCell, accountCell);
    accountTableBody.appendChild(row);
  }

  function appendAccountResult(webLink, sheetRow) {
    appendAccountTableRow(webLink, sheetRow?.account || "");

    if (!sheetRow) {
      appendHtml(`
        <div style="margin-top:10px;color:#b26a00">
          Không tìm thấy account trong CSV tài khoản.
        </div>
      `);
      return;
    }

    appendHtml(`
      <div style="margin-top:10px;padding:10px;background:#f5f5f5;border-radius:5px">
        <div><b>Tìm thấy account trong CSV</b></div>
        <div style="margin-top:5px">Đường dẫn: <b>${escapeHtml(sheetRow.domain)}</b></div>
        <div style="margin-top:5px">
          Tài khoản: <b>${escapeHtml(sheetRow.account) || "(trống)"}</b>
          ${sheetRow.account ? `
            <button type="button" data-copy-value="${escapeHtml(sheetRow.account)}"
              style="margin-left:5px;cursor:pointer">Copy</button>
          ` : ""}
        </div>
      </div>
    `);
  }

  async function requestPermission(token, orgId, adminId, adminName) {
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() + 30);

    const requestData = {
      userName: TARGET_ACCOUNT,
      name: TARGET_NAME,
      description: "Chỉnh sửa website",
      approvedBy: adminId,
      expiredAt: expiredDate.toISOString(),
      groupNameRoles: ["Quản lý web"],
      orgId,
      data: JSON.stringify({
        roles: ["com_api.admin"],
        attribute: {
          social_group_permission: "social_group_admin",
        },
      }),
    };

    try {
      const response = await fetch(REQUEST_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify(requestData),
      });

      const result = await readJson(response);
      const message = String(
        result?.message || result?.data?.message || ""
      );

      if (message.includes(ALREADY_REQUESTED_MESSAGE)) {
        appendHtml(`
          <div style="margin-top:8px;color:#b26a00">
            ↷ Đã có yêu cầu quyền trước đó cho
            <b>${escapeHtml(adminName)}</b>; bỏ qua các request tiếp theo.
          </div>
        `);

        return { alreadyRequested: true };
      }

      if (!response.ok) {
        appendHtml(`
          <div style="margin-top:8px;color:red">
            ✖ Lỗi API với <b>${escapeHtml(adminName)}</b>:
            ${escapeHtml(message || "HTTP " + response.status)}
          </div>
        `);

        return { alreadyRequested: false, requested: false };
      }

      // Cố ý không hiển thị dòng "Đã request ...".
      appendHtml(`
        <div style="margin-top:8px;color:#1677ff">
          ${escapeHtml(message || "Đã xử lý yêu cầu quyền.")}
          <span> — ${escapeHtml(adminName)}</span>
        </div>
        ${buildMailHtml(adminName)}
      `);

      return { alreadyRequested: false, requested: true };
    } catch (error) {
      appendHtml(`
        <div style="margin-top:8px;color:red">
          ✖ Lỗi request với <b>${escapeHtml(adminName)}</b>:
          ${escapeHtml(error.message)}
        </div>
      `);

      return { alreadyRequested: false, requested: false };
    }
  }

  function normalizeDomain(value) {
    const raw = String(value ?? "").trim();
    if (!raw) throw new Error("Domain đang trống.");

    const url = new URL(
      /^https?:\/\//i.test(raw) ? raw : "https://" + raw
    );

    return url.origin;
  }

  function splitInputs(value) {
    return [...new Set(
      String(value ?? "")
        .split(/[\n,;]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )];
  }

  async function resolveShop(input, token) {
    let domain = "";
    let orgId = "";

    if (/^\d+$/.test(input)) {
      const shopResponse = await fetch(SHOP_URL(input), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
      });

      const shopData = await readJson(shopResponse);
      if (!shopResponse.ok) {
        throw new Error(
          shopData?.message || "Không lấy được shop từ Org ID."
        );
      }

      orgId = input;
      domain =
        shopData?.data?.buyerDomain ||
        shopData?.buyerDomain ||
        shopData?.data?.domain ||
        shopData?.domain ||
        "";

      if (!domain) {
        throw new Error("Không tìm thấy buyerDomain từ Org ID.");
      }
    } else {
      domain = input;
    }

    const origin = normalizeDomain(domain);
    const metaResponse = await fetch(origin + "/meta.json", {
      cache: "no-store",
    });

    const metaData = await readJson(metaResponse);
    if (!metaResponse.ok) {
      throw new Error("Không tải được meta.json: HTTP " + metaResponse.status);
    }

    if (!orgId) {
      orgId = String(
        metaData.id ||
        metaData.org_id ||
        metaData.orgId ||
        ""
      );
    }

    if (!orgId) {
      throw new Error("Không tìm thấy Org ID trong meta.json.");
    }

    const shopDomain =
      metaData.myharavan_domain ||
      metaData.domain ||
      origin;

    return {
      origin,
      orgId,
      metaData,
      shopDomain,
    };
  }

  async function processShop(input, token, sheetRows) {
    appendHtml(`
      <div style="margin-top:16px;color:#666">
        Đang xử lý <b>${escapeHtml(input)}</b>...
      </div>
    `);

    const shop = await resolveShop(input, token);
    appendShopHeader(input, shop.metaData, shop.orgId, shop.shopDomain);
    appendAccountResult(
      shop.shopDomain,
      findSheetAccount(sheetRows, shop.shopDomain)
    );

    const adminResponse = await fetch(ADMINS_URL(shop.orgId), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    });

    const adminData = await readJson(adminResponse);
    if (!adminResponse.ok) {
      throw new Error(
        adminData?.message ||
        "Không lấy được danh sách admin: HTTP " + adminResponse.status
      );
    }

    const admins = Array.isArray(adminData?.data)
      ? adminData.data
      : Array.isArray(adminData?.data?.data)
        ? adminData.data.data
        : Array.isArray(adminData?.admins)
          ? adminData.admins
          : [];

    const internalAdmin = admins.find((admin) =>
      String(admin?.username || admin?.email || "")
        .toLowerCase()
        .includes("@haravan.com")
    );

    if (internalAdmin) {
      appendHtml(`
        <div style="margin-top:10px;color:green">
          ✔ Đã có quyền: <b>${escapeHtml(
            internalAdmin.username || internalAdmin.email
          )}</b>
        </div>
      `);
      return;
    }

    appendHtml(`
      <div style="margin-top:10px;color:#b26a00">
        Không thấy tài khoản nội bộ có quyền; kiểm tra yêu cầu hiện có...
      </div>
    `);

    for (const admin of admins) {
      const adminId = admin?.id || admin?.userId || admin?.user_id;
      const adminName = admin?.username || admin?.email || admin?.name || "";
      if (!adminId || !adminName) continue;

      const requestResult = await requestPermission(
        token,
        shop.orgId,
        adminId,
        adminName
      );

      if (requestResult.alreadyRequested) break;
    }
  }

  (async () => {
    let sheetRows = [];
    try {
      sheetRows = await loadSheet();
    } catch (error) {
      sheetStatus.textContent = "CSV lỗi: " + error.message;
      sheetStatus.style.color = "#b00020";
    }

    const token = getAccessToken();
    if (!token) {
      box.innerHTML = `
        <div style="color:red">
          Không tìm thấy token đăng nhập. Hãy chạy tool trên tab đã đăng nhập.
        </div>
      `;
      return;
    }

    button.addEventListener("click", async () => {
      const inputs = splitInputs(input.value);

      if (!inputs.length) {
        box.innerHTML = `
          <div style="color:#b26a00">Hãy nhập ít nhất một domain hoặc Org ID.</div>
        `;
        return;
      }

      box.innerHTML = "";
      accountTableBody.innerHTML = `
        <tr data-empty-row>
          <td colspan="2" style="padding:8px;border:1px solid #d9dee5;color:#777">
            Đang tải...
          </td>
        </tr>
      `;
      setRunning(true);

      try {
        for (const item of inputs) {
          try {
            await processShop(item, token, sheetRows);
          } catch (error) {
            appendHtml(`
              <div style="margin-top:10px;color:red">
                ✖ Lỗi <b>${escapeHtml(item)}</b>:
                ${escapeHtml(error.message)}
              </div>
            `);
          }
        }
      } finally {
        setRunning(false);
      }
    });

    input.focus();
  })();
})();
