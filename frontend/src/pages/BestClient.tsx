import { useEffect, useState } from 'react'
import { api, BestCustomerResponse } from '../api/client'
import { Trophy, Star, ShoppingBag, Euro } from 'lucide-react'

type Period = 'day' | 'week' | 'month'

export default function BestClientPage() {
  const [data, setData] = useState<BestCustomerResponse | null>(null)
  const [period, setPeriod] = useState<Period>('day')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getBestCustomer(period)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  const periodLabel = { day: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois' }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Meilleur client</h1>
          <p className="text-gray-500 text-sm">Classement par dépenses</p>
        </div>
        <div className="flex gap-2">
          {(['day','week','month'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {periodLabel[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Chargement...</div>
      ) : !data?.best ? (
        <div className="card text-center py-16 text-gray-500">
          <Trophy size={48} className="mx-auto mb-3 opacity-20" />
          <p>Aucune commande sur cette période</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Winner card */}
          <div className="card border-yellow-600/40 bg-yellow-900/10">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={20} className="text-yellow-400" />
              <span className="text-sm font-semibold text-yellow-400">🥇 #1 — {periodLabel[period]}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-yellow-900/40 border-2 border-yellow-600/50 flex items-center justify-center text-2xl">
                {data.best.is_vip ? '⭐' : '👤'}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white">
                  {data.best.first_name || 'Client anonyme'}
                  {data.best.is_vip && <span className="ml-2 text-xs badge-yellow">VIP</span>}
                </h2>
                <p className="text-gray-400 text-sm">{data.best.phone}</p>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-green-400">
                    <Euro size={14} />
                    <span className="font-bold">{parseFloat(data.best.period_spent).toFixed(2)}€</span>
                    <span className="text-gray-500 text-xs">dépensés</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-blue-400">
                    <ShoppingBag size={14} />
                    <span className="font-bold">{data.best.period_orders}</span>
                    <span className="text-gray-500 text-xs">commandes</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-yellow-400">
                    <Star size={14} />
                    <span className="font-bold">{data.best.loyalty_points}</span>
                    <span className="text-gray-500 text-xs">points</span>
                  </div>
                </div>
              </div>
            </div>
            {data.best.favorite_items?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-yellow-700/30">
                <p className="text-xs text-gray-500 mb-1">Plats favoris</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.best.favorite_items.map((item, i) => (
                    <span key={i} className="badge-yellow">{item}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Top 5 */}
          {data.top5.length > 1 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-3">Top 5</h2>
              <div className="space-y-3">
                {data.top5.map((c, idx) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="w-6 text-center text-sm font-bold text-gray-500">#{idx + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{c.first_name || 'Anonyme'} {c.is_vip && '⭐'}</p>
                      <p className="text-xs text-gray-500">{c.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-400">{parseFloat(c.period_spent).toFixed(2)}€</p>
                      <p className="text-xs text-gray-500">{c.period_orders} cmd</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
