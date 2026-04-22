import { useEffect, useState } from 'react'
import { api, SaasRevenue, RevenuePoint } from '../api/client'
import { TrendingUp, Euro, BarChart2, Target } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

type Period = 'week' | 'month' | 'year'

export default function RevenuePage() {
  const [saas, setSaas] = useState<SaasRevenue | null>(null)
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([])
  const [period, setPeriod] = useState<Period>('month')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getSaasRevenue(),
      api.getRevenue(period),
    ]).then(([s, r]) => {
      setSaas(s)
      setRevenueData(r)
    }).finally(() => setLoading(false))
  }, [period])

  // Objectif : 10 000€/mois (101 restaurants à 99€)
  const TARGET_MRR = 10000
  const progress = saas ? Math.min(100, (parseFloat(saas.mrr) / TARGET_MRR) * 100) : 0
  const restaurantsNeeded = saas ? Math.max(0, Math.ceil((TARGET_MRR - parseFloat(saas.mrr)) / 99)) : 101

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Revenus</h1>
        <p className="text-gray-500 text-sm">MRR, ARR et performances financières</p>
      </div>

      {/* Progression objectif */}
      <div className="card border-purple-700/40 bg-purple-900/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-purple-400" />
            <span className="text-sm font-semibold text-purple-400">Objectif : 10 000€/mois</span>
          </div>
          <span className="text-2xl font-bold text-white">{saas?.mrr ?? '0'}€</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-3 mb-2">
          <div
            className="bg-gradient-to-r from-red-600 to-purple-600 h-3 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{progress.toFixed(1)}% atteint</span>
          <span>+{restaurantsNeeded} restaurants pour atteindre 10 000€/mois</span>
        </div>
      </div>

      {/* Stats SaaS */}
      {saas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">MRR</p>
            <p className="text-2xl font-bold text-green-400">{saas.mrr}€</p>
            <p className="text-xs text-gray-600">par mois</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">ARR</p>
            <p className="text-2xl font-bold text-blue-400">{saas.arr}€</p>
            <p className="text-xs text-gray-600">par an</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">Restaurants actifs</p>
            <p className="text-2xl font-bold text-white">{saas.restaurants_active}</p>
            <p className="text-xs text-gray-600">sur {saas.restaurants_total} total</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">ARPU</p>
            <p className="text-2xl font-bold text-yellow-400">{saas.avg_revenue_per_restaurant}€</p>
            <p className="text-xs text-gray-600">par restaurant</p>
          </div>
        </div>
      )}

      {/* Graphique CA restaurants */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">CA restaurants (commandes clients)</h2>
          <div className="flex gap-2">
            {(['week','month','year'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${period === p ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                {p === 'week' ? '7j' : p === 'month' ? '30j' : '1an'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={revenueData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number) => [`${v.toFixed(2)}€`, 'Revenus']} />
            <Area type="monotone" dataKey="revenue" stroke="#7c3aed" fill="url(#revGrad2)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Projection */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-3">Projection vers 10 000€/mois</h2>
        <div className="space-y-3 text-sm">
          {[
            { restaurants: 5, mrr: 495, label: 'Palier 1 — Semaine 1' },
            { restaurants: 20, mrr: 1980, label: 'Palier 2 — Mois 1' },
            { restaurants: 50, mrr: 4950, label: 'Palier 3 — Mois 3' },
            { restaurants: 101, mrr: 9999, label: '🎯 Objectif — 10 000€/mois' },
          ].map((p, i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <span className="text-gray-300">{p.label}</span>
                <span className="text-gray-500 text-xs ml-2">({p.restaurants} restaurants)</span>
              </div>
              <span className="text-green-400 font-semibold">{p.mrr.toLocaleString()}€/mois</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
