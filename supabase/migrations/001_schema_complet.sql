-- ============================================================
-- PIZZERIA VOCAL SAAS — Schéma Supabase complet
-- Multi-tenant : un compte SaaS → N restaurants
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- recherche texte

-- ─── 1. RESTAURANTS (anciennement "pizzerias") ─────────────────────────────
create table if not exists restaurants (
  id            uuid primary key default uuid_generate_v4(),
  -- Infos restaurant
  name          text not null,
  type          text not null check (type in ('pizza','kebab','fastfood','autre')) default 'pizza',
  address       text,
  phone         text,                          -- numéro public du restaurant
  owner_phone   text not null,                 -- numéro du patron (notifications)
  owner_email   text,
  -- Agent vocal
  retell_agent_id   text,                      -- ID agent Retell AI
  retell_phone      text,                      -- numéro Retell assigné
  zadarma_number    text,                      -- numéro SIP Zadarma (si utilisé)
  -- Config
  config_json   jsonb default '{}',            -- horaires, délai, zone livraison, etc.
  menu_id       uuid,                          -- référence vers menu actif
  is_active     boolean default true,
  plan          text default 'trial' check (plan in ('trial','starter','pro')),
  plan_start    timestamptz,
  monthly_price numeric(8,2) default 99.00,
  -- Timestamps
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── 2. MENUS ───────────────────────────────────────────────────────────────
create table if not exists menus (
  id            uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  name          text not null default 'Menu principal',
  type          text check (type in ('pizza','kebab','fastfood','autre')) default 'pizza',
  categories    jsonb not null default '[]',   -- tableau de catégories + items
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Lier le menu actif après création
alter table restaurants add constraint fk_menu foreign key (menu_id) references menus(id) on delete set null;

-- ─── 3. CLIENTS ─────────────────────────────────────────────────────────────
create table if not exists customers (
  id            uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  phone         text not null,
  first_name    text,
  last_name     text,
  email         text,
  -- Fidélité
  order_count   int default 0,
  total_spent   numeric(10,2) default 0,
  loyalty_points int default 0,
  is_vip        boolean default false,
  -- Préférences
  favorite_items  jsonb default '[]',
  language        text default 'fr',
  -- Relances
  last_order_date timestamptz,
  last_sms_date   timestamptz,
  sms_opt_out     boolean default false,
  -- Timestamps
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (restaurant_id, phone)
);

-- ─── 4. APPELS ──────────────────────────────────────────────────────────────
create table if not exists calls (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid references restaurants(id) on delete set null,
  retell_call_id  text unique,
  -- Numéros
  from_number     text,
  to_number       text,
  customer_id     uuid references customers(id) on delete set null,
  -- Statut
  status          text default 'pending' check (status in ('pending','in_progress','completed','failed')),
  call_successful boolean,
  user_sentiment  text,                        -- positive / neutral / negative
  -- Contenu
  transcript      text,                        -- transcription complète
  summary         text,                        -- résumé Claude
  recording_url   text,                        -- URL enregistrement audio
  -- Métriques
  duration_seconds int default 0,
  intent          text,                        -- ORDER / INFO / COMPLAINT / TRANSFER / CANCEL
  -- Timestamps
  started_at      timestamptz default now(),
  ended_at        timestamptz,
  created_at      timestamptz default now()
);

-- ─── 5. COMMANDES ───────────────────────────────────────────────────────────
create table if not exists orders (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references restaurants(id) on delete cascade,
  call_id         uuid references calls(id) on delete set null,
  customer_id     uuid references customers(id) on delete set null,
  -- Commande
  items           jsonb not null default '[]',  -- [{nom, qte, prix, notes}]
  type            text check (type in ('livraison','retrait','sur_place')) default 'retrait',
  delivery_address text,
  pickup_time     text,
  -- Financier
  subtotal        numeric(8,2) default 0,
  discount        numeric(8,2) default 0,
  total           numeric(8,2) default 0,
  promo_code      text,
  -- Statut
  status          text default 'new' check (status in ('new','confirmed','preparing','ready','delivered','cancelled')),
  notes           text,
  -- Timestamps
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── 6. RELANCES SMS ────────────────────────────────────────────────────────
create table if not exists sms_relances (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references restaurants(id) on delete cascade,
  customer_id     uuid references customers(id) on delete set null,
  -- SMS
  phone_to        text not null,
  message         text not null,
  promo_code      text,
  discount_pct    int,
  -- Statut
  status          text default 'pending' check (status in ('pending','sent','failed','clicked')),
  twilio_sid      text,
  sent_at         timestamptz,
  -- Campagne
  campaign_name   text,
  trigger_type    text check (trigger_type in ('manual','auto_inactive','auto_birthday','auto_promo')),
  -- Timestamps
  created_at      timestamptz default now()
);

-- ─── 7. CODES PROMO ─────────────────────────────────────────────────────────
create table if not exists promo_codes (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references restaurants(id) on delete cascade,
  code            text not null,
  discount_type   text check (discount_type in ('percent','fixed')) default 'percent',
  discount_value  numeric(6,2) not null,
  description     text,
  uses_count      int default 0,
  max_uses        int,
  valid_from      timestamptz default now(),
  valid_until     timestamptz,
  is_active       boolean default true,
  created_at      timestamptz default now(),
  unique (restaurant_id, code)
);

-- ─── 8. KPIs QUOTIDIENS (cache pré-calculé) ──────────────────────────────
create table if not exists daily_kpis (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references restaurants(id) on delete cascade,
  date            date not null,
  -- Appels
  calls_total     int default 0,
  calls_success   int default 0,
  calls_failed    int default 0,
  -- Commandes
  orders_total    int default 0,
  orders_revenue  numeric(10,2) default 0,
  avg_basket      numeric(8,2) default 0,
  conversion_rate numeric(5,2) default 0,  -- % appels → commande
  -- Clients
  new_customers   int default 0,
  returning_customers int default 0,
  -- SMS
  sms_sent        int default 0,
  sms_conversions int default 0,
  unique (restaurant_id, date)
);

-- ─── INDEX PERFORMANCES ─────────────────────────────────────────────────────
create index if not exists idx_calls_restaurant on calls(restaurant_id);
create index if not exists idx_calls_started_at on calls(started_at desc);
create index if not exists idx_orders_restaurant on orders(restaurant_id);
create index if not exists idx_orders_created_at on orders(created_at desc);
create index if not exists idx_customers_restaurant on customers(restaurant_id);
create index if not exists idx_customers_phone on customers(phone);
create index if not exists idx_sms_restaurant on sms_relances(restaurant_id);
create index if not exists idx_daily_kpis on daily_kpis(restaurant_id, date desc);

-- ─── TRIGGERS : updated_at auto ─────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_restaurants_updated before update on restaurants for each row execute function update_updated_at();
create trigger trg_menus_updated before update on menus for each row execute function update_updated_at();
create trigger trg_customers_updated before update on customers for each row execute function update_updated_at();
create trigger trg_orders_updated before update on orders for each row execute function update_updated_at();

-- ─── TRIGGER : MAJ stats client après commande ───────────────────────────────
create or replace function update_customer_stats()
returns trigger as $$
begin
  if (TG_OP = 'INSERT' or TG_OP = 'UPDATE') and new.customer_id is not null then
    update customers set
      order_count = (select count(*) from orders where customer_id = new.customer_id and status != 'cancelled'),
      total_spent = (select coalesce(sum(total),0) from orders where customer_id = new.customer_id and status != 'cancelled'),
      loyalty_points = (select coalesce(sum(total),0) from orders where customer_id = new.customer_id and status != 'cancelled')::int / 5,
      last_order_date = now(),
      updated_at = now()
    where id = new.customer_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_order_customer_stats after insert or update on orders for each row execute function update_customer_stats();

-- ─── RLS (Row Level Security) — désactivé pour MVP, activer en prod ──────────
-- alter table restaurants enable row level security;
-- alter table calls enable row level security;
-- etc.

-- ─── DONNÉES DE DÉMONSTRATION (restaurant test) ──────────────────────────────
insert into restaurants (
  name, type, address, phone, owner_phone, owner_email,
  retell_agent_id, retell_phone,
  config_json, is_active, plan
) values (
  'Bella Napoli', 'pizza',
  '12 rue de la Paix, 75001 Paris',
  '+33189480917',
  '+33620845417',
  'demo@bellanapoli.fr',
  'agent_060c0ce4ebdff9852544a2c74e',
  '+33189480917',
  jsonb_build_object(
    'delay_minutes', 30,
    'delivery_zones', array['75001','75002','75003'],
    'hours', jsonb_build_object(
      'lundi', '11h30-14h30 / 18h30-22h30',
      'mardi', '11h30-14h30 / 18h30-22h30',
      'mercredi', '11h30-14h30 / 18h30-22h30',
      'jeudi', '11h30-14h30 / 18h30-22h30',
      'vendredi', '11h30-14h30 / 18h30-23h00',
      'samedi', '12h00-23h00',
      'dimanche', 'Fermé'
    )
  ),
  true, 'trial'
) on conflict do nothing;
