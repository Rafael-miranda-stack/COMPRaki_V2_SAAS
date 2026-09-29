const DEFAULT_APP_URL = "http://localhost:3000";

async function sendPasswordResetEmail({ to, name, token }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const appUrl = (process.env.APP_URL || DEFAULT_APP_URL).replace(/\/$/, "");

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV] Link de recuperação para ${to}: ${appUrl}/?reset_token=${encodeURIComponent(token)}`);
      return { dev: true };
    }
    throw new Error("Serviço de e-mail não configurado.");
  }

  const resetUrl = `${appUrl}/?reset_token=${encodeURIComponent(token)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Redefina sua senha do CompraKi",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#152033">
          <h2 style="margin-bottom:8px">CompraKi</h2>
          <p>Olá${name ? `, ${String(name).replace(/[<>]/g, "")}` : ""}.</p>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
          <p style="margin:28px 0"><a href="${resetUrl}" style="background:#ff765d;color:white;text-decoration:none;padding:13px 20px;border-radius:10px;display:inline-block">Criar nova senha</a></p>
          <p>Este link expira em 30 minutos e só pode ser usado uma vez.</p>
          <p style="font-size:13px;color:#687386">Se você não solicitou a alteração, ignore este e-mail. Sua senha atual continuará válida.</p>
        </div>`
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Falha no envio do e-mail de recuperação:", response.status, detail);
    throw new Error("Falha ao enviar e-mail de recuperação.");
  }

  return response.json().catch(() => ({ ok: true }));
}

module.exports = { sendPasswordResetEmail };
