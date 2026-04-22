import { useEffect, useState } from 'react'
import { api, Call } from '../api/client'
import { Phone, Clock, ChevronDown, ChevronUp, Play } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import clsx from 'clsx'

function sentimentBadge(s: string | null) {
  if (!s) return <span className="badge-gray">-</span>
  if (s === 'Positive') return <span className="badge-green">😊 Positif</span>
  if (s === 'Negative') return <span className="badge-red">😤 Négatif</span>
  return <span className="badge-yellow">😐 Neutre</span>
}

function CallRow({ call }: { call: Call }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card mb-2">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className={clsx('p-2 rounded-lg', call.call_successful ? 'bg-green-900/30' : 'bg-gray-800')}>
          <Phone size={16} className={call.call_successful ? 'text-green-400' : 'text-gray-500'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{call.from_number || 'Numéro masqué'}</span>
            {call.restaurants && <span className="text-xs text-gray-500">→ {call.restaurants.name}</span>}
            {sentimentBadge(call.user_sentiment)}
            {call.call_successful === false && <span className="badge-red">Échoué</span>}
            {call.intent && <span className="badge-blue">{call.intent}</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span>{format(new Date(call.started_at), 'dd MMM HH:mm', { locale: fr })}</span>
            <span className="flex items-center gap-1"><Clock size={11} />{call.duration_seconds}s</span>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-500 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-800 space-y-3">
          {call.summary && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">Résumé</p>
              <p className="text-sm text-gray-300">{call.summary}</p>
            </div>
          )}
          {call.recording_url && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Enregistrement</p>
              <audio controls src={call.recording_url} className="w-full h-10" />
            </div>
          )}
          {call.transcript && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Transcription</p>
              <div className="bg-gray-950 rounded-lg p-3 text-xs text-gray-400 max-h-64 overflow-y-auto whitespace-pre-wrap font-mono">
                {call.transcript}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getCalls({ limit: 100 })
      .then(setCalls)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Chargement des appels...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Appels</h1>
          <p className="text-gray-500 text-sm">{calls.length} appels — cliquez pour voir/réécouter</p>
        </div>
      </div>

      {calls.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <Phone size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucun appel pour l'instant</p>
          <p className="text-xs mt-1">Les appels apparaissent ici dès que l'agent reçoit un appel</p>
        </div>
      ) : (
        calls.map(call => <CallRow key={call.id} call={call} />)
      )}
    </div>
  )
}
