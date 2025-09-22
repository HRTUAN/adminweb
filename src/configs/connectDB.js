import mysql from "mysql2/promise";

// // create the connection to database

console.log("Creating connection pool...");

const pool = mysql.createPool({
  host: "sql12.freesqldatabase.com",
  user: "sql12799517",
  database: "sql12799517",
  password: "YZvZzyYid9",
  port: "3306",
});

export default pool;
