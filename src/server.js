import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import configViewEngine from "./configs/viewEngine.js";
import initWebRoute from "./route/web.js";
import session from "express-session";
import crypto from "crypto"; // để tạo secret ngẫu nhiên
import dotenv from "dotenv";
dotenv.config();

import morgan from "morgan";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// ---------- Static files ----------
app.use(express.static(path.join(__dirname, "../public"))); // public ngoài src/
app.use(express.static(path.join(__dirname, "./dist"))); // dist trong src/

// ---------- Logger & body parser ----------
app.use(morgan("combined"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---------- Setup session ----------
app.use(
  session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(64).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 30 }, // 30 phút
  })
);

// ---------- Middleware kiểm tra login ----------
function requireLogin(req, res, next) {
  const publicPaths = ["/login", "/register", "/forgot-password"];
  if (publicPaths.includes(req.path)) return next();
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  return res.redirect("/login");
}

// ---------- Setup view engine ----------
configViewEngine(app);

// ---------- Redirect / to /dashboard ----------
app.get("/", (req, res) => {
  return res.redirect("/dashboard");
});

// ---------- Init routes ----------
initWebRoute(app);

// ---------- Handle 404 ----------
app.use((req, res) => {
  return res.render("404.ejs");
});

// ---------- Start server ----------
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
