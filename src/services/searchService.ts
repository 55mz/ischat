export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface SearchResponse {
  answer?: string;
  results: TavilySearchResult[];
  query: string;
}

export interface FormattedSearchContext {
  query: string;
  answer?: string;
  results: Array<{
    title: string;
    source: string;
    snippet: string;
  }>;
}

const SEARCH_KEYWORDS = [
  // 时间相关
  '天气', '今天', '最新', '现在', '当前', '实时', 'weather', 'today', 'latest', 'current', 'now',
  // 实时信息
  '新闻', '股价', '汇率', '比赛', 'news', 'price', 'stock', 'live',
  // 具体日期/位置/事件
  '明天', '昨天', '几月', '几号', '几点', '哪里', '何时'
];

export const searchService = {
  shouldSearch(query: string): boolean {
    console.log('🔍 检查是否需要搜索:', query);
    
    // 先检查是否是明显不需要搜索的问题
    const NO_SEARCH_PHRASES = ['我是谁', '你是谁', '我是', '你是', 'hello', 'hi', '你好'];
    const lowerQuery = query.toLowerCase();
    
    for (const phrase of NO_SEARCH_PHRASES) {
      if (lowerQuery.includes(phrase.toLowerCase())) {
        console.log('发现免搜索短语:', phrase);
        return false;
      }
    }
    
    const shouldSearch = SEARCH_KEYWORDS.some(keyword => 
      lowerQuery.includes(keyword.toLowerCase())
    );
    console.log('是否需要搜索:', shouldSearch);
    return shouldSearch;
  },

  async search(query: string, options?: { search_depth?: 'basic' | 'advanced'; max_results?: number }): Promise<SearchResponse> {
    console.log('🌐 开始 Tavily 搜索:', query);
    const response = await fetch('/api/tavily-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        search_depth: options?.search_depth || 'basic',
        max_results: options?.max_results || 5,
      }),
    });

    console.log('Tavily API 响应状态码:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Tavily API 错误详情:', errorText);
      throw new Error('Search failed');
    }

    const data = await response.json();
    console.log('📥 完整搜索结果:', JSON.stringify(data, null, 2));
    return data;
  },

  formatResults(searchResponse: SearchResponse): FormattedSearchContext {
    return {
      query: searchResponse.query,
      answer: searchResponse.answer,
      results: searchResponse.results.map((result, index) => ({
        title: result.title,
        source: result.url,
        snippet: result.content,
      })),
    };
  },

  buildContext(formatted: FormattedSearchContext): string {
    let context = '';

    if (formatted.answer) {
      context += `【搜索摘要】\n${formatted.answer}\n\n`;
    }

    // 只保留前 3 个最重要的结果
    const topResults = formatted.results.slice(0, 3);

    context += '【重要搜索结果】\n';
    topResults.forEach((result, index) => {
      if (index === 0) {
        // 第一个结果是最重要的，突出显示
        context += `\n⚠️ 最相关结果（请优先参考）：\n标题: ${result.title}\n来源: ${result.source}\n内容: ${result.snippet}\n\n`;
      } else {
        context += `[${index + 1}] ${result.title}\n来源: ${result.source}\n摘要: ${result.snippet}\n\n`;
      }
    });

    return context;
  },
};

