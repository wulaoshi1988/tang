# 《大唐古诗穿越记》- GitHub Pages 静态托管版

✅ **部署在 GitHub Pages，通过 HTTPS 直接访问，稳定可靠！**

## 快速开始

### 在线访问

**游戏地址：** https://wulaoshi1988.github.io/tang/

直接访问即可开始游戏！

### 本地运行

如果想本地修改后预览：

```bash
# 使用 Python 启动本地服务器
python -m http.server 8000

# 然后在浏览器打开
http://localhost:8000/tang_poetry_v2.html
```

## 版本说明

### 本版本特点

- ✅ **零依赖部署**：GitHub Pages 自动托管
- ✅ **HTTPS 访问**：无需担心跨域问题
- ✅ **稳定可靠**：不依赖第三方代理
- ✅ **完整功能**：保留所有游戏功能

## 配置说明

### 默认 API 配置

项目已预设以下配置：

```
API 地址：https://api.code-relay.com/v1
API Key：sk-9mETcZgCAi1oaR1SI9IarN5H862gOW7Bg46MwB0F5adtQtaV
模型：gemini-3-pro-preview
```

### 自定义配置

如需使用其他 API 服务：

1. 点击底部导航栏的 **⚙️ 设置**
2. 修改 API 地址和 API Key
3. 选择或输入模型名称
4. 点击 **保存设置** 和 **测试连接**

## 支持的 API 服务

以下 API 服务已测试可用：

- OpenAI 官方 API
- API Code-Relay（代理服务）
- DeepSeek
- Moonshot（月之暗面）
- 其他兼容 OpenAI 格式的 API

## 部署说明

### 如何部署到 GitHub Pages

本项目已自动启用 GitHub Pages，访问地址：
```
https://wulaoshi1988.github.io/tang/
```

如果需要修改项目并重新部署：

```bash
# 1. 修改文件
git add .
git commit -m "更新内容"
git push

# 2. 等待 1-2 分钟，GitHub Pages 自动更新
```

## 常见问题

### Q1: 为什么选择 GitHub Pages？

**A:** GitHub Pages 提供免费、稳定、HTTPS 的静态托管，无需任何服务器配置，最适合这种纯前端项目。

### Q2: 测试连接失败怎么办？

**A:** 尝试以下步骤：
1. 检查 API Key 是否正确
2. 检查网络连接
3. 确保使用 HTTPS 访问（而非 file://）
4. 稍等片刻再试（可能是 API 服务临时繁忙）

### Q3: 数据保存在哪里？

**A:** 游戏数据保存在浏览器的 **localStorage** 中，不会上传到任何服务器。每个浏览器独立存储。

### Q4: 可以离线使用吗？

**A:** 不行，游戏需要联网调用 AI API。但可以提前将 HTML 和 JS 文件下载到本地，通过本地服务器运行。

## 存档管理

### 导出存档

在 **设置** 页面点击 **📤 导出存档**，会下载 `.json` 文件。

### 导入存档

在 **设置** 页面点击 **📥 导入存档**，选择之前导出的 `.json` 文件。

### 重置游戏

在 **设置** 页面点击 **🔄 重新开始**，将清空所有进度（不可恢复）。

## 文件说明

```
tang/
├── tang_poetry_v2.html      # 游戏主文件
├── tang_poetry_game.js      # 游戏逻辑
├── quick_star.py            # Python 启动脚本（本地调试用）
└── README.md                # 本说明文件
```

## 版本历史

### v3.0 (GitHub Pages 托管版)
- ✅ 部署到 GitHub Pages
- ✅ 移除 CORS 代理，直接 HTTPS 访问
- ✅ 更稳定、更快速

### v2.0 (CORS 代理版)
- 使用 CORS 代理中转请求
- 可直接双击 HTML 运行（但代理不稳定）

### v1.0 (Python 服务器版)
- 使用 Python HTTP 服务器
- 需要 `quick_star.py` 启动

## 技术支持

如遇问题，请检查：
1. 浏览器是否支持 ES6+（推荐 Chrome/Firefox/Edge）
2. 网络连接是否正常
3. API Key 是否有效
4. 确保使用 HTTPS 访问（而非 file://）

---

**享受你的诗词穿越之旅！** 🎋
