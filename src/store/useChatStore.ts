import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { memoryStore } from '../services/memoryStore';

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: 'pending' | 'streaming' | 'completed' | 'error';
  agentId?: string;
  createdAt: number;
  files?: AttachedFile[];
}

export interface ChatState {
  messages: Record<string, Message[]>;
  currentConversationId: string;
  isStreaming: boolean;
  abortController: AbortController | null;

  setConversation: (id: string) => void;
  sendMessage: (content: string, agentId: string, files?: AttachedFile[]) => Promise<void>;
  stopStreaming: () => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  getContext: (conversationId: string) => {
    systemPrompt: string;
    shortTermMessages: { role: 'user' | 'assistant'; content: string }[];
  };
  saveMessagePair: (conversationId: string, userMsg: { content: string; id: string }, assistantMsg: { content: string; id: string }) => Promise<void>;
}

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

  getContext: (conversationId) => {
    const memory = memoryStore.getContext(conversationId);
    let systemPrompt = 'You are a helpful assistant. When users upload files, analyze the file content and provide insights based on the actual content of the files.';
    if (memory.longTermSummary) {
      systemPrompt += `\n\n---\n\nPrevious conversation summary:\n${memory.longTermSummary}`;
    }
    return {
      systemPrompt,
      shortTermMessages: memory.shortTermMessages,
    };
  },

  saveMessagePair: async (conversationId, userMsg, assistantMsg) => {
    const { shouldGenerateSummary, memory } = memoryStore.addMessagePair(
      conversationId,
      userMsg,
      assistantMsg
    );

    if (shouldGenerateSummary) {
      try {
        const oldMessages = memoryStore.getOldestRoundsForSummary(conversationId, 5);
        const conversationText = oldMessages
          .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n\n');

        const response = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation: conversationText }),
        });

        if (response.ok) {
          const data = await response.json();
          memoryStore.updateSummary(conversationId, data.summary, memory.currentRound);
        }
      } catch (error) {
        console.error('Failed to generate summary:', error);
      }
    }
  },

  sendMessage: async (content, agentId, files = []) => {
    const { currentConversationId, isStreaming, abortController } = get();
    if (isStreaming) return;

    if (abortController) {
      abortController.abort();
    }

    const newAbortController = new AbortController();
    const userMessageId = uuidv4();
    const assistantMessageId = uuidv4();

    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: content.trim(),
      status: 'completed',
      createdAt: Date.now(),
      files: files.length > 0 ? files.map(f => ({ id: f.id, name: f.name, size: f.size, type: f.type })) : undefined,
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
      const { systemPrompt, shortTermMessages } = get().getContext(currentConversationId);

      const messages = [
        { role: 'system', content: systemPrompt },
        ...shortTermMessages,
        { role: 'user', content: content },
      ];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          conversationId: currentConversationId,
          files: files.map(f => ({ name: f.name, type: f.type, content: f.content })),
          context: shortTermMessages,
        }),
        signal: newAbortController.signal,
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

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

      get().updateMessage(currentConversationId, assistantMessageId, {
        status: 'completed',
        content: fullContent,
      });

      await get().saveMessagePair(
        currentConversationId,
        { id: userMessageId, content: content },
        { id: assistantMessageId, content: fullContent }
      );

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
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

