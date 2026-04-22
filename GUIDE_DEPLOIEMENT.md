# Guide de déploiement — Pizzeria Vocal SaaS
## Étape par étape, sans connaissances techniques requises

---

## ÉTAPE 1 — Supabase : créer les tables en base de données

1. Va sur https://supabase.com → **Dashboard** → ton projet → **SQL Editor**
2. Copie tout le contenu du fichier `supabase/migrations/001_schema_complet.sql`
3. Colle dans le SQL Editor → clique **Run**
4. ✅ Toutes les tables sont créées

---

## ÉTAPE 2 — Backend sur Render

1. Va sur https://render.com
2. **New** → **Web Service** → **Deploy from a Git repository**

   > **Si ton code n'est pas sur GitHub :** crée un compte GitHub, puis :
   > - Installe Git sur ton PC (https://git-scm.com)
   > - Ouvre un terminal dans le dossier `backend/`
   > - Tape ces commandes une par une :
   > ```
   > git init
   > git add .
   > git commit -m "Backend v2.0"
   > ```
   > - Crée un repo GitHub et suis les instructions pour "push"

3. Sélectionne ton repo → **Root Directory** = `pizzeria-vocal-saas/backend`
4. **Environment** : Node
5. **Build Command** : `npm install && npm run build`
6. **Start Command** : `npm start`

### Variables d'environnement à remplir dans Render :

| Variable | Valeur |
|----------|--------|
| NODE_ENV | production |
| PORT | 3000 |
| BASE_URL | https://[ton-app].onrender.com |
| RETELL_API_KEY | (depuis ton .env) |
| ZADARMA_API_KEY | (depuis ton .env) |
| ZADARMA_API_SECRET | (depuis ton .env) |
| ZADARMA_SIP_LOGIN | (depuis ton .env) |
| SUPABASE_URL | (depuis ton .env) |
| SUPABASE_SERVICE_KEY | (depuis ton .env) |
| ANTHROPIC_API_KEY | (depuis ton .env) |
| ANTHROPIC_MODEL | claude-haiku-4-5-20251001 |
| TWILIO_ACCOUNT_SID | (depuis ton .env) |
| TWILIO_AUTH_TOKEN | (depuis ton .env) |
| TWILIO_SMS_FROM | (depuis ton .env) |
| TWILIO_WHATSAPP_FROM | (depuis ton .env) |
| WEBHOOK_SECRET | (génère un string aléatoire) |
| ALLOWED_ORIGINS | https://[ton-frontend].vercel.app |

7. Clique **Deploy**
8. Attends 2-3 minutes → l'URL de ton backend s'affiche
9. ✅ Teste : va sur `https://[ton-app].onrender.com/api/health` → tu dois voir `{"status":"ok"}`

---

## ÉTAPE 3 — Frontend sur Vercel

1. Va sur https://vercel.com
2. **Add New** → **Project** → importe ton repo GitHub
3. **Root Directory** = `pizzeria-vocal-saas/frontend`
4. **Framework** : Vite (détecté automatiquement)
5. **Environment Variables** :
   - `VITE_API_URL` = `https://[ton-backend].onrender.com/api`
6. Clique **Deploy**
7. ✅ Le dashboard est en ligne sur `https://[ton-app].vercel.app`

---

## ÉTAPE 4 — Connecter Retell AI au backend

1. Va sur https://app.retellai.com
2. Sélectionne ton agent (`agent_060c0ce4ebdff9852544a2c74e`)
3. **LLM** → choisis **Custom LLM**
4. **WebSocket URL** : `wss://[ton-backend].onrender.com/llm-websocket`
5. Clique **Save**

---

## ÉTAPE 5 — Connecter le webhook Retell

1. Dans Retell AI → **Settings** → **Webhooks**
2. **Webhook URL** : `https://[ton-backend].onrender.com/webhook/retell`
3. Événements à activer : `call_started`, `call_ended`, `call_analyzed`
4. Clique **Save**

---

## ÉTAPE 6 — Test final

1. Appelle le numéro Retell : **+33 1 89 48 09 17**
2. L'agent répond → prend une commande de test
3. Vérifie dans le dashboard (Appels) que l'appel apparaît
4. Vérifie que le patron reçoit un SMS avec la commande

---

## ✅ SYSTÈME OPÉRATIONNEL — Prêt pour la démo !

### Checklist avant démo :
- [ ] Backend répond sur `/api/health`
- [ ] Dashboard accessible sur Vercel
- [ ] Appel test réussi (numéro Retell)
- [ ] SMS patron reçu
- [ ] Restaurant "Bella Napoli" visible dans le dashboard

### Prix de vente :
- **3 premiers mois** : 99€/mois (installation gratuite)
- **Ensuite** : 149€/mois à vie

---

## En cas de problème

Reviens dans BOS et dis exactement ce qui ne marche pas. Je corrige.
