#!/usr/bin/env python3
"""
启动服务器并运行测试
"""
import subprocess
import time
import sys
import requests
import json
import uuid
import signal
import os

SERVER_URL = "http://localhost:47779"
WORKSPACE = "/home/node/.openclaw/workspace/soul"

def print_step(msg):
    print(f"\n{'='*60}")
    print(f"🧪 {msg}")
    print(f"{'='*60}")

def print_success(msg):
    print(f"✅ {msg}")

def print_error(msg):
    print(f"❌ {msg}")

def check_server():
    """检查服务器状态"""
    try:
        resp = requests.get(f"{SERVER_URL}/api/chat/health", timeout=3)
        return resp.status_code == 200
    except:
        return False

def start_server():
    """启动服务器"""
    print_step("启动服务器")
    
    try:
        # 启动服务器进程
        server_proc = subprocess.Popen(
            ["node", "dist/server.js"],
            cwd=WORKSPACE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # 等待服务器启动
        print("等待服务器启动...")
        for i in range(30):
            if check_server():
                print_success("服务器启动成功")
                return server_proc
            time.sleep(1)
        
        print_error("服务器启动超时")
        server_proc.terminate()
        return None
        
    except Exception as e:
        print_error(f"启动失败：{e}")
        return None

def test_health():
    """测试健康检查"""
    print_step("测试 1: 健康检查")
    
    try:
        resp = requests.get(f"{SERVER_URL}/api/chat/health")
        data = resp.json()
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        if data.get("status") == "ok":
            print_success("健康检查通过")
            return True
        else:
            print_error("健康检查失败")
            return False
    except Exception as e:
        print_error(f"测试失败：{e}")
        return False

def test_create_user():
    """测试创建用户"""
    print_step("测试 2: 创建用户")
    
    try:
        resp = requests.post(
            f"{SERVER_URL}/api/chat/users",
            json={}
        )
        data = resp.json()
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        if data.get("userId"):
            print_success(f"用户创建成功：{data['userId']}")
            return data["userId"]
        else:
            print_error("用户创建失败")
            return None
    except Exception as e:
        print_error(f"测试失败：{e}")
        return None

def test_chat_message(user_id):
    """测试发送消息"""
    print_step("测试 3: 发送消息")
    
    try:
        resp = requests.post(
            f"{SERVER_URL}/api/chat",
            json={
                "userId": user_id,
                "message": "你好！这是我的第一次对话。"
            }
        )
        data = resp.json()
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        if data.get("response"):
            print_success(f"消息发送成功，收到 {len(data['response'])} 字符响应")
            return data
        else:
            print_error("消息发送失败")
            return None
    except Exception as e:
        print_error(f"测试失败：{e}")
        return None

def test_memory_isolation():
    """测试记忆隔离"""
    print_step("测试 4: 记忆隔离")
    
    try:
        # 创建用户 A
        resp = requests.post(f"{SERVER_URL}/api/chat/users", json={})
        user_a = resp.json()["userId"]
        print(f"用户 A: {user_a}")
        
        # 创建用户 B
        resp = requests.post(f"{SERVER_URL}/api/chat/users", json={})
        user_b = resp.json()["userId"]
        print(f"用户 B: {user_b}")
        
        # 用户 A 设置记忆
        resp = requests.post(f"{SERVER_URL}/api/chat", json={
            "userId": user_a,
            "message": "我的名字是 Alice，我喜欢蓝色。"
        })
        print(f"用户 A 设置记忆：{resp.json()['response'][:50]}...")
        
        # 用户 B 设置记忆
        resp = requests.post(f"{SERVER_URL}/api/chat", json={
            "userId": user_b,
            "message": "我的名字是 Bob，我喜欢红色。"
        })
        print(f"用户 B 设置记忆：{resp.json()['response'][:50]}...")
        
        # 用户 A 查询记忆
        resp = requests.post(f"{SERVER_URL}/api/chat", json={
            "userId": user_a,
            "message": "我叫什么名字？我喜欢什么颜色？"
        })
        response_a = resp.json()["response"]
        print(f"用户 A 查询：{response_a}")
        
        # 用户 B 查询记忆
        resp = requests.post(f"{SERVER_URL}/api/chat", json={
            "userId": user_b,
            "message": "我叫什么名字？我喜欢什么颜色？"
        })
        response_b = resp.json()["response"]
        print(f"用户 B 查询：{response_b}")
        
        # 验证记忆隔离
        a_has_name = "Alice" in response_a or "名字" in response_a
        b_has_name = "Bob" in response_b or "名字" in response_b
        
        if a_has_name and b_has_name:
            print_success("记忆隔离正常")
            return True
        else:
            print_error("记忆可能未正确隔离")
            return False
            
    except Exception as e:
        print_error(f"测试失败：{e}")
        return False

def test_list_users():
    """测试列出用户"""
    print_step("测试 5: 列出用户")
    
    try:
        resp = requests.get(f"{SERVER_URL}/api/chat/users")
        data = resp.json()
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        print_success(f"共有 {data['count']} 个用户")
        return True
    except Exception as e:
        print_error(f"测试失败：{e}")
        return False

def test_sessions():
    """测试会话列表"""
    print_step("测试 6: 会话列表")
    
    try:
        resp = requests.get(f"{SERVER_URL}/api/chat/sessions")
        data = resp.json()
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        print_success(f"共有 {data['count']} 个会话")
        return True
    except Exception as e:
        print_error(f"测试失败：{e}")
        return False

def main():
    print("="*60)
    print("Chat API 功能验证")
    print("="*60)
    
    # 启动服务器
    server_proc = start_server()
    if not server_proc:
        print_error("无法启动服务器，测试终止")
        sys.exit(1)
    
    # 运行测试
    results = []
    
    results.append(("健康检查", test_health()))
    results.append(("创建用户", test_create_user() is not None))
    results.append(("发送消息", test_chat_message("test-user") is not None))
    results.append(("记忆隔离", test_memory_isolation()))
    results.append(("列出用户", test_list_users()))
    results.append(("会话列表", test_sessions()))
    
    # 总结
    print_step("测试总结")
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✅" if result else "❌"
        print(f"{status} {name}")
    
    print(f"\n通过率：{passed}/{total} ({passed/total*100:.1f}%)")
    
    # 关闭服务器
    print("\n关闭服务器...")
    server_proc.terminate()
    server_proc.wait()
    
    print("\n✅ 验证完成！")

if __name__ == "__main__":
    main()
