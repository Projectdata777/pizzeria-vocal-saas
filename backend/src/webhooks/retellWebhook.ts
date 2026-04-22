/**
 * Webhook Retell AI — Événements post-appel
 */

import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { db } from '../db/client';
import config from '../config';

const router = Router();

function verifySignature(req: Request): boolean {
  if (!config.security.webhookSecret || config.security.webhookSecret === 'changeme') return true;
  const sig = req.headers['x-retell-signature'] as string;
  if (!sig) return false;
  const expected = crypto
    .createHmac('sha256', config.security.webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
}

router.post('/retell', async (req: Request, res: Response) => {
  if (!verifySignature(req)) {
    return res.status(401).json({ error: 'Signature invalide' });
  }

  const body = req.body as Record<string, unknown>;
  const event = body.event as string;
  const callObj = (body.call as Record<string, unknown>) ?? {};
  const callId = (callObj.call_id ?? '') as string;

  res.status(200).json({ received: true });

  try {
    switch (event) {
      case 'call_ended': {
        const durationSec = typeof callObj.duration_ms === 'number'
          ? Math.round(callObj.duration_ms / 1000) : 0;

        await db.from('calls').update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_seconds: durationSec,
          recording_url: callObj.recording_url as string ?? null,
        }).eq('retell_call_id', callId);
        break;
      }

      case 'call_analyzed': {
        const analysis = callObj.call_analysis as Record<string, unknown> ?? {};
        await db.from('calls').update({
          call_successful: analysis.call_successful as boolean ?? null,
          user_sentiment: analysis.user_sentiment as string ?? null,
          summary: analysis.call_summary as string ?? null,
        }).eq('retell_call_id', callId);
        break;
      }
    }
  } catch (err) {
    console.error('❌ Retell webhook erreur:', err);
  }

  return;
});

export default router;
