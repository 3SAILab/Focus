import asyncio
import aiohttp
import json
import time
import os
import sys
from datetime import datetime

# --- 配置区域 ---
API_KEY = os.getenv("VECTOR_ENGINE_KEY", "sk-YIRSJjrtRablveDqg9NrJUtQe6q67g7JvRNUAsifrp6neD0h") 
API_URL = "https://api.vectorengine.ai/v1beta/models/gemini-3-pro-image-preview:generateContent"

# 要测试的 Prompt 列表
prompts = [
    "A cute llama standing in a futuristic city, cyberpunk style",
    # "A fat cat wearing sunglasses on a beach",
    # "A futuristic robot playing a guitar"
]

# --- 核心逻辑 ---

def save_json_response(data, filename):
    """将 API 响应数据保存为 JSON 文件"""
    try:
        # 确保输出目录存在
        os.makedirs("output", exist_ok=True)
        file_path = os.path.join("output", filename)
        
        # 写入 JSON 文件，ensure_ascii=False 保证中文正常显示（如果有）
        with open(file_path, "w", encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        
        return file_path
    except Exception as e:
        print(f"❌ 保存 JSON 失败: {e}")
        return None

async def send_request(session, prompt, index):
    """发送请求并保存原始 JSON 响应"""
    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": prompt}]}
        ],
        "generationConfig": {
            "responseModalities": ["IMAGE", "TEXT"], 
            "imageConfig": {
                "aspectRatio": "1:1",
                "imageSize": "2K"
            }
        }
    }
    
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }

    start_time = time.time()
    try:
        async with session.post(API_URL, json=payload, headers=headers) as response:
            # 获取完整的 JSON 结果
            result = await response.json()
            duration = time.time() - start_time
            
            # --- 修改点：直接保存 JSON，不处理图片 ---
            filename = f"response_{index}.json"
            saved_path = save_json_response(result, filename)
            
            if saved_path:
                print(f"✅ 请求 {index} 完成! JSON 已保存: {saved_path} (耗时: {duration:.2f}s)")
            else:
                print(f"⚠️ 请求 {index} 完成，但保存文件失败。")

    except Exception as e:
        print(f"❌ 网络请求失败 (请求 {index}): {e}")

async def main():
    async with aiohttp.ClientSession() as session:
        tasks = []
        print(f"🚀 开始并发发送 {len(prompts)} 个请求...")
        
        for i, prompt in enumerate(prompts):
            task = send_request(session, prompt, i)
            tasks.append(task)
        
        await asyncio.gather(*tasks)
        
        # 等待一小会儿，确保底层连接断开
        await asyncio.sleep(0.25)

if __name__ == "__main__":
    # --- Windows 专用修复补丁 ---
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
    asyncio.run(main())

    # --- 修改点：最后打印当前时间 ---
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print("-" * 30)
    print(f"🕒 执行结束时间: {current_time}")
    print("-" * 30)

