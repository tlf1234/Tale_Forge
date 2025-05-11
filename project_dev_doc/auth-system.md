# Tale Forge 统一认证系统

本文档详细介绍了Tale Forge平台的统一认证系统，包括其设计理念、实现方式和使用指南。

## 设计理念

Tale Forge平台支持多种登录方式：
1. 钱包连接登录（Web3方式）
2. 电子邮件登录（传统Web2方式）

为了统一处理这些不同的认证方式，我们设计了一个统一的认证系统，可以：
- 支持多种认证方式识别用户
- 简化API开发流程
- 确保认证逻辑的一致性
- 提高代码复用率

## 后端实现

### AuthService.authenticateUser

在`backend/src/services/auth.service.ts`中，我们实现了一个统一的认证函数：

```typescript
async authenticateUser(options: {
  address?: string;
  userId?: string;
  token?: string;
}): Promise<{ user: User; userId: string }>
```

这个函数的特点：
- 支持三种认证方式：用户ID、认证令牌、钱包地址
- 按优先级依次尝试验证：userId > token > address
- 成功返回用户信息和用户ID
- 失败抛出相应的错误信息

### 使用示例

在API端点中使用：

```typescript
app.get('/api/some-endpoint', async (req, res) => {
  try {
    // 使用统一认证函数验证用户
    const { user, userId } = await authService.authenticateUser({
      address: req.query.address as string,
      userId: req.query.userId as string,
      token: (req.query.token || req.headers.authorization?.replace('Bearer ', '')) as string
    });
    
    // 用户已验证，可以访问资源
    // ...
    
    res.json({ success: true, data: ... });
  } catch (authError) {
    // 认证失败
    res.status(401).json({ error: (authError as Error).message || '认证失败' });
  }
});
```

## 前端实现

### 认证中间件

在`frontend/web/middleware/authMiddleware.ts`中，我们实现了一系列工具函数：

1. **extractAuthInfo**: 从请求中提取所有可能的认证信息
2. **withAuth**: 一个高阶函数，用于包装API路由处理函数，确保请求包含认证信息
3. **buildAuthParams**: 构建包含认证信息的查询参数
4. **buildAuthHeaders**: 构建包含认证信息的请求头

### 在API路由中使用

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, buildAuthParams, buildAuthHeaders } from '@/middleware/authMiddleware'

async function handleRequest(request: NextRequest, authInfo: any) {
  // authInfo 包含提取的认证信息
  // 构建API请求
  const queryParams = buildAuthParams(authInfo)
  const headers = buildAuthHeaders(authInfo)
  
  // 调用后端API
  // ...
}

// 使用中间件包装处理函数
export const GET = withAuth(handleRequest)
```

## 在前端组件中使用

在React组件中，可以通过以下方式获取用户认证状态：

```typescript
import { useAuth } from '@/hooks/useAuth'

function MyComponent() {
  const { user, token, isAuthenticated } = useAuth()
  
  // 检查用户是否已登录
  if (!isAuthenticated) {
    return <div>请先登录</div>
  }
  
  // 使用用户信息
  return <div>欢迎, {user.nickname || user.address}</div>
}
```

## 最佳实践

1. **始终使用统一认证函数**：在所有需要验证用户身份的API端点中使用`authenticateUser`函数。

2. **优先使用中间件**：在前端API路由中，使用`withAuth`中间件简化认证流程。

3. **检查isAuthenticated**：在需要认证的页面或组件中，始终使用`isAuthenticated`检查用户登录状态，而不是只检查特定的登录方式（如isConnected）。

4. **传递完整认证信息**：向后端API发送请求时，应当传递所有可用的认证信息（地址、用户ID、令牌），让后端决定使用哪种方式验证。

5. **适当处理认证错误**：为不同的认证错误提供友好的错误信息，指导用户正确登录。

## 故障排除

如果遇到认证问题，可以检查以下几点：

1. **令牌是否有效**：检查JWT令牌是否过期或无效。
2. **用户ID是否正确**：验证使用的用户ID在数据库中是否存在。
3. **钱包地址格式**：确保钱包地址格式正确（小写、有效的以太坊地址）。
4. **请求头设置**：Authorization头应该使用"Bearer "前缀。
5. **Cookie设置**：确保token cookie正确设置且未过期。

---

有关认证系统的任何问题或建议，请联系开发团队。 