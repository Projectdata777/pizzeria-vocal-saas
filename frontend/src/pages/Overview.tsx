import { useEffect, useState } from 'react'
import { api, DashboardOverview, SaasRevenue } from '../api/client'
import { Phone, ShoppingBag, TrendingUp, Users, Store, Euro, BarChart2, Percent } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function StatCard({ icon: Icon, label, value, sub, color = 'red' }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string
}) {
  const colors: Record<string, string> = {
    red: 'text-red-400 bg-red-900/20 border-red-700/30',
    green: 'text-green-400 bg-green-900/20 border-green-700/30',
    blue: 'text-blue-400 bg-blue-900/20 border-blue-700/30',
    yellow: 'text-yellow-400 bg-yellow-900/20 border-yellow-700/30',
    purple: 'text-purple-400 bg-purple-900/20 border-purple-700/30',
  }
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-2.5 rounded-lg border ${colors[color]}`}>
        <Icon size={20} className={colors[color].split(' ')[0]} />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function Overview() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [saas, setSaas] = useState<SaasRevenue | null>(null)
  const [revenueData, setRevenueData] = useState<{ date: string; revenue: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getOverview(),
      api.getSaasRevenue(),
      api.getRevenue('month'),
    ]).then(([ov, sv, rv]) => {
      setOverview(ov)
      setSaas(sv)
      setRevenueData(rv)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Chargement...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Vue d'ensemble</h1>
        <p className="text-gray-500 text-sm mt-1">Tableau de bord en temps réel</p>
      </div>

      {/* KPIs SaaS (pour Fery) */}
      {saas && (
        <div className="card border-purple-700/40 bg-purple-900/10">
          <p className="text-xs text-purple-400 font-semibold uppercase tracking-wider mb-3">💜 Revenus SaaS (vos abonnements)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-xs text-gray-500">MRR</p><p className="text-xl font-bold text-white">{saas.mrr}€</p></div>
            <div><p className="text-xs text-gray-500">ARR</p><p className="text-xl font-bold text-white">{saas.arr}€</p></div>
            <div><p className="text-xs text-gray-500">Restaurants actifs</p><p className="text-xl font-bold text-white">{saas.restaurants_active}</p></div>
            <div><p className="text-xs text-gray-500">Panier moyen/resto</p><p className="text-xl font-bold text-white">{saas.avg_revenue_per_restaurant}€</p></div>
          </div>
        </div>
      )}

      {/* Stats opérationnelles */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Phone} label="Appels aujourd'hui" value={overview.calls_today} sub={`${overview.calls_total} total`} color="blue" />
          <StatCard icon={ShoppingBag} label="Commandes aujourd'hui" value={overview.orders_today} sub={`Panier moyen : ${overview.avg_basket}€`} color="green" />
          <StatCard icon={Euro} label="CA aujourd'hui" value={`${overview.revenue_today}€`} sub={`Ce mois : ${overview.revenue_month}€`} color="yellow" />
          <StatCard icon={Percent} label="Taux de conversion" value={`${overview.conversion_rate}%`} sub="appels → commandes" color="red" />
          <StatCard icon={Users} label="Clients total" value={overview.customers_total} color="purple" />
          <StatCard icon={Store} label="Restaurants" value={overview.restaurants} color="blue" />
        </div>
      )}

      {/* Graphique revenus */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-4">Revenus des 30 derniers jours</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={revenueData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(v: number) => [`${v.toFixed(2)}€`, 'Revenus']}
            />
            <Area type="monotone" dataKey="revenue" stroke="#dc2626" fill="url(#revGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
