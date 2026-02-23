# """
# Aiaimi (aiaicc) API Key 验证工具
# 用于验证 API Key 有效性并获取额度信息
# """
# import requests
# import urllib3
# import os

# # 禁用 SSL 警告
# urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# # --- 配置区域 ---
# AIAIMI_BASE_URL = "https://aiaimi.cc"
# AIAIMI_USER = "3"
# AIAIMI_AUTH_KEY = "wHZXM5oncgJnmDOwvG8BijXunBXM"

# # 代理配置（如果需要的话，设置为 None 表示不使用代理）
# # 例如: "http://127.0.0.1:7890" 或 "socks5://127.0.0.1:1080"
# PROXY = os.getenv("HTTPS_PROXY") or os.getenv("HTTP_PROXY") or None


# def validate_aiaimi_key(api_key: str, use_proxy: bool = True) -> dict:
#     """
#     验证 Aiaimi 平台的 API Key
    
#     Args:
#         api_key: 要验证的 API Key
#         use_proxy: 是否使用代理
        
#     Returns:
#         dict: 包含验证结果的字典
#     """
#     url = f"{AIAIMI_BASE_URL}/api/token/search?keyword=&token={api_key}"
    
#     headers = {
#         "New-Api-User": AIAIMI_USER,
#         "Authorization": AIAIMI_AUTH_KEY,
#     }
    
#     # 代理设置
#     proxies = None
#     if use_proxy and PROXY:
#         proxies = {"http": PROXY, "https": PROXY}
#         print(f"[INFO] 使用代理: {PROXY}")
    
#     try:
#         response = requests.get(
#             url, 
#             headers=headers, 
#             verify=False, 
#             timeout=30,
#             proxies=proxies
#         )
        
#         print(f"[DEBUG] HTTP Status: {response.status_code}")
        
#         if response.status_code != 200:
#             return {
#                 "valid": False,
#                 "error": f"HTTP 错误: {response.status_code}"
#             }
        
#         # 尝试解析 JSON
#         try:
#             result = response.json()
#         except Exception as e:
#             print(f"[DEBUG] Response Text: {response.text[:500]}")
#             return {
#                 "valid": False,
#                 "error": f"JSON 解析失败: {e}"
#             }
        
#         if not result.get("success"):
#             return {
#                 "valid": False,
#                 "error": f"API 返回失败: {result.get('message', '未知')}"
#             }
        
#         data_list = result.get("data", [])
#         if not data_list:
#             return {
#                 "valid": False,
#                 "error": "未找到令牌数据"
#             }
        
#         info = data_list[0]
        
#         # 获取原始额度
#         remain_quota = info.get("remain_quota", 0)
#         used_quota = info.get("used_quota", 0)
        
#         # Aiaimi 额度计算公式
#         remain_sheets = (remain_quota / 500000.0) / 1.5
#         used_sheets = (used_quota / 500000.0) / 1.5
        
#         name = info.get("name", "未命名")
        
#         return {
#             "valid": True,
#             "name": name,
#             "remain": round(remain_sheets, 2),
#             "used": round(used_sheets, 2),
#             "remain_quota": remain_quota,
#             "used_quota": used_quota,
#         }
        
#     except requests.exceptions.Timeout:
#         return {"valid": False, "error": "请求超时，可能需要配置代理"}
#     except requests.exceptions.RequestException as e:
#         return {"valid": False, "error": f"网络错误: {e}"}
#     except Exception as e:
#         return {"valid": False, "error": f"未知错误: {e}"}


# def main():
#     print("=" * 50)
#     print("Aiaimi (aiaicc) API Key 验证工具")
#     print("=" * 50)
    
#     if PROXY:
#         print(f"当前代理: {PROXY}")
#     else:
#         print("未配置代理 (可设置环境变量 HTTPS_PROXY)")
    
#     api_key = input("\n请输入要验证的 API Key: ").strip()
    
#     if not api_key:
#         print("❌ API Key 不能为空")
#         return
    
#     print("\n正在验证...")
#     result = validate_aiaimi_key(api_key)
    
#     print("\n" + "-" * 50)
#     if result["valid"]:
#         print("✅ API Key 有效!")
#         print(f"   令牌名称: {result['name']}")
#         print(f"   剩余额度: {result['remain']} 张")
#         print(f"   已使用: {result['used']} 张")
#         print(f"   原始剩余: {result['remain_quota']}")
#         print(f"   原始已用: {result['used_quota']}")
#     else:
#         print(f"❌ API Key 无效: {result.get('error', '未知错误')}")
#     print("-" * 50)


# if __name__ == "__main__":
#     main()


"""
Aiaimi (aiaicc) API Key 验证工具
用于验证 API Key 有效性并获取额度信息
"""
import requests
import urllib3

# 禁用 SSL 警告（因为 aiaimi 需要跳过 TLS 验证）
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# --- 配置区域 ---
AIAIMI_BASE_URL = "https://ttest.aiaimi.cc"
AIAIMI_USER = "3"
AIAIMI_AUTH_KEY = "wHZXM5oncgJnmDOwvG8BijXunBXM"


def validate_aiaimi_key(api_key: str) -> dict:
    """
    验证 Aiaimi 平台的 API Key
    
    Args:
        api_key: 要验证的 API Key
        
    Returns:
        dict: 包含验证结果的字典
            - valid: bool, 是否有效
            - name: str, 令牌名称
            - remain: float, 剩余额度（张数）
            - used: float, 已使用额度（张数）
            - remain_quota: float, 原始剩余额度
            - used_quota: float, 原始已使用额度
            - error: str, 错误信息（如果有）
    """
    url = f"{AIAIMI_BASE_URL}/api/token/search?keyword=&token={api_key}"
    
    headers = {
        "New-Api-User": AIAIMI_USER,
        "Authorization": AIAIMI_AUTH_KEY,
    }
    
    try:
        # 发送请求，跳过 SSL 验证
        response = requests.get(url, headers=headers, verify=False, timeout=10)
        
        if response.status_code != 200:
            return {
                "valid": False,
                "error": f"HTTP 错误: {response.status_code}"
            }
        
        result = response.json()
        
        if not result.get("success"):
            return {
                "valid": False,
                "error": "API 返回失败"
            }
        
        data_list = result.get("data", [])
        if not data_list:
            return {
                "valid": False,
                "error": "未找到令牌数据"
            }
        
        info = data_list[0]
        
        # 获取原始额度
        remain_quota = info.get("remain_quota", 0)
        used_quota = info.get("used_quota", 0)
        
        # Aiaimi 额度计算公式
        remain_sheets = (remain_quota / 500000.0) / 1.5
        used_sheets = (used_quota / 500000.0) / 1.5
        
        name = info.get("name", "未命名")
        
        return {
            "valid": True,
            "name": name,
            "remain": round(remain_sheets, 2),
            "used": round(used_sheets, 2),
            "remain_quota": remain_quota,
            "used_quota": used_quota,
        }
        
    except requests.exceptions.Timeout:
        return {"valid": False, "error": "请求超时"}
    except requests.exceptions.RequestException as e:
        return {"valid": False, "error": f"网络错误: {e}"}
    except Exception as e:
        return {"valid": False, "error": f"未知错误: {e}"}


def main():
    print("=" * 50)
    print("Aiaimi (aiaicc) API Key 验证工具")
    print("=" * 50)
    
    api_key = input("\n请输入要验证的 API Key: ").strip()
    
    if not api_key:
        print("❌ API Key 不能为空")
        return
    
    print("\n正在验证...")
    result = validate_aiaimi_key(api_key)
    
    print("\n" + "-" * 50)
    if result["valid"]:
        print("✅ API Key 有效!")
        print(f"   令牌名称: {result['name']}")
        print(f"   剩余额度: {result['remain']} 张")
        print(f"   已使用: {result['used']} 张")
        print(f"   原始剩余: {result['remain_quota']}")
        print(f"   原始已用: {result['used_quota']}")
    else:
        print(f"❌ API Key 无效: {result.get('error', '未知错误')}")
    print("-" * 50)


if __name__ == "__main__":
    main()