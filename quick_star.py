#!/usr/bin/env python3
"""
快速启动《大唐古诗穿越记》
解决API配置问题的专用启动脚本
"""

import http.server
import socketserver
import webbrowser
import threading
import time
import sys
import os
import json
from urllib.parse import urlparse

# 配置
PORT = 8000
GAME_FILE = "tang_poetry_v2.html"
BACKUP_PORT = 8888

def check_game_files():
    """检查游戏文件完整性"""
    required_files = [GAME_FILE, "tang_poetry_game.js"]
    missing_files = []
    
    for file in required_files:
        if not os.path.exists(file):
            missing_files.append(file)
    
    if missing_files:
        print(f"❌ 错误：缺少游戏文件：{', '.join(missing_files)}")
        return False
    
    print(f"✅ 游戏文件检查通过")
    return True

def analyze_api_config():
    """分析API配置问题"""
    print(f"🔍 分析API配置问题...")
    print(f"")
    
    # 读取游戏JS文件检查配置
    try:
        with open("tang_poetry_game.js", "r", encoding="utf-8") as f:
            content = f.read()
            
        # 检查API配置
        if "api.code-relay.com" in content:
            print(f"📋 发现API配置：")
            print(f"   - API地址：https://api.code-relay.com/v1")
            print(f"   - 默认模型：gemini-3-pro-preview")
            print(f"   - 配置状态：已预设")
            print(f"")
            print(f"⚠️  常见问题：")
            print(f"   1. 直接双击HTML文件会触发CORS跨域限制")
            print(f"   2. 浏览器阻止从file://协议访问外部API")
            print(f"   3. 需要使用HTTP服务器运行")
            print(f"")
            print(f"✅ 解决方案：使用本地HTTP服务器启动游戏")
            
    except Exception as e:
        print(f"⚠️  无法分析API配置：{e}")

def test_server_port(port):
    """测试端口是否可用"""
    try:
        with socketserver.TCPServer(("", port), http.server.SimpleHTTPRequestHandler) as test_server:
            return True
    except OSError:
        return False

def start_server(port):
    """启动本地服务器"""
    try:
        with socketserver.TCPServer(("", port), http.server.SimpleHTTPRequestHandler) as httpd:
            print(f"========================================")
            print(f"  《大唐古诗穿越记》已启动")
            print(f"========================================")
            print(f"✅ 服务器地址：http://localhost:{port}")
            print(f"📱 游戏地址：http://localhost:{port}/{GAME_FILE}")
            print(f"")
            print(f"🌐 游戏已在浏览器中自动打开")
            print(f"")
            print(f"📌 操作指南：")
            print(f"   1. 点击底部导航栏的 ⚙️ 设置")
            print(f"   2. 点击 🔌 测试连接")
            print(f"   3. 如果成功，点击 📥 获取模型")
            print(f"   4. 开始体验游戏！")
            print(f"")
            print(f"⚠️  注意事项：")
            print(f"   - 按Ctrl+C停止服务器")
            print(f"   - 关闭此窗口会停止服务器")
            print(f"   - 服务器停止后游戏无法继续")
            print(f"========================================")
            print(f"")
            
            httpd.serve_forever()
            
    except OSError as e:
        print(f"❌ 启动服务器失败：{e}")
        return False
    
    return True

def open_browser(port):
    """在浏览器中打开游戏"""
    time.sleep(2)  # 等待服务器完全启动
    url = f"http://localhost:{port}/{GAME_FILE}"
    
    print(f"🚀 正在打开浏览器...")
    
    # 尝试打开浏览器
    if webbrowser.open(url):
        print(f"✅ 浏览器已打开")
        print(f"📍 访问地址：{url}")
    else:
        print(f"⚠️  自动打开浏览器失败")
        print(f"📌 请手动在浏览器中访问：{url}")
        print(f"")
        print(f"💡 提示：复制上面的地址粘贴到浏览器地址栏")

def main():
    """主函数"""
    print(f"========================================")
    print(f"  《大唐古诗穿越记》快速启动器")
    print(f"  解决API配置问题专用版本")
    print(f"========================================")
    print(f"")
    
    # 检查游戏文件
    if not check_game_files():
        print(f"")
        print(f"❌ 请确保游戏文件完整后再试")
        input("按回车键退出...")
        sys.exit(1)
    
    print(f"")
    
    # 分析API配置
    analyze_api_config()
    print(f"")
    print(f"========================================")
    print(f"")
    
    # 确定使用的端口
    use_port = PORT
    if not test_server_port(PORT):
        print(f"⚠️  端口 {PORT} 被占用，尝试使用端口 {BACKUP_PORT}...")
        if test_server_port(BACKUP_PORT):
            use_port = BACKUP_PORT
        else:
            print(f"❌ 端口 {PORT} 和 {BACKUP_PORT} 都被占用")
            print(f"   请关闭其他程序或修改端口配置")
            input("按回车键退出...")
            sys.exit(1)
    
    # 启动浏览器线程
    browser_thread = threading.Thread(target=open_browser, args=(use_port,))
    browser_thread.daemon = True
    browser_thread.start()
    
    # 启动服务器（主线程）
    try:
        if not start_server(use_port):
            print(f"")
            input("按回车键退出...")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print(f"")
        print(f"========================================")
        print(f"  服务器已停止")
        print(f"  感谢您的使用！")
        print(f"========================================")
        sys.exit(0)

if __name__ == "__main__":
    main()