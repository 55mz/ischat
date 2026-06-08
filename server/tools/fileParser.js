/**
 * 文件解析工具
 * 支持调用 MinerU API 或其他文档解析服务
 */

const fs = require('fs').promises;
const path = require('path');

class FileParser {
  constructor() {
    // MinerU API 配置
    this.mineruApiUrl = process.env.MINERU_API_URL || 'http://localhost:8888';
    this.mineruApiKey = process.env.MINERU_API_KEY;
  }

  /**
   * 解析文件内容
   * @param {Object} file - 文件对象 { name, type, content(base64) }
   * @returns {Promise<string>} 解析后的文本内容
   */
  async parseFile(file) {
    console.log(`[FileParser] 解析文件: ${file.name}, 类型: ${file.type}`);

    try {
      // 根据文件类型选择不同的解析策略
      if (file.type === 'application/pdf') {
        return await this.parsePDF(file);
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/msword'
      ) {
        return await this.parseWord(file);
      } else if (file.type.startsWith('text/') ||
                 file.name.endsWith('.md') ||
                 file.name.endsWith('.txt') ||
                 file.name.endsWith('.json') ||
                 file.name.endsWith('.csv')) {
        return await this.parseText(file);
      } else {
        throw new Error(`不支持的文件类型: ${file.type}`);
      }
    } catch (error) {
      console.error('[FileParser] 解析文件失败:', error);
      throw error;
    }
  }

  /**
   * 解析 PDF 文件
   * 使用 MinerU API 或直接提取文本
   */
  async parsePDF(file) {
    // 优先使用 MinerU API
    if (this.mineruApiKey) {
      try {
        return await this.parseWithMinerU(file);
      } catch (error) {
        console.warn('[FileParser] MinerU 调用失败，回退到基础解析:', error.message);
      }
    }

    // 回退方案：提取 PDF 文本内容
    return await this.extractPDFText(file);
  }

  /**
   * 使用 MinerU API 解析文档
   * MinerU 是一个强大的文档解析工具，支持 PDF、图片等
   */
  async parseWithMinerU(file) {
    const formData = new FormData();

    // 将 base64 内容转换为 Blob
    const buffer = Buffer.from(file.content, 'base64');
    const blob = new Blob([buffer]);

    formData.append('file', blob, file.name);

    const response = await fetch(`${this.mineruApiUrl}/api/v1/document/parse`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.mineruApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`MinerU API 调用失败: ${response.status}`);
    }

    const result = await response.json();

    // 返回解析后的文本内容
    if (result.content) {
      return result.content;
    }

    // 如果有 markdown 输出，优先使用
    if (result.markdown) {
      return result.markdown;
    }

    throw new Error('MinerU API 返回格式不正确');
  }

  /**
   * 提取 PDF 文本（基础实现）
   */
  async extractPDFText(file) {
    // 基础实现：直接返回 base64 解码后的内容
    // 实际生产环境应该使用 pdf-parse 或类似库
    try {
      const buffer = Buffer.from(file.content, 'base64');

      // 简单的文本提取（假设 PDF 包含可提取的文本）
      // 对于复杂 PDF，建议使用 pdf-parse 库
      const text = buffer.toString('utf-8');

      if (text && text.length > 0 && this.isPrintableText(text)) {
        return `[PDF 文件内容]\n文件名: ${file.name}\n\n${text}`;
      }

      return `[PDF 文件]\n文件名: ${file.name}\n\n注意: 这是一个 PDF 文件，建议安装 MinerU 进行完整解析。\n当前仅显示文件元数据信息。`;
    } catch (error) {
      console.error('[FileParser] PDF 提取失败:', error);
      throw error;
    }
  }

  /**
   * 解析 Word 文档
   */
  async parseWord(file) {
    try {
      const buffer = Buffer.from(file.content, 'base64');
      const text = buffer.toString('utf-8');

      return `[Word 文档]\n文件名: ${file.name}\n\n${text}\n\n注意: 这是基础解析，对于复杂的 Word 文档，建议使用专业的文档解析工具。`;
    } catch (error) {
      throw new Error(`Word 文档解析失败: ${error.message}`);
    }
  }

  /**
   * 解析文本文件
   */
  async parseText(file) {
    try {
      const buffer = Buffer.from(file.content, 'base64');
      const text = buffer.toString('utf-8');

      const fileType = file.type.split('/')[1]?.toUpperCase() || '文本';
      return `[${fileType} 文件]\n文件名: ${file.name}\n大小: ${this.formatFileSize(file.size)}\n\n${text}`;
    } catch (error) {
      throw new Error(`文本文件解析失败: ${error.message}`);
    }
  }

  /**
   * 批量解析多个文件
   */
  async parseMultipleFiles(files) {
    const results = [];

    for (const file of files) {
      try {
        const content = await this.parseFile(file);
        results.push({
          name: file.name,
          success: true,
          content
        });
      } catch (error) {
        results.push({
          name: file.name,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * 检查文本是否为可打印文本
   */
  isPrintableText(text) {
    // 检查是否包含足够的可打印字符
    const printableChars = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '').length;
    return printableChars > text.length * 0.3;
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

module.exports = FileParser;
