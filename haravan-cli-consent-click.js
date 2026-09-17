// Haravan CLI consent helper — chạy trên trang authorize/consent của accounts.haravan.com
// khi Haravan CLI vừa mở login. Tự bấm Đồng Ý; không đọc credential, không lưu token.
(() => {
  const labels = [
    "đồng ý",
    "dong y",
    "cho phép",
    "allow",
    "authorize",
    "agree",
    "accept",
    "consent",
  ];

  const textOf = (el) =>
    `${el.innerText || ""} ${el.value || ""} ${el.getAttribute("aria-label") || ""}`
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const clickable = [
    ...document.querySelectorAll(
      "button, a, input[type=submit], [role=button]",
    ),
  ];

  const match = clickable.find((el) => {
    const text = textOf(el);
    return labels.some((label) => text === label || text.includes(label));
  });

  if (!match) {
    console.warn("Haravan CLI consent: không thấy nút Đồng Ý.");
    return false;
  }

  match.click();
  console.log("Haravan CLI consent: đã bấm Đồng Ý.");
  return true;
})();
