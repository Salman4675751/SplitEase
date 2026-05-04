/**
 * Email sender — supports SMTP via nodemailer.
 *
 * If SMTP_HOST is not configured, emails are logged to the console (dev mode)
 * so you can see what would have been sent without needing a real mail server.
 */

const nodemailer = require('nodemailer');

let transporter = null;
let usingSMTP = false;

function init() {
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    });
    usingSMTP = true;
    console.log(`📧 Mailer: using SMTP ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}`);
  } else {
    console.log('📧 Mailer: SMTP not configured — emails will be logged to console');
  }
}
init();

const FROM = process.env.MAIL_FROM || '"SplitEase" <no-reply@splitease.app>';
const APP_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const baseStyle = `
  font-family: 'Montserrat', system-ui, sans-serif;
  max-width: 560px; margin: 0 auto; padding: 32px 24px;
  background: #ffffff; color: #1f2937; line-height: 1.55;
`;

function wrap(content, ctaUrl, ctaLabel) {
  return `<!DOCTYPE html><html><body style="background:#f8fafc;padding:24px 0;margin:0">
    <div style="${baseStyle}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
        <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#26d0ad,#00876b);display:inline-block"></div>
        <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em">
          <span style="color:#111827">Split</span><span style="color:#00b894">Ease</span>
        </span>
      </div>
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:28px">
        ${content}
        ${ctaUrl ? `<div style="margin-top:24px"><a href="${ctaUrl}" style="display:inline-block;padding:12px 22px;background:#00b894;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">${ctaLabel}</a></div>` : ''}
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px">
        SplitEase — Track shared expenses, split costs fairly.
      </p>
    </div>
  </body></html>`;
}

async function send({ to, subject, html, text }) {
  const message = { from: FROM, to, subject, html, text };

  if (!usingSMTP) {
    console.log('\n' + '─'.repeat(60));
    console.log(`📧 [DEV EMAIL] To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   ${text || html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 200)}`);
    console.log('─'.repeat(60) + '\n');
    return { dev: true };
  }

  try {
    return await transporter.sendMail(message);
  } catch (err) {
    console.error('📧 Mail send failed:', err.message);
    return { error: err.message };
  }
}

// ─── Templates ────────────────────────────────────────────────

exports.sendGroupInvite = ({ to, inviterName, groupName, isNewUser, inviteToken }) => {
  const url = isNewUser
    ? `${APP_URL}/register?invite=${inviteToken}&email=${encodeURIComponent(to)}`
    : `${APP_URL}/groups`;

  const content = `
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700">You're invited to a group 🎉</h2>
    <p style="margin:0 0 8px"><strong>${inviterName}</strong> has added you to the SplitEase group:</p>
    <p style="margin:0 0 16px;padding:12px 16px;background:#f0fdfa;border-left:3px solid #00b894;border-radius:6px;font-weight:600;color:#065f5b">${groupName}</p>
    <p style="margin:0;color:#4b5563">${isNewUser
      ? 'Click below to create your account and join the group automatically.'
      : 'Sign in to view the group and start tracking shared expenses.'}</p>
  `;

  return send({
    to,
    subject: `${inviterName} added you to "${groupName}" on SplitEase`,
    html: wrap(content, url, isNewUser ? 'Sign Up & Join' : 'Open SplitEase'),
    text: `${inviterName} added you to the group "${groupName}". ${isNewUser ? `Sign up: ${url}` : `Open: ${url}`}`,
  });
};

exports.sendExpenseAdded = ({ to, payerName, groupName, description, amount, currency, share }) => {
  const url = `${APP_URL}/groups`;
  const content = `
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700">New expense added</h2>
    <p style="margin:0 0 14px;color:#4b5563"><strong>${payerName}</strong> added an expense in <strong>${groupName}</strong>:</p>
    <div style="padding:14px 16px;background:#f8fafc;border-radius:10px;margin-bottom:14px">
      <div style="font-weight:600;font-size:16px;margin-bottom:4px">${description}</div>
      <div style="color:#6b7280;font-size:14px">Total: <strong>${currency} ${amount.toFixed(2)}</strong></div>
      ${share ? `<div style="color:#dc2626;font-size:14px;margin-top:6px">Your share: <strong>${currency} ${share.toFixed(2)}</strong></div>` : ''}
    </div>
  `;

  return send({
    to,
    subject: `${payerName} added "${description}" in ${groupName}`,
    html: wrap(content, url, 'View Group'),
    text: `${payerName} added "${description}" (${currency} ${amount.toFixed(2)}) in ${groupName}. Your share: ${currency} ${share?.toFixed(2) || '0.00'}.`,
  });
};

exports.sendWelcome = ({ to, name }) => {
  const url = `${APP_URL}/dashboard`;
  const content = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:800">Welcome to SplitEase, ${name.split(' ')[0]} 👋</h2>
    <p style="margin:0 0 14px;color:#4b5563">You're all set up! Here's what you can do next:</p>
    <ul style="margin:0 0 14px;padding-left:18px;color:#374151;line-height:1.8">
      <li><strong>Create a group</strong> for your trips, household, or office</li>
      <li><strong>Add expenses</strong> with equal, exact, or percentage splits</li>
      <li><strong>Settle up</strong> with the smart payment minimizer</li>
    </ul>
    <p style="margin:0;color:#6b7280;font-size:14px">No more awkward "who paid what" conversations.</p>
  `;

  return send({
    to,
    subject: `Welcome to SplitEase, ${name.split(' ')[0]}!`,
    html: wrap(content, url, 'Open Dashboard'),
    text: `Welcome to SplitEase, ${name}! Get started: ${url}`,
  });
};

exports.sendPasswordReset = ({ to, name, token }) => {
  const url = `${APP_URL}/reset-password?token=${token}`;
  const content = `
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700">Reset your password 🔑</h2>
    <p style="margin:0 0 14px;color:#4b5563">Hi ${name.split(' ')[0]}, we received a request to reset your SplitEase password.</p>
    <p style="margin:0 0 14px;color:#4b5563">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
    <p style="margin:14px 0 0;font-size:13px;color:#9ca3af">If you didn't request this, you can safely ignore this email — your password won't change.</p>
  `;

  return send({
    to,
    subject: 'Reset your SplitEase password',
    html: wrap(content, url, 'Reset Password'),
    text: `Reset your password: ${url} (expires in 1 hour)`,
  });
};

exports.sendExpenseComment = ({ to, commenterName, groupName, expenseDescription, commentText }) => {
  const url = `${APP_URL}/groups`;
  const content = `
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700">New comment 💬</h2>
    <p style="margin:0 0 14px;color:#4b5563"><strong>${commenterName}</strong> commented on <strong>"${expenseDescription}"</strong> in <strong>${groupName}</strong>:</p>
    <blockquote style="margin:0 0 14px;padding:14px 16px;background:#f8fafc;border-left:3px solid #00b894;border-radius:6px;color:#374151;font-style:italic">${commentText.replace(/</g, '&lt;')}</blockquote>
  `;

  return send({
    to,
    subject: `${commenterName} commented on "${expenseDescription}"`,
    html: wrap(content, url, 'View Comment'),
    text: `${commenterName} commented on "${expenseDescription}" in ${groupName}: ${commentText}`,
  });
};

exports.sendSettlementRecorded = ({ to, payerName, amount, currency, groupName }) => {
  const url = `${APP_URL}/groups`;
  const content = `
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700">Payment received 💰</h2>
    <p style="margin:0 0 14px;color:#4b5563"><strong>${payerName}</strong> recorded a payment to you in <strong>${groupName}</strong>:</p>
    <div style="padding:16px;background:#f0fdfa;border-radius:10px;text-align:center">
      <div style="font-size:28px;font-weight:800;color:#00876b">${currency} ${amount.toFixed(2)}</div>
    </div>
  `;

  return send({
    to,
    subject: `${payerName} paid you ${currency} ${amount.toFixed(2)}`,
    html: wrap(content, url, 'View Settlement'),
    text: `${payerName} paid you ${currency} ${amount.toFixed(2)} in ${groupName}.`,
  });
};

exports.isUsingSMTP = () => usingSMTP;
