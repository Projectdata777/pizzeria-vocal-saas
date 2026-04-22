/**
 * Pizzeria Vocal SaaS — Serveur principal v2.0
 * Architecture multi-tenant | Retell AI + Claude + Supabase + Twilio
 */

import * as http from 'http';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
dotenv.config();

import config from './config';
import { setupLlmWebSocket } from './llm/llmWebsocket';
import retellWebhook from './webhooks/retellWebhook';
import apiRoutes from './routes/api';

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Retell webhooks, curl, etc.
    if (config.security.allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS bloqué pour : ${origin}`));
  },
  credentials: true,
}));

// ─── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({ windowMs: 60000, max: 60, standardHeaders: true, legacyHeaders: false });
app.use('/api', limiter);

// ─── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);
app.use('/webhook', retellWebhook);

// ─── Keep-alive (Render Free) ─────────────────────────────────────────────────
if (config.nodeEnv === 'production') {
  setInterval(async () => {
    try {
      await fetch(`${config.baseUrl}/api/health`);
    } catch {}
  }, 4 * 60 * 1000);
}

// ─── Démarrage ────────────────────────────────────────────────────────────────
const server = http.createServer(app);
setupLlmWebSocket(server);

server.listen(config.port, () => {
  console.log('');
  console.log('🍕 ══════════════════════════════════════════════');
  console.log(`   Pizzeria Vocal SaaS v2.0 — Démarré`);
  console.log(`   Port     : ${config.port}`);
  console.log(`   Env      : ${config.nodeEnv}`);
  console.log(`   Health   : ${config.baseUrl}/api/health`);
  console.log(`   WebSocket: ${config.baseUrl.replace('https','wss')}/llm-websocket`);
  console.log('🍕 ══════════════════════════════════════════════');
  console.log('');
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));

export default app;
