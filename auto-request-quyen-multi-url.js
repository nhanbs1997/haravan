// ========================================
// AUTO REQUEST QUYỀN - NHIỀU URL
// Chạy toàn bộ file này trong Console khi đang đăng nhập inside.haravan.com
//
// Bản này không dùng Google Sheet/CSV và không đọc mật khẩu.
// Nhập mỗi URL hoặc Org ID trên một dòng; có thể ngăn cách bằng dấu phẩy/chấm phẩy.
// ========================================

(() => {
  const PANEL_ID = "tool-orgid-multi-url";
  const INPUT_ID = "domainInputMultiUrl";
  const BUTTON_ID = "btnRunMultiUrl";
  const RESULT_ID = "resultMultiUrl";

  const TARGET_ACCOUNT = "html.tech@haravan.com";
  const TARGET_NAME = "NGUYỄN MINH NHÂN";
  const ALREADY_REQUESTED_MESSAGE =
    "Tên đăng nhập này đã được sử dụng";

  const REQUEST_URL =
    "https://accounts.haravan.com/api/users/request_access";

  const SHOP_URL = (orgId) =>
    "https://inside-api.haravan.com/api/shops/" +
    encodeURIComponent(orgId);

  const ADMINS_URL = (orgId) =>
    "https://accounts.haravan.com/api/users/admins?org_id=" +
    encodeURIComponent(orgId);

  document.getElementById(PANEL_ID)?.remove();

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div id="${PANEL_ID}" style="
        position:fixed;
        left:20px;
        bottom:20px;
        z-index:999999;
        width:520px;
        max-width:calc(100vw - 40px);
        max-height:90vh;
        overflow:auto;
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

        <textarea id="${INPUT_ID}" rows="6"
          placeholder="Nhập nhiều URL hoặc Org ID, mỗi dòng một giá trị..."
          style="
            width:100%;
            box-sizing:border-box;
            padding:10px;
            border:1px solid #ccc;
            border-radius:5px;
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

        <div id="${RESULT_ID}" style="margin-top:18px;font-size:14px"></div>
      </div>
    `,
  );

  const button = document.getElementById(BUTTON_ID);
  const input = document.getElementById(INPUT_ID);
  const box = document.getElementById(RESULT_ID);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function appendHtml(html) {
    box.insertAdjacentHTML("beforeend", html);
  }

  function splitInputs(value) {
    return [...new Set(
      String(value || "")
        .split(/[\n,;]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    )];
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
        result?.message || result?.data?.message || "",
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
        return { alreadyRequested: false };
      }

      // Không hiển thị dòng "Đã request ...".
      appendHtml(`
        <div style="margin-top:8px;color:#1677ff">
          ${escapeHtml(message || "Đã xử lý yêu cầu quyền.")}
          <span> — ${escapeHtml(adminName)}</span>
        </div>
        ${buildMailHtml(adminName)}
      `);

      return { alreadyRequested: false };
    } catch (error) {
      appendHtml(`
        <div style="margin-top:8px;color:red">
          ✖ Lỗi request với <b>${escapeHtml(adminName)}</b>:
          ${escapeHtml(error.message)}
        </div>
      `);
      return { alreadyRequested: false };
    }
  }

  async function resolveShop(inputValue, token) {
    let domain = "";
    let orgId = "";

    if (/^\d+$/.test(inputValue)) {
      const shopResponse = await fetch(SHOP_URL(inputValue), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
      });

      const shopData = await readJson(shopResponse);
      if (!shopResponse.ok) {
        throw new Error(
          shopData?.message || "Không lấy được shop từ Org ID.",
        );
      }

      orgId = inputValue;
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
      domain = inputValue;
    }

    const origin = new URL(
      /^https?:\/\//i.test(domain) ? domain : "https://" + domain,
    ).origin;

    const metaResponse = await fetch(origin + "/meta.json", {
      cache: "no-store",
    });
    const metaData = await readJson(metaResponse);

    if (!metaResponse.ok) {
      throw new Error("Không tải được meta.json: HTTP " + metaResponse.status);
    }

    if (!orgId) {
      orgId = String(metaData.id || metaData.org_id || metaData.orgId || "");
    }

    if (!orgId) {
      throw new Error("Không tìm thấy Org ID trong meta.json.");
    }

    return {
      origin,
      orgId,
      metaData,
      shopDomain: metaData.myharavan_domain || origin,
    };
  }

  async function processOneShop(inputValue, token, index, total) {
    appendHtml(`
      <div style="margin-top:16px;padding:10px;background:#eef6ff;border-radius:5px">
        Đang xử lý <b>${index}/${total}</b>: ${escapeHtml(inputValue)}
      </div>
    `);

    const shop = await resolveShop(inputValue, token);

    appendHtml(`
      <div style="margin-top:8px">
        Org ID: <b>${escapeHtml(shop.orgId)}</b><br>
        Shop: <b>${escapeHtml(shop.metaData.name || "")}</b><br>
        Domain: <b>${escapeHtml(shop.shopDomain)}</b>
      </div>
    `);

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
        "Không lấy được danh sách admin: HTTP " + adminResponse.status,
      );
    }

    const admins = Array.isArray(adminData?.data)
      ? adminData.data
      : Array.isArray(adminData?.data?.data)
        ? adminData.data.data
        : [];

    const internalAdmin = admins.find((admin) =>
      String(admin?.username || admin?.email || "")
        .toLowerCase()
        .includes("@haravan.com"),
    );

    if (internalAdmin) {
      appendHtml(`
        <div style="margin-top:10px;color:green">
          ✔ Đã có quyền:
          <b>${escapeHtml(internalAdmin.username || internalAdmin.email)}</b>
        </div>
      `);
      return;
    }

    if (!admins.length) {
      appendHtml(`
        <div style="margin-top:10px;color:#b26a00">
          Không tìm thấy admin để request quyền.
        </div>
      `);
      return;
    }

    appendHtml(`
      <div style="margin-top:10px;color:#b26a00">
        Không thấy quyền nội bộ; bắt đầu kiểm tra request hiện có...
      </div>
    `);

    for (const admin of admins) {
      const adminId = admin?.id || admin?.userId || admin?.user_id;
      const adminName = admin?.username || admin?.email || admin?.name || "";
      if (!adminId || !adminName) continue;

      const result = await requestPermission(
        token,
        shop.orgId,
        adminId,
        adminName,
      );

      if (result.alreadyRequested) break;
    }
  }

  const token = getAccessToken();

  if (!token) {
    box.innerHTML = `
      <div style="color:red">
        Không tìm thấy token đăng nhập. Hãy chạy trên tab đã đăng nhập.
      </div>
    `;
    return;
  }

  button.addEventListener("click", async () => {
    const inputs = splitInputs(input.value);

    if (!inputs.length) {
      box.innerHTML = `
        <div style="color:#b26a00">
          Hãy nhập ít nhất một URL hoặc Org ID.
        </div>
      `;
      return;
    }

    box.innerHTML = "";
    button.disabled = true;
    button.style.opacity = "0.65";
    button.textContent = "Đang chạy...";

    try {
      for (let index = 0; index < inputs.length; index += 1) {
        try {
          await processOneShop(
            inputs[index],
            token,
            index + 1,
            inputs.length,
          );
        } catch (error) {
          appendHtml(`
            <div style="margin-top:10px;color:red">
              ✖ Lỗi <b>${escapeHtml(inputs[index])}</b>:
              ${escapeHtml(error.message)}
            </div>
          `);
        }
      }
    } finally {
      button.disabled = false;
      button.style.opacity = "1";
      button.textContent = "Chạy";
    }
  });

  input.focus();
})();
