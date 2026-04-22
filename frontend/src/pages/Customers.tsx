import { useEffect, useState } from 'react'
import { api, Customer } from '../api/client'
import { Users, Star, ShoppingBag } from 'lucide-react'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.getCustomers().then(setCustomers).catch(console.error).finally(() => setLoading(false))
  }, [])

  const filtered = customers.filter(c =>
    !search || c.phone.includes(search) || (c.first_name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Clients</h1>
        <p className="text-gray-500 text-sm">{customers.length} client(s) enregistrés</p>
      </div>

      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher par nom ou téléphone..."
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none"
      />

      {loading ? (
        <div className="text-center py-16 text-gray-500">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 text-gray-500">
          <Users size={48} className="mx-auto mb-3 opacity-20" />
          <p>Aucun client trouvé</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-sm font-bold text-white">
                  {c.first_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{c.first_name || 'Client'}</span>
                    {c.is_vip && <span className="badge-yellow">⭐ VIP</span>}
                  </div>
                  <p className="text-xs text-gray-500">{c.phone}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><ShoppingBag size={11} />{c.order_count} cmd</span>
                    <span className="text-green-400 font-medium">{parseFloat(String(c.total_spent)).toFixed(2)}€</span>
                    <span className="flex items-center gap-1"><Star size={11} />{c.loyalty_points} pts</span>
                  </div>
                  {c.last_order_date && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      Dernière cmd : {new Date(c.last_order_date).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
              </div>
              {c.favorite_items?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.favorite_items.slice(0, 3).map((item, i) => (
                    <span key={i} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{item}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
