import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import configViewEngine from "./configs/viewEngine.js";
import initWebRoute from "./route/web.js";
import session from "express-session";
import crypto from "crypto"; // để tạo secret ngẫu nhiên
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import MySQLStoreFactory from "express-mysql-session";
import morgan from "morgan";
import logger from "./utils/logger.js";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;
const isProd = process.env.NODE_ENV === "production";

// Trust proxy for secure cookies and HTTPS redirect behind reverse proxies (e.g., Nginx, Heroku)
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY));
}

// ---------- Static files ----------
app.use(express.static(path.join(__dirname, "../public"))); // public ngoài src/
app.use(express.static(path.join(__dirname, "./dist"))); // dist trong src/

// ---------- Logger & body parser ----------
app.use(morgan("combined"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---------- Security Headers (Helmet) ----------
app.use(
  helmet({
    // Enable HSTS in production
    hsts: isProd ? { maxAge: 60 * 60 * 24 * 365, includeSubDomains: true, preload: true } : false,
    xssFilter: true,
  })
);

// Content Security Policy — tune as needed
const allowRecaptcha = (process.env.ENABLE_RECAPTCHA === "true");
const scriptSrcEnv = (process.env.CSP_SCRIPT_SRC || "").split(" ").filter(Boolean);
const styleSrcEnv = (process.env.CSP_STYLE_SRC || "").split(" ").filter(Boolean);
const imgSrcEnv = (process.env.CSP_IMG_SRC || "").split(" ").filter(Boolean);

app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // remove if you inline nothing
        "https://cdn.jsdelivr.net",
        ...(allowRecaptcha ? [
          "https://www.google.com",
          "https://www.gstatic.com",
          "https://www.recaptcha.net",
        ] : []),
        ...scriptSrcEnv,
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", ...styleSrcEnv],
      imgSrc: ["'self'", "data:", ...imgSrcEnv],
      connectSrc: ["'self'"],
      frameSrc: [
        ...(allowRecaptcha ? ["https://www.google.com", "https://www.recaptcha.net"] : []),
      ],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProd ? [] : null,
    },
  })
);

// ---------- Setup session with MySQL store ----------
const MySQLStore = MySQLStoreFactory(session);
const sessionStoreOptions = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "appdb",
  clearExpired: true,
  checkExpirationInterval: 15 * 60 * 1000, // how frequently expired sessions will be cleared; millisec
  expiration: 24 * 60 * 60 * 1000, // session max age in ms
  createDatabaseTable: true,
  connectionLimit: Number(process.env.DB_CONN_LIMIT || 10),
  schema: {
    tableName: "sessions",
    columnNames: {
      session_id: "session_id",
      expires: "expires",
      data: "data",
    },
  },
};

const sessionStore = new MySQLStore(sessionStoreOptions);

app.use(
  session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(64).toString("hex"),
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 30, // 30 phút
      httpOnly: true,
      sameSite: "lax",
      secure: isProd, // require HTTPS in production
    },
    name: "sid",
  })
);

// ---------- Enforce HTTPS in production ----------
if (isProd) {
  app.use((req, res, next) => {
    if (req.secure || req.headers["x-forwarded-proto"] === "https") return next();
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  });
}

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

// Expose reCAPTCHA config to templates
app.locals.ENABLE_RECAPTCHA = process.env.ENABLE_RECAPTCHA === "true";
app.locals.RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY || "";

// ---------- Redirect / to /dashboard ----------
app.get("/", (req, res) => {
  return res.redirect("/dashboard");
});

// ---------- Rate limiter for login route only ----------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts, please try again later.",
});

// Pass limiter to routes via app locals so router can attach it to POST /login
app.locals.loginLimiter = loginLimiter;

// ---------- Init routes ----------
initWebRoute(app);

// ---------- Handle 404 ----------
app.use((req, res) => {
  return res.render("404.ejs");
});

// ---------- Start server ----------
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
