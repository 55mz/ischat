import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Smile, Square, X, FileText } from 'lucide-react'
import { useChatStore } from '../store/useChatStore'
import { v4 as uuidv4 } from 'uuid'

interface AttachedFile {
  id: string
  name: string
  size: number
  type: string
  content: string
}

const ChatInput = () => {
  const [input, setInput] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const { sendMessage, isStreaming, stopStreaming } = useChatStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isStreaming) return

    const content = input.trim()
    setInput('')

    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // 调用真正的 sendMessage，传递文件
    await sendMessage(content, 'default', attachedFiles)

    // 清空附件
    setAttachedFiles([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newFiles: AttachedFile[] = []

    for (const file of Array.from(files)) {
      // 限制文件大小为 10MB
      if (file.size > 10 * 1024 * 1024) {
        alert(`文件 ${file.name} 超过 10MB 限制`)
        continue
      }

      // 读取文件内容
      const content = await readFileContent(file)
      newFiles.push({
        id: uuidv4(),
        name: file.name,
        size: file.size,
        type: file.type,
        content
      })
    }

    setAttachedFiles(prev => [...prev, ...newFiles])

    // 重置 input，允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        // 获取 base64 部分（去掉 data URL 前缀）
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const removeFile = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="max-w-4xl mx-auto">
        {/* 附件列表 */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachedFiles.map(file => (
              <div
                key={file.id}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm"
              >
                <FileText size={16} className="text-blue-500" />
                <span className="text-slate-700 dark:text-slate-300 max-w-[150px] truncate">
                  {file.name}
                </span>
                <span className="text-slate-400 text-xs">
                  ({formatFileSize(file.size)})
                </span>
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                  disabled={isStreaming}
                >
                  <X size={14} className="text-slate-400" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative flex items-end gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl p-2 transition-all focus-within:ring-1 focus-within:ring-blue-500">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept=".txt,.pdf,.doc,.docx,.md,.json,.csv"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
            disabled={isStreaming}
            title="上传文件 (支持 txt, pdf, doc, docx, md, json, csv)"
          >
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
              disabled={!input.trim() && attachedFiles.length === 0}
              className={`p-2 rounded-lg transition-colors ${
                input.trim() || attachedFiles.length > 0
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Send size={18} />
            </button>
          )}
        </div>
        <p className="text-[10px] text-center text-slate-400 mt-2">
          Powered by DeepSeek. AI can make mistakes. 支持上传文档进行分析。
        </p>
      </div>
    </div>
  )
}

export default ChatInput
