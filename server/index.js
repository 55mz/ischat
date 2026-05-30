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

// 简单的 DeepSeek 流式代理
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationId } = req.body
    console.log('收到请求，message:', message)
    
    // 从环境变量读取 API Key
    const API_KEY = process.env.DEEPSEEK_API_KEY
    console.log('API Key 长度:', API_KEY ? API_KEY.length : '未设置')
    
    if (!API_KEY) {
      return res.status(500).json({ error: 'DEEPSEEK_API_KEY is not set' })
    }
    
    console.log('正在调用 DeepSeek API...')
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: message }
        ],
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
