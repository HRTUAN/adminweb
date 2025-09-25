import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Create the connection pool using environment variables
// Never hardcode credentials
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  database: process.env.DB_NAME || "appdb",
  password: process.env.DB_PASSWORD || "",
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONN_LIMIT || 10),
  queueLimit: 0,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

export default pool;
