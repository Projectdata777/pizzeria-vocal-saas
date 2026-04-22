import { createClient } from '@supabase/supabase-js';
import config from '../config';

export const db = createClient(config.supabase.url, config.supabase.serviceKey);

// Types utilitaires
export interface Restaurant {
  id: string;
  name: string;
  type: 'pizza' | 'kebab' | 'fastfood' | 'autre';
  address: string | null;
  phone: string | null;
  owner_phone: string;
  owner_email: string | null;
  retell_agent_id: string | null;
  retell_phone: string | null;
  zadarma_number: string | null;
  config_json: Record<string, unknown>;
  menu_id: string | null;
  is_active: boolean;
  plan: 'trial' | 'starter' | 'pro';
  monthly_price: number;
  created_at: string;
}

export interface Customer {
  id: string;
  restaurant_id: string;
  phone: string;
  first_name: string | null;
  last_name: string | null;
  order_count: number;
  total_spent: number;
  loyalty_points: number;
  is_vip: boolean;
  favorite_items: string[];
  last_order_date: string | null;
  sms_opt_out: boolean;
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
  call_id: string | null;
  customer_id: string | null;
  items: OrderItem[];
  type: 'livraison' | 'retrait' | 'sur_place';
  delivery_address: string | null;
  subtotal: number;
  total: number;
  promo_code: string | null;
  status: string;
  created_at: string;
}

export interface Call {
  id: string;
  restaurant_id: string | null;
  retell_call_id: string | null;
  from_number: string | null;
  to_number: string | null;
  customer_id: string | null;
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
}
