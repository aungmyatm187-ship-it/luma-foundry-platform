import "dotenv/config";

const required = [
  "PORT",
  "DATABASE_URL",
  "LEMON_SQUEEZY_SIGNING_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "SUPPORT_EMAIL",
];

export function getConfig(env = process.env) {
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const port = Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return {
    port,
    databaseUrl: env.DATABASE_URL,
    lemonSigningSecret: env.LEMON_SQUEEZY_SIGNING_SECRET,
    resendApiKey: env.RESEND_API_KEY,
    emailFrom: env.EMAIL_FROM,
    supportEmail: env.SUPPORT_EMAIL,
    storeUrl: env.STORE_URL || "",
    allowTestModeEmails: env.ALLOW_TEST_MODE_EMAILS === "true",
  };
}
