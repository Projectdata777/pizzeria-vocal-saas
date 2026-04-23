/**
 * Custom LLM WebSocket — Cerveau de l'agent vocal
 * Retell AI se connecte ici à chaque appel
 *
 * Features :
 *  A. Multi-tenant : récupère la config du restaurant via le numéro appelé
 *  B. Reconnaissance client fidèle (phone → customers)
 *  C. Prise de commande naturelle
 *  D. Upselling intelligent (1x par appel)
 *  E. Notification patron en temps réel
 *  F. SMS confirmation client
 *  G. Détection plaintes + escalade
 *  H. Détection langue (FR/EN/AR)
 */

import * as http from 'http';
import * as WebSocket from 'ws';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db/client';
import type { Restaurant, Customer, OrderItem } from '../db/client';
import config from '../config';
import {
  notifyOwnerSms,
  notifyOwnerPush,
  notifyClient,
  formatOwnerMessage,
} from '../services/NotificationService';

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

// ─── Types ───────────────────────────────────────────────────────────────────
interface RetellMessage {
  interaction_type: 'call_details' | 'response_required' | 'reminder_required' | 'update_only';
  call?: {
    call_id: string;
    from_number?: string;
    to_number?: string;
    metadata?: Record<string, string>;
  };
  transcript?: Array<{ role: 'agent' | 'user'; content: string }>;
  response_id?: number;
}

interface OrderState {
  articles: OrderItem[];
  type: 'livraison' | 'retrait' | 'sur_place' | 'inconnu';
  adresse_livraison?: string;
  heure_souhaitee?: string;
  total_estime: number;
}

interface SessionContext {
  callId: string;
  restaurant: Restaurant | null;
  customer: Customer | null;
  orderState: OrderState;
  history: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  upsellDone: boolean;
  notificationSent: boolean;
  clientSmsSent: boolean;
  language: 'fr' | 'en' | 'ar';
  callerPhone: string;
  callStartTime: number;
}

// ─── Lookup restaurant par numéro appelé ──────────────────────────────────────
async function findRestaurantByPhone(phone: string): Promise<Restaurant | null> {
  const { data } = await db
    .from('restaurants')
    .select('*')
    .or(`retell_phone.eq.${phone},phone.eq.${phone},zadarma_number.eq.${phone}`)
    .eq('is_active', true)
    .limit(1)
    .single();
  return data as Restaurant | null;
}

// ─── Lookup client fidèle ─────────────────────────────────────────────────────
async function findOrCreateCustomer(phone: string, restaurantId: string): Promise<Customer | null> {
  if (!phone || !restaurantId) return null;
  const { data: existing } = await db
    .from('customers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('phone', phone)
    .single();
  if (existing) return existing as Customer;
  const { data: created } = await db
    .from('customers')
    .insert({ restaurant_id: restaurantId, phone })
    .select()
    .single();
  return created as Customer | null;
}

// ─── Construire le system prompt ──────────────────────────────────────────────
function buildSystemPrompt(ctx: SessionContext): string {
  const r = ctx.restaurant;
  if (!r) {
    return `Tu es un assistant téléphonique pour restaurant. Tu prends les commandes de façon naturelle et professionnelle. Parle français.`;
  }

  const cfg = r.config_json as Record<string, unknown>;
  const hours = cfg?.hours as Record<string, string> | undefined;
  const hoursText = hours
    ? Object.entries(hours).map(([d, h]) => `${d}: ${h}`).join('\n')
    : 'Voir avec le restaurant';
  const delay = (cfg?.delay_minutes as number) ?? 30;

  const customerSection = ctx.customer && ctx.customer.order_count > 0
    ? `\n## CLIENT FIDÈLE DÉTECTÉ\nPrénom : ${ctx.customer.first_name || 'inconnu'}\nCommandes passées : ${ctx.customer.order_count}\nDépenses totales : ${ctx.customer.total_spent}€\nPlats favoris : ${(ctx.customer.favorite_items || []).join(', ') || 'non renseigné'}\nPoints fidélité : ${ctx.customer.loyalty_points}\n→ Accueil personnalisé, propose ses favoris en priorité.`
    : '';

  return `Tu es l'assistant téléphonique vocal de ${r.name} (${r.type}).
Tu parles en voix masculine, chaleureux, naturel — exactement comme un vrai employé compétent.
Ton prénom est Alex.

## RÈGLES FONDAMENTALES
- Réponds TOUJOURS en ${ctx.language === 'ar' ? 'arabe' : ctx.language === 'en' ? 'anglais' : 'français'} sauf si le client change de langue
- Ne LIS JAMAIS de liste à voix haute (c'est un appel vocal) — décris naturellement
- Une question à la fois — ne surcharge pas le client
- Ton but : prendre la commande complète et confirmer

## HORAIRES
${hoursText}

## DÉLAI DE LIVRAISON/RETRAIT
${delay} minutes environ

## INSTRUCTIONS COMMANDE
1. Accueil : "Bonjour, ${r.name}, [prénom] à l'appareil, que puis-je faire pour vous ?"
2. Prends les articles un par un, confirme chaque article
3. Demande livraison ou retrait
4. Si livraison : adresse complète, confirme zone
5. Si retrait : heure souhaitée
6. UPSELL (1 seule fois) : propose un article complémentaire pertinent
7. Récapitulatif final avant raccrocher
8. Si demande de parler au responsable : "Je vous transfère immédiatement"
${customerSection}

## INTERDICTIONS
- Ne jamais inventer un prix ou un article absent du menu
- Ne jamais confirmer livraison hors zone
- Ne jamais faire plus d'un upsell`;
}

// ─── Extraire articles commandés depuis transcript ────────────────────────────
function extractOrderFromHistory(history: SessionContext['history']): Partial<OrderState> {
  const fullText = history.map(h => h.content).join('\n').toLowerCase();
  const type = fullText.includes('livraison') ? 'livraison'
    : fullText.includes('retrait') || fullText.includes('sur place') ? 'retrait'
    : 'inconnu';
  const addressMatch = fullText.match(/(?:adresse|livrer)[^\n.]*?(\d+[^,.]+)/i);
  return { type, adresse_livraison: addressMatch?.[1] };
}

// ─── Sauvegarder appel en DB ──────────────────────────────────────────────────
async function saveCall(callId: string, ctx: SessionContext, status: string): Promise<void> {
  const transcript = ctx.history
    .filter(h => h.role !== 'system')
    .map(h => `[${h.role === 'user' ? 'Client' : 'Agent'}] ${h.content}`)
    .join('\n');

  await db.from('calls').upsert({
    retell_call_id: callId,
    restaurant_id: ctx.restaurant?.id ?? null,
    customer_id: ctx.customer?.id ?? null,
    from_number: ctx.callerPhone,
    to_number: ctx.restaurant?.retell_phone ?? null,
    status,
    transcript,
    duration_seconds: Math.round((Date.now() - ctx.callStartTime) / 1000),
    started_at: new Date(ctx.callStartTime).toISOString(),
  });
}

// ─── Générer récapitulatif + sauvegarder commande ────────────────────────────
async function finalizeCall(ctx: SessionContext): Promise<void> {
  if (!ctx.restaurant || ctx.notificationSent) return;
  ctx.notificationSent = true;

  const orderExtracted = extractOrderFromHistory(ctx.history);
  const orderState = { ...ctx.orderState, ...orderExtracted };
  const cfg = ctx.restaurant.config_json as Record<string, unknown>;
  const delay = (cfg?.delay_minutes as number) ?? 30;
  const ntfyTopic = (cfg?.ntfy_topic as string) || '';

  const message = formatOwnerMessage({
    restaurantName: ctx.restaurant.name,
    orderItems: orderState.articles,
    orderType: orderState.type as 'livraison' | 'retrait' | 'sur_place' | 'inconnu',
    deliveryAddress: orderState.adresse_livraison,
    pickupTime: orderState.heure_souhaitee,
    total: orderState.total_estime,
    callerPhone: ctx.callerPhone,
    delayMinutes: delay,
    customerName: ctx.customer?.first_name ?? undefined,
    isVip: ctx.customer?.is_vip ?? false,
  });

  await Promise.allSettled([
    notifyOwnerSms(ctx.restaurant.owner_phone, message),
    ntfyTopic ? notifyOwnerPush(ntfyTopic, message, ctx.restaurant.name) : Promise.resolve(),
  ]);

  if (ctx.callerPhone && orderState.articles.length > 0 && !ctx.clientSmsSent) {
    ctx.clientSmsSent = true;
    await notifyClient({
      clientPhone: ctx.callerPhone,
      restaurantName: ctx.restaurant.name,
      orderItems: orderState.articles,
      total: orderState.total_estime,
      orderType: orderState.type,
      delayMinutes: delay,
      deliveryAddress: orderState.adresse_livraison,
    });
  }

  if (orderState.articles.length > 0) {
    await db.from('orders').insert({
      restaurant_id: ctx.restaurant.id,
      customer_id: ctx.customer?.id ?? null,
      items: orderState.articles,
      type: orderState.type === 'livraison' ? 'livraison' : orderState.type === 'retrait' ? 'retrait' : 'retrait',
      delivery_address: orderState.adresse_livraison ?? null,
      total: orderState.total_estime,
      status: 'new',
    });
  }
}

// ─── Setup WebSocket ──────────────────────────────────────────────────────────
export function setupLlmWebSocket(server: http.Server): void {
  const wss = new WebSocket.WebSocketServer({
    server,
    path: '/llm-websocket',
    // FIX: Retell envoie Sec-WebSocket-Protocol: retell-llm-v2
    // Sans handleProtocols, le client Retell ferme la connexion (RFC 6455 §4.1)
    handleProtocols: (protocols, _req) => {
      if (protocols.has('retell-llm-v2')) return 'retell-llm-v2';
      if (protocols.has('retell-llm')) return 'retell-llm';
      return false;
    },
  });

  // Log toutes les tentatives d'upgrade HTTP
  server.on('upgrade', (req, _socket, _head) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress;
    const proto = req.headers['sec-websocket-protocol'] || 'none';
    console.log(`[WS-UPGRADE] ${req.url} | IP:${ip} | Proto:${proto}`);
  });

  wss.on('connection', (ws, req) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress;
    console.log(`[WS-OPEN] IP=${ip}`);

    let ctx: SessionContext = {
      callId: '',
      restaurant: null,
      customer: null,
      orderState: { articles: [], type: 'inconnu', total_estime: 0 },
      history: [],
      upsellDone: false,
      notificationSent: false,
      clientSmsSent: false,
      language: 'fr',
      callerPhone: '',
      callStartTime: Date.now(),
    };

    ws.on('message', async (raw) => {
      try {
        const rawStr = raw.toString();
        console.log(`[WS-MSG] ${rawStr.substring(0, 300)}`);
        const msg = JSON.parse(rawStr) as RetellMessage;

        // ─── call_details : premier message Retell → envoyer salutation ────
        if (msg.interaction_type === 'call_details' && msg.call) {
          ctx.callId = msg.call.call_id;
          ctx.callerPhone = msg.call.from_number || '';
          const toNumber = msg.call.to_number || '';

          console.log(`[WS-CALL] callId=${ctx.callId} from=${ctx.callerPhone} to=${toNumber}`);

          // Trouver le restaurant (async, mais on envoie la salutation avant)
          const [restaurant] = await Promise.all([
            findRestaurantByPhone(toNumber),
          ]);
          ctx.restaurant = restaurant;

          // Trouver/créer le client
          if (ctx.callerPhone && ctx.restaurant) {
            ctx.customer = await findOrCreateCustomer(ctx.callerPhone, ctx.restaurant.id);
          }

          // Initialiser l'historique
          const immediateGreeting = `Bonjour, ${ctx.restaurant?.name ? ctx.restaurant.name + ', ' : ''}Alex à l'appareil, que puis-je faire pour vous ?`;
          ctx.history = [
            { role: 'system', content: buildSystemPrompt(ctx) },
            { role: 'assistant', content: immediateGreeting },
          ];

          // FIX: response_id doit être 0 pour la réponse à call_details
          ws.send(JSON.stringify({
            response_type: 'response',
            response_id: 0,
            content: immediateGreeting,
            content_complete: true,
            end_call: false,
          }));
          console.log('[WS-GREETING] Salutation envoyée (response_id=0)');

          // Sauvegarder appel en cours
          await db.from('calls').upsert({
            retell_call_id: ctx.callId,
            restaurant_id: ctx.restaurant?.id ?? null,
            customer_id: ctx.customer?.id ?? null,
            from_number: ctx.callerPhone,
            to_number: toNumber,
            status: 'in_progress',
            started_at: new Date().toISOString(),
          });

          console.log(`[WS-READY] Restaurant: ${ctx.restaurant?.name ?? 'inconnu'} | Client: ${ctx.callerPhone}`);
          return;
        }

        // ─── response_required : le client a parlé → répondre ────────────
        if (msg.interaction_type === 'response_required' && msg.transcript) {
          const lastUserMsg = msg.transcript.filter(t => t.role === 'user').pop();
          if (!lastUserMsg) return;

          // Détecter langue
          const userText = lastUserMsg.content.toLowerCase();
          if (ctx.history.length <= 2) {
            if (/[\u0600-\u06FF]/.test(lastUserMsg.content)) ctx.language = 'ar';
            else if (/\b(hello|hi|yes|no|please|i want|order)\b/.test(userText)) ctx.language = 'en';
          }

          ctx.history.push({ role: 'user', content: lastUserMsg.content });

          // Appel Claude
          const response = await anthropic.messages.create({
            model: config.anthropic.model,
            max_tokens: 500,
            messages: ctx.history.slice(1).map(h => ({
              role: h.role === 'system' ? 'user' : (h.role as 'user' | 'assistant'),
              content: h.content,
            })),
            system: ctx.history[0].content,
          });

          const agentText = response.content[0].type === 'text' ? response.content[0].text : '...';
          ctx.history.push({ role: 'assistant', content: agentText });

          const isRecap = /récap|récapitulatif|votre commande est|total.*€|confirme votre commande/i.test(agentText);
          if (isRecap && !ctx.notificationSent) {
            finalizeCall(ctx).catch(console.error);
          }

          ws.send(JSON.stringify({
            response_type: 'response',
            response_id: msg.response_id ?? 1,
            content: agentText,
            content_complete: true,
            end_call: false,
          }));
        }

        // ─── reminder_required : Retell relance → répéter ────────────────
        if (msg.interaction_type === 'reminder_required') {
          ws.send(JSON.stringify({
            response_type: 'response',
            response_id: msg.response_id ?? 1,
            content: "Je suis toujours là, que puis-je faire pour vous ?",
            content_complete: true,
            end_call: false,
          }));
        }

      } catch (err) {
        console.error('[WS-ERR]', err);
      }
    });

    ws.on('close', async (code, reason) => {
      console.log(`[WS-CLOSE] callId=${ctx.callId || 'EMPTY'} code=${code} reason=${reason.toString() || 'none'}`);
      await finalizeCall(ctx).catch(console.error);
      if (ctx.callId) {
        await saveCall(ctx.callId, ctx, 'completed').catch(console.error);
        await db.from('calls').update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_seconds: Math.round((Date.now() - ctx.callStartTime) / 1000),
        }).eq('retell_call_id', ctx.callId);
      }
    });

    ws.on('error', (err) => console.error(`[WS-ERR] ${err.message}`));
  });

  console.log('[WS] WebSocket LLM monté sur /llm-websocket');
    }/**
 * Custom LLM WebSocket — Cerveau de l'agent vocal
 * Retell AI se connecte ici à chaque appel
 *
 * Features :
 *  A. Multi-tenant : récupère la config du restaurant via le numéro appelé
 *  B. Reconnaissance client fidèle (phone → customers)
 *  C. Prise de commande naturelle
 *  D. Upselling intelligent (1x par appel)
 *  E. Notification patron en temps réel
 *  F. SMS confirmation client
 *  G. Détection plaintes + escalade
 *  H. Détection langue (FR/EN/AR)
 */

import * as http from 'http';
import * as WebSocket from 'ws';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db/client';
import type { Restaurant, Customer, OrderItem } from '../db/client';
import config from '../config';
import {
  notifyOwnerSms,
  notifyOwnerPush,
  notifyClient,
  formatOwnerMessage,
} from '../services/NotificationService';

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

// ─── Types ───────────────────────────────────────────────────────────────────
interface RetellMessage {
  interaction_type: 'call_details' | 'response_required' | 'reminder_required' | 'update_only';
  call?: {
    call_id: string;
    from_number?: string;
    to_number?: string;
    metadata?: Record<string, string>;
  };
  transcript?: Array<{ role: 'agent' | 'user'; content: string }>;
  response_id?: number;
}

interface OrderState {
  articles: OrderItem[];
  type: 'livraison' | 'retrait' | 'sur_place' | 'inconnu';
  adresse_livraison?: string;
  heure_souhaitee?: string;
  total_estime: number;
}

interface SessionContext {
  callId: string;
  restaurant: Restaurant | null;
  customer: Customer | null;
  orderState: OrderState;
  history: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  upsellDone: boolean;
  notificationSent: boolean;
  clientSmsSent: boolean;
  language: 'fr' | 'en' | 'ar';
  callerPhone: string;
  callStartTime: number;
}

// ─── Lookup restaurant par numéro appelé ──────────────────────────────────────
async function findRestaurantByPhone(phone: string): Promise<Restaurant | null> {
  const { data } = await db
    .from('restaurants')
    .select('*')
    .or(`retell_phone.eq.${phone},phone.eq.${phone},zadarma_number.eq.${phone}`)
    .eq('is_active', true)
    .limit(1)
    .single();
  return data as Restaurant | null;
}

// ─── Lookup client fidèle ─────────────────────────────────────────────────────
async function findOrCreateCustomer(phone: string, restaurantId: string): Promise<Customer | null> {
  if (!phone || !restaurantId) return null;
  const { data: existing } = await db
    .from('customers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('phone', phone)
    .single();
  if (existing) return existing as Customer;
  const { data: created } = await db
    .from('customers')
    .insert({ restaurant_id: restaurantId, phone })
    .select()
    .single();
  return created as Customer | null;
}

// ─── Construire le system prompt ──────────────────────────────────────────────
function buildSystemPrompt(ctx: SessionContext): string {
  const r = ctx.restaurant;
  if (!r) {
    return `Tu es un assistant téléphonique pour restaurant. Tu prends les commandes de façon naturelle et professionnelle. Parle français.`;
  }

  const cfg = r.config_json as Record<string, unknown>;
  const hours = cfg?.hours as Record<string, string> | undefined;
  const hoursText = hours
    ? Object.entries(hours).map(([d, h]) => `${d}: ${h}`).join('\n')
    : 'Voir avec le restaurant';
  const delay = (cfg?.delay_minutes as number) ?? 30;

  const customerSection = ctx.customer && ctx.customer.order_count > 0
    ? `\n## CLIENT FIDÈLE DÉTECTÉ\nPrénom : ${ctx.customer.first_name || 'inconnu'}\nCommandes passées : ${ctx.customer.order_count}\nDépenses totales : ${ctx.customer.total_spent}€\nPlats favoris : ${(ctx.customer.favorite_items || []).join(', ') || 'non renseigné'}\nPoints fidélité : ${ctx.customer.loyalty_points}\n→ Accueil personnalisé, propose ses favoris en priorité.`
    : '';

  return `Tu es l'assistant téléphonique vocal de ${r.name} (${r.type}).
Tu parles en voix masculine, chaleureux, naturel — exactement comme un vrai employé compétent.
Ton prénom est Alex.

## RÈGLES FONDAMENTALES
- Réponds TOUJOURS en ${ctx.language === 'ar' ? 'arabe' : ctx.language === 'en' ? 'anglais' : 'français'} sauf si le client change de langue
- Ne LIS JAMAIS de liste à voix haute (c'est un appel vocal) — décris naturellement
- Une question à la fois — ne surcharge pas le client
- Ton but : prendre la commande complète et confirmer

## HORAIRES
${hoursText}

## DÉLAI DE LIVRAISON/RETRAIT
${delay} minutes environ

## INSTRUCTIONS COMMANDE
1. Accueil : "Bonjour, ${r.name}, [prénom] à l'appareil, que puis-je faire pour vous ?"
2. Prends les articles un par un, confirme chaque article
3. Demande livraison ou retrait
4. Si livraison : adresse complète, confirme zone
5. Si retrait : heure souhaitée
6. UPSELL (1 seule fois) : propose un article complémentaire pertinent
7. Récapitulatif final avant raccrocher
8. Si demande de parler au responsable : "Je vous transfère immédiatement"
${customerSection}

## INTERDICTIONS
- Ne jamais inventer un prix ou un article absent du menu
- Ne jamais confirmer livraison hors zone
- Ne jamais faire plus d'un upsell`;
}

// ─── Extraire articles commandés depuis transcript ────────────────────────────
function extractOrderFromHistory(history: SessionContext['history']): Partial<OrderState> {
  const fullText = history.map(h => h.content).join('\n').toLowerCase();
  const type = fullText.includes('livraison') ? 'livraison'
    : fullText.includes('retrait') || fullText.includes('sur place') ? 'retrait'
    : 'inconnu';
  const addressMatch = fullText.match(/(?:adresse|livrer)[^\n.]*?(\d+[^,.]+)/i);
  return { type, adresse_livraison: addressMatch?.[1] };
}

// ─── Sauvegarder appel en DB ──────────────────────────────────────────────────
async function saveCall(callId: string, ctx: SessionContext, status: string): Promise<void> {
  const transcript = ctx.history
    .filter(h => h.role !== 'system')
    .map(h => `[${h.role === 'user' ? 'Client' : 'Agent'}] ${h.content}`)
    .join('\n');

  await db.from('calls').upsert({
    retell_call_id: callId,
    restaurant_id: ctx.restaurant?.id ?? null,
    customer_id: ctx.customer?.id ?? null,
    from_number: ctx.callerPhone,
    to_number: ctx.restaurant?.retell_phone ?? null,
    status,
    transcript,
    duration_seconds: Math.round((Date.now() - ctx.callStartTime) / 1000),
    started_at: new Date(ctx.callStartTime).toISOString(),
  });
}

// ─── Générer récapitulatif + sauvegarder commande ────────────────────────────
async function finalizeCall(ctx: SessionContext): Promise<void> {
  if (!ctx.restaurant || ctx.notificationSent) return;
  ctx.notificationSent = true;

  const orderExtracted = extractOrderFromHistory(ctx.history);
  const orderState = { ...ctx.orderState, ...orderExtracted };
  const cfg = ctx.restaurant.config_json as Record<string, unknown>;
  const delay = (cfg?.delay_minutes as number) ?? 30;
  const ntfyTopic = (cfg?.ntfy_topic as string) || '';

  const message = formatOwnerMessage({
    restaurantName: ctx.restaurant.name,
    orderItems: orderState.articles,
    orderType: orderState.type as 'livraison' | 'retrait' | 'sur_place' | 'inconnu',
    deliveryAddress: orderState.adresse_livraison,
    pickupTime: orderState.heure_souhaitee,
    total: orderState.total_estime,
    callerPhone: ctx.callerPhone,
    delayMinutes: delay,
    customerName: ctx.customer?.first_name ?? undefined,
    isVip: ctx.customer?.is_vip ?? false,
  });

  await Promise.allSettled([
    notifyOwnerSms(ctx.restaurant.owner_phone, message),
    ntfyTopic ? notifyOwnerPush(ntfyTopic, message, ctx.restaurant.name) : Promise.resolve(),
  ]);

  if (ctx.callerPhone && orderState.articles.length > 0 && !ctx.clientSmsSent) {
    ctx.clientSmsSent = true;
    await notifyClient({
      clientPhone: ctx.callerPhone,
      restaurantName: ctx.restaurant.name,
      orderItems: orderState.articles,
      total: orderState.total_estime,
      orderType: orderState.type,
      delayMinutes: delay,
      deliveryAddress: orderState.adresse_livraison,
    });
  }

  if (orderState.articles.length > 0) {
    await db.from('orders').insert({
      restaurant_id: ctx.restaurant.id,
      customer_id: ctx.customer?.id ?? null,
      items: orderState.articles,
      type: orderState.type === 'livraison' ? 'livraison' : orderState.type === 'retrait' ? 'retrait' : 'retrait',
      delivery_address: orderState.adresse_livraison ?? null,
      total: orderState.total_estime,
      status: 'new',
    });
  }
}

// ─── Setup WebSocket ──────────────────────────────────────────────────────────
export function setupLlmWebSocket(server: http.Server): void {
  const wss = new WebSocket.WebSocketServer({
    server,
    path: '/llm-websocket',
    // FIX: Retell envoie Sec-WebSocket-Protocol: retell-llm-v2
    // Sans handleProtocols, le client Retell ferme la connexion (RFC 6455 §4.1)
    handleProtocols: (protocols, _req) => {
      if (protocols.has('retell-llm-v2')) return 'retell-llm-v2';
      if (protocols.has('retell-llm')) return 'retell-llm';
      return false;
    },
  });

  // Log toutes les tentatives d'upgrade HTTP
  server.on('upgrade', (req, _socket, _head) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress;
    const proto = req.headers['sec-websocket-protocol'] || 'none';
    console.log(`[WS-UPGRADE] ${req.url} | IP:${ip} | Proto:${proto}`);
  });

  wss.on('connection', (ws, req) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress;
    console.log(`[WS-OPEN] IP=${ip}`);

    let ctx: SessionContext = {
      callId: '',
      restaurant: null,
      customer: null,
      orderState: { articles: [], type: 'inconnu', total_estime: 0 },
      history: [],
      upsellDone: false,
      notificationSent: false,
      clientSmsSent: false,
      language: 'fr',
      callerPhone: '',
      callStartTime: Date.now(),
    };

    ws.on('message', async (raw) => {
      try {
        const rawStr = raw.toString();
        console.log(`[WS-MSG] ${rawStr.substring(0, 300)}`);
        const msg = JSON.parse(rawStr) as RetellMessage;

        // ─── call_details : premier message Retell → envoyer salutation ────
        if (msg.interaction_type === 'call_details' && msg.call) {
          ctx.callId = msg.call.call_id;
          ctx.callerPhone = msg.call.from_number || '';
          const toNumber = msg.call.to_number || '';

          console.log(`[WS-CALL] callId=${ctx.callId} from=${ctx.callerPhone} to=${toNumber}`);

          // Trouver le restaurant (async, mais on envoie la salutation avant)
          const [restaurant] = await Promise.all([
            findRestaurantByPhone(toNumber),
          ]);
          ctx.restaurant = restaurant;

          // Trouver/créer le client
          if (ctx.callerPhone && ctx.restaurant) {
            ctx.customer = await findOrCreateCustomer(ctx.callerPhone, ctx.restaurant.id);
          }

          // Initialiser l'historique
          const immediateGreeting = `Bonjour, ${ctx.restaurant?.name ? ctx.restaurant.name + ', ' : ''}Alex à l'appareil, que puis-je faire pour vous ?`;
          ctx.history = [
            { role: 'system', content: buildSystemPrompt(ctx) },
            { role: 'assistant', content: immediateGreeting },
          ];

          // FIX: response_id doit être 0 pour la réponse à call_details
          ws.send(JSON.stringify({
            response_type: 'response',
            response_id: 0,
            content: immediateGreeting,
            content_complete: true,
            end_call: false,
          }));
          console.log('[WS-GREETING] Salutation envoyée (response_id=0)');

          // Sauvegarder appel en cours
          await db.from('calls').upsert({
            retell_call_id: ctx.callId,
            restaurant_id: ctx.restaurant?.id ?? null,
            customer_id: ctx.customer?.id ?? null,
            from_number: ctx.callerPhone,
            to_number: toNumber,
            status: 'in_progress',
            started_at: new Date().toISOString(),
          });

          console.log(`[WS-READY] Restaurant: ${ctx.restaurant?.name ?? 'inconnu'} | Client: ${ctx.callerPhone}`);
          return;
        }

        // ─── response_required : le client a parlé → répondre ────────────
        if (msg.interaction_type === 'response_required' && msg.transcript) {
          const lastUserMsg = msg.transcript.filter(t => t.role === 'user').pop();
          if (!lastUserMsg) return;

          // Détecter langue
          const userText = lastUserMsg.content.toLowerCase();
          if (ctx.history.length <= 2) {
            if (/[\u0600-\u06FF]/.test(lastUserMsg.content)) ctx.language = 'ar';
            else if (/\b(hello|hi|yes|no|please|i want|order)\b/.test(userText)) ctx.language = 'en';
          }

          ctx.history.push({ role: 'user', content: lastUserMsg.content });

          // Appel Claude
          const response = await anthropic.messages.create({
            model: config.anthropic.model,
            max_tokens: 500,
            messages: ctx.history.slice(1).map(h => ({
              role: h.role === 'system' ? 'user' : (h.role as 'user' | 'assistant'),
              content: h.content,
            })),
            system: ctx.history[0].content,
          });

          const agentText = response.content[0].type === 'text' ? response.content[0].text : '...';
          ctx.history.push({ role: 'assistant', content: agentText });

          const isRecap = /récap|récapitulatif|votre commande est|total.*€|confirme votre commande/i.test(agentText);
          if (isRecap && !ctx.notificationSent) {
            finalizeCall(ctx).catch(console.error);
          }

          ws.send(JSON.stringify({
            response_type: 'response',
            response_id: msg.response_id ?? 1,
            content: agentText,
            content_complete: true,
            end_call: false,
          }));
        }

        // ─── reminder_required : Retell relance → répéter ────────────────
        if (msg.interaction_type === 'reminder_required') {
          ws.send(JSON.stringify({
            response_type: 'response',
            response_id: msg.response_id ?? 1,
            content: "Je suis toujours là, que puis-je faire pour vous ?",
            content_complete: true,
            end_call: false,
          }));
        }

      } catch (err) {
        console.error('[WS-ERR]', err);
      }
    });

    ws.on('close', async (code, reason) => {
      console.log(`[WS-CLOSE] callId=${ctx.callId || 'EMPTY'} code=${code} reason=${reason.toString() || 'none'}`);
      await finalizeCall(ctx).catch(console.error);
      if (ctx.callId) {
        await saveCall(ctx.callId, ctx, 'completed').catch(console.error);
        await db.from('calls').update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_seconds: Math.round((Date.now() - ctx.callStartTime) / 1000),
        }).eq('retell_call_id', ctx.callId);
      }
    });

    ws.on('error', (err) => console.error(`[WS-ERR] ${err.message}`));
  });

  console.log('[WS] WebSocket LLM monté sur /llm-websocket');
}
