import { Bot } from 'lucide-react'
import { useChatStore } from '../store/useChatStore'
import MessageItem from './MessageItem'
import ChatInput from './ChatInput'

const ChatWindow = () => {
  const { messages, currentConversationId } = useChatStore()
  const currentMessages = messages[currentConversationId] || []

  return (
    <div className="flex flex-col h-full relative bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
            <Bot size={20} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Default Assistant</h2>
            <p className="text-xs text-green-500">Online</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {currentMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
            <Bot size={48} className="opacity-20" />
            <p>Start a conversation with your AI agent</p>
          </div>
        ) : (
          currentMessages.map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))
        )}
      </div>

      {/* Input Area */}
      <ChatInput />
    </div>
  )
}

export default ChatWindow
