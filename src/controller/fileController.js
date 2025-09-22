import multer from "multer";
import path from "path";
import fs from "fs";
import pool from "../configs/connectDB.js";

// lưu ý nếu db chưa có dữ liệu, rất có khả năng lỗi TypeError: pool.execute is not a function
// Lấy thư mục gốc của project (dùng __dirname luôn)
import { fileURLToPath } from "url";
import { dirname } from "path";

// Tạo __filename và __dirname trong ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uploadDir = path.join(__dirname, "../../public/uploads");

// Tạo thư mục upload nếu chưa tồn tại
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

// Kiểm tra loại file
const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Chỉ chấp nhận file ảnh và tài liệu (jpg, jpeg, png, gif, pdf, doc, docx)"));
  }
};

// Khởi tạo multer
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Giới hạn 10MB
  fileFilter: fileFilter,
});

// Xử lý upload file
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn file để tải lên" });
    }

    const { originalname, filename, mimetype, size, path: filePath } = req.file;
    const userId = req.session.user?.id || null;

    // Lưu thông tin file vào database
    const [result] = await pool.execute("INSERT INTO files (original_name, stored_name, mime_type, size, path, user_id) VALUES (?, ?, ?, ?, ?, ?)", [
      originalname,
      filename,
      mimetype,
      size,
      filePath,
      userId,
    ]);

    return res.json({
      success: true,
      message: "Tải file lên thành công",
      file: {
        id: result.insertId,
        originalName: originalname,
        fileName: filename,
        mimeType: mimetype,
        size,
        path: filePath,
        userId,
      },
    });
  } catch (error) {
    console.error("Lỗi khi tải file lên:", error);
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(500).json({ success: false, message: "Đã xảy ra lỗi khi tải file lên" });
  }
};

// Lấy danh sách file
const getFiles = async (req, res) => {
  try {
    const [files] = await pool.execute(
      `SELECT f.*, u.email as uploader_email 
       FROM files f 
       LEFT JOIN users u ON f.user_id = u.id 
       ORDER BY f.created_at DESC`
    );

    return res.json({ success: true, files });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách file:", error);
    return res.status(500).json({ success: false, message: "Đã xảy ra lỗi khi lấy danh sách file" });
  }
};

// Xóa file
const deleteFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.session.user?.id;

    // Lấy thông tin file từ DB
    const [files] = await pool.execute("SELECT * FROM files WHERE id = ?", [fileId]);
    if (files.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy file" });
    }

    const file = files[0];

    // Kiểm tra quyền
    if (file.user_id !== userId && req.session.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Bạn không có quyền xóa file này" });
    }

    // Xóa file trên server, nếu file không tồn tại vẫn tiếp tục
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        console.log("Đã xóa file:", file.path);
      } else {
        console.log("File không tồn tại trên server, vẫn xóa DB:", file.path);
      }
    } catch (err) {
      console.error("Lỗi khi xóa file trên server:", err);
      // Không return, vẫn xóa DB
    }

    // Xóa record trong DB
    await pool.execute("DELETE FROM files WHERE id = ?", [fileId]);

    return res.json({ success: true, message: "Đã xóa file thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa file:", error);
    return res.status(500).json({ success: false, message: "Đã xảy ra lỗi khi xóa file" });
  }
};

// Lấy trang upload
const getUploadPage = (req, res) => {
  return res.render("upload.ejs", { user: req.session.user });
};

export default {
  upload,
  uploadFile,
  getFiles,
  deleteFile,
  getUploadPage,
};
