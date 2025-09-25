import express from "express";
import { body } from "express-validator";
import homeController from "../controller/homeController.js";
import adminController from "../controller/adminController.js";
import fileController from "../controller/fileController.js";
import excelController from "../controller/excelController.js";

let router = express.Router();

// ================= Middleware =================
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    // Nếu là API request, trả JSON 401 để client xử lý thay vì redirect HTML
    if (req.path.startsWith('/api')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    return res.redirect("/login");
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("Forbidden: Admin only!");
  }
  next();
};

// ================= Routes =================
const initWebRoute = (app) => {
  // -------- File Upload Routes --------
  // Upload file page
  router.get("/upload", requireLogin, fileController.getUploadPage);

  // Handle file upload
  router.post("/api/upload", requireLogin, fileController.upload.single("file"), fileController.uploadFile);

  // Get all files
  router.get("/api/files", requireLogin, fileController.getFiles);

  // Delete file
  router.delete("/api/files/:id", requireLogin, fileController.deleteFile);

  // -------- Excel Routes --------
  router.get("/order", requireLogin, excelController.getExcelPage);
  router.post("/api/order/upload", requireLogin, excelController.upload.single("excel"), excelController.uploadExcel);
  router.get("/api/order/download", requireLogin, excelController.downloadExcel);
  router.delete("/api/order/:id", requireLogin, excelController.deleteOrder);
  router.post("/api/order/bulk-delete", requireLogin, excelController.bulkDeleteOrders);

  // Auth
  router.get("/login", homeController.getLoginPage);
  router.post(
    "/login",
    app.locals.loginLimiter,
    // Validation & sanitization
    body("email").trim().isEmail().withMessage("Email không hợp lệ").normalizeEmail(),
    body("password").isLength({ min: 8 }).withMessage("Mật khẩu tối thiểu 8 ký tự"),
    homeController.postLogin
  );
  router.get("/dashboard", requireLogin, homeController.getDashboardPage);
  router.get("/logout", homeController.logout);

  // About
  router.get("/about", (req, res) => res.send(`I'm about page!`));

  // -------- Admin routes --------
  router.get("/admin", requireLogin, requireAdmin, adminController.getAdminPage);
  router.post("/admin/add", requireLogin, requireAdmin, adminController.apiAddUser);
  router.post("/admin/delete", requireLogin, requireAdmin, adminController.apiDeleteUser);
  router.post("/admin/update", requireLogin, requireAdmin, adminController.apiUpdateUser);

  return app.use("/", router);
};

export default initWebRoute;
