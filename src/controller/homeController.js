import pool from "../configs/connectDB.js";
import multer from "multer";
import bcrypt from "bcrypt";

// Middleware check login
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
};

// Trang login
let getLoginPage = async (req, res) => {
  return res.render("login.ejs", { title: "Login Page", error: null });
};

// Xử lý login
let postLogin = async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);

  if (rows.length > 0) {
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      req.session.user = { id: user.id, email: user.email, role: user.role };
      return res.redirect("/dashboard");
    }
  }
  return res.render("login.ejs", { title: "Login Page", error: "Sai email hoặc mật khẩu" });
};

// Trang dashboard
let getDashboardPage = async (req, res) => {
  return res.render("dashboard.ejs", { title: "Dashboard", user: req.session.user });
};

// Logout
let logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
};

export default {
  getLoginPage,
  postLogin,
  getDashboardPage,
  logout,
  requireLogin,
};
