import { User, Bot, FileText } from 'lucide-react'
import type { Message } from '../store/useChatStore'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface MessageItemProps {
  message: Message
}

const MessageItem = ({ message }: MessageItemProps) => {
  const isAssistant = message.role === 'assistant'

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className={cn(
      "flex w-full gap-4 px-4",
      isAssistant ? "justify-start" : "justify-end"
    )}>
      <div className={cn(
        "flex max-w-[80%] gap-3",
        isAssistant ? "flex-row" : "flex-row-reverse"
      )}>
        {/* Avatar */}
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
          isAssistant ? "bg-blue-100 text-blue-600" : "bg-slate-200 text-slate-600"
        )}>
          {isAssistant ? <Bot size={18} /> : <User size={18} />}
        </div>

        {/* Bubble */}
        <div className={cn(
          "flex flex-col gap-1",
          isAssistant ? "items-start" : "items-end"
        )}>
          {/* 文件附件 */}
          {message.files && message.files.length > 0 && (
            <div className={cn(
              "flex flex-wrap gap-2 mb-2",
              isAssistant ? "mr-auto" : "ml-auto"
            )}>
              {message.files.map(file => (
                <div
                  key={file.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs",
                    isAssistant
                      ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      : "bg-blue-500 text-white"
                  )}
                >
                  <FileText size={14} />
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  <span className="opacity-70">({formatFileSize(file.size)})</span>
                </div>
              ))}
            </div>
          )}

          <div className={cn(
            "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
            isAssistant
              ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none"
              : "bg-blue-600 text-white rounded-tr-none"
          )}>
            {message.content}
            {message.status === 'streaming' && (
              <span className="inline-block w-1.5 h-4 ml-1 bg-blue-400 animate-pulse align-middle" />
            )}
          </div>
          <span className="text-[10px] text-slate-400 px-1">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  )
}

export default MessageItem
