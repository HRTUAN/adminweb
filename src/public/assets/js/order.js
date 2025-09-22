const form = document.getElementById("excelForm");
const spinner = document.getElementById("excelSpinner");
const text = document.getElementById("excelText");
const msg = document.getElementById("msg");
const table = document.getElementById("ordersTable");
const chkAll = document.getElementById("chkAll");
const btnBulkDelete = document.getElementById("btnBulkDelete");

// Helper: safe JSON parsing for fetch responses
async function parseJSONResponse(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return await res.json();
  } else {
    const text = await res.text();
    throw new Error(text?.slice(0, 120) || "Unexpected non-JSON response");
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.innerHTML = "";
  spinner.classList.remove("d-none");
  text.textContent = "Đang import...";
  try {
    const formData = new FormData(form);
    const res = await fetch("/api/order/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || "Import thất bại");
    msg.innerHTML = `<div class="alert alert-success">Import thành công: thêm ${data.inserted || 0} hàng.</div>`;
    // Reload để cập nhật bảng từ DB
    setTimeout(() => window.location.reload(), 800);
  } catch (err) {
    msg.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  } finally {
    spinner.classList.add("d-none");
    text.textContent = "Import Excel";
    form.reset();
  }
});

const updateBulkState = () => {
  const checks = Array.from(document.querySelectorAll("#ordersTable .row-check"));
  const selected = checks.filter((c) => c.checked).length;
  btnBulkDelete.disabled = selected === 0;
  if (checks.length > 0) {
    chkAll.checked = selected === checks.length;
    chkAll.indeterminate = selected > 0 && selected < checks.length;
  } else {
    chkAll.checked = false;
    chkAll.indeterminate = false;
  }
};

// Select all toggle
chkAll?.addEventListener("change", () => {
  document.querySelectorAll("#ordersTable .row-check").forEach((chk) => {
    chk.checked = chkAll.checked;
  });
  updateBulkState();
});

// Row checkbox change
table?.addEventListener("change", (e) => {
  if (e.target.classList.contains("row-check")) updateBulkState();
});

// Bulk delete
btnBulkDelete?.addEventListener("click", async () => {
  const ids = Array.from(document.querySelectorAll("#ordersTable tbody tr"))
    .filter((tr) => tr.querySelector(".row-check")?.checked)
    .map((tr) => tr.getAttribute("data-id"));
  if (ids.length === 0) return;
  if (!confirm(`Bạn có chắc muốn xóa ${ids.length} đơn hàng?`)) return;
  try {
    const res = await fetch("/api/order/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const data = await parseJSONResponse(res);
    if (!data.success) throw new Error(data.message || "Xóa nhiều thất bại");
    // Remove selected rows
    ids.forEach((id) => {
      const tr = table.querySelector(`tr[data-id="${id}"]`);
      tr && tr.remove();
    });
    updateBulkState();
    msg.innerHTML = `<div class="alert alert-success">Đã xóa ${data.affectedRows || ids.length} đơn hàng.</div>`;
  } catch (err) {
    msg.innerHTML = `<div class=\"alert alert-danger\">${err.message}</div>`;
  }
});

// Xóa một hàng
table?.addEventListener("click", async (e) => {
  const btn = e.target.closest(".btn-delete");
  if (!btn) return;
  const tr = btn.closest("tr");
  const id = tr?.getAttribute("data-id");
  if (!id) return;
  if (!confirm("Bạn có chắc muốn xóa đơn hàng này?")) return;
  try {
    const res = await fetch(`/api/order/${id}`, { method: "DELETE" });
    const data = await parseJSONResponse(res);
    if (!data.success) throw new Error(data.message || "Xóa thất bại");
    tr.remove();
    msg.innerHTML = '<div class="alert alert-success">Đã xóa đơn hàng.</div>';
  } catch (err) {
    msg.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
});
