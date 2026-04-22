import { useEffect, useState } from 'react'
import { api, SmsRelance, Restaurant } from '../api/client'
import { MessageSquare, Send, Zap, CheckCircle, XCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const statusIcon: Record<string, React.ReactNode> = {
  sent: <CheckCircle size={14} className="text-green-400" />,
  failed: <XCircle size={14} className="text-red-400" />,
  pending: <Clock size={14} className="text-yellow-400" />,
}

export default function RelancesPage() {
  const [relances, setRelances] = useState<SmsRelance[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [sending, setSending] = useState(false)
  const [autoSending, setAutoSending] = useState(false)
  const [form, setForm] = useState({
    restaurant_id: '',
    campaign_name: 'Promotion spéciale',
    message: 'Bonjour {prenom} ! Une offre spéciale vous attend chez votre pizzeria préférée 🍕',
    promo_code: '',
    discount_pct: 15,
    inactive_days: 14,
  })

  useEffect(() => {
    Promise.all([
      api.getRelances(),
      api.getRestaurants(),
    ]).then(([r, rests]) => {
      setRelances(r)
      setRestaurants(rests)
      if (rests.length) setForm(f => ({ ...f, restaurant_id: rests[0].id }))
    }).finally(() => setLoading(false))
  }, [])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    try {
      const result = await api.sendCampaign({
        restaurant_id: form.restaurant_id,
        campaign_name: form.campaign_name,
        message: form.message,
        promo_code: form.promo_code || undefined,
        discount_pct: form.discount_pct,
        inactive_days: form.inactive_days,
        trigger_type: 'manual',
      })
      alert(`✅ ${result.sent} SMS envoyé(s) !`)
      setShowForm(false)
      const updated = await api.getRelances()
      setRelances(updated)
    } catch {
      alert('Erreur lors de l\'envoi')
    } finally {
      setSending(false)
    }
  }

  const handleAuto = async () => {
    if (!form.restaurant_id) return
    setAutoSending(true)
    try {
      const result = await api.sendAutoRelance(form.restaurant_id)
      alert(`🚀 Relance automatique : ${result.sent} SMS envoyé(s) aux clients inactifs depuis 14 jours !`)
      const updated = await api.getRelances()
      setRelances(updated)
    } catch {
      alert('Erreur relance automatique')
    } finally {
      setAutoSending(false)
    }
  }

  const sentCount = relances.filter(r => r.status === 'sent').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Relances SMS</h1>
          <p className="text-gray-500 text-sm">{relances.length} relances — {sentCount} envoyées</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleAuto} disabled={autoSending || !form.restaurant_id}
            className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm">
            <Zap size={15} /> {autoSending ? 'Envoi...' : 'Relance auto (inactifs 14j)'}
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <Send size={15} /> Campagne manuelle
          </button>
        </div>
      </div>

      {/* Formulaire campagne */}
      {showForm && (
        <div className="card border-red-700/40">
          <h2 className="text-base font-semibold text-white mb-4">Nouvelle campagne SMS</h2>
          <form onSubmit={handleSend} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Restaurant *</label>
                <select value={form.restaurant_id} onChange={e => setForm(f => ({ ...f, restaurant_id: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none">
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nom de la campagne</label>
                <input value={form.campaign_name} onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Code promo (optionnel)</label>
                <input value={form.promo_code} onChange={e => setForm(f => ({ ...f, promo_code: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none"
                  placeholder="PROMO15" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Inactifs depuis (jours)</label>
                <input type="number" value={form.inactive_days} onChange={e => setForm(f => ({ ...f, inactive_days: parseInt(e.target.value) }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
                  min="1" max="365" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Message SMS (utilisez {'{prenom}'} pour personnaliser)</label>
              <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none h-20 resize-none" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={sending} className="btn-primary">{sending ? 'Envoi en cours...' : 'Envoyer la campagne'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
            </div>
          </form>
        </div>
      )}

      {/* Liste relances */}
      {loading ? (
        <div className="text-center py-16 text-gray-500">Chargement...</div>
      ) : relances.length === 0 ? (
        <div className="card text-center py-16 text-gray-500">
          <MessageSquare size={48} className="mx-auto mb-3 opacity-20" />
          <p>Aucune relance envoyée</p>
          <p className="text-xs mt-1">Lancez votre première campagne SMS ci-dessus</p>
        </div>
      ) : (
        <div className="space-y-2">
          {relances.map(r => (
            <div key={r.id} className="card">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{statusIcon[r.status] || <Clock size={14} className="text-gray-500" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{r.phone_to}</span>
                    {r.campaign_name && <span className="badge-blue">{r.campaign_name}</span>}
                    {r.promo_code && <span className="badge-yellow">🎁 {r.promo_code}</span>}
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2">{r.message}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {r.sent_at ? format(new Date(r.sent_at), 'dd MMM HH:mm', { locale: fr }) : 'En attente'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
