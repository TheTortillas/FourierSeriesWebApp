import nodemailer from "nodemailer";
import { config } from "../../config/env";

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

export async function sendVerificationEmail(
  to: string,
  firstName: string,
  token: string,
): Promise<void> {
  const verifyUrl = `${config.app.frontendUrl}/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"Fourier Calculator" <${config.email.from}>`,
    to,
    subject: "Verifica tu cuenta",
    html: `
      <h2>Hola ${firstName}</h2>
      <p>Gracias por registrarte en Fourier Calculator.</p>
      <p>Haz click en el siguiente enlace para verificar tu cuenta:</p>
      <a href="${verifyUrl}" style="
        background-color: #4F46E5;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 6px;
        display: inline-block;
        margin: 16px 0;
      ">Verificar cuenta</a>
      <p>Este enlace expira en 24 horas.</p>
      <p>Si no creaste esta cuenta puedes ignorar este correo.</p>
    `,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  firstName: string,
  token: string,
): Promise<void> {
  const resetUrl = `${config.app.frontendUrl}/auth/reset-password?token=${token}`;

  await transporter.sendMail({
    from: `"Fourier Calculator" <${config.email.from}>`,
    to,
    subject: "Restablecer contraseña",
    html: `
      <h2>Hola ${firstName}</h2>
      <p>Recibimos una solicitud para restablecer tu contraseña.</p>
      <a href="${resetUrl}" style="
        background-color: #4F46E5;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 6px;
        display: inline-block;
        margin: 16px 0;
      ">Restablecer contraseña</a>
      <p>Este enlace expira en 1 hora.</p>
      <p>Si no solicitaste esto puedes ignorar este correo.</p>
    `,
  });
}

export async function sendRecoveryEmail(
  to: string,
  firstName: string,
  token: string,
): Promise<void> {
  const recoveryUrl = `${config.app.frontendUrl}/auth/reset-password?token=${token}`;

  await transporter.sendMail({
    from: `"Fourier Calculator" <${config.email.from}>`,
    to,
    subject: "Recuperar cuenta",
    html: `
      <h2>Hola ${firstName}</h2>
      <p>Recibimos una solicitud para recuperar tu cuenta.</p>
      <a href="${recoveryUrl}" style="
        background-color: #4F46E5;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 6px;
        display: inline-block;
        margin: 16px 0;
      ">Recuperar cuenta</a>
      <p>Este enlace expira en 24 horas.</p>
      <p>Si no solicitaste esto puedes ignorar este correo.</p>
    `,
  });
}
