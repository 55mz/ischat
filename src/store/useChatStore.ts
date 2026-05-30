import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: 'pending' | 'streaming' | 'completed' | 'error';
  agentId?: string;
  createdAt: number;
}

export interface ChatState {
  messages: Record<string, Message[]>;
  currentConversationId: string;
  isStreaming: boolean;
  abortController: AbortController | null;
  
  setConversation: (id: string) => void;
  sendMessage: (content: string, agentId: string) => Promise<void>;
  stopStreaming: () => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
}

// 解析 SSE 流数据
const parseSSELine = (line: string) => {
  if (line.startsWith('data: ')) {
    const data = line.slice(6);
    if (data === '[DONE]') return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return null;
};

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {
    'default': [
      {
        id: '1',
        role: 'assistant',
        content: 'Hello! I am your AI assistant powered by DeepSeek. How can I help you today?',
        status: 'completed',
        createdAt: Date.now(),
      }
    ]
  },
  currentConversationId: 'default',
  isStreaming: false,
  abortController: null,

  setConversation: (id) => set({ currentConversationId: id }),

  addMessage: (conversationId, message) => set((state) => ({
    messages: {
      ...state.messages,
      [conversationId]: [...(state.messages[conversationId] || []), message],
    }
  })),

  updateMessage: (conversationId, messageId, updates) => set((state) => {
    const currentMsgs = [...(state.messages[conversationId] || [])];
    const msgIndex = currentMsgs.findIndex(m => m.id === messageId);
    if (msgIndex > -1) {
      currentMsgs[msgIndex] = { ...currentMsgs[msgIndex], ...updates };
    }
    return { messages: { ...state.messages, [conversationId]: currentMsgs } };
  }),

  stopStreaming: () => {
    const { abortController, isStreaming, currentConversationId, messages } = get();
    if (abortController) {
      abortController.abort();
    }
    if (isStreaming) {
      const lastMsg = messages[currentConversationId]?.slice(-1)[0];
      if (lastMsg && lastMsg.status === 'streaming') {
        get().updateMessage(currentConversationId, lastMsg.id, { status: 'completed' });
      }
    }
    set({ isStreaming: false, abortController: null });
  },

  sendMessage: async (content, agentId) => {
    const { currentConversationId, isStreaming, abortController } = get();
    if (isStreaming) return;

    // 如果有正在进行的请求，先取消它
    if (abortController) {
      abortController.abort();
    }

    const newAbortController = new AbortController();
    const userMessageId = uuidv4();
    const assistantMessageId = uuidv4();

    // 1. 乐观更新用户消息
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: content.trim(),
      status: 'completed',
      createdAt: Date.now(),
    };

    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      status: 'pending',
      agentId,
      createdAt: Date.now(),
    };

    set((state) => ({
      messages: {
        ...state.messages,
        [currentConversationId]: [
          ...(state.messages[currentConversationId] || []),
          userMessage,
          assistantMessage,
        ],
      },
      isStreaming: true,
      abortController: newAbortController,
    }));

    try {
      // 2. 发送请求并处理流式响应
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: content, 
          conversationId: currentConversationId 
        }),
        signal: newAbortController.signal,
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      // 更新状态为 streaming
      get().updateMessage(currentConversationId, assistantMessageId, { status: 'streaming' });

      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const data = parseSSELine(line.trim());
          if (data && data.choices && data.choices.length > 0) {
            const delta = data.choices[0].delta;
            if (delta && delta.content) {
              fullContent += delta.content;
              get().updateMessage(currentConversationId, assistantMessageId, { 
                content: fullContent 
              });
            }
          }
        }
      }

      // 3. 完成流
      get().updateMessage(currentConversationId, assistantMessageId, { 
        status: 'completed',
        content: fullContent,
      });

    } catch (error) {
      if (error.name === 'AbortError') {
        // 用户手动停止
        const lastMsg = get().messages[currentConversationId]?.slice(-1)[0];
        if (lastMsg && lastMsg.status === 'streaming') {
          get().updateMessage(currentConversationId, lastMsg.id, { status: 'completed' });
        }
      } else {
        console.error('Error in sendMessage:', error);
        get().updateMessage(currentConversationId, assistantMessageId, { 
          content: 'Sorry, something went wrong. Please try again.',
          status: 'error' 
        });
      }
    } finally {
      set({ isStreaming: false, abortController: null });
    }
  }
}));
