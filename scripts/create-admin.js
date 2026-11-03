require("dotenv").config();

const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

const rl = readline.createInterface({ input: stdin, output: stdout });

async function main() {
  const ra = (await rl.question("RA do administrador: ")).trim().toUpperCase();
  const fullName = (await rl.question("Nome completo: ")).trim();
  const institutionalEmail = (await rl.question("E-mail institucional: ")).trim().toLowerCase();
  const course = (await rl.question("Curso/área: ")).trim();
  const password = await rl.question("Senha (mínimo 10 caracteres): ");

  if (!/^[A-Z0-9._-]{3,30}$/.test(ra)
    || fullName.length < 3 || fullName.length > 160
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(institutionalEmail)
    || course.length < 2 || course.length > 120
    || password.length < 10 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Dados inválidos. Confira os campos e a política de senha.");
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 2
  });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.execute(
      "INSERT INTO users (ra, full_name, institutional_email, course, password_hash, user_type) VALUES (?, ?, ?, ?, ?, 'administrador')",
      [ra, fullName, institutionalEmail, course, passwordHash]
    );
    console.log(`Administrador ${ra} cadastrado com sucesso.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Não foi possível cadastrar o administrador:", error.code === "ER_DUP_ENTRY"
    ? "Já existe uma conta com esse RA ou e-mail."
    : error.message);
  process.exitCode = 1;
}).finally(() => rl.close());
