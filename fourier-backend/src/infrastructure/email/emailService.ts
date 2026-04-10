import nodemailer from "nodemailer";
import { config } from "../../config/env";

// ── Supported languages ────────────────────────────────────────────────────
type Lang = "es" | "en";

function resolveLang(lang?: string): Lang {
  return lang === "en" ? "en" : "es";
}

// ── i18n strings ───────────────────────────────────────────────────────────
const STRINGS = {
  es: {
    greeting: (name: string) => `Hola, ${name}`,
    footer: "Si tienes dudas, contáctanos respondiendo este correo.",
    brand: "Fourier Calculator",
    linkFallback: "O copia este enlace en tu navegador:",
    verify: {
      subject: "Verifica tu cuenta · Fourier Calculator",
      body: "Gracias por registrarte en Fourier Calculator. Haz clic en el botón para verificar tu correo y activar tu cuenta.",
      cta: "Verificar cuenta",
      expiry: "Este enlace expira en 24 horas.",
      ignore: "Si no creaste esta cuenta, puedes ignorar este correo.",
    },
    resetPassword: {
      subject: "Restablece tu contraseña · Fourier Calculator",
      body: "Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón para elegir una nueva.",
      cta: "Restablecer contraseña",
      expiry: "Este enlace expira en 1 hora.",
      ignore:
        "Si no solicitaste esto, puedes ignorar este correo con seguridad.",
    },
    recovery: {
      subject: "Recupera tu cuenta · Fourier Calculator",
      body: "Recibimos una solicitud para recuperar el acceso a tu cuenta. Haz clic en el botón para continuar.",
      cta: "Recuperar cuenta",
      expiry: "Este enlace expira en 24 horas.",
      ignore:
        "Si no solicitaste esto, puedes ignorar este correo con seguridad.",
    },
  },
  en: {
    greeting: (name: string) => `Hi, ${name}`,
    footer: "If you have any questions, reply to this email.",
    brand: "Fourier Calculator",
    linkFallback: "Or copy this link into your browser:",
    verify: {
      subject: "Verify your account · Fourier Calculator",
      body: "Thanks for signing up for Fourier Calculator. Click the button below to verify your email and activate your account.",
      cta: "Verify account",
      expiry: "This link expires in 24 hours.",
      ignore: "If you didn't create this account, you can safely ignore this email.",
    },
    resetPassword: {
      subject: "Reset your password · Fourier Calculator",
      body: "We received a request to reset your account password. Click the button below to choose a new one.",
      cta: "Reset password",
      expiry: "This link expires in 1 hour.",
      ignore: "If you didn't request this, you can safely ignore this email.",
    },
    recovery: {
      subject: "Recover your account · Fourier Calculator",
      body: "We received a request to recover access to your account. Click the button below to continue.",
      cta: "Recover account",
      expiry: "This link expires in 24 hours.",
      ignore: "If you didn't request this, you can safely ignore this email.",
    },
  },
} as const;

// ── HTML template ──────────────────────────────────────────────────────────
function buildHtml(opts: {
  greeting: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  expiry: string;
  ignore: string;
  linkFallback: string;
  footer: string;
  brand: string;
}): string {
  const { greeting, body, ctaLabel, ctaUrl, expiry, ignore, linkFallback, footer, brand } = opts;

  // Design system: paper #f5f0e8 · paper2 #ede7d9 · ink #1a1410
  //                accent #8b2500 · border #c8bca8 · muted #6b5e4e
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${brand}</title>
</head>
<body style="margin:0;padding:0;background-color:#ede7d9;font-family:Georgia,'Times New Roman',Times,serif;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background-color:#ede7d9;padding:40px 16px;">
    <tr>
      <td align="center">
        <!-- Inner column -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0"
               style="max-width:560px;width:100%;">

          <!-- ── Brandmark ── -->
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <p style="margin:0;font-family:Georgia,serif;font-size:12px;
                         letter-spacing:0.12em;text-transform:uppercase;
                         color:#6b5e4e;">
                ${brand}
              </p>
            </td>
          </tr>

          <!-- ── Card ── -->
          <tr>
            <td style="background-color:#f5f0e8;border:1px solid #c8bca8;
                        border-radius:12px;padding:40px 36px;">

              <!-- Greeting -->
              <p style="margin:0 0 4px;font-size:22px;font-weight:bold;
                          color:#1a1410;line-height:1.3;">
                ${greeting}
              </p>
              <!-- Decorative rule -->
              <div style="width:40px;height:2px;background-color:#8b2500;margin:12px 0 20px;"></div>

              <!-- Body text -->
              <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#3d3228;">
                ${body}
              </p>

              <!-- CTA button (table trick for email clients) -->
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background-color:#8b2500;">
                    <a href="${ctaUrl}"
                       style="display:inline-block;padding:13px 30px;
                              color:#f5f0e8;font-family:Georgia,serif;
                              font-size:14px;font-weight:bold;
                              text-decoration:none;border-radius:8px;
                              letter-spacing:0.02em;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry + ignore -->
              <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#6b5e4e;">
                ${expiry}<br>
                ${ignore}
              </p>

              <!-- Horizontal rule -->
              <div style="border-top:1px solid #c8bca8;margin:24px 0;"></div>

              <!-- Fallback URL -->
              <p style="margin:0;font-size:11px;color:#8a7a6c;line-height:1.5;">
                ${linkFallback}<br>
                <a href="${ctaUrl}" style="color:#8b2500;word-break:break-all;">
                  ${ctaUrl}
                </a>
              </p>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0 0 4px;font-size:11px;color:#8a7a6c;font-family:Georgia,serif;">
                ${footer}
              </p>
              <p style="margin:4px 0 0;font-size:11px;color:#a09080;font-family:Georgia,serif;">
                © ${new Date().getFullYear()} ${brand}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Transporter ────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

// ── Public functions ───────────────────────────────────────────────────────
export async function sendVerificationEmail(
  to: string,
  firstName: string,
  token: string,
  lang?: string,
): Promise<void> {
  const l = resolveLang(lang);
  const t = STRINGS[l];
  const verifyUrl = `${config.app.frontendUrl}/${l}/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"${t.brand}" <${config.email.from}>`,
    to,
    subject: t.verify.subject,
    html: buildHtml({
      greeting: t.greeting(firstName),
      body: t.verify.body,
      ctaLabel: t.verify.cta,
      ctaUrl: verifyUrl,
      expiry: t.verify.expiry,
      ignore: t.verify.ignore,
      linkFallback: t.linkFallback,
      footer: t.footer,
      brand: t.brand,
    }),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  firstName: string,
  token: string,
  lang?: string,
): Promise<void> {
  const l = resolveLang(lang);
  const t = STRINGS[l];
  const resetUrl = `${config.app.frontendUrl}/${l}/auth/reset-password?token=${token}`;

  await transporter.sendMail({
    from: `"${t.brand}" <${config.email.from}>`,
    to,
    subject: t.resetPassword.subject,
    html: buildHtml({
      greeting: t.greeting(firstName),
      body: t.resetPassword.body,
      ctaLabel: t.resetPassword.cta,
      ctaUrl: resetUrl,
      expiry: t.resetPassword.expiry,
      ignore: t.resetPassword.ignore,
      linkFallback: t.linkFallback,
      footer: t.footer,
      brand: t.brand,
    }),
  });
}

export async function sendRecoveryEmail(
  to: string,
  firstName: string,
  token: string,
  lang?: string,
): Promise<void> {
  const l = resolveLang(lang);
  const t = STRINGS[l];
  const recoveryUrl = `${config.app.frontendUrl}/${l}/auth/reset-password?token=${token}`;

  await transporter.sendMail({
    from: `"${t.brand}" <${config.email.from}>`,
    to,
    subject: t.recovery.subject,
    html: buildHtml({
      greeting: t.greeting(firstName),
      body: t.recovery.body,
      ctaLabel: t.recovery.cta,
      ctaUrl: recoveryUrl,
      expiry: t.recovery.expiry,
      ignore: t.recovery.ignore,
      linkFallback: t.linkFallback,
      footer: t.footer,
      brand: t.brand,
    }),
  });
}
