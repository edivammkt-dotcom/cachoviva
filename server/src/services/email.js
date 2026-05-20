const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (config.smtp?.host && config.smtp?.user) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port || 587,
      secure: config.smtp.secure || false,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
    return transporter;
  }

  return null;
}

function buildDiagnosisEmail({ name, diagnosis }) {
  const calendarRows = (diagnosis.calendar || [])
    .map(d => `<tr><td style="padding:8px 12px;background:#F5EFE1;border-radius:8px;text-align:center;border:1px solid #E8DCC4"><div style="font-size:1.3rem;margin-bottom:4px">${d.icon}</div><div style="font-size:0.7rem;font-weight:700;color:#A09890;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">${d.day}</div><div style="font-size:0.82rem;font-weight:600;color:#3D2324">${d.treatment}</div></td></tr>`).join('');

  const tipsList = (diagnosis.tips || [])
    .map(t => `<li style="padding:6px 0;color:#7A746E;font-size:0.88rem;line-height:1.5">${t}</li>`).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F9F4EA;font-family:Inter,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
      <tr><td style="background:linear-gradient(135deg,#3D2324,#2A1A1B);padding:32px;text-align:center">
        <h1 style="font-family:'Playfair Display',Georgia,serif;color:#E8DCC4;font-size:1.5rem;margin:0 0 4px;font-weight:400">Diagnóstico Capilar</h1>
        <p style="color:#C5A55A;font-size:0.85rem;font-weight:600;margin:0;letter-spacing:0.1em">CACHOVIVA</p>
      </td></tr>
      <tr><td style="padding:32px">
        <p style="color:#3D2324;font-size:1rem;margin:0 0 4px">Olá, <strong>${name}</strong>!</p>
        <p style="color:#7A746E;font-size:0.88rem;margin:0 0 24px;line-height:1.6">Seu diagnóstico capilar personalizado está pronto. Confira abaixo:</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F4EA;border-radius:12px;padding:24px;margin-bottom:20px">
          <tr><td align="center" style="font-size:2.8rem;padding-bottom:8px">${diagnosis.icon}</td></tr>
          <tr><td align="center"><h2 style="font-family:'Playfair Display',Georgia,serif;color:#3D2324;font-size:1.3rem;margin:0 0 4px;font-weight:600">${diagnosis.name}</h2></td></tr>
          <tr><td align="center"><p style="color:#7A746E;font-size:0.9rem;margin:0;line-height:1.6">${diagnosis.desc}</p></td></tr>
        </table>

        <h3 style="font-family:'Playfair Display',Georgia,serif;color:#3D2324;font-size:1rem;margin:0 0 8px">📋 O que isso significa?</h3>
        <p style="color:#7A746E;font-size:0.88rem;line-height:1.7;margin:0 0 24px">${diagnosis.meaning}</p>

        <h3 style="font-family:'Playfair Display',Georgia,serif;color:#3D2324;font-size:1rem;margin:0 0 8px">📅 Calendário capilar recomendado</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
          ${calendarRows}
        </table>

        <h3 style="font-family:'Playfair Display',Georgia,serif;color:#3D2324;font-size:1rem;margin:0 0 8px">💡 Dicas rápidas</h3>
        <ul style="padding-left:0;list-style:none;margin:0 0 24px">${tipsList}</ul>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#2A1A1B,#3D2324);border-radius:12px;padding:24px;margin-bottom:4px">
          <tr><td align="center" style="font-size:2rem;padding-bottom:8px">🔥</td></tr>
          <tr><td align="center"><h3 style="font-family:'Playfair Display',Georgia,serif;color:#E8DCC4;font-size:1.1rem;margin:0 0 8px;font-weight:600">Algo especial está chegando</h3></td></tr>
          <tr><td align="center"><p style="color:rgba(232,220,196,0.7);font-size:0.85rem;margin:0;line-height:1.6">Em <strong style="color:#E4D49B">30 dias</strong>, vamos apresentar algo que vai transformar seus cachos. Fique de olho no WhatsApp — enviaremos conteúdos exclusivos para preparar você.</p></td></tr>
        </table>
      </td></tr>
      <tr><td style="background:#F5F3F0;padding:20px 32px;text-align:center">
        <p style="color:#A09890;font-size:0.72rem;margin:0;line-height:1.5">© 2026 Maynard Distribuidora e Atacadista de Cosméticos e Perfumaria Ltda.<br>CNPJ: 66.781.714/0001-92</p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
}

async function sendDiagnosisEmail({ to, name, diagnosis }) {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[Email] Modo dev — diagnóstico para ${to}:\n  Nome: ${name}\n  Diagnóstico: ${diagnosis.name}`);
    return { sent: false, dev: true };
  }

  try {
    const html = buildDiagnosisEmail({ name, diagnosis });
    await transport.sendMail({
      from: config.smtp.from || `"CachoViva" <${config.smtp.user}>`,
      to,
      subject: `Seu Diagnóstico Capilar CachoViva está pronto!`,
      html,
    });
    console.log(`[Email] Diagnóstico enviado para ${to}`);
    return { sent: true };
  } catch (err) {
    console.error(`[Email] Erro ao enviar para ${to}:`, err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendDiagnosisEmail };
