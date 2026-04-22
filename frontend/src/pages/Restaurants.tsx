import { useEffect, useState } from 'react'
import { api, Restaurant } from '../api/client'
import { Store, Phone, MapPin, Plus, CheckCircle, XCircle } from 'lucide-react'

const typeEmoji: Record<string, string> = { pizza: '🍕', kebab: '🥙', fastfood: '🍔', autre: '🍽️' }
const planBadge: Record<string, string> = { trial: 'badge-yellow', starter: 'badge-blue', pro: 'badge-green' }

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'pizza', address: '', phone: '', owner_phone: '', owner_email: '' })
  const [saving, setSaving] = useState(false)

  const load = () => {
    api.getRestaurants().then(setRestaurants).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.createRestaurant(form)
      setShowForm(false)
      setForm({ name: '', type: 'pizza', address: '', phone: '', owner_phone: '', owner_email: '' })
      load()
    } catch (err) {
      alert('Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Restaurants inscrits</h1>
          <p className="text-gray-500 text-sm">{restaurants.length} restaurant(s)</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Formulaire d'ajout */}
      {showForm && (
        <div className="card border-red-700/40">
          <h2 className="text-base font-semibold text-white mb-4">Nouveau restaurant</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Nom du restaurant *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none"
                placeholder="Bella Napoli" required />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none">
                <option value="pizza">🍕 Pizzeria</option>
                <option value="kebab">🥙 Kebab</option>
                <option value="fastfood">🍔 Fast Food</option>
                <option value="autre">🍽️ Autre</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Numéro du restaurant</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none"
                placeholder="+33123456789" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Téléphone patron (notifications SMS) *</label>
              <input value={form.owner_phone} onChange={e => setForm(f => ({ ...f, owner_phone: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none"
                placeholder="+33612345678" required />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email patron</label>
              <input value={form.owner_email} onChange={e => setForm(f => ({ ...f, owner_email: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none"
                placeholder="patron@restaurant.fr" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Adresse</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none"
                placeholder="12 rue de la Paix, 75001 Paris" />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Création...' : 'Créer le restaurant'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
            </div>
          </form>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="text-center py-16 text-gray-500">Chargement...</div>
      ) : restaurants.length === 0 ? (
        <div className="card text-center py-16 text-gray-500">
          <Store size={48} className="mx-auto mb-3 opacity-20" />
          <p>Aucun restaurant inscrit</p>
          <p className="text-xs mt-1">Ajoutez votre premier restaurant ci-dessus</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {restaurants.map(r => (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{typeEmoji[r.type] || '🍽️'}</span>
                  <div>
                    <h3 className="font-semibold text-white">{r.name}</h3>
                    <span className={planBadge[r.plan] || 'badge-gray'}>{r.plan}</span>
                  </div>
                </div>
                {r.is_active
                  ? <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                  : <XCircle size={16} className="text-red-400 flex-shrink-0" />}
              </div>
              <div className="space-y-1.5 text-sm text-gray-400">
                {r.address && <p className="flex items-center gap-2"><MapPin size={13} />{r.address}</p>}
                {r.phone && <p className="flex items-center gap-2"><Phone size={13} />{r.phone}</p>}
                {r.retell_phone && <p className="flex items-center gap-2 text-blue-400"><Phone size={13} />Agent : {r.retell_phone}</p>}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-500">{r.monthly_price}€/mois</span>
                {r.retell_agent_id
                  ? <span className="badge-green">Agent actif</span>
                  : <span className="badge-red">Pas d'agent</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
