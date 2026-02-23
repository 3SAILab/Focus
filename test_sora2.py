# # import http.client
# # import json
# # import time
# # import concurrent.futures
# # from threading import Lock

# # # --- 配置部分 ---
# # API_HOST = "api.vectorengine.ai"
# # # 注意：生产环境中请勿将 Key 硬编码在代码里，建议使用环境变量
# # API_KEY = "Bearer sk-YIRSJjrtRablveDqg9NrJUtQe6q67g7JvRNUAsifrp6neD0h" 

# # headers = {
# #     'Accept': 'application/json',
# #     'Authorization': API_KEY,
# #     'Content-Type': 'application/json'
# # }

# # print_lock = Lock()

# # def safe_print(*args, **kwargs):
# #     """线程安全的打印函数"""
# #     with print_lock:
# #         print(*args, **kwargs)

# # def create_video_task(task_index):
# #     """第一步：创建视频生成任务"""
# #     conn = http.client.HTTPSConnection(API_HOST)
    
# #     payload = json.dumps({
# #         "images": [
# #             "https://filesystem.site/cdn/20250612/998IGmUiM2koBGZM3UnZeImbPBNIUL.png"
# #         ],
# #         "model": "sora-2",
# #         "orientation": "portrait",
# #         "prompt": "make animate",
# #         "size": "large",
# #         "duration": 15,
# #         "watermark": False
# #     })
    
# #     safe_print(f"[任务 {task_index}] >>> 正在提交任务...")
# #     conn.request("POST", "/v1/video/create", payload, headers)
    
# #     res = conn.getresponse()
# #     data = res.read().decode("utf-8")
# #     conn.close()
    
# #     try:
# #         response_json = json.loads(data)
# #         if "id" in response_json:
# #             safe_print(f"[任务 {task_index}] ✅ 任务提交成功! Task ID: {response_json['id']}")
# #             return response_json["id"]
# #         else:
# #             safe_print(f"[任务 {task_index}] ❌ 提交失败，未获取到ID: {data}")
# #             return None
# #     except json.JSONDecodeError:
# #         safe_print(f"[任务 {task_index}] ❌ 解析响应失败: {data}")
# #         return None

# # def poll_task_status(task_id, task_index):
# #     """第二步：循环查询任务状态直到完成"""
# #     safe_print(f"[任务 {task_index}] >>> 开始轮询任务状态 (ID: {task_id})...")
    
# #     while True:
# #         conn = http.client.HTTPSConnection(API_HOST)
# #         conn.request("GET", f"/v1/video/query?id={task_id}", headers=headers)
        
# #         res = conn.getresponse()
# #         data = res.read().decode("utf-8")
# #         conn.close()

# #         try:
# #             task_info = json.loads(data)
# #             status = task_info.get("status")
# #             progress = task_info.get("progress", 0)
            
# #             safe_print(f"[任务 {task_index}] Status: {status} | Progress: {progress}%")
            
# #             if status == "completed":
# #                 safe_print(f"\n[任务 {task_index}] 🎉 任务完成！")
# #                 return task_info
            
# #             elif status == "failed":
# #                 safe_print(f"\n[任务 {task_index}] ❌ 任务失败。")
# #                 safe_print(task_info)
# #                 return task_info
            
# #             else:
# #                 time.sleep(3)
                
# #         except json.JSONDecodeError:
# #             safe_print(f"[任务 {task_index}] ⚠️ 解析查询响应失败，稍后重试... Raw: {data}")
# #             time.sleep(3)

# # def run_single_task(task_index):
# #     """运行单个完整任务流程"""
# #     task_id = create_video_task(task_index)
    
# #     if task_id:
# #         final_result = poll_task_status(task_id, task_index)
        
# #         if final_result:
# #             video_url = final_result.get('video_url', 'N/A')
# #             safe_print(f"\n[任务 {task_index}] >>> 最终视频链接: {video_url}")
            
# #             # 保存结果到单独文件
# #             filename = f"final_response_task_{task_index}.json"
# #             with open(filename, "w", encoding="utf-8") as f:
# #                 json.dump(final_result, f, indent=4, ensure_ascii=False)
# #             safe_print(f"[任务 {task_index}] >>> 结果已保存至 {filename}")
            
# #             return {"task_index": task_index, "result": final_result}
    
# #     return {"task_index": task_index, "result": None}

# # # --- 主程序流程 ---

# # if __name__ == "__main__":
# #     NUM_TASKS = 4  # 同时启动的任务数量
    
# #     print(f"🚀 开始同时启动 {NUM_TASKS} 个视频生成任务...\n")
    
# #     # 使用线程池并行执行任务
# #     with concurrent.futures.ThreadPoolExecutor(max_workers=NUM_TASKS) as executor:
# #         # 提交所有任务
# #         futures = {executor.submit(run_single_task, i+1): i+1 for i in range(NUM_TASKS)}
        
# #         # 收集所有结果
# #         all_results = []
# #         for future in concurrent.futures.as_completed(futures):
# #             task_index = futures[future]
# #             try:
# #                 result = future.result()
# #                 all_results.append(result)
# #             except Exception as e:
# #                 safe_print(f"[任务 {task_index}] ❌ 执行异常: {e}")
    
# #     # 汇总所有结果
# #     print("\n" + "="*50)
# #     print("📊 所有任务执行完毕，汇总结果：")
# #     print("="*50)
    
# #     for r in sorted(all_results, key=lambda x: x["task_index"]):
# #         idx = r["task_index"]
# #         res = r["result"]
# #         if res and res.get("status") == "completed":
# #             print(f"  ✅ 任务 {idx}: 成功 - {res.get('video_url', 'N/A')}")
# #         elif res and res.get("status") == "failed":
# #             print(f"  ❌ 任务 {idx}: 失败")
# #         else:
# #             print(f"  ⚠️ 任务 {idx}: 未完成或无结果")
    
# #     # 保存汇总结果
# #     with open("all_results.json", "w", encoding="utf-8") as f:
# #         json.dump(all_results, f, indent=4, ensure_ascii=False)
# #     print("\n>>> 汇总结果已保存至 all_results.json")


# import requests
# import time
# import json

# # ================= 配置区域 =================
# # API URL
# SUBMIT_URL = "https://api.apimart.ai/v1/videos/generations"
# QUERY_BASE_URL = "https://api.apimart.ai/v1/tasks/"

# # Headers (Token 保持不变)
# headers = {
#     "Authorization": "Bearer sk-hcJXXfhjsJl15fyH36vidjuMTSwHkEyk6LMuQvaHhwSAtVXZ",
#     "Content-Type": "application/json"
# }

# # 提交的参数
# payload = {
#     "model": "sora-2",
#     "prompt": "A waterfall cascading down forming a rainbow",
#     "duration": 15,
#     "aspect_ratio": "16:9",
#     "image_urls": ["https://cdn.apimart.ai/doc/9998238782946594-f62f70ce-348c-4b13-bb5f-15f17bee676b-image_task_01K88BEGZHVJWJ3ZV6HY99SWQR_0.png"]
# }

# # 强制不使用系统代理，解决 SSL 报错
# proxies = { "http": None, "https": None }

# # ================= 第一步：提交任务 =================
# print("1. 正在提交任务...")

# try:
#     submit_response = requests.post(SUBMIT_URL, json=payload, headers=headers, proxies=proxies)
#     submit_response.raise_for_status() # 检查请求是否成功
#     submit_data = submit_response.json()
    
#     # 解析 Task ID (根据你提供的第一个 JSON 结构，data 是一个列表)
#     # 结构: {"data": [ {"task_id": "..."} ] }
#     if submit_data.get("code") == 200 and submit_data.get("data"):
#         task_id = submit_data["data"][0]["task_id"]
#         print(f"✅ 任务提交成功! Task ID: {task_id}")
#     else:
#         print("❌ 提交失败，未获取到 Task ID")
#         print(submit_data)
#         exit() # 终止程序

# except Exception as e:
#     print(f"❌ 请求发生错误: {e}")
#     exit()

# # ================= 第二步：轮询查询状态 =================
# print(f"2. 开始轮询查询状态 (每隔 5 秒查一次)...")

# # 拼接查询 URL: https://api.apimart.ai/v1/tasks/{task_id}
# query_url = f"{QUERY_BASE_URL}{task_id}"

# while True:
#     try:
#         # 查询参数
#         params = {"language": "en"}
        
#         # 发起查询请求
#         query_response = requests.get(query_url, headers=headers, params=params, proxies=proxies)
        
#         if query_response.status_code == 200:
#             query_data = query_response.json()
            
#             # 获取内部数据 (根据你提供的第二个 JSON 结构)
#             # 结构: { "data": { "status": "completed", "progress": 100 ... } }
#             task_info = query_data.get("data", {})
#             status = task_info.get("status")
#             progress = task_info.get("progress", 0)
            
#             print(f"   >>> 当前状态: {status} (进度: {progress}%)")
            
#             # 判断状态
#             if status == "completed":
#                 print("\n✅ 任务完成！")
#                 print("-" * 30)
#                 # 打印完整结果 JSON
#                 print(json.dumps(query_data, indent=2, ensure_ascii=False))
#                 print("-" * 30)
                
#                 # 尝试直接提取生成的 URL (如果存在)
#                 result = task_info.get("result", {})
#                 if "images" in result:
#                     print("生成的资源链接:", result["images"][0]["url"][0])
#                 elif "video" in result: # 视频任务可能返回 video 字段
#                     print("生成的资源链接:", result["video"]["url"])
                    
#                 break # 退出循环
            
#             elif status == "failed":
#                 print("\n❌ 任务失败。")
#                 print(query_data)
#                 break # 退出循环
            
#             # 如果是 submitted 或 processing，继续等待
#             time.sleep(5) 
            
#         else:
#             print(f"查询请求返回错误代码: {query_response.status_code}")
#             time.sleep(5)
            
#     except Exception as e:
#         print(f"查询过程发生异常: {e}")
#         break


# import requests
# import json
# import re

# class SoraChatClient:
#     def __init__(self, api_key, base_url="https://ai.t8star.cn"):
#         self.base_url = base_url.rstrip('/')
#         self.headers = {
#             "Authorization": f"Bearer {api_key}",
#             "Content-Type": "application/json",
#             "Accept": "application/json"
#         }

#     def construct_model_name(self, orientation="portrait", hd=False, duration="10s"):
#         """
#         根据参数构建模型名称
#         规则参考文档:
#         - sora_video2-portrait (竖屏)
#         - sora_video2-landscape (横屏)
#         - 后缀: -hd (高清), -15s (15秒)
#         """
#         model = "sora_video2"
        
#         # 1. 方向
#         if orientation == "portrait":
#             model += "-portrait"
#         else:
#             model += "-landscape" # 假设默认为 landscape，文档中给出了明确的 landscape 后缀
            
#         # 2. 高清 (HD)
#         if hd:
#             model += "-hd"
            
#         # 3. 时长 (15s)
#         # 文档仅明确提到了 15s 的后缀组合，普通10s一般不需要后缀或默认
#         if duration == "15s":
#             model += "-15s"
            
#         return model

#     def generate_video(self, prompt, image_url=None, orientation="portrait", hd=False, duration="10s"):
#         """
#         发送生成请求
        
#         :param prompt: 提示词 (e.g., "一只猫在跳舞")
#         :param image_url: (可选) 参考图 URL
#         :param orientation: 'portrait' (竖屏) 或 'landscape' (横屏)
#         :param hd: Boolean, 是否高清
#         :param duration: '10s' 或 '15s'
#         """
#         url = f"{self.base_url}/v1/chat/completions"
        
#         # 1. 构建模型名
#         model_name = self.construct_model_name(orientation, hd, duration)
#         print(f"[配置] 使用模型: {model_name}")

#         # 2. 构建消息体 (支持多模态：文本 + 图片)
#         content_payload = [{"type": "text", "text": prompt}]
        
#         if image_url:
#             content_payload.append({
#                 "type": "image_url",
#                 "image_url": {
#                     "url": image_url
#                 }
#             })

#         payload = {
#             "model": model_name,
#             "stream": False, # 设为 False 以便一次性拿到完整结果
#             "messages": [
#                 {
#                     "role": "user",
#                     "content": content_payload
#                 }
#             ]
#         }

#         try:
#             print("[请求] 正在提交任务，视频生成可能需要 1-5 分钟，请耐心等待...")
#             # 注意：视频生成耗时较长，timeout 设置大一些 (例如 600秒/10分钟)
#             response = requests.post(url, headers=self.headers, json=payload, timeout=600)
#             response.raise_for_status()
            
#             result = response.json()
            
#             # 解析返回内容
#             if "choices" in result and len(result["choices"]) > 0:
#                 message_content = result["choices"][0]["message"]["content"]
#                 print("\n[响应原始内容]:", message_content)
                
#                 # 尝试提取视频链接
#                 video_url = self._extract_url(message_content)
#                 if video_url:
#                     print("\n" + "="*30)
#                     print("🎉 视频生成成功！")
#                     print(f"🔗 下载地址: {video_url}")
#                     print("="*30)
#                     return video_url
#                 else:
#                     print("[提示] 未能从回复中自动提取到 URL，请检查原始内容。")
#             else:
#                 print(f"[错误] 返回结构异常: {result}")

#         except requests.exceptions.Timeout:
#             print("[超时] 请求超时。服务端可能仍在处理，但连接已断开。")
#         except requests.exceptions.RequestException as e:
#             print(f"[请求异常] {e}")
#             if hasattr(e, 'response') and e.response:
#                 print(f"服务端错误信息: {e.response.text}")
        
#         return None

#     def _extract_url(self, text):
#         """从 Markdown 文本中提取 URL"""
#         # 匹配 markdown 链接 [text](url) 或 直接的 url
#         url_pattern = r'https?://[^\s)\]]+'
#         match = re.search(url_pattern, text)
#         if match:
#             return match.group(0)
#         return None

# # ================= 使用示例 =================

# if __name__ == "__main__":
#     # 配置 API KEY
#     API_KEY = "sk-7srdRcJyp1mYKqQ0yF3pUNc3o0xkmc7uKOxaZ6EgJ7GZxks8"
    
#     client = SoraChatClient(API_KEY)
    
#     # 场景 1: 纯文本生成 (竖屏，15秒，高清)
#     client.generate_video(
#         prompt="赛博朋克风格的街道，下雨天，霓虹灯闪烁",
#         orientation="portrait",
#         hd=False,
#         duration="15s"
#     )

#     # 场景 2: 图生视频 (带参考图)
#     # client.generate_video(
#     #     prompt="让这张图里的猫动起来，向前奔跑",
#     #     image_url="https://github.com/dianping/cat/raw/master/cat-home/src/main/webapp/images/logo/cat_logo03.png",
#     #     orientation="landscape", # 横屏
#     #     hd=False,
#     #     duration="10s"
#     # )


import requests
import json
import re

# ================= Sora2 Chat API 测试 =================
# 基于 OpenAPI 规范: /v1/chat/completions

BASE_URL = "https://ai.t8star.cn"
API_KEY = "sk-7srdRcJyp1mYKqQ0yF3pUNc3o0xkmc7uKOxaZ6EgJ7GZxks8"

def test_sora2_chat_api(prompt="竖屏 动起来", image_url=None, model="sora_video2", stream=False):
    """
    测试 Sora2 Chat API
    
    模型名称规则:
    - sora_video2-portrait: 竖屏
    - sora_video2-landscape: 横屏
    - sora_video2-portrait-hd: 高清版
    - sora_video2-portrait-15s: pro 15s 时间
    - sora_video2-portrait-hd-15s: 高清pro
    
    :param prompt: 提示词
    :param image_url: 参考图URL (可选)
    :param model: 模型名称
    :param stream: 是否流式返回
    """
    url = f"{BASE_URL}/v1/chat/completions"
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    
    # 构建消息内容
    content = [{"type": "text", "text": prompt}]
    
    if image_url:
        content.append({
            "type": "image_url",
            "image_url": {"url": image_url}
        })
    
    payload = {
        "model": model,
        "stream": stream,
        "messages": [
            {
                "role": "user",
                "content": content
            }
        ]
    }
    
    print(f"[请求] URL: {url}")
    print(f"[请求] Model: {model}")
    print(f"[请求] Prompt: {prompt}")
    if image_url:
        print(f"[请求] Image: {image_url}")
    print("-" * 50)
    
    try:
        # 视频生成耗时较长，设置较大的超时时间
        response = requests.post(url, headers=headers, json=payload, timeout=600)
        response.raise_for_status()
        
        result = response.json()
        print("[响应] 状态码:", response.status_code)
        print("[响应] JSON:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        # 提取视频链接
        if "choices" in result and len(result["choices"]) > 0:
            message_content = result["choices"][0]["message"]["content"]
            video_url = extract_video_url(message_content)
            if video_url:
                print("\n" + "=" * 50)
                print("🎉 视频生成成功!")
                print(f"🔗 视频链接: {video_url}")
                print("=" * 50)
                return video_url
        
        return result
        
    except requests.exceptions.Timeout:
        print("[错误] 请求超时")
    except requests.exceptions.RequestException as e:
        print(f"[错误] 请求失败: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"[错误] 响应内容: {e.response.text}")
    
    return None

def extract_video_url(text):
    """从响应文本中提取视频URL"""
    url_pattern = r'https?://[^\s)\]]+'
    match = re.search(url_pattern, text)
    return match.group(0) if match else None


if __name__ == "__main__":
    # 测试1: 图生视频 (带参考图)
    test_sora2_chat_api(
        prompt="竖屏 动起来",
        image_url="https://github.com/dianping/cat/raw/master/cat-home/src/main/webapp/images/logo/cat_logo03.png",
        model="sora_video2"
    )
    
    # 测试2: 纯文本生成 (取消注释使用)
    # test_sora2_chat_api(
    #     prompt="赛博朋克风格的街道，下雨天，霓虹灯闪烁",
    #     model="sora_video2-portrait-15s"
    # )
    
    # 测试3: 横屏高清 (取消注释使用)
    # test_sora2_chat_api(
    #     prompt="海浪拍打沙滩",
    #     model="sora_video2-landscape-hd"
    # )