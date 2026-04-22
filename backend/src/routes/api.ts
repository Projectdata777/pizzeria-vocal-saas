/**
 * Routes API — Dashboard + gestion restaurants + relances SMS
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { sendMarketingSms } from '../services/NotificationService';
import { TOUS_LES_MENUS, getMenuByType } from '../data/menus';
import Retell from 'retell-sdk';
import axios from 'axios';
import config from '../config';

const router = Router();
const retell = new Retell({ apiKey: config.retell.apiKey });

// ════════════════════════════════════════════════════════════
//  DASHBOARD — Stats globales
// ════════════════════════════════════════════════════════════

router.get('/dashboard/overview', async (_req: Request, res: Response) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const monthAgo = new Date(Date.now() - 30 * 86400000);

    const [restaurants, callsToday, callsTotal, ordersToday, revenueRes, customersTotal] = await Promise.all([
      db.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_active', true),
      db.from('calls').select('id', { count: 'exact', head: true }).gte('started_at', today.toISOString()),
      db.from('calls').select('id', { count: 'exact', head: true }),
      db.from('orders').select('id, total').gte('created_at', today.toISOString()),
      db.from('orders').select('total').gte('created_at', monthAgo.toISOString()),
      db.from('customers').select('id', { count: 'exact', head: true }),
    ]);

    const revenueToday = (ordersToday.data ?? []).reduce((s, o) => s + parseFloat(o.total ?? 0), 0);
    const revenueMonth = (revenueRes.data ?? []).reduce((s, o) => s + parseFloat(o.total ?? 0), 0);
    const avgBasket = ordersToday.data?.length ? revenueToday / ordersToday.data.length : 0;

    return res.json({
      restaurants: restaurants.count ?? 0,
      calls_today: callsToday.count ?? 0,
      calls_total: callsTotalRes?.count ?? callsTotal.count ?? 0,
      orders_today: ordersToday.data?.length ?? 0,
      revenue_today: revenueToday.toFixed(2),
      revenue_month: revenueMonth.toFixed(2),
      avg_basket: avgBasket.toFixed(2),
      customers_total: customersTotal.count ?? 0,
      conversion_rate: callsToday.count
        ? Math.round(((ordersToday.data?.length ?? 0) / callsToday.count) * 100)
        : 0,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ════════════════════════════════════════════════════════════
//  RESTAURANTS
// ════════════════════════════════════════════════════════════

router.get('/restaurants', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await db
      .from('restaurants')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.get('/restaurants/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await db.from('restaurants').select('*').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ error: 'Restaurant introuvable' });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post('/restaurants', async (req: Request, res: Response) => {
  try {
    const { name, type, address, phone, owner_phone, owner_email, config_json } = req.body;
    if (!name || !owner_phone) return res.status(400).json({ error: 'name et owner_phone requis' });

    const { data, error } = await db.from('restaurants').insert({
      name, type: type || 'pizza', address, phone, owner_phone, owner_email,
      config_json: config_json || {},
    }).select().single();
    if (error) throw error;
    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.patch('/restaurants/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await db.from('restaurants')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// Délai livraison temps réel
router.put('/restaurants/:id/delay', async (req: Request, res: Response) => {
  const { delay_minutes } = req.body;
  if (typeof delay_minutes !== 'number' || delay_minutes < 5 || delay_minutes > 120) {
    return res.status(400).json({ error: 'delay_minutes entre 5 et 120' });
  }
  const { data: current } = await db.from('restaurants').select('config_json').eq('id', req.params.id).single();
  const newConfig = { ...(current?.config_json ?? {}), delay_minutes };
  await db.from('restaurants').update({ config_json: newConfig }).eq('id', req.params.id);
  return res.json({ success: true, delay_minutes });
});

// Stats par restaurant
router.get('/restaurants/:id/stats', async (req: Request, res: Response) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const [calls, orders] = await Promise.all([
      db.from('calls').select('id', { count: 'exact', head: true }).eq('restaurant_id', req.params.id).gte('started_at', today.toISOString()),
      db.from('orders').select('total').eq('restaurant_id', req.params.id).gte('created_at', today.toISOString()),
    ]);
    const revenue = (orders.data ?? []).reduce((s, o) => s + parseFloat(o.total ?? 0), 0);
    return res.json({ calls_today: calls.count ?? 0, orders_today: orders.data?.length ?? 0, revenue_today: revenue.toFixed(2) });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ════════════════════════════════════════════════════════════
//  APPELS
// ════════════════════════════════════════════════════════════

router.get('/calls', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const restaurantId = req.query.restaurant_id as string;

    let query = db.from('calls')
      .select('*, restaurants(name, type)')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (restaurantId) query = query.eq('restaurant_id', restaurantId);

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.get('/calls/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await db.from('calls').select('*').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ error: 'Appel introuvable' });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ════════════════════════════════════════════════════════════
//  COMMANDES
// ════════════════════════════════════════════════════════════

router.get('/orders', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const restaurantId = req.query.restaurant_id as string;
    const period = req.query.period as string; // today, week, month

    let query = db.from('orders')
      .select('*, restaurants(name), customers(first_name, phone)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (restaurantId) query = query.eq('restaurant_id', restaurantId);
    if (period === 'today') {
      const today = new Date(); today.setHours(0,0,0,0);
      query = query.gte('created_at', today.toISOString());
    } else if (period === 'week') {
      query = query.gte('created_at', new Date(Date.now() - 7*86400000).toISOString());
    } else if (period === 'month') {
      query = query.gte('created_at', new Date(Date.now() - 30*86400000).toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// Ventes par période (graphiques)
router.get('/orders/revenue', async (req: Request, res: Response) => {
  try {
    const period = req.query.period as string || 'month'; // week, month, year
    let since: Date;
    if (period === 'week') since = new Date(Date.now() - 7*86400000);
    else if (period === 'year') since = new Date(Date.now() - 365*86400000);
    else since = new Date(Date.now() - 30*86400000);

    const { data, error } = await db
      .from('orders')
      .select('created_at, total')
      .gte('created_at', since.toISOString())
      .order('created_at');

    if (error) throw error;

    // Grouper par jour
    const byDay: Record<string, number> = {};
    for (const order of data ?? []) {
      const day = order.created_at.split('T')[0];
      byDay[day] = (byDay[day] || 0) + parseFloat(order.total ?? 0);
    }

    return res.json(Object.entries(byDay).map(([date, revenue]) => ({ date, revenue: parseFloat(revenue.toFixed(2)) })));
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ════════════════════════════════════════════════════════════
//  CLIENTS
// ════════════════════════════════════════════════════════════

router.get('/customers', async (req: Request, res: Response) => {
  try {
    const restaurantId = req.query.restaurant_id as string;
    let query = db.from('customers').select('*').order('order_count', { ascending: false });
    if (restaurantId) query = query.eq('restaurant_id', restaurantId);
    const { data, error } = await query;
    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// Meilleur client (jour, semaine, mois)
router.get('/customers/best', async (req: Request, res: Response) => {
  try {
    const period = req.query.period as string || 'day';
    let since: Date;
    if (period === 'week') since = new Date(Date.now() - 7*86400000);
    else if (period === 'month') since = new Date(Date.now() - 30*86400000);
    else { since = new Date(); since.setHours(0,0,0,0); }

    const { data, error } = await db
      .from('orders')
      .select('customer_id, total, customers(first_name, last_name, phone, order_count, total_spent, favorite_items)')
      .gte('created_at', since.toISOString())
      .not('customer_id', 'is', null);

    if (error) throw error;

    // Agréger par client
    const byCustomer: Record<string, { info: Record<string, unknown>; spent: number; orders: number }> = {};
    for (const o of data ?? []) {
      if (!o.customer_id) continue;
      if (!byCustomer[o.customer_id]) {
        byCustomer[o.customer_id] = { info: o.customers as Record<string, unknown>, spent: 0, orders: 0 };
      }
      byCustomer[o.customer_id].spent += parseFloat(o.total ?? 0);
      byCustomer[o.customer_id].orders++;
    }

    const ranked = Object.entries(byCustomer)
      .map(([id, c]) => ({ id, ...c.info, period_spent: c.spent.toFixed(2), period_orders: c.orders }))
      .sort((a, b) => parseFloat(b.period_spent as string) - parseFloat(a.period_spent as string));

    return res.json({ period, best: ranked[0] ?? null, top5: ranked.slice(0, 5) });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ════════════════════════════════════════════════════════════
//  RELANCES SMS
// ════════════════════════════════════════════════════════════

// Liste des relances
router.get('/relances', async (req: Request, res: Response) => {
  try {
    const restaurantId = req.query.restaurant_id as string;
    let query = db.from('sms_relances')
      .select('*, customers(first_name, phone)')
      .order('created_at', { ascending: false });
    if (restaurantId) query = query.eq('restaurant_id', restaurantId);
    const { data, error } = await query;
    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// Envoyer une campagne de relance
router.post('/relances/campaign', async (req: Request, res: Response) => {
  try {
    const { restaurant_id, campaign_name, message, promo_code, discount_pct, trigger_type, inactive_days } = req.body;
    if (!restaurant_id || !message) return res.status(400).json({ error: 'restaurant_id et message requis' });

    // Trouver clients éligibles (inactifs depuis N jours, pas opt-out)
    const since = inactive_days ? new Date(Date.now() - inactive_days * 86400000).toISOString() : null;

    let query = db.from('customers')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .eq('sms_opt_out', false)
      .gt('order_count', 0);

    if (since) query = (query as unknown as typeof query).lt('last_order_date', since);

    const { data: customers } = await query;
    if (!customers?.length) return res.json({ sent: 0, message: 'Aucun client éligible' });

    let sent = 0;
    for (const customer of customers) {
      const personalMessage = message
        .replace('{prenom}', customer.first_name || 'cher client')
        .replace('{restaurant}', '');

      const result = await sendMarketingSms({
        clientPhone: customer.phone,
        restaurantName: '',
        message: personalMessage,
        promoCode: promo_code,
      });

      if (result.success) {
        sent++;
        await db.from('sms_relances').insert({
          restaurant_id, customer_id: customer.id, phone_to: customer.phone,
          message: personalMessage, promo_code, discount_pct,
          status: 'sent', twilio_sid: result.sid,
          sent_at: new Date().toISOString(),
          campaign_name, trigger_type: trigger_type || 'manual',
        });
        await db.from('customers').update({ last_sms_date: new Date().toISOString() }).eq('id', customer.id);
      }
    }

    return res.json({ sent, total_eligible: customers.length });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// Relance automatique (cron ou trigger manuel)
router.post('/relances/auto', async (req: Request, res: Response) => {
  try {
    const { restaurant_id } = req.body;

    // Clients inactifs depuis 14 jours
    const since14 = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data: restaurant } = await db.from('restaurants').select('name, config_json').eq('id', restaurant_id).single();
    const restaurantName = restaurant?.name || 'votre restaurant';

    const { data: customers } = await db.from('customers')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .eq('sms_opt_out', false)
      .lt('last_order_date', since14)
      .gt('order_count', 1);

    if (!customers?.length) return res.json({ sent: 0 });

    // Générer un code promo unique
    const promoCode = `RETOUR${Math.random().toString(36).substring(2,7).toUpperCase()}`;
    let sent = 0;

    for (const customer of customers) {
      const msg = `Bonjour ${customer.first_name || ''} ! ${restaurantName} vous manque 😊 Revenez avec -15% sur votre prochaine commande !`;
      const result = await sendMarketingSms({
        clientPhone: customer.phone,
        restaurantName,
        message: msg,
        promoCode,
      });
      if (result.success) {
        sent++;
        await Promise.all([
          db.from('sms_relances').insert({
            restaurant_id, customer_id: customer.id, phone_to: customer.phone,
            message: msg, promo_code: promoCode, discount_pct: 15,
            status: 'sent', sent_at: new Date().toISOString(),
            campaign_name: 'Auto — Relance inactifs 14j',
            trigger_type: 'auto_inactive',
          }),
          db.from('customers').update({ last_sms_date: new Date().toISOString() }).eq('id', customer.id),
          db.from('promo_codes').insert({
            restaurant_id, code: promoCode,
            discount_type: 'percent', discount_value: 15,
            description: `Relance auto — ${customer.first_name}`,
          }),
        ]);
      }
    }

    return res.json({ sent, total_eligible: customers.length, promo_code: promoCode });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ════════════════════════════════════════════════════════════
//  MENUS TEMPLATES
// ════════════════════════════════════════════════════════════

router.get('/menus/templates', (_req: Request, res: Response) => {
  return res.json(TOUS_LES_MENUS.map(m => ({
    id: m.id, enseigne: m.enseigne, type: m.type, emoji: m.emoji, couleur: m.couleur,
    categories_count: m.categories.length,
    items_count: m.categories.reduce((s, c) => s + c.items.length, 0),
  })));
});

router.get('/menus/templates/:id', (req: Request, res: Response) => {
  const menu = TOUS_LES_MENUS.find(m => m.id === req.params.id);
  if (!menu) return res.status(404).json({ error: 'Template introuvable' });
  return res.json(menu);
});

router.get('/menus/templates/type/:type', (req: Request, res: Response) => {
  const type = req.params.type as 'pizza' | 'kebab' | 'fastfood';
  return res.json(getMenuByType(type));
});

// Menus restaurant (DB)
router.get('/restaurants/:id/menus', async (req: Request, res: Response) => {
  const { data, error } = await db.from('menus').select('*').eq('restaurant_id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

router.post('/restaurants/:id/menus', async (req: Request, res: Response) => {
  try {
    const { name, categories, type } = req.body;
    const { data, error } = await db.from('menus').insert({
      restaurant_id: req.params.id, name, categories: categories || [], type,
    }).select().single();
    if (error) throw error;
    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ════════════════════════════════════════════════════════════
//  AGENTS RETELL AI
// ════════════════════════════════════════════════════════════

router.get('/agents', async (_req: Request, res: Response) => {
  try {
    const agents = await retell.agent.list();
    return res.json(agents ?? []);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ════════════════════════════════════════════════════════════
//  SETUP RETELL (one-time endpoint)
// ════════════════════════════════════════════════════════════

router.get('/setup-retell', async (req: Request, res: Response) => {
  try {
    if (req.query.secret !== 'PIZZERIA_SETUP_2024') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const BASE = 'https://pizzeria-vocal-saas-backend.onrender.com';
    const WS_URL = `wss://pizzeria-vocal-saas-backend.onrender.com/llm-websocket`;
    const WEBHOOK_URL = `${BASE}/webhook/retell`;

    // Créer l'agent avec Custom LLM WebSocket (format exact SDK v4)
    const agentRes = await retell.agent.create({
      response_engine: {
        type: 'custom-llm',
        llm_websocket_url: WS_URL,
      } as any,
      voice_id: '11labs-Adrian',
      agent_name: 'Agent Pizzeria IA',
      language: 'fr-FR',
      webhook_url: WEBHOOK_URL,
    });

    const agentId = (agentRes as any).agent_id;

    // Mettre à jour le premier restaurant en base avec l'agent_id
    const { data: restaurants } = await db.from('restaurants').select('id').limit(1);
    if (restaurants && restaurants.length > 0) {
      await db.from('restaurants').update({
        retell_agent_id: agentId,
        updated_at: new Date().toISOString(),
      }).eq('id', restaurants[0].id);
    }

    return res.json({
      success: true,
      agent_id: agentId,
      ws_url: WS_URL,
      webhook_url: WEBHOOK_URL,
      message: '✅ Agent Retell créé et configuré avec succès !',
    });
  } catch (err: any) {
    return res.status(500).json({ error: String(err), details: err?.message || '' });
  }
});

// ════════════════════════════════════════════════════════════
//  KPIs REVENUS SAAS (pour Fery)
// ════════════════════════════════════════════════════════════

router.get('/saas/revenue', async (_req: Request, res: Response) => {
  try {
    const { data: restaurants } = await db
      .from('restaurants')
      .select('id, name, monthly_price, plan, is_active, plan_start, created_at');

    const activeRestaurants = (restaurants ?? []).filter(r => r.is_active);
    const mrr = activeRestaurants.reduce((s, r) => s + parseFloat(r.monthly_price || 99), 0);

    return res.json({
      mrr: mrr.toFixed(2),                           // Monthly Recurring Revenue
      restaurants_total: restaurants?.length ?? 0,
      restaurants_active: activeRestaurants.length,
      arr: (mrr * 12).toFixed(2),                    // Annual Recurring Revenue
      avg_revenue_per_restaurant: activeRestaurants.length
        ? (mrr / activeRestaurants.length).toFixed(2) : '0',
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ════════════════════════════════════════════════════════════
//  SETUP PHONE (Twilio → Retell)
// ════════════════════════════════════════════════════════════

router.get('/setup-phone', async (req: Request, res: Response) => {
  try {
    if (req.query.secret !== 'PIZZERIA_SETUP_2024') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const AGENT_ID = 'agent_39579a2a3b3231a1c456ed991c';
    const ZADARMA_NUMBER = '+33620845417';

    // Importer le numéro Zadarma dans Retell
    const phoneRes = await retell.phoneNumber.import({
      phone_number: ZADARMA_NUMBER,
      termination_uri: 'sip.zadarma.com',
      inbound_agent_id: AGENT_ID,
      nickname: 'Pizzeria IA — Zadarma FR',
    } as any);

    return res.json({
      success: true,
      phone_number: ZADARMA_NUMBER,
      agent_id: AGENT_ID,
      retell_data: phoneRes,
      message: '✅ Numéro Zadarma importé dans Retell !',
      next_step: 'Configurer Zadarma pour envoyer les appels entrants vers le SIP Retell',
    });
  } catch (err: any) {
    return res.status(500).json({ error: String(err), details: err?.response?.data || err?.message });
  }
});

// ════════════════════════════════════════════════════════════
//  SETUP ZADARMA → RETELL SIP routing
// ════════════════════════════════════════════════════════════

router.get('/setup-zadarma', async (req: Request, res: Response) => {
  try {
    if (req.query.secret !== 'PIZZERIA_SETUP_2024') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const crypto = require('crypto');
    const apiKey = config.zadarma.apiKey;
    const apiSecret = config.zadarma.apiSecret;
    const ZADARMA_NUMBER = '+33189480917';
    const AGENT_ID = 'agent_39579a2a3b3231a1c456ed991c';

    function zadarmaAuth(method: string, path: string, params: Record<string,string>): string {
      const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
      const md5 = crypto.createHash('md5').update(sorted).digest('hex');
      const signStr = method.toUpperCase() + path + sorted + md5;
      const hmac = crypto.createHmac('sha1', apiSecret).update(signStr).digest('base64');
      return `${apiKey}:${hmac}`;
    }

    // 1. D'abord supprimer l'ancien import Retell (mauvais numéro +33620845417)
    try {
      await retell.phoneNumber.delete('+33620845417');
    } catch (_) { /* ignore si inexistant */ }

    // 2. Importer le bon numéro Zadarma dans Retell
    let retellPhone: any;
    try {
      retellPhone = await retell.phoneNumber.retrieve(ZADARMA_NUMBER);
    } catch (_) {
      retellPhone = await retell.phoneNumber.import({
        phone_number: ZADARMA_NUMBER,
        termination_uri: 'sip.zadarma.com',
        inbound_agent_id: AGENT_ID,
        nickname: 'Pizzeria IA — Zadarma FR',
      } as any);
    }

    // 3. Configurer le routing Zadarma via leur API
    const path = '/v1/direct_numbers/routing/';
    const params: Record<string,string> = {
      number: ZADARMA_NUMBER,
      type: 'sip',
      destination: 'sip.retellai.com',
    };
    const auth = zadarmaAuth('POST', path, params);

    let zadarmaResult: any = null;
    try {
      const zdRes = await axios.post(`https://api.zadarma.com${path}`, new URLSearchParams(params), {
        headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      zadarmaResult = zdRes.data;
    } catch (zdErr: any) {
      zadarmaResult = { error: zdErr?.response?.data || String(zdErr) };
    }

    // 4. Mettre à jour le restaurant en base avec le bon agent_id et numéro
    const { data: restaurants } = await db.from('restaurants').select('id').limit(1);
    if (restaurants && restaurants.length > 0) {
      await db.from('restaurants').update({
        retell_agent_id: AGENT_ID,
        retell_phone: ZADARMA_NUMBER,
        updated_at: new Date().toISOString(),
      }).eq('id', restaurants[0].id);
    }

    return res.json({
      success: true,
      retell_number: ZADARMA_NUMBER,
      retell_agent_id: AGENT_ID,
      retell_phone_data: retellPhone,
      zadarma_routing: zadarmaResult,
      message: zadarmaResult?.error
        ? '⚠️ Retell OK mais config Zadarma manuelle requise'
        : '✅ Tout configuré ! Appelez le +33189480917 pour tester.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: String(err), details: err?.response?.data || err?.message });
  }
});

// ════════════════════════════════════════════════════════════
//  SANTÉ + TEST
// ════════════════════════════════════════════════════════════

router.get('/health', (_req, res) => res.json({
  status: 'ok', service: 'Pizzeria Vocal SaaS', version: '2.0.0',
  uptime: Math.round(process.uptime()), timestamp: new Date().toISOString(),
}));

// Variable de fix pour TypeScript
const callsTotalRes = null as { count: number | null } | null;

export default router;
