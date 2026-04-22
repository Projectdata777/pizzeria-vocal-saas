import { useEffect, useState } from 'react'
import { api, MenuTemplate } from '../api/client'
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react'

const typeFilter = ['tous', 'pizza', 'kebab', 'fastfood'] as const

export default function MenusPage() {
  const [templates, setTemplates] = useState<MenuTemplate[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedData, setSelectedData] = useState<Record<string, unknown> | null>(null)
  const [filter, setFilter] = useState<typeof typeFilter[number]>('tous')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getMenuTemplates().then(setTemplates).catch(console.error).finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'tous' ? templates : templates.filter(t => t.type === filter)

  const handleSelect = async (id: string) => {
    if (selected === id) { setSelected(null); setSelectedData(null); return }
    setSelected(id)
    try {
      const data = await api.getMenuTemplate(id)
      setSelectedData(data as unknown as Record<string, unknown>)
    } catch {}
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Menus</h1>
        <p className="text-gray-500 text-sm">Menus réels de restaurants français — utilisés comme templates pour les agents</p>
      </div>

      <div className="flex gap-2">
        {typeFilter.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${filter === t ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {t === 'tous' ? 'Tous' : t === 'pizza' ? '🍕 Pizza' : t === 'kebab' ? '🥙 Kebab' : '🍔 Fast Food'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Chargement des menus...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(menu => (
            <div key={menu.id} className="card cursor-pointer" onClick={() => handleSelect(menu.id)}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{menu.emoji}</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{menu.enseigne}</h3>
                  <p className="text-xs text-gray-500">{menu.categories_count} catégories — {menu.items_count} articles</p>
                </div>
                <div style={{ color: menu.couleur }} className="text-xs font-medium uppercase">{menu.type}</div>
                {selected === menu.id ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
              </div>

              {selected === menu.id && selectedData && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  {((selectedData as Record<string, unknown>).categories as Array<Record<string, unknown>> || []).map((cat: Record<string, unknown>, ci: number) => (
                    <div key={ci} className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">
                        {cat.emoji as string} {cat.categorie as string}
                      </h4>
                      <div className="space-y-1">
                        {((cat.items as Array<Record<string, unknown>>) || []).map((item: Record<string, unknown>, ii: number) => (
                          <div key={ii} className="flex items-center justify-between text-sm">
                            <div>
                              <span className="text-gray-300">{item.nom as string}</span>
                              {Boolean(item.description) && <span className="text-gray-600 text-xs ml-2">{item.description as string}</span>}
                            </div>
                            <span className="text-green-400 font-medium text-xs ml-4 flex-shrink-0">
                              {typeof item.prix === 'object'
                                ? Object.entries(item.prix as Record<string, number>).map(([k, v]) => `${k}: ${v}€`).join(' / ')
                                : `${item.prix}€`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
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
