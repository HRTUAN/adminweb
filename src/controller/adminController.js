import pool from "../configs/connectDB.js";
import bcrypt from "bcrypt";

// Hiển thị trang admin + list user
let getAdminPage = async (req, res) => {
  try {
    const [users] = await pool.execute("SELECT id, email, address, role FROM users");
    res.render("admin/admin.ejs", {
      title: "Admin Dashboard",
      user: req.session.user,
      users,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading admin page");
  }
};

// Thêm user (POST form, reload lại dashboard)
let apiAddUser = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute("INSERT INTO users(email, password, role) VALUES (?, ?, ?)", [email, hash, role]);
    // Lấy id mới
    const id = result.insertId;
    return res.json({ success: true, id, email, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Xóa user (POST form, reload lại dashboard)
let apiDeleteUser = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).send("Missing user id");

    await pool.execute("DELETE FROM users WHERE id = ?", [id]);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

// Sửa user (POST form, reload lại dashboard)
let apiUpdateUser = async (req, res) => {
  try {
    const { id, firstName, lastName, email, address, role } = req.body;
    if (!id || !email || !role) {
      return res.status(400).send("Missing required fields");
    }
    await pool.execute("UPDATE users SET firstName=?, lastName=?, email=?, address=?, role=? WHERE id=?", [
      firstName || "",
      lastName || "",
      email,
      address || "",
      role,
      id,
    ]);
    return res.redirect("/admin");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

export default {
  getAdminPage,
  apiAddUser,
  apiDeleteUser,
  apiUpdateUser,
};
