/**
 * NotificationService
 * Patron : SMS Twilio (principal) + ntfy push (gratuit, app mobile)
 * Client : SMS Twilio confirmation commande
 */

import twilio from 'twilio';
import config from '../config';
import type { OrderItem } from '../db/client';

const twilioClient = config.twilio.accountSid && config.twilio.authToken
  ? twilio(config.twilio.accountSid, config.twilio.authToken)
  : null;

// ─── Formatage du message patron ─────────────────────────────────────────────
export function formatOwnerMessage(opts: {
  restaurantName: string;
  orderItems: OrderItem[];
  orderType: 'livraison' | 'retrait' | 'sur_place' | 'inconnu';
  deliveryAddress?: string;
  pickupTime?: string;
  total: number;
  callerPhone?: string;
  delayMinutes?: number;
  customerName?: string;
  isVip?: boolean;
}): string {
  const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const typeEmoji = opts.orderType === 'livraison' ? '🚗' : opts.orderType === 'retrait' ? '🏃' : '📞';
  const typeLabel = opts.orderType === 'livraison' ? 'Livraison' : opts.orderType === 'retrait' ? 'Retrait' : 'Sur place';

  const lines: string[] = [];
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🍕 ${opts.restaurantName.toUpperCase()}`);
  if (opts.isVip) lines.push(`⭐ CLIENT VIP`);
  lines.push(`🕐 ${now}  ${typeEmoji} ${typeLabel}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);

  for (const item of opts.orderItems) {
    const note = item.notes ? ` (${item.notes})` : '';
    lines.push(`${item.qte}x ${item.nom}${note}  →  ${(item.prix * item.qte).toFixed(2)}€`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`💰 TOTAL : ${opts.total.toFixed(2)}€`);

  if (opts.orderType === 'livraison' && opts.deliveryAddress) {
    lines.push(`📍 ${opts.deliveryAddress}`);
  }
  if (opts.pickupTime) {
    lines.push(`⏰ ${opts.orderType === 'livraison' ? 'Livraison' : 'Retrait'} : ${opts.pickupTime}`);
  }
  if (opts.delayMinutes) {
    lines.push(`⌛ Délai estimé : ${opts.delayMinutes} min`);
  }
  if (opts.callerPhone) {
    lines.push(`📞 ${opts.callerPhone}`);
  }
  if (opts.customerName) {
    lines.push(`👤 ${opts.customerName}`);
  }

  return lines.join('\n');
}

// ─── Notification patron via SMS ─────────────────────────────────────────────
export async function notifyOwnerSms(ownerPhone: string, message: string): Promise<void> {
  if (!twilioClient || !config.twilio.smsFrom) {
    console.warn('⚠️  Twilio non configuré — SMS patron ignoré');
    return;
  }
  try {
    await twilioClient.messages.create({
      body: message,
      from: config.twilio.smsFrom,
      to: ownerPhone,
    });
    console.log(`✅ SMS patron envoyé → ${ownerPhone}`);
  } catch (err) {
    console.error('❌ SMS patron erreur:', err);
  }
}

// ─── Notification patron via ntfy push ───────────────────────────────────────
export async function notifyOwnerPush(ntfyTopic: string, message: string, restaurantName: string): Promise<void> {
  if (!ntfyTopic) return;
  try {
    await fetch(`${config.ntfy.baseUrl}/${ntfyTopic}`, {
      method: 'POST',
      headers: {
        'Title': `🍕 Nouvelle commande — ${restaurantName}`,
        'Priority': 'high',
        'Tags': 'pizza,bell',
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: message,
    });
    console.log(`✅ Push ntfy envoyé → topic:${ntfyTopic}`);
  } catch (err) {
    console.error('❌ Push ntfy erreur:', err);
  }
}

// ─── Notification client (confirmation commande) ──────────────────────────────
export async function notifyClient(opts: {
  clientPhone: string;
  restaurantName: string;
  orderItems: OrderItem[];
  total: number;
  orderType: string;
  delayMinutes?: number;
  deliveryAddress?: string;
}): Promise<void> {
  if (!twilioClient || !config.twilio.smsFrom) {
    console.warn('⚠️  Twilio non configuré — SMS client ignoré');
    return;
  }

  const delay = opts.delayMinutes ?? 30;
  const typeLabel = opts.orderType === 'livraison'
    ? `Livraison estimée dans ${delay} min à ${opts.deliveryAddress || 'votre adresse'}`
    : `Retrait prêt dans ${delay} min`;

  const itemLines = opts.orderItems.map(i => `• ${i.qte}x ${i.nom}`).join('\n');
  const message = `✅ Commande confirmée — ${opts.restaurantName}\n\n${itemLines}\n\nTotal : ${opts.total.toFixed(2)}€\n${typeLabel}\n\nMerci de votre confiance ! 🍕`;

  try {
    await twilioClient.messages.create({
      body: message,
      from: config.twilio.smsFrom,
      to: opts.clientPhone,
    });
    console.log(`✅ SMS client envoyé → ${opts.clientPhone}`);
  } catch (err) {
    console.error('❌ SMS client erreur:', err);
  }
}

// ─── SMS Relance marketing ────────────────────────────────────────────────────
export async function sendMarketingSms(opts: {
  clientPhone: string;
  restaurantName: string;
  message: string;
  promoCode?: string;
}): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!twilioClient || !config.twilio.smsFrom) {
    return { success: false, error: 'Twilio non configuré' };
  }

  const fullMessage = opts.promoCode
    ? `${opts.message}\n\nCode promo : ${opts.promoCode} 🎁`
    : opts.message;

  try {
    const result = await twilioClient.messages.create({
      body: fullMessage,
      from: config.twilio.smsFrom,
      to: opts.clientPhone,
    });
    return { success: true, sid: result.sid };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('❌ SMS marketing erreur:', error);
    return { success: false, error };
  }
}
