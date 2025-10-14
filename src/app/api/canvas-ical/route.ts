import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json(
        { error: '缺少iCal URL参数' },
        { status: 400 }
      )
    }

    // 验证URL格式
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: '无效的URL格式' },
        { status: 400 }
      )
    }

    console.log('正在获取Canvas iCal数据:', url)

    // 尝试多次请求，处理可能的临时错误
    let response: Response | null = null
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`尝试第 ${attempt} 次请求...`)
        
        response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/calendar,text/plain,*/*',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          // 设置超时
          signal: AbortSignal.timeout(30000) // 30秒超时
        })
        
        // 如果请求成功，跳出重试循环
        if (response.ok) {
          break
        } else if (response.status === 401 || response.status === 403) {
          // 认证错误不需要重试
          break
        }
        
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('请求失败')
        
        // 如果是最后一次尝试，不等待
        if (attempt < 3) {
          console.log(`第 ${attempt} 次尝试失败，等待 ${attempt * 1000}ms 后重试...`)
          await new Promise(resolve => setTimeout(resolve, attempt * 1000))
        }
      }
    }

    if (!response || !response.ok) {
      const status = response?.status || 500
      const statusText = response?.statusText || '请求失败'
      
      console.error('获取iCal数据失败:', status, statusText, lastError?.message)
      
      const errorMessage = `无法获取iCal数据: ${status} ${statusText}`
      let details = '请检查iCal链接是否正确'
      
      if (status === 401) {
        details = 'Canvas日历链接需要认证。请确保：\n1. 使用完整的订阅链接（包含认证令牌）\n2. 链接没有过期\n3. 你有访问该日历的权限'
      } else if (status === 403) {
        details = 'Canvas日历访问被拒绝。请确保：\n1. 使用的是公开的日历订阅链接\n2. Canvas账户有访问权限\n3. 尝试重新生成订阅链接'
      } else if (status === 404) {
        details = 'Canvas日历链接不存在。请检查：\n1. 链接是否正确复制\n2. 链接是否完整\n3. 尝试重新获取订阅链接'
      } else if (lastError?.name === 'AbortError') {
        details = '请求超时。请检查：\n1. 网络连接是否正常\n2. Canvas服务是否可用\n3. 尝试使用文件上传方式'
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: details
        },
        { status: status }
      )
    }

    const icalData = await response.text()
    
    if (!icalData || icalData.trim().length === 0) {
      return NextResponse.json(
        { error: 'iCal数据为空，请检查链接是否正确' },
        { status: 400 }
      )
    }

    // 简单验证是否是iCal格式
    if (!icalData.includes('BEGIN:VCALENDAR') || !icalData.includes('END:VCALENDAR')) {
      return NextResponse.json(
        { 
          error: '获取的数据不是有效的iCal格式',
          details: '请确保提供的是Canvas日历的iCal订阅链接'
        },
        { status: 400 }
      )
    }

    console.log('成功获取iCal数据，长度:', icalData.length)

    return NextResponse.json({
      success: true,
      data: icalData,
      size: icalData.length
    })

  } catch (error) {
    console.error('Canvas iCal API错误:', error)
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: '请求超时，请检查网络连接或稍后重试' },
          { status: 408 }
        )
      }
      
      return NextResponse.json(
        { 
          error: '获取iCal数据时发生错误',
          details: error.message
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: '未知错误' },
      { status: 500 }
    )
  }
}

// 支持OPTIONS请求（用于CORS预检）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
