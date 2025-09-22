// hash.js
import bcrypt from "bcrypt";

async function run() {
  const password = "12345678a@";
  const saltRounds = 10;

  const hash = await bcrypt.hash(password, saltRounds);
  console.log("Hashed password:", hash);
}

run();
