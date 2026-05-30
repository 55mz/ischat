import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Smile, Square } from 'lucide-react'
import { useChatStore } from '../store/useChatStore'

const ChatInput = () => {
  const [input, setInput] = useState('')
  const { sendMessage, isStreaming, stopStreaming } = useChatStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return

    const content = input.trim()
    setInput('')
    
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // 调用真正的 sendMessage
    await sendMessage(content, 'default')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="max-w-4xl mx-auto">
        <div className="relative flex items-end gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl p-2 transition-all focus-within:ring-1 focus-within:ring-blue-500">
          <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <Paperclip size={20} />
          </button>
          
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? "AI is thinking..." : "Type your message..."}
            disabled={isStreaming}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 resize-none max-h-[200px] text-slate-900 dark:text-slate-100 disabled:opacity-50"
          />

          <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <Smile size={20} />
          </button>

          {isStreaming ? (
            <button 
              onClick={stopStreaming}
              className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              <Square size={18} />
            </button>
          ) : (
            <button 
              onClick={handleSend}
              disabled={!input.trim()}
              className={`p-2 rounded-lg transition-colors ${
                input.trim() 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' 
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Send size={18} />
            </button>
          )}
        </div>
        <p className="text-[10px] text-center text-slate-400 mt-2">
          Powered by DeepSeek. AI can make mistakes.
        </p>
      </div>
    </div>
  )
}

export default ChatInput
