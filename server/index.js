import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import 'dotenv/config'

const app = express()
const PORT = 3000

app.use(cors())
app.use(express.json())

// 调试中间件 - 打印请求信息
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  next()
})

// 摘要生成接口
app.post('/api/summarize', async (req, res) => {
  try {
    const { conversation } = req.body
    console.log('收到摘要生成请求，对话长度:', conversation.length)
    
    const API_KEY = process.env.DEEPSEEK_API_KEY
    
    if (!API_KEY) {
      return res.status(500).json({ error: 'DEEPSEEK_API_KEY is not set' })
    }
    
    console.log('正在调用 DeepSeek 生成摘要...')

    const prompt = `You are a memory summarizer. Your task is to summarize the conversation history concisely.

Rules:
1. Keep key information: names, preferences, important facts, questions asked, answers given
2. Keep it concise (max 200 words)
3. Maintain chronological order
4. Use bullet points for clarity
5. Focus on what the user said and what was agreed upon

Conversation to summarize:
${conversation}

Summary:`

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        temperature: 0.3,
      }),
    })

    console.log('DeepSeek 摘要 API 响应状态:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('DeepSeek 摘要 API 错误:', response.status, errorText)
      return res.status(500).json({ 
        error: `DeepSeek summarize error: ${response.status}`, 
        details: errorText 
      })
    }

    const data = await response.json()
    const summary = data.choices[0].message.content
    
    res.json({ summary })
    console.log('摘要生成完成，长度:', summary.length)

  } catch (error) {
    console.error('摘要服务器错误:', error)
    res.status(500).json({ error: 'Internal server error', details: error.message })
  }
})

// Tavily 搜索接口
app.post('/api/tavily-search', async (req, res) => {
  try {
    const { query, search_depth = 'basic', max_results = 5 } = req.body
    console.log('收到 Tavily 搜索请求:', query)
    
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY
    
    if (!TAVILY_API_KEY) {
      return res.status(500).json({ error: 'TAVILY_API_KEY is not set' })
    }
    
    console.log('正在调用 Tavily 搜索...')

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth,
        max_results,
        include_images: false,
        include_answers: true
      })
    })

    console.log('Tavily API 响应状态:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Tavily API 错误:', response.status, errorText)
      return res.status(500).json({ 
        error: `Tavily search error: ${response.status}`, 
        details: errorText 
      })
    }

    const data = await response.json()
    res.json(data)
    console.log('Tavily 搜索完成，结果数:', data.results?.length || 0)

  } catch (error) {
    console.error('Tavily 搜索服务器错误:', error)
    res.status(500).json({ error: 'Internal server error', details: error.message })
  }
})

// 简单的 DeepSeek 流式代理
app.post('/api/chat', async (req, res) => {
  try {
    console.log('📥 完整请求体:', JSON.stringify(req.body, null, 2).substring(0, 500))
    const { message, conversationId, files = [], context = [], system_prompt = null } = req.body
    console.log('📨 收到请求，message:', message)
    console.log('📁 文件数量:', files.length)
    console.log('📜 上下文消息数量:', context.length)
    console.log('🎯 system_prompt 是否存在?', !!system_prompt)
    if (system_prompt) {
      console.log('🎯 收到自定义 system prompt，长度:', system_prompt.length)
    }
    
    // 从环境变量读取 API Key
    const API_KEY = process.env.DEEPSEEK_API_KEY
    console.log('🔑 API Key 长度:', API_KEY ? API_KEY.length : '未设置')
    
    if (!API_KEY) {
      return res.status(500).json({ error: 'DEEPSEEK_API_KEY is not set' })
    }
    
    console.log('🚀 正在调用 DeepSeek API...')

    // 构建用户消息，包含文件内容
    let userContent = message

    if (files && files.length > 0) {
      userContent += '\n\n[附件文件]:\n'
      files.forEach((file, index) => {
        userContent += `\n文件 ${index + 1}: ${file.name} (${file.type})\n`
        // 对于文本文件，包含内容
        if (file.type.startsWith('text/') || file.type === 'application/json' || file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
          try {
            // 解码 base64 内容
            const buffer = Buffer.from(file.content, 'base64')
            const textContent = buffer.toString('utf-8')
            userContent += `\n内容:\n${textContent}\n`
          } catch (e) {
            userContent += `\n(无法读取文件内容)\n`
          }
        } else {
          userContent += `\n(二进制文件，已上传但无法显示内容)\n`
        }
      })
      userContent += '\n请基于以上文件内容回答用户的问题。'
    }

    // 构建完整消息列表 - 如果有 system_prompt，优先使用
    const systemMessage = system_prompt || 'You are a helpful assistant. When users upload files, analyze the file content and provide insights based on the actual content of the files.'
    console.log('📋 最终发送给 LLM 的消息数量:', 2 + context.length)
    console.log('🤖 System message 预览（前200字）:', systemMessage.substring(0, 200))
    
    const messages = [
      { role: 'system', content: systemMessage },
      ...context,
      { role: 'user', content: userContent }
    ]

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        stream: true,
      }),
    })

    console.log('DeepSeek API 响应状态:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('DeepSeek API 错误:', response.status, errorText)
      return res.status(500).json({ 
        error: `DeepSeek API error: ${response.status}`, 
        details: errorText 
      })
    }

    // 设置流式响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')

    // 转发流式数据
    const reader = response.body ? response.body.getReader() : null
    if (!reader) {
      return res.status(500).json({ error: 'No response body' })
    }
    
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      res.write(chunk)
    }
    res.end()
    console.log('请求完成')

  } catch (error) {
    console.error('服务器错误:', error)
    res.status(500).json({ error: 'Internal server error', details: error.message })
  }
})

const server = createServer(app)

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
  console.log('DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? '已配置' : '未配置')
})
