import multer from "multer";
import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";
import pool from "../configs/connectDB.js";

// Thư mục lưu file excel tạm thời
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const excelUploadDir = path.join(__dirname, "../../public/uploads/excel");

if (!fs.existsSync(excelUploadDir)) {
  fs.mkdirSync(excelUploadDir, { recursive: true });
}

// Cấu hình multer chỉ nhận file excel
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, excelUploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const excelFileFilter = (req, file, cb) => {
  const filetypes = /xlsx|xls/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.mimetype === "application/vnd.ms-excel";

  if (extname && mimetype) return cb(null, true);
  cb(new Error("Chỉ chấp nhận file Excel (.xlsx, .xls)"));
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: excelFileFilter,
});

// Đảm bảo bảng orders tồn tại
const ensureTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_code VARCHAR(100) NOT NULL,
      customer VARCHAR(255) NOT NULL,
      product VARCHAR(255) NOT NULL,
      quantity INT NOT NULL DEFAULT 0,
      price DECIMAL(15,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

// GET trang xử lý Excel
const getExcelPage = (req, res) => {
  (async () => {
    try {
      await ensureTable();
      const q = (req.query.q || "").trim();
      let rows = [];
      if (q) {
        const like = `%${q}%`;
        const [r] = await pool.execute(
          "SELECT id, order_code, customer, product, quantity, price FROM orders WHERE order_code LIKE ? OR customer LIKE ? OR product LIKE ? ORDER BY id DESC",
          [like, like, like]
        );
        rows = r;
      } else {
        const [r] = await pool.execute("SELECT id, order_code, customer, product, quantity, price FROM orders ORDER BY id DESC");
        rows = r;
      }
      return res.render("handleExcel.ejs", { user: req.session.user, rows, q });
    } catch (e) {
      console.error("Lỗi getExcelPage:", e);
      const q = (req.query.q || "").trim();
      return res.render("handleExcel.ejs", { user: req.session.user, rows: [], q });
    }
  })();
};

// POST /api/excel/upload - đọc file excel và trả dữ liệu JSON
const uploadExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn file Excel" });
    }

    const filePath = req.file.path;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ success: false, message: "File không có worksheet" });
    }

    // Đọc header đúng cột bằng eachCell (không làm lệch chỉ số)
    const headerRow = worksheet.getRow(1);
    const expectedHeaders = ["Đơn hàng", "Khách hàng", "Sản phẩm", "SL", "Giá"];

    const normalize = (val) => {
      if (val == null) return "";
      if (typeof val === "object") {
        if (val.text) return String(val.text).trim();
        if (Array.isArray(val.richText))
          return val.richText
            .map((r) => r.text)
            .join("")
            .trim();
        if (val.result) return String(val.result).trim();
      }
      return String(val).trim();
    };

    const headerCol = {}; // map: header name (expected) -> colNumber
    headerRow.eachCell((cell, colNumber) => {
      const title = normalize(cell.value).toLowerCase();
      expectedHeaders.forEach((eh) => {
        if (title === eh.toLowerCase()) headerCol[eh] = colNumber;
      });
    });

    const rows = [];
    // Duyệt từ dòng 2 đến dòng cuối để đảm bảo thứ tự
    for (let r = 2; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const record = {
        order_code: normalize(row.getCell(headerCol["Đơn hàng"] || 1).value),
        customer: normalize(row.getCell(headerCol["Khách hàng"] || 2).value),
        product: normalize(row.getCell(headerCol["Sản phẩm"] || 3).value),
        quantity: normalize(row.getCell(headerCol["SL"] || 4).value),
        price: normalize(row.getCell(headerCol["Giá"] || 5).value),
      };

      const isEmpty = Object.values(record).every((v) => String(v).trim() === "");
      if (!isEmpty) rows.push(record);
    }

    // Xoá file tạm sau khi đọc
    fs.unlink(filePath, () => {});

    // Ghi DB: thêm vào các hàng tiếp theo
    await ensureTable();
    let inserted = 0;
    if (rows.length > 0) {
      // Chuyển đổi kiểu dữ liệu
      const values = rows.map((r) => [
        String(r.order_code).trim(),
        String(r.customer).trim(),
        String(r.product).trim(),
        Number(r.quantity) || 0,
        Number(r.price) || 0,
      ]);

      // Insert lần lượt để đơn giản và an toàn
      for (const v of values) {
        await pool.execute("INSERT INTO orders (order_code, customer, product, quantity, price) VALUES (?, ?, ?, ?, ?)", v);
        inserted++;
      }
    }

    return res.json({ success: true, message: "Import thành công", inserted });
  } catch (error) {
    console.error("Lỗi uploadExcel:", error);
    return res.status(500).json({ success: false, message: "Có lỗi xảy ra khi đọc file Excel" });
  }
};

// GET /api/excel/download - tạo file excel mẫu và gửi về client
const downloadExcel = async (req, res) => {
  try {
    await ensureTable();
    const [data] = await pool.execute("SELECT order_code, customer, product, quantity, price FROM orders ORDER BY id ASC");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Orders");

    // Header
    worksheet.addRow(["Đơn hàng", "Khách hàng", "Sản phẩm", "SL", "Giá"]);
    worksheet.getRow(1).font = { bold: true };

    // Data từ DB
    data.forEach((r) => {
      worksheet.addRow([r.order_code, r.customer, r.product, r.quantity, r.price]);
    });

    // Định dạng cột
    worksheet.columns = [
      { key: "order_code", width: 15 },
      { key: "customer", width: 25 },
      { key: "product", width: 25 },
      { key: "quantity", width: 10 },
      { key: "price", width: 15 },
    ];

    // Gửi file cho client
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="export-data-${Date.now()}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Lỗi downloadExcel:", error);
    return res.status(500).json({ success: false, message: "Có lỗi xảy ra khi tạo file Excel" });
  }
};

// Xóa một đơn hàng theo id
export const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: "Thiếu id" });
    await ensureTable();

    const [rows] = await pool.execute("SELECT id FROM orders WHERE id = ?", [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    await pool.execute("DELETE FROM orders WHERE id = ?", [id]);
    return res.json({ success: true, message: "Đã xóa đơn hàng" });
  } catch (e) {
    console.error("Lỗi deleteOrder:", e);
    return res.status(500).json({ success: false, message: "Có lỗi xảy ra khi xóa" });
  }
};

// Xóa nhiều đơn hàng theo danh sách id
export const bulkDeleteOrders = async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "Thiếu danh sách ids" });
    }
    // Lọc các id hợp lệ (số nguyên dương)
    const cleanIds = ids.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0);
    if (cleanIds.length === 0) {
      return res.status(400).json({ success: false, message: "Danh sách ids không hợp lệ" });
    }
    await ensureTable();

    // Xóa theo danh sách
    const placeholders = cleanIds.map(() => "?").join(",");
    const [result] = await pool.execute(`DELETE FROM orders WHERE id IN (${placeholders})`, cleanIds);

    return res.json({ success: true, message: "Đã xóa các đơn hàng", affectedRows: result.affectedRows || 0 });
  } catch (e) {
    console.error("Lỗi bulkDeleteOrders:", e);
    return res.status(500).json({ success: false, message: "Có lỗi xảy ra khi xóa nhiều" });
  }
};

export default {
  upload,
  getExcelPage,
  uploadExcel,
  downloadExcel,
  deleteOrder,
  bulkDeleteOrders,
};
