require("dotenv").config();

const crypto = require("node:crypto");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const express = require("express");
const session = require("express-session");
const MySQLStoreFactory = require("express-mysql-session");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");

const app = express();
const port = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === "production";

for (const name of ["SESSION_SECRET", "DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"]) {
  if (!process.env[name]) throw new Error(`A variável ${name} é obrigatória.`);
}
if (process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET deve conter pelo menos 32 caracteres.");
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT deve ser uma porta válida.");
}
if (production && !process.env.APP_ORIGIN) {
  throw new Error("APP_ORIGIN é obrigatório em produção.");
}
if (production) {
  let appOrigin;
  try {
    appOrigin = new URL(process.env.APP_ORIGIN);
  } catch (error) {
    throw new Error("APP_ORIGIN deve ser uma origem HTTPS válida.");
  }
  if (appOrigin.protocol !== "https:" || appOrigin.username || appOrigin.password
    || appOrigin.pathname !== "/" || appOrigin.search || appOrigin.hash) {
    throw new Error("APP_ORIGIN deve conter apenas a origem HTTPS pública, sem caminhos ou credenciais.");
  }
}
if (process.env.SMTP_HOST) {
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  if (!process.env.SMTP_FROM || !Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535
    || Boolean(process.env.SMTP_USER) !== Boolean(process.env.SMTP_PASSWORD)) {
    throw new Error("Configure SMTP_FROM, uma porta SMTP válida e, quando aplicável, SMTP_USER e SMTP_PASSWORD.");
  }
}

if (production) app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", "data:", "https://cdn-icons-png.flaticon.com"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      upgradeInsecureRequests: production ? [] : null
    }
  }
}));
app.use(express.json({ limit: "16kb", strict: true }));
app.use((req, res, next) => {
  if (!req.body) req.body = {};
  return next();
});
app.use("/api", (req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method) && !req.is("application/json")) {
    return res.status(415).json({ error: "Envie os dados no formato JSON." });
  }
  return next();
});

const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: "Z",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};
const pool = mysql.createPool(dbConfig);
const MySQLStore = MySQLStoreFactory(session);
const dummyPasswordHash = bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 12);
const sessionStore = new MySQLStore({
  createDatabaseTable: true,
  clearExpired: true,
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 8 * 60 * 60 * 1000
}, pool);

app.use(session({
  name: "schoolfix.sid",
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: production,
    sameSite: "strict",
    maxAge: 8 * 60 * 60 * 1000
  }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }
});

function sameOrigin(req, res, next) {
  const origin = req.get("origin");
  if (!origin) return next();

  const expectedOrigin = process.env.APP_ORIGIN || `${req.protocol}://${req.get("host")}`;
  try {
    if (new URL(origin).origin === new URL(expectedOrigin).origin) return next();
  } catch (error) {
    console.error("APP_ORIGIN inválido:", error.message);
  }
  return res.status(403).json({ error: "Origem da solicitação não autorizada." });
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Sua sessão expirou. Entre novamente." });
  pool.execute(
    "SELECT id, user_type FROM users WHERE id = ? AND account_status = 'ativo' LIMIT 1",
    [req.session.userId]
  ).then(([users]) => {
    if (!users[0]) {
      req.session.destroy((error) => {
        if (error) console.error("Não foi possível encerrar a sessão de uma conta indisponível:", error);
      });
      return res.status(401).json({ error: "Esta conta não está disponível. Entre novamente." });
    }
    req.session.userType = users[0].user_type;
    req.authUser = users[0];
    return next();
  }).catch(next);
}

function requireAdministrator(req, res, next) {
  if (req.authUser?.user_type === "administrador") return next();
  return res.status(403).json({ error: "Apenas administradores podem cadastrar usuários." });
}

function requireStaff(req, res, next) {
  if (["professor", "administrador"].includes(req.authUser?.user_type)) return next();
  return res.status(403).json({ error: "Esta ação é permitida apenas a professores e administradores." });
}

function normalizeRa(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function validRa(value) {
  return /^[A-Z0-9._-]{3,30}$/.test(value);
}

function validEmail(value) {
  return typeof value === "string"
    && value.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPassword(value) {
  return typeof value === "string" && value.length >= 10 && Buffer.byteLength(value, "utf8") <= 72;
}

function publicUser(user) {
  return {
    id: user.id,
    ra: user.ra,
    fullName: user.full_name,
    institutionalEmail: user.institutional_email,
    course: user.course,
    userType: user.user_type,
    accountStatus: user.account_status,
    createdAt: user.created_at
  };
}

function regenerateSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.userId = user.id;
      req.session.userType = user.user_type;
      req.session.save((saveError) => saveError ? reject(saveError) : resolve());
    });
  });
}

function invalidateUserSessions(executor, userId, exceptSessionId) {
  if (exceptSessionId) {
    return executor.execute(
      "DELETE FROM sessions WHERE session_id <> ? AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.userId')) = ?",
      [exceptSessionId, String(userId)]
    );
  }
  return executor.execute(
    "DELETE FROM sessions WHERE JSON_UNQUOTE(JSON_EXTRACT(data, '$.userId')) = ?",
    [String(userId)]
  );
}

app.use("/api", sameOrigin);
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  return next();
});

app.post("/api/auth/login", authLimiter, async (req, res, next) => {
  try {
    const ra = normalizeRa(req.body.ra);
    const password = req.body.password;
    if (!validRa(ra) || typeof password !== "string" || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ error: "Informe um RA e uma senha válidos." });
    }

    const [users] = await pool.execute(
      "SELECT id, ra, full_name, institutional_email, course, password_hash, user_type, account_status, created_at FROM users WHERE ra = ? LIMIT 1",
      [ra]
    );
    const user = users[0];
    const passwordMatches = await bcrypt.compare(password, user?.password_hash || dummyPasswordHash);
    if (!user || user.account_status !== "ativo" || !passwordMatches) {
      return res.status(401).json({ error: "RA ou senha inválidos. Confira os dados e tente novamente." });
    }

    await regenerateSession(req, user);
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/auth/logout", requireAuth, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("schoolfix.sid", {
      httpOnly: true,
      secure: production,
      sameSite: "strict"
    });
    return res.status(204).end();
  });
});

app.post("/api/auth/change-password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== "string" || Buffer.byteLength(currentPassword, "utf8") > 72 || !validPassword(newPassword)) {
      return res.status(400).json({ error: "Informe sua senha atual e uma nova senha com pelo menos 10 caracteres." });
    }
    const [users] = await pool.execute(
      "SELECT id, password_hash FROM users WHERE id = ? AND account_status = 'ativo' LIMIT 1",
      [req.session.userId]
    );
    if (!users[0] || !await bcrypt.compare(currentPassword, users[0].password_hash)) {
      return res.status(401).json({ error: "A senha atual está incorreta." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, users[0].id]);
      await invalidateUserSessions(connection, users[0].id, req.sessionID);
      await connection.commit();
      return res.json({ message: "Senha atualizada com sucesso." });
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Não foi possível desfazer a alteração de senha:", rollbackError);
      }
      return next(error);
    } finally {
      connection.release();
    }
  } catch (error) {
    return next(error);
  }
});

app.get("/api/auth/me", requireAuth, async (req, res, next) => {
  try {
    const [users] = await pool.execute(
      "SELECT id, ra, full_name, institutional_email, course, user_type, account_status, created_at FROM users WHERE id = ? LIMIT 1",
      [req.session.userId]
    );
    const user = users[0];
    if (!user || user.account_status !== "ativo") {
      req.session.destroy((error) => {
        if (error) console.error("Não foi possível encerrar a sessão de uma conta indisponível:", error);
      });
      return res.status(401).json({ error: "Esta conta não está disponível. Entre novamente." });
    }
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/admin/users", requireAuth, requireAdministrator, async (req, res, next) => {
  try {
    const { fullName, institutionalEmail, course, password, userType } = req.body;
    const ra = normalizeRa(req.body.ra);
    const allowedTypes = ["aluno", "professor", "administrador"];
    if (!validRa(ra)
      || typeof fullName !== "string" || fullName.trim().length < 3 || fullName.trim().length > 160
      || !validEmail(institutionalEmail)
      || typeof course !== "string" || course.trim().length < 2 || course.trim().length > 120
      || !validPassword(password)
      || !allowedTypes.includes(userType)) {
      return res.status(400).json({ error: "Confira os dados. A senha deve ter entre 10 e 72 caracteres." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      "INSERT INTO users (ra, full_name, institutional_email, course, password_hash, user_type) VALUES (?, ?, ?, ?, ?, ?)",
      [ra, fullName.trim(), institutionalEmail.trim().toLowerCase(), course.trim(), passwordHash, userType]
    );
    const [users] = await pool.execute(
      "SELECT id, ra, full_name, institutional_email, course, user_type, account_status, created_at FROM users WHERE id = ?",
      [result.insertId]
    );
    return res.status(201).json({ user: publicUser(users[0]) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Já existe uma conta com esse RA ou e-mail institucional." });
    }
    return next(error);
  }
});

app.post("/api/auth/forgot-password", authLimiter, async (req, res, next) => {
  try {
    const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_FROM;
    if (!smtpConfigured) {
      return res.status(503).json({ error: "A recuperação por e-mail ainda não está configurada. Procure o administrador da plataforma." });
    }

    const ra = normalizeRa(req.body.ra);
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!validRa(ra) || !validEmail(email)) {
      return res.status(400).json({ error: "Informe seu RA e e-mail institucional válidos." });
    }

    const [users] = await pool.execute(
      "SELECT id, institutional_email FROM users WHERE ra = ? AND institutional_email = ? AND account_status = 'ativo' LIMIT 1",
      [ra, email]
    );
    if (users[0]) {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      await pool.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [users[0].id]);
      await pool.execute(
        "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE))",
        [users[0].id, tokenHash]
      );

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 30000,
        auth: process.env.SMTP_USER ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        } : undefined
      });
      const origin = process.env.APP_ORIGIN || `${req.protocol}://${req.get("host")}`;
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: email,
          subject: "Redefinição de senha — SchoolFix",
          text: `Use este link para redefinir sua senha em até 30 minutos: ${origin}/?reset=${token}\nSe você não solicitou a redefinição, ignore esta mensagem.`
        });
      } catch (error) {
        await pool.execute("DELETE FROM password_reset_tokens WHERE token_hash = ?", [tokenHash]);
        return next(error);
      }
    }
    return res.json({ message: "Se os dados corresponderem a uma conta ativa, enviaremos as instruções para o e-mail institucional." });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/auth/reset-password", authLimiter, async (req, res, next) => {
  const { token, password } = req.body;
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) || !validPassword(password)) {
    return res.status(400).json({ error: "O link é inválido ou expirou. Solicite uma nova redefinição." });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [tokens] = await connection.execute(
      "SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP() FOR UPDATE",
      [tokenHash]
    );
    if (!tokens[0]) {
      await connection.rollback();
      return res.status(400).json({ error: "O link é inválido ou expirou. Solicite uma nova redefinição." });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await connection.execute("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, tokens[0].user_id]);
    await connection.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [tokens[0].user_id]);
    await invalidateUserSessions(connection, tokens[0].user_id);
    await connection.commit();
    return res.json({ message: "Senha redefinida. Entre com sua nova senha." });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Não foi possível desfazer a redefinição de senha:", rollbackError);
      }
    }
    return next(error);
  } finally {
    if (connection) connection.release();
  }
});

const complaintCategories = ["Infraestrutura", "Pedagógico", "Convivência", "Alimentação"];
const complaintStatuses = ["Pendente", "Em Análise", "Resolvido", "Arquivada"];
const complaintDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo"
});

function mapComplaint(row, responses = [], rating = null) {
  const initials = row.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return {
    id: String(row.id),
    userId: row.user_id,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    author: row.full_name,
    initials,
    date: complaintDateFormatter.format(new Date(row.created_at)),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    responses,
    rating
  };
}

app.get("/api/complaints", requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      "SELECT c.id, c.user_id, c.title, c.description, c.category, c.status, c.created_at, c.updated_at, u.full_name FROM complaints c JOIN users u ON u.id = c.user_id WHERE (? IN ('professor', 'administrador') OR c.user_id = ?) ORDER BY c.created_at DESC",
      [req.session.userType, req.session.userId]
    );
    if (!rows.length) return res.json({ complaints: [] });
    const ids = rows.map((row) => row.id);
    const placeholders = ids.map(() => "?").join(", ");
    const [responses] = await pool.execute(
      `SELECT r.complaint_id, r.message, r.created_at, u.full_name FROM complaint_responses r JOIN users u ON u.id = r.user_id WHERE r.complaint_id IN (${placeholders}) ORDER BY r.created_at ASC`,
      ids
    );
    const responsesByComplaint = new Map();
    responses.forEach((response) => {
      const complaintResponses = responsesByComplaint.get(response.complaint_id) || [];
      complaintResponses.push({
        author: response.full_name,
        date: complaintDateFormatter.format(new Date(response.created_at)),
        text: response.message
      });
      responsesByComplaint.set(response.complaint_id, complaintResponses);
    });
    const ratingsByComplaint = new Map();
    if (req.session.userType === "aluno") {
      const [ratings] = await pool.execute(
        `SELECT complaint_id, rating, comment, created_at FROM complaint_ratings WHERE user_id = ? AND complaint_id IN (${placeholders})`,
        [req.session.userId, ...ids]
      );
      ratings.forEach((rating) => {
        ratingsByComplaint.set(rating.complaint_id, {
          value: rating.rating,
          comment: rating.comment,
          createdAt: new Date(rating.created_at).toISOString()
        });
      });
    }
    return res.json({
      complaints: rows.map((row) => mapComplaint(
        row,
        responsesByComplaint.get(row.id) || [],
        ratingsByComplaint.get(row.id) || null
      ))
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/complaints", requireAuth, async (req, res, next) => {
  try {
    const { title, description, category } = req.body;
    if (typeof title !== "string" || title.trim().length < 5 || title.trim().length > 160
      || typeof description !== "string" || description.trim().length < 10 || description.trim().length > 5000
      || !complaintCategories.includes(category)) {
      return res.status(400).json({ error: "Informe um título, uma descrição e uma categoria válidos." });
    }
    const [result] = await pool.execute(
      "INSERT INTO complaints (user_id, title, description, category) VALUES (?, ?, ?, ?)",
      [req.session.userId, title.trim(), description.trim(), category]
    );
    const [rows] = await pool.execute(
      "SELECT c.id, c.user_id, c.title, c.description, c.category, c.status, c.created_at, c.updated_at, u.full_name FROM complaints c JOIN users u ON u.id = c.user_id WHERE c.id = ?",
      [result.insertId]
    );
    return res.status(201).json({ complaint: mapComplaint(rows[0]) });
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/complaints/:id/status", requireAuth, requireStaff, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!Number.isSafeInteger(id) || id < 1 || !complaintStatuses.includes(status)) {
      return res.status(400).json({ error: "O protocolo ou o status informado é inválido." });
    }
    const [result] = await pool.execute("UPDATE complaints SET status = ? WHERE id = ?", [status, id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Reclamação não encontrada." });
    return res.json({ message: "Status atualizado com sucesso." });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/complaints/:id/responses", requireAuth, requireStaff, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { message } = req.body;
    if (!Number.isSafeInteger(id) || id < 1
      || typeof message !== "string" || message.trim().length < 2 || message.trim().length > 5000) {
      return res.status(400).json({ error: "Informe uma resposta válida." });
    }
    const [complaints] = await pool.execute("SELECT id FROM complaints WHERE id = ? LIMIT 1", [id]);
    if (!complaints[0]) return res.status(404).json({ error: "Reclamação não encontrada." });
    await pool.execute(
      "INSERT INTO complaint_responses (complaint_id, user_id, message) VALUES (?, ?, ?)",
      [id, req.session.userId, message.trim()]
    );
    return res.status(201).json({ message: "Resposta registrada com sucesso." });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/complaints/:id/rating", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rating, comment = "" } = req.body;
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isInteger(rating) || rating < 1 || rating > 5
      || typeof comment !== "string" || comment.trim().length > 1000) {
      return res.status(400).json({ error: "Informe uma avaliação de 1 a 5 e um comentário de até 1000 caracteres." });
    }
    const [complaints] = await pool.execute(
      "SELECT id, status FROM complaints WHERE id = ? AND user_id = ? LIMIT 1",
      [id, req.session.userId]
    );
    if (!complaints[0]) return res.status(404).json({ error: "Reclamação não encontrada." });
    if (complaints[0].status !== "Resolvido") {
      return res.status(409).json({ error: "Você poderá avaliar a reclamação depois que ela for resolvida." });
    }
    await pool.execute(
      "INSERT INTO complaint_ratings (complaint_id, user_id, rating, comment) VALUES (?, ?, ?, ?)",
      [id, req.session.userId, rating, comment.trim() || null]
    );
    return res.status(201).json({ message: "Avaliação registrada com sucesso." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Você já avaliou esta reclamação." });
    }
    return next(error);
  }
});

app.get("/api/suggestions", requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      "SELECT s.id, s.user_id, s.title, s.description, s.status, s.created_at, u.full_name FROM suggestions s JOIN users u ON u.id = s.user_id WHERE (? IN ('professor', 'administrador') OR s.user_id = ?) ORDER BY s.created_at DESC",
      [req.session.userType, req.session.userId]
    );
    return res.json({
      suggestions: rows.map((row) => ({
        id: String(row.id),
        userId: row.user_id,
        title: row.title,
        description: row.description,
        status: row.status,
        author: row.full_name,
        date: complaintDateFormatter.format(new Date(row.created_at))
      }))
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/suggestions", requireAuth, async (req, res, next) => {
  try {
    const { title, description } = req.body;
    if (typeof title !== "string" || title.trim().length < 5 || title.trim().length > 120
      || typeof description !== "string" || description.trim().length < 10 || description.trim().length > 3000) {
      return res.status(400).json({ error: "Informe um título e uma descrição válidos para sua sugestão." });
    }
    await pool.execute(
      "INSERT INTO suggestions (user_id, title, description) VALUES (?, ?, ?)",
      [req.session.userId, title.trim(), description.trim()]
    );
    return res.status(201).json({ message: "Sugestão registrada com sucesso." });
  } catch (error) {
    return next(error);
  }
});

const chatChannels = ["Geral", "Professores", "Gestão"];
const chatTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo"
});

function canAccessChannel(channel, userType) {
  return channel === "Geral" || ["professor", "administrador"].includes(userType);
}

app.get("/api/chat/messages", requireAuth, async (req, res, next) => {
  try {
    const channel = req.query.channel;
    if (!chatChannels.includes(channel) || !canAccessChannel(channel, req.authUser.user_type)) {
      return res.status(403).json({ error: "Este canal não está disponível para sua conta." });
    }
    const [rows] = await pool.execute(
      "SELECT m.id, m.user_id, m.message, m.created_at, u.full_name FROM chat_messages m JOIN users u ON u.id = m.user_id WHERE m.channel = ? ORDER BY m.created_at DESC LIMIT 100",
      [channel]
    );
    return res.json({
      messages: rows.reverse().map((row) => ({
        id: String(row.id),
        userId: row.user_id,
        author: row.full_name,
        message: row.message,
        text: row.message,
        time: chatTimeFormatter.format(new Date(row.created_at)),
        createdAt: new Date(row.created_at).toISOString()
      }))
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/chat/messages", requireAuth, async (req, res, next) => {
  try {
    const { channel, message } = req.body;
    if (!chatChannels.includes(channel) || !canAccessChannel(channel, req.authUser.user_type)) {
      return res.status(403).json({ error: "Este canal não está disponível para sua conta." });
    }
    if (typeof message !== "string" || message.trim().length < 1 || message.trim().length > 2000) {
      return res.status(400).json({ error: "A mensagem deve ter entre 1 e 2000 caracteres." });
    }
    await pool.execute(
      "INSERT INTO chat_messages (user_id, channel, message) VALUES (?, ?, ?)",
      [req.session.userId, channel, message.trim()]
    );
    return res.status(201).json({ message: "Mensagem enviada." });
  } catch (error) {
    return next(error);
  }
});

const loginPage = path.join(__dirname, "login.html");
const dashboardPage = path.join(__dirname, "index.html");
async function serveDashboard(req, res, next) {
  res.set("Cache-Control", "no-store, private");
  if (!req.session.userId) return res.redirect("/");
  try {
    const [users] = await pool.execute(
      "SELECT id FROM users WHERE id = ? AND account_status = 'ativo' LIMIT 1",
      [req.session.userId]
    );
    if (!users[0]) {
      req.session.destroy((error) => {
        if (error) console.error("Não foi possível encerrar a sessão de uma conta indisponível:", error);
      });
      return res.redirect("/");
    }
    return res.sendFile(dashboardPage);
  } catch (error) {
    return next(error);
  }
}
app.get("/", (req, res) => {
  if (req.session.userId) return res.redirect("/painel");
  return res.sendFile(loginPage);
});
app.get("/login", (req, res) => {
  if (req.session.userId) return res.redirect("/painel");
  return res.sendFile(loginPage);
});
app.get("/painel", serveDashboard);
app.get("/index.html", serveDashboard);
app.get("/style.css", (req, res) => res.sendFile(path.join(__dirname, "style.css")));
app.get("/script.js", (req, res) => res.sendFile(path.join(__dirname, "script.js")));
app.get("/login.js", (req, res) => res.sendFile(path.join(__dirname, "login.js")));

app.use((req, res) => res.status(404).json({ error: "Página não encontrada." }));
app.use((error, req, res, next) => {
  console.error("Erro na aplicação:", error);
  if (res.headersSent) return next(error);
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "O corpo da solicitação contém JSON inválido." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "A solicitação excede o tamanho permitido." });
  }
  return res.status(500).json({ error: "Não foi possível concluir a solicitação. Tente novamente." });
});

async function start() {
  await pool.query("SELECT 1");
  await pool.query("SELECT id FROM users LIMIT 0");
  await pool.query("SELECT id FROM password_reset_tokens LIMIT 0");
  await pool.query("SELECT id FROM complaints LIMIT 0");
  await pool.query("SELECT id FROM complaint_responses LIMIT 0");
  await pool.query("SELECT id FROM chat_messages LIMIT 0");
  await pool.query("SELECT id FROM suggestions LIMIT 0");
  await pool.query("SELECT id FROM complaint_ratings LIMIT 0");
  await sessionStore.onReady();
  app.listen(port, () => {
    console.log(`SchoolFix disponível em ${process.env.APP_ORIGIN || `http://localhost:${port}`}`);
  });
}

start().catch(async (error) => {
  console.error("Não foi possível iniciar o SchoolFix:", error);
  await sessionStore.close().catch((closeError) => console.error("Erro ao fechar sessões:", closeError));
  await pool.end();
  process.exitCode = 1;
});

async function shutdown() {
  try {
    await sessionStore.close();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Erro ao encerrar o SchoolFix:", error);
    process.exit(1);
  }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
