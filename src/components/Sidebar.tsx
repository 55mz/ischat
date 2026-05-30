import { Plus, MessageSquare, Bot, Settings, Search } from 'lucide-react'

const Sidebar = () => {
  return (
    <div className="w-64 md:w-72 flex flex-col h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      {/* New Chat Button */}
      <div className="p-4">
        <button className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 transition-colors font-medium">
          <Plus size={18} />
          <span>New Chat</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search agents..." 
            className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-2 space-y-6">
        {/* Agent List */}
        <div>
          <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">My Agents</h3>
          <div className="space-y-1">
            {[
              { name: 'Default Assistant', id: '1', active: true },
              { name: 'Code Expert', id: '2', active: false },
              { name: 'UI/UX Designer', id: '3', active: false },
            ].map((agent) => (
              <button 
                key={agent.id}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  agent.active 
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Bot size={18} />
                <span className="truncate">{agent.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Chats */}
        <div>
          <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recent History</h3>
          <div className="space-y-1">
            {[
              'Explain React Hooks',
              'Design System Tips',
              'MongoDB Aggregation Help'
            ].map((chat, i) => (
              <button 
                key={i}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <MessageSquare size={18} />
                <span className="truncate">{chat}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Profile/Settings */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <Settings size={18} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  )
}

export default Sidebar
