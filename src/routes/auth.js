const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db");
const auth = require("../middleware/auth");
const { sendPasswordResetEmail } = require("../services/emailService");
const r = express.Router();

const normalizeEmail = value => String(value || "").trim().toLowerCase();
const validPassword = value => typeof value === "string" && value.length >= 8;
const hashToken = token => crypto.createHash("sha256").update(token).digest("hex");

r.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !normalizeEmail(email) || !validPassword(password)) {
      return res.status(400).json({ error: "Informe nome, e-mail e uma senha com pelo menos 8 caracteres." });
    }
    const h = await bcrypt.hash(password, 12);
    const c = await db.connect();
    try {
      await c.query("BEGIN");
      const u = (await c.query(
        "INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email",
        [String(name).trim(), normalizeEmail(email), h]
      )).rows[0];
      await c.query("INSERT INTO subscriptions(user_id) VALUES($1)", [u.id]);
      await c.query("COMMIT");
      res.json({ token: jwt.sign(u, process.env.JWT_SECRET, { expiresIn: "7d" }), user: u });
    } catch (x) {
      await c.query("ROLLBACK");
      throw x;
    } finally {
      c.release();
    }
  } catch (x) {
    res.status(400).json({ error: x.code === "23505" ? "E-mail já cadastrado." : "Falha no cadastro." });
  }
});

r.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const u = (await db.query("SELECT * FROM users WHERE email=$1", [normalizeEmail(email)])).rows[0];
  if (!u || !await bcrypt.compare(password || "", u.password_hash)) {
    return res.status(401).json({ error: "E-mail ou senha inválidos." });
  }
  const x = { id: u.id, name: u.name, email: u.email };
  res.json({ token: jwt.sign(x, process.env.JWT_SECRET, { expiresIn: "7d" }), user: x });
});

r.post("/forgot-password", async (req, res) => {
  const generic = { message: "Se este e-mail estiver cadastrado, enviaremos um link para redefinir a senha." };
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.json(generic);

    const user = (await db.query("SELECT id,name,email FROM users WHERE email=$1", [email])).rows[0];
    if (!user) return res.json(generic);

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);

    await db.query("DELETE FROM password_reset_tokens WHERE user_id=$1 OR expires_at < NOW()", [user.id]);
    await db.query(
      "INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 minutes')",
      [user.id, tokenHash]
    );

    try {
      await sendPasswordResetEmail({ to: user.email, name: user.name, token });
    } catch (mailError) {
      console.error(mailError);
      await db.query("DELETE FROM password_reset_tokens WHERE token_hash=$1", [tokenHash]);
    }

    return res.json(generic);
  } catch (error) {
    console.error("forgot-password:", error);
    return res.json(generic);
  }
});

r.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !validPassword(password)) {
      return res.status(400).json({ error: "Informe uma nova senha com pelo menos 8 caracteres." });
    }

    const tokenHash = hashToken(String(token));
    const c = await db.connect();
    try {
      await c.query("BEGIN");
      const row = (await c.query(
        `SELECT prt.id,prt.user_id
           FROM password_reset_tokens prt
          WHERE prt.token_hash=$1 AND prt.used_at IS NULL AND prt.expires_at>NOW()
          FOR UPDATE`,
        [tokenHash]
      )).rows[0];

      if (!row) {
        await c.query("ROLLBACK");
        return res.status(400).json({ error: "Este link é inválido ou expirou. Solicite um novo." });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await c.query("UPDATE users SET password_hash=$1 WHERE id=$2", [passwordHash, row.user_id]);
      await c.query("UPDATE password_reset_tokens SET used_at=NOW() WHERE id=$1", [row.id]);
      await c.query("DELETE FROM password_reset_tokens WHERE user_id=$1 AND id<>$2", [row.user_id, row.id]);
      await c.query("COMMIT");
      return res.json({ message: "Senha redefinida com sucesso. Você já pode entrar." });
    } catch (error) {
      await c.query("ROLLBACK");
      throw error;
    } finally {
      c.release();
    }
  } catch (error) {
    console.error("reset-password:", error);
    return res.status(500).json({ error: "Não foi possível redefinir a senha." });
  }
});

r.post("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!validPassword(newPassword)) {
      return res.status(400).json({ error: "A nova senha deve ter pelo menos 8 caracteres." });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "A nova senha deve ser diferente da senha atual." });
    }

    const user = (await db.query("SELECT id,password_hash FROM users WHERE id=$1", [req.user.id])).rows[0];
    if (!user || !await bcrypt.compare(currentPassword || "", user.password_hash)) {
      return res.status(400).json({ error: "Senha atual incorreta." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [passwordHash, req.user.id]);
    await db.query("DELETE FROM password_reset_tokens WHERE user_id=$1", [req.user.id]);
    return res.json({ message: "Senha alterada com sucesso." });
  } catch (error) {
    console.error("change-password:", error);
    return res.status(500).json({ error: "Não foi possível alterar a senha." });
  }
});

module.exports = r;
