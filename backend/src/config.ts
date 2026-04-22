import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  retell: {
    apiKey: process.env.RETELL_API_KEY || '',
  },

  zadarma: {
    apiKey: process.env.ZADARMA_API_KEY || '',
    apiSecret: process.env.ZADARMA_API_SECRET || '',
    sipLogin: process.env.ZADARMA_SIP_LOGIN || '',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    smsFrom: process.env.TWILIO_SMS_FROM || '',
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM || '',
  },

  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },

  ntfy: {
    baseUrl: process.env.NTFY_BASE_URL || 'https://ntfy.sh',
  },

  security: {
    webhookSecret: process.env.WEBHOOK_SECRET || 'changeme',
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(o => o.trim()),
  },
};

export default config;
