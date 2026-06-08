export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  round: number;
}

export interface ConversationMemory {
  conversationId: string;
  createdAt: number;
  updatedAt: number;
  currentRound: number;
  shortTermMemory: Message[];
  longTermSummary: string;
  lastSummaryRound: number;
}

const STORAGE_KEY = 'chat_conversation_memories';

export const memoryStore = {
  getAllMemories(): Record<string, ConversationMemory> {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  },

  saveAllMemories(memories: Record<string, ConversationMemory>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
  },

  getOrCreateMemory(conversationId: string): ConversationMemory {
    const memories = this.getAllMemories();
    if (!memories[conversationId]) {
      memories[conversationId] = {
        conversationId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        currentRound: 0,
        shortTermMemory: [],
        longTermSummary: '',
        lastSummaryRound: 0,
      };
      this.saveAllMemories(memories);
    }
    return memories[conversationId];
  },

  saveMemory(memory: ConversationMemory) {
    const memories = this.getAllMemories();
    memories[memory.conversationId] = {
      ...memory,
      updatedAt: Date.now(),
    };
    this.saveAllMemories(memories);
  },

  addMessagePair(
    conversationId: string,
    userMsg: { content: string; id: string },
    assistantMsg: { content: string; id: string }
  ) {
    const memory = this.getOrCreateMemory(conversationId);
    const newRound = memory.currentRound + 1;

    const pair: Message[] = [
      {
        id: userMsg.id,
        role: 'user',
        content: userMsg.content,
        timestamp: Date.now(),
        round: newRound,
      },
      {
        id: assistantMsg.id,
        role: 'assistant',
        content: assistantMsg.content,
        timestamp: Date.now(),
        round: newRound,
      },
    ];

    memory.shortTermMemory.push(...pair);
    memory.currentRound = newRound;

    if (memory.shortTermMemory.length > 6) {
      memory.shortTermMemory = memory.shortTermMemory.slice(-6);
    }

    this.saveMemory(memory);
    return { memory, shouldGenerateSummary: newRound >= memory.lastSummaryRound + 5 };
  },

  updateSummary(conversationId: string, newSummary: string, upToRound: number) {
    const memory = this.getOrCreateMemory(conversationId);
    memory.longTermSummary = memory.longTermSummary
      ? `${memory.longTermSummary}\n\n---\n\n${newSummary}`
      : newSummary;
    memory.lastSummaryRound = upToRound;
    this.saveMemory(memory);
  },

  getContext(conversationId: string): {
    longTermSummary: string;
    shortTermMessages: { role: 'user' | 'assistant'; content: string }[];
  } {
    const memory = this.getOrCreateMemory(conversationId);
    return {
      longTermSummary: memory.longTermSummary,
      shortTermMessages: memory.shortTermMemory.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };
  },

  getOldestRoundsForSummary(conversationId: string, limit: number = 5): Message[] {
    const memory = this.getOrCreateMemory(conversationId);
    const allMessages = memory.shortTermMemory;
    const roundGroups: { [key: number]: Message[] } = {};

    allMessages.forEach(msg => {
      if (!roundGroups[msg.round]) roundGroups[msg.round] = [];
      roundGroups[msg.round].push(msg);
    });

    const sortedRounds = Object.keys(roundGroups)
      .map(Number)
      .sort((a, b) => a - b)
      .slice(0, limit);

    const result: Message[] = [];
    sortedRounds.forEach(round => {
      result.push(...roundGroups[round]);
    });

    return result;
  },

  clearConversation(conversationId: string) {
    const memories = this.getAllMemories();
    delete memories[conversationId];
    this.saveAllMemories(memories);
  },
};

