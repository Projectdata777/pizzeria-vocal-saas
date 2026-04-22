import { useEffect, useState } from 'react'
import { api, Order } from '../api/client'
import { ShoppingBag, TrendingUp, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type Period = 'today' | 'week' | 'month'

const statusLabel: Record<string, { label: string; cls: string }> = {
  new: { label: 'Nouvelle', cls: 'badge-blue' },
  confirmed: { label: 'Confirmée', cls: 'badge-yellow' },
  preparing: { label: 'En préparation', cls: 'badge-yellow' },
  ready: { label: 'Prête', cls: 'badge-green' },
  delivered: { label: 'Livrée', cls: 'badge-green' },
  cancelled: { label: 'Annulée', cls: 'badge-red' },
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [revenueData, setRevenueData] = useState<{ date: string; revenue: number }[]>([])
  const [period, setPeriod] = useState<Period>('today')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getOrders({ limit: 100, period }),
      api.getRevenue(period === 'today' ? 'week' : period),
    ]).then(([o, r]) => {
      setOrders(o)
      setRevenueData(r)
    }).finally(() => setLoading(false))
  }, [period])

  const totalRevenue = orders.reduce((s, o) => s + parseFloat(String(o.total || 0)), 0)
  const avgBasket = orders.length ? totalRevenue / orders.length : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Commandes</h1>
          <p className="text-gray-500 text-sm">{orders.length} commandes — {totalRevenue.toFixed(2)}€ de CA</p>
        </div>
        <div className="flex gap-2">
          {(['today','week','month'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {p === 'today' ? "Aujourd'hui" : p === 'week' ? '7 jours' : '30 jours'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">Commandes</p>
          <p className="text-2xl font-bold text-white">{orders.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">CA total</p>
          <p className="text-2xl font-bold text-green-400">{totalRevenue.toFixed(2)}€</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">Panier moyen</p>
          <p className="text-2xl font-bold text-yellow-400">{avgBasket.toFixed(2)}€</p>
        </div>
      </div>

      {/* Graphique */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-3">Revenus par jour</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={revenueData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number) => [`${v.toFixed(2)}€`, 'CA']} />
            <Bar dataKey="revenue" fill="#dc2626" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Liste commandes */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">Chargement...</div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucune commande sur cette période</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(order => {
            const st = statusLabel[order.status] ?? { label: order.status, cls: 'badge-gray' }
            return (
              <div key={order.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={st.cls}>{st.label}</span>
                      <span className="badge-blue">{order.type === 'livraison' ? '🚗 Livraison' : '🏃 Retrait'}</span>
                      {order.restaurants && <span className="text-xs text-gray-500">{order.restaurants.name}</span>}
                    </div>
                    <div className="space-y-0.5">
                      {(order.items || []).map((item, i) => (
                        <p key={i} className="text-sm text-gray-300">
                          {item.qte}× {item.nom} — {(item.prix * item.qte).toFixed(2)}€
                          {item.notes && <span className="text-gray-500 text-xs"> ({item.notes})</span>}
                        </p>
                      ))}
                    </div>
                    {order.delivery_address && (
                      <p className="text-xs text-gray-500 mt-1">📍 {order.delivery_address}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-white">{parseFloat(String(order.total)).toFixed(2)}€</p>
                    <p className="text-xs text-gray-500">{format(new Date(order.created_at), 'dd/MM HH:mm', { locale: fr })}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
