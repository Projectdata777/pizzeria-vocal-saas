import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Phone, ShoppingBag, Users, Store, MessageSquare,
  BookOpen, Bot, TrendingUp, Trophy, ChevronRight, Menu as MenuIcon, X
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

// Pages
import Overview from './pages/Overview'
import CallsPage from './pages/Calls'
import OrdersPage from './pages/Orders'
import CustomersPage from './pages/Customers'
import RestaurantsPage from './pages/Restaurants'
import RelancesPage from './pages/Relances'
import MenusPage from './pages/Menus'
import AgentsPage from './pages/Agents'
import RevenuePage from './pages/Revenue'
import BestClientPage from './pages/BestClient'

const navItems = [
  { to: '/',           icon: LayoutDashboard, label: 'Vue d\'ensemble' },
  { to: '/calls',      icon: Phone,           label: 'Appels' },
  { to: '/orders',     icon: ShoppingBag,     label: 'Commandes' },
  { to: '/customers',  icon: Users,           label: 'Clients' },
  { to: '/best',       icon: Trophy,          label: 'Meilleur client' },
  { to: '/restaurants',icon: Store,           label: 'Restaurants' },
  { to: '/relances',   icon: MessageSquare,   label: 'Relances SMS' },
  { to: '/menus',      icon: BookOpen,        label: 'Menus' },
  { to: '/agents',     icon: Bot,             label: 'Agents vocaux' },
  { to: '/revenue',    icon: TrendingUp,      label: 'Revenus' },
]

function Sidebar({ mobile, onClose }: { mobile?: boolean; onClose?: () => void }) {
  return (
    <aside className={clsx(
      'flex flex-col bg-gray-900 border-r border-gray-800',
      mobile ? 'w-72 h-full' : 'w-64 min-h-screen sticky top-0'
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍕</span>
          <div>
            <p className="font-bold text-white text-sm leading-tight">Pizzeria Vocal AI</p>
            <p className="text-xs text-gray-500">Dashboard</p>
          </div>
        </div>
        {mobile && onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-all',
              isActive
                ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}
            onClick={onClose}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800">
        <p className="text-xs text-gray-600">v2.0.0 — Built with BOS</p>
      </div>
    </aside>
  )
}

function Header({ onMenuOpen }: { onMenuOpen: () => void }) {
  const loc = useLocation()
  const current = navItems.find(n => n.to === loc.pathname)
  return (
    <header className="flex items-center gap-4 px-6 py-4 border-b border-gray-800 bg-gray-950 sticky top-0 z-20">
      <button onClick={onMenuOpen} className="lg:hidden text-gray-400 hover:text-white">
        <MenuIcon size={22} />
      </button>
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span className="text-white font-semibold">{current?.label ?? 'Dashboard'}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-900/30 border border-green-700/40 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          Système actif
        </span>
      </div>
    </header>
  )
}

export default function App() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gray-950">
        {/* Sidebar desktop */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Sidebar mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            <div className="relative z-10">
              <Sidebar mobile onClose={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header onMenuOpen={() => setMobileOpen(true)} />
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/calls" element={<CallsPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/best" element={<BestClientPage />} />
              <Route path="/restaurants" element={<RestaurantsPage />} />
              <Route path="/relances" element={<RelancesPage />} />
              <Route path="/menus" element={<MenusPage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/revenue" element={<RevenuePage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
