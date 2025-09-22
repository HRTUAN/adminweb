document.addEventListener("DOMContentLoaded", function () {
  // Xóa user
  document.querySelectorAll(".btn-delete-user").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!confirm("Bạn có chắc muốn xóa user này?")) return;
      const userId = btn.getAttribute("data-userid");
      fetch("/admin/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId }),
      })
        .then(async (res) => {
          if (res.ok) btn.closest("tr").remove();
          else alert("Xóa thất bại!");
        })
        .catch(() => alert("Có lỗi xảy ra!"));
    });
  });

  // Thêm user mới
  const addUserForm = document.getElementById("addUserForm");
  if (addUserForm) {
    addUserForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const formData = new FormData(addUserForm);
      const data = Object.fromEntries(formData.entries());

      fetch("/admin/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then((res) => res.json())
        .then((user) => {
          if (user && user.id) {
            const tbody = document.querySelector("table tbody");
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.email}</td>
                <td>••••••••</td>
                <td>${user.role}</td>
                <td>
                  <button type="button" class="btn btn-sm btn-danger btn-delete-user" data-userid="${user.id}">Xóa</button>
                  <form action="/admin/update" method="POST" style="display: inline">
                    <input type="hidden" name="id" value="${user.id}" />
                    <input type="email" name="email" value="${
                      user.email
                    }" placeholder="Email" class="form-control form-control-sm d-inline w-auto" style="width: 180px;" required />
                    <input type="password" name="password" value="" placeholder="Password" class="form-control form-control-sm d-inline w-auto" style="width: 120px;" />
                    <select name="role" class="form-select form-select-sm d-inline w-auto" style="width: 90px;">
                      <option value="user" ${user.role === "user" ? "selected" : ""}>User</option>
                      <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
                    </select>
                    <button type="submit" class="btn btn-sm btn-warning">Sửa</button>
                  </form>
                </td>
              `;
            tbody.appendChild(tr);

            // Gắn lại sự kiện xóa cho user mới
            tr.querySelector(".btn-delete-user").addEventListener("click", function () {
              if (!confirm("Bạn có chắc muốn xóa user này?")) return;
              const userId = this.getAttribute("data-userid");
              fetch("/admin/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: userId }),
              })
                .then((res) => res.json())
                .then((data) => {
                  if (data.success) this.closest("tr").remove();
                  else alert("Xóa thất bại!");
                })
                .catch(() => alert("Có lỗi xảy ra!"));
            });

            addUserForm.reset();
          } else {
            alert("Thêm user thất bại!");
          }
        })
        .catch(() => alert("Có lỗi xảy ra!"));
    });
  }
});
