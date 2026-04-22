const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const api = {
  // Dashboard
  getOverview: () => request<DashboardOverview>('/dashboard/overview'),
  getSaasRevenue: () => request<SaasRevenue>('/saas/revenue'),

  // Restaurants
  getRestaurants: () => request<Restaurant[]>('/restaurants'),
  getRestaurant: (id: string) => request<Restaurant>(`/restaurants/${id}`),
  createRestaurant: (data: Partial<Restaurant>) => request<Restaurant>('/restaurants', { method: 'POST', body: JSON.stringify(data) }),
  updateRestaurant: (id: string, data: Partial<Restaurant>) => request<Restaurant>(`/restaurants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateDelay: (id: string, delay: number) => request(`/restaurants/${id}/delay`, { method: 'PUT', body: JSON.stringify({ delay_minutes: delay }) }),
  getRestaurantStats: (id: string) => request<RestaurantStats>(`/restaurants/${id}/stats`),

  // Appels
  getCalls: (params?: { limit?: number; restaurant_id?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.restaurant_id) q.set('restaurant_id', params.restaurant_id);
    return request<Call[]>(`/calls?${q}`);
  },
  getCall: (id: string) => request<Call>(`/calls/${id}`),

  // Commandes
  getOrders: (params?: { limit?: number; restaurant_id?: string; period?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.restaurant_id) q.set('restaurant_id', params.restaurant_id);
    if (params?.period) q.set('period', params.period);
    return request<Order[]>(`/orders?${q}`);
  },
  getRevenue: (period: string) => request<RevenuePoint[]>(`/orders/revenue?period=${period}`),

  // Clients
  getCustomers: (restaurant_id?: string) => {
    const q = restaurant_id ? `?restaurant_id=${restaurant_id}` : '';
    return request<Customer[]>(`/customers${q}`);
  },
  getBestCustomer: (period: string) => request<BestCustomerResponse>(`/customers/best?period=${period}`),

  // Relances
  getRelances: (restaurant_id?: string) => {
    const q = restaurant_id ? `?restaurant_id=${restaurant_id}` : '';
    return request<SmsRelance[]>(`/relances${q}`);
  },
  sendCampaign: (data: CampaignPayload) => request<{ sent: number }>('/relances/campaign', { method: 'POST', body: JSON.stringify(data) }),
  sendAutoRelance: (restaurant_id: string) => request<{ sent: number }>('/relances/auto', { method: 'POST', body: JSON.stringify({ restaurant_id }) }),

  // Menus
  getMenuTemplates: () => request<MenuTemplate[]>('/menus/templates'),
  getMenuTemplate: (id: string) => request<MenuTemplate>(`/menus/templates/${id}`),
  getRestaurantMenus: (id: string) => request<Menu[]>(`/restaurants/${id}/menus`),
  createMenu: (restaurant_id: string, data: Partial<Menu>) => request<Menu>(`/restaurants/${restaurant_id}/menus`, { method: 'POST', body: JSON.stringify(data) }),

  // Agents
  getAgents: () => request<RetellAgent[]>('/agents'),
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardOverview {
  restaurants: number;
  calls_today: number;
  calls_total: number;
  orders_today: number;
  revenue_today: string;
  revenue_month: string;
  avg_basket: string;
  customers_total: number;
  conversion_rate: number;
}

export interface SaasRevenue {
  mrr: string;
  restaurants_total: number;
  restaurants_active: number;
  arr: string;
  avg_revenue_per_restaurant: string;
}

export interface Restaurant {
  id: string;
  name: string;
  type: 'pizza' | 'kebab' | 'fastfood' | 'autre';
  address: string | null;
  phone: string | null;
  owner_phone: string;
  retell_agent_id: string | null;
  retell_phone: string | null;
  config_json: Record<string, unknown>;
  is_active: boolean;
  plan: string;
  monthly_price: number;
  created_at: string;
}

export interface RestaurantStats {
  calls_today: number;
  orders_today: number;
  revenue_today: string;
}

export interface Call {
  id: string;
  restaurant_id: string | null;
  retell_call_id: string | null;
  from_number: string | null;
  status: string;
  call_successful: boolean | null;
  user_sentiment: string | null;
  transcript: string | null;
  summary: string | null;
  recording_url: string | null;
  duration_seconds: number;
  intent: string | null;
  started_at: string;
  ended_at: string | null;
  restaurants?: { name: string; type: string };
}

export interface OrderItem {
  nom: string;
  qte: number;
  prix: number;
  notes?: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  items: OrderItem[];
  type: string;
  delivery_address: string | null;
  total: number;
  status: string;
  created_at: string;
  restaurants?: { name: string };
  customers?: { first_name: string; phone: string };
}

export interface Customer {
  id: string;
  restaurant_id: string;
  phone: string;
  first_name: string | null;
  order_count: number;
  total_spent: number;
  loyalty_points: number;
  is_vip: boolean;
  favorite_items: string[];
  last_order_date: string | null;
}

export interface BestCustomerResponse {
  period: string;
  best: Customer & { period_spent: string; period_orders: number } | null;
  top5: Array<Customer & { period_spent: string; period_orders: number }>;
}

export interface SmsRelance {
  id: string;
  restaurant_id: string;
  phone_to: string;
  message: string;
  promo_code: string | null;
  status: string;
  sent_at: string | null;
  campaign_name: string | null;
  created_at: string;
  customers?: { first_name: string; phone: string };
}

export interface CampaignPayload {
  restaurant_id: string;
  campaign_name: string;
  message: string;
  promo_code?: string;
  discount_pct?: number;
  trigger_type?: string;
  inactive_days?: number;
}

export interface RevenuePoint {
  date: string;
  revenue: number;
}

export interface MenuTemplate {
  id: string;
  enseigne: string;
  type: string;
  emoji: string;
  couleur: string;
  categories_count: number;
  items_count: number;
}

export interface Menu {
  id: string;
  restaurant_id: string;
  name: string;
  type: string;
  categories: unknown[];
  is_active: boolean;
}

export interface RetellAgent {
  agent_id: string;
  agent_name: string;
  voice_id: string;
  llm_websocket_url?: string;
}
