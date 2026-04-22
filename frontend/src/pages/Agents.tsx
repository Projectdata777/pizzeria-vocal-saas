import { useEffect, useState } from 'react'
import { api, RetellAgent } from '../api/client'
import { Bot, Mic, Link } from 'lucide-react'

export default function AgentsPage() {
  const [agents, setAgents] = useState<RetellAgent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getAgents().then(a => setAgents(Array.isArray(a) ? a : [])).catch(console.error).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Agents vocaux</h1>
        <p className="text-gray-500 text-sm">Agents Retell AI configurés — {agents.length} agent(s)</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Chargement des agents...</div>
      ) : agents.length === 0 ? (
        <div className="card text-center py-16 text-gray-500">
          <Bot size={48} className="mx-auto mb-3 opacity-20" />
          <p>Aucun agent configuré</p>
          <p className="text-xs mt-1">Créez un agent sur retell.ai puis configurez-le ici</p>
          <a href="https://app.retellai.com" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 mt-3 text-sm text-blue-400 hover:text-blue-300">
            <Link size={14} /> Ouvrir Retell AI
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map(agent => (
            <div key={agent.agent_id} className="card">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-blue-900/30 border border-blue-700/30 rounded-lg">
                  <Bot size={20} className="text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{agent.agent_name || 'Agent sans nom'}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{agent.agent_id}</p>
                  {agent.voice_id && (
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <Mic size={11} /> Voix : {agent.voice_id}
                    </p>
                  )}
                  {agent.llm_websocket_url && (
                    <p className="text-xs text-gray-600 mt-1 truncate">
                      WS : {agent.llm_websocket_url}
                    </p>
                  )}
                </div>
                <span className="badge-green">Actif</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card border-blue-700/30 bg-blue-900/10">
        <h2 className="text-sm font-semibold text-blue-400 mb-2">Configuration WebSocket LLM</h2>
        <p className="text-xs text-gray-400 mb-2">
          Dans Retell AI, configurez l'URL du LLM Custom WebSocket pour connecter vos agents au cerveau Claude :
        </p>
        <code className="text-xs bg-gray-900 px-3 py-2 rounded-lg block text-green-400">
          wss://votre-backend.onrender.com/llm-websocket
        </code>
      </div>
    </div>
  )
}
