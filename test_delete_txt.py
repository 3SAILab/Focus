import http.client
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# -------------------------- 配置项 --------------------------
FILE_PATH = r"C:\Users\45374\Desktop\key.txt"   # 您的日志文件路径
API_DOMAIN = "api.vectorengine.ai"
HEADERS = {
    'new-api-user': '142538',  # ⚠️ 请确认您的 User ID
    'Authorization': 'SxpO4tsw05gn5icEKyBb4iSKfE/Y3TEj', # ⚠️ 请确认您的 Auth Key
    'content-type': 'application/json'
}
MAX_WORKERS = 10  # 并发删除线程数

# -------------------------- 核心逻辑 --------------------------

def extract_keys_from_log_file(file_path):
    """
    针对您的日志格式：'前缀信息 | sk-xxxxx'
    使用 split('|') 进行精准切割
    """
    keys = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        print(f"📄 正在解析文件，共 {len(lines)} 行...")
        
        for line in lines:
            line = line.strip()
            # 忽略空行或不包含分隔符的行
            if not line or "|" not in line:
                continue
            
            # ✅ 核心修改：按竖线分割，取最后一部分
            parts = line.split("|")
            possible_key = parts[-1].strip()  # 去除首尾空格
            
            # 再次确认提取出来的是不是 sk- 开头
            if possible_key.startswith("sk-"):
                keys.append(possible_key)
        
        # 去重
        keys = list(set(keys))
        return keys
    except Exception as e:
        print(f"❌ 读取文件失败: {e}")
        return []

def fetch_all_tokens_map():
    """
    拉取服务器上所有令牌，建立 {Key: ID} 映射表
    这是唯一能绕过 Search 接口搜不到问题的办法
    """
    print("🔄 正在拉取服务器所有 Token (为了获取 ID)...")
    token_map = {} 
    
    page = 0
    while True:
        try:
            conn = http.client.HTTPSConnection(API_DOMAIN, timeout=15)
            conn.request("GET", f"/api/token/?p={page}&size=100", headers=HEADERS)
            res = conn.getresponse()
            
            if res.status != 200:
                print(f"❌ 拉取列表失败 Page {page}: HTTP {res.status}")
                break

            data_str = res.read().decode("utf-8")
            data = json.loads(data_str)
            conn.close()

            if not data.get("success"):
                break

            # 兼容处理返回数据
            response_data = data.get("data", {})
            if isinstance(response_data, list):
                items = response_data
            elif isinstance(response_data, dict) and "items" in response_data:
                items = response_data["items"]
            else:
                items = []

            if not items:
                break 

            for item in items:
                k = item.get("key")
                tid = item.get("id")
                if k and tid:
                    token_map[k] = tid
                    # 同时存一个去掉前缀的版本以防万一
                    if k.startswith("sk-"):
                        token_map[k.replace("sk-", "")] = tid

            # print(f"   已扫描第 {page+1} 页...") # 减少刷屏
            
            if len(items) < 100 or page > 200:
                break
            page += 1
            
        except Exception as e:
            print(f"❌ 拉取列表异常: {e}")
            break
            
    return token_map

def delete_token_task(token_id, key):
    """删除任务"""
    conn = http.client.HTTPSConnection(API_DOMAIN, timeout=10)
    try:
        conn.request("DELETE", f"/api/token/{token_id}/", headers=HEADERS)
        res = conn.getresponse()
        if res.status in [200, 201, 204]:
            return True, "已删除"
        else:
            return False, f"HTTP {res.status}"
    except Exception as e:
        return False, str(e)
    finally:
        conn.close()

# -------------------------- 主程序 --------------------------
if __name__ == "__main__":
    # 1. 精准提取 Key
    local_keys = extract_keys_from_log_file(FILE_PATH)
    
    if not local_keys:
        print("❌ 未能提取到任何 Key！")
        print("   请检查 key.txt 内容格式是否为：'其他文字 | sk-xxxxx'")
        exit()
    
    print(f"✅ 从文件中精准提取到 {len(local_keys)} 个 Key")

    # 2. 拉取服务器 ID 映射
    server_map = fetch_all_tokens_map()
    print(f"☁️ 服务器现有 Token 总数: {len(server_map)}")
    print("=" * 60)

    # 3. 匹配并删除
    tasks = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {}
        
        for key in local_keys:
            # 尝试匹配
            token_id = server_map.get(key)
            
            if token_id:
                futures[executor.submit(delete_token_task, token_id, key)] = key
            else:
                # 打印前10个和后4个字符
                short_key = f"{key[:10]}...{key[-4:]}"
                print(f"⚠️ 跳过: {short_key} | 服务器上不存在 (可能已删)")

        if not futures:
            print("🎉 没有需要删除的 Token (所有提取的 Key 都不在服务器上)。")
            exit()

        print(f"🚀 开始执行删除任务 ({len(futures)} 个)...")
        
        processed = 0
        for future in as_completed(futures):
            key = futures[future]
            processed += 1
            success, msg = future.result()
            short_key = f"{key[:10]}...{key[-4:]}"
            
            if success:
                print(f"[{processed}/{len(futures)}] ✅ 删除成功: {short_key}")
            else:
                print(f"[{processed}/{len(futures)}] ❌ 删除失败: {short_key} | {msg}")

    print("=" * 60)
    print("处理完毕。")