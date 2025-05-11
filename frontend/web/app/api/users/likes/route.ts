import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") || "1";
    const limit = searchParams.get("limit") || "10";
    const userId = searchParams.get("userId");
    const address = searchParams.get("address");
    
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;
    
    if (!token && !userId && !address) {
      return NextResponse.json({ error: "未认证，请先登录" }, { status: 401 });
    }
    
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("limit", limit);
    if (userId) params.append("userId", userId);
    if (address) params.append("address", address);
    
    const response = await fetch(`${API_BASE_URL}/api/user/likes?${params.toString()}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token && { "Authorization": `Bearer ${token}` })
      },
    });
    
    if (!response.ok) {
      throw new Error(`获取用户点赞列表失败: ${response.statusText || response.status}`);
    }
    
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("获取用户点赞列表失败:", error);
    return NextResponse.json({ error: "获取点赞列表失败" }, { status: 500 });
  }
}
