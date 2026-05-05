import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
  },
})

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const verifyUrl = `${process.env.APP_URL ?? 'http://localhost:5173'}/verify-email?token=${token}`

  await transporter.sendMail({
    from: `"MedLog AI" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to,
    subject: 'Verify your MedLog AI account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0EA5E9;margin-bottom:8px">Welcome to MedLog AI, Dr. ${name}</h2>
        <p style="color:#374151;margin-bottom:24px">Please verify your email address to activate your account.</p>
        <a href="${verifyUrl}" style="background:#0EA5E9;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Verify Email Address</a>
        <p style="color:#9CA3AF;font-size:13px;margin-top:24px">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
        <p style="color:#D1D5DB;font-size:12px;margin-top:16px">MedLog AI — Clinical Documentation System</p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const resetUrl = `${process.env.APP_URL ?? 'http://localhost:5173'}/reset-password?token=${token}`

  await transporter.sendMail({
    from: `"MedLog AI" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to,
    subject: 'Reset your MedLog AI password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0EA5E9;margin-bottom:8px">Password Reset</h2>
        <p style="color:#374151;margin-bottom:24px">Hi Dr. ${name}, click below to reset your password.</p>
        <a href="${resetUrl}" style="background:#0EA5E9;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Reset Password</a>
        <p style="color:#9CA3AF;font-size:13px;margin-top:24px">This link expires in 1 hour. If you didn't request this, ignore it.</p>
      </div>
    `,
  })
}
