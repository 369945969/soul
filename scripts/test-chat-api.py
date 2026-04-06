#!/usr/bin/env python3
"""
测试 Chat API
"""
import subprocess
import time
import sys
import json
import urllib.request
import urllib.error

SERVER_URL = "http://localhost:47779"

def print_step(msg):
    print(f"\n{'='*60}")
    print(f"🧪 {msg}")
    print(f"{'='*60}")

def print_success(msg):
    print(f"✅ {msg}")

def print_error(msg):
    print(f"❌ {msg}")

def http_request(url, method="GET", data=None):
    """发送 HTTP 请求"""
    try:
        headers = {"Content-Type": "application/json"}
        if data:
            data = json.dumps(data).encode("utf-8")
        
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": str(e)}

def test_health():
    """测试健康检查"""
    print_step("测试 1: 健康检查")
    
    result = http_request(f"{SERVER_URL}/api/chat/health")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    if result.get("status") == "ok":
        print_success("健康检查通过")
        return True
    else:
        print_error("健康检查失败")
        return False

def test_soul_status():
    """测试 Soul 状态"""
    print_step("测试 2: Soul 状态")
    
    result = http_request(f"{SERVER_URL}/api/health")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    if result.get("status") == "alive":
        soul = result.get("soul", {})
        if soul.get("initialized"):
            print_success("Soul 已初始化")
            return True
        else:
            print_error("Soul 未初始化，需要先运行 soul_setup")
            return False
    else:
        print_error("Soul 状态检查失败")
        return False

def main():
    print("="*60)
    print("Chat API 功能验证")
    print("="*60)
    
    # 测试健康检查
    test_health()
    
    # 测试 Soul 状态
    test_soul_status()
    
    print("\n" + "="*60)
    print("验证完成")
    print("="*60)
    
    print("\n注意：Soul 需要 soul_setup 才能使用 Chat API。")
    print("请通过主界面或其他方式运行 soul_setup 工具。")

if __name__ == "__main__":
    main()
