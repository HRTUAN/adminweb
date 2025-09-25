import pool from "../configs/connectDB.js";
import multer from "multer";
import bcrypt from "bcrypt";
import { validationResult } from "express-validator";
import logger from "../utils/logger.js";
import { verifyRecaptcha } from "../utils/recaptcha.js";

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
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map((e) => e.msg).join("; ");
      return res.status(400).render("login.ejs", { title: "Login Page", error: msg });
    }

    const { email, password } = req.body;

    // Optional reCAPTCHA
    if (req.app.locals.ENABLE_RECAPTCHA) {
      const token = req.body["g-recaptcha-response"] || req.body["recaptcha"];
      const verify = await verifyRecaptcha(token, req.ip);
      if (!verify?.success) {
        logger.warn("Login blocked due to failed reCAPTCHA", { email, ip: req.ip, error: verify?.['error-codes'] || verify?.error });
        return res.status(400).render("login.ejs", { title: "Login Page", error: "Xác thực reCAPTCHA thất bại" });
      }
    }

    const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);

    if (rows.length > 0) {
      const user = rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        // Prevent session fixation
        return req.session.regenerate((err) => {
          if (err) {
            logger.error("Session regenerate error", { err });
            return res.status(500).render("login.ejs", { title: "Login Page", error: "Có lỗi xảy ra. Vui lòng thử lại" });
          }
          req.session.user = { id: user.id, email: user.email, role: user.role };
          req.session.save(() => res.redirect("/dashboard"));
        });
      }
    }

    logger.warn("Login failed", { email, ip: req.ip });
    return res.status(401).render("login.ejs", { title: "Login Page", error: "Sai email hoặc mật khẩu" });
  } catch (err) {
    logger.error("Login error", { err: String(err) });
    return res.status(500).render("login.ejs", { title: "Login Page", error: "Có lỗi xảy ra. Vui lòng thử lại" });
  }
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
