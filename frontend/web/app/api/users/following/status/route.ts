import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';


const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// 检查用户是否关注了指定作者
export async function GET(request: NextRequest) {
  try {
    // 从URL参数中获取数据
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const authorId = searchParams.get('authorId');
    
    console.log(`[关注状态API-统一] 收到检查关注状态请求:`, {
      userId,
      authorId,
      url: request.url
    });
    
    // 检查authorId的格式
    console.log(`[关注状态API-统一] authorId详情:`, {
      value: authorId,
      type: typeof authorId,
      length: authorId?.length,
      isStartWith0x: authorId?.startsWith('0x'),
      firstFiveChars: authorId?.substring(0, 5)
    });
    
    if (!userId || !authorId) {
      return NextResponse.json(
        { error: '缺少必要参数', isFollowing: false }, 
        { status: 400 }
      );
    }
    
    // 从Cookie中获取认证令牌
    const cookieStore = cookies();
    const token = cookieStore.get('token')?.value;
    
    console.log(`[关注状态API-统一] 认证信息:`, {
      hasToken: !!token,
      tokenLength: token?.length
    });
    
    // 构建请求头
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
    
    const apiUrl = `${API_BASE_URL}/api/users/${userId}/following/${authorId}/status`;
    console.log(`[关注状态API-统一] 发送后端请求:`, {
      url: apiUrl,
      method: 'GET',
      userId,
      authorId,
      API_BASE_URL
    });
    
    // 发送请求到后端
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    
    console.log(`[关注状态API-统一] 收到后端响应:`, {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
      url: response.url
    });
    
    if (!response.ok) {
      let error;
      try {
        error = await response.json();
        console.error(`[关注状态API-统一] 后端返回错误(JSON):`, error);
      } catch (e) {
        // 如果响应不是JSON格式
        const text = await response.text();
        console.error(`[关注状态API-统一] 响应不是JSON:`, text.substring(0, 200));
        error = { error: '服务器返回了非JSON响应' };
      }
      
      console.error(`[关注状态API-统一] 后端返回错误状态码:`, response.status);
      return NextResponse.json(
        { error: error.error || '检查关注状态失败', isFollowing: false }, 
        { status: response.status }
      );
    }
    
    let data;
    try {
      data = await response.json();
      console.log(`[关注状态API-统一] 后端返回数据:`, data);
    } catch (e) {
      console.error(`[关注状态API-统一] 解析响应失败:`, e);
      data = { isFollowing: false };
    }
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[关注状态API-统一] 服务器错误:`, error);
    console.error(`[关注状态API-统一] 错误堆栈:`, error.stack);
    return NextResponse.json(
      { error: error.message || '服务器错误', isFollowing: false }, 
      { status: 500 }
    );
  }
} 