import { NextResponse } from 'next/server'

// POST - 添加收藏
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`[前端路由-添加收藏] 开始处理请求, storyId: ${params.id}`);
    
    const body = await request.json();
    console.log('[前端路由-添加收藏] 请求体:', body);
    
    const { address } = body;
    
    if (!address) {
      console.log('[前端路由-添加收藏] 错误: 缺少钱包地址');
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }
    
    // 调用后端 API
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/stories/${params.id}/favorite`;
    console.log(`[前端路由-添加收藏] 调用后端API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ address })
    });
    
    console.log('[前端路由-添加收藏] 后端响应状态:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    // 尝试读取响应内容
    let responseText;
    try {
      responseText = await response.text();
      console.log('[前端路由-添加收藏] 后端响应内容:', 
        responseText.length > 200 
          ? responseText.substring(0, 200) + '...' 
          : responseText
      );
    } catch (textError) {
      console.error('[前端路由-添加收藏] 读取响应内容失败:', textError);
    }
    
    // 处理响应
    if (!response.ok) {
      let errorData;
      try {
        errorData = responseText ? JSON.parse(responseText) : { error: 'Unknown error' };
      } catch (parseError) {
        console.error('[前端路由-添加收藏] 解析错误响应失败:', parseError);
        errorData = { error: 'Failed to parse error response' };
      }
      
      console.error('[前端路由-添加收藏] 后端返回错误:', errorData);
      return NextResponse.json(
        { error: errorData.error || 'Failed to add to favorites' },
        { status: response.status }
      );
    }
    
    // 解析成功响应
    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('[前端路由-添加收藏] 解析成功响应失败:', parseError);
      responseData = {};
    }
    
    console.log('[前端路由-添加收藏] 处理成功:', responseData);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('[前端路由-添加收藏] 发生异常:', error);
    if (error instanceof Error) {
      console.error('[前端路由-添加收藏] 错误堆栈:', error.stack);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - 删除收藏
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`[前端路由-取消收藏] 开始处理请求, storyId: ${params.id}`);
    
    const body = await request.json();
    console.log('[前端路由-取消收藏] 请求体:', body);
    
    const { address } = body;
    
    if (!address) {
      console.log('[前端路由-取消收藏] 错误: 缺少钱包地址');
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }
    
    // 调用后端 API
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/stories/${params.id}/favorite`;
    console.log(`[前端路由-取消收藏] 调用后端API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ address })
    });
    
    console.log('[前端路由-取消收藏] 后端响应状态:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    // 尝试读取响应内容
    let responseText;
    try {
      responseText = await response.text();
      console.log('[前端路由-取消收藏] 后端响应内容:', 
        responseText.length > 200 
          ? responseText.substring(0, 200) + '...' 
          : responseText
      );
    } catch (textError) {
      console.error('[前端路由-取消收藏] 读取响应内容失败:', textError);
    }
    
    // 处理响应
    if (!response.ok) {
      let errorData;
      try {
        errorData = responseText ? JSON.parse(responseText) : { error: 'Unknown error' };
      } catch (parseError) {
        console.error('[前端路由-取消收藏] 解析错误响应失败:', parseError);
        errorData = { error: 'Failed to parse error response' };
      }
      
      console.error('[前端路由-取消收藏] 后端返回错误:', errorData);
      return NextResponse.json(
        { error: errorData.error || 'Failed to remove from favorites' },
        { status: response.status }
      );
    }
    
    console.log('[前端路由-取消收藏] 处理成功');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[前端路由-取消收藏] 发生异常:', error);
    if (error instanceof Error) {
      console.error('[前端路由-取消收藏] 错误堆栈:', error.stack);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 