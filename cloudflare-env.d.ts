declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    RESEND_API_KEY?: string;
    OWNER_EMAIL?: string;
    EMAIL_FROM?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_TOKEN_ENCRYPTION_KEY?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    VISIBILITY_CRON_SECRET?: string;
  }
}
