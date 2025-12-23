import aiohttp
import asyncio
import time
import json
import base64
import os
import sys

# 检查依赖
try:
    import aiofiles
except ImportError:
    print("❌ 缺少 'aiofiles' 库，请运行 'pip install aiofiles'")
    sys.exit(1)

# --- 配置 ---
API_KEY = "sk-hcJXXfhjsJl15fyH36vidjuMTSwHkEyk6LMuQvaHhwSAtVXZ"
SUBMIT_URL = "https://api.apimart.ai/v1/images/generations"
TASK_BASE_URL = "https://api.apimart.ai/v1/tasks/"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# --- 文件路径 ---
GARMENT_PATH = r"E:\PythonProject\sigma\skirt.jpg" # 图片1：衣服
PERSON_PATH = r"E:\PythonProject\sigma\modal.png"   # 图片2：模特

# --- 核心 Prompt (提示词) ---
# 既然是通用模型，提示词必须非常具体，明确指定图1和图2的关系
EDIT_PROMPT = (
    "请作为一位专业的时尚修图师执行以下任务："
    "图片列表中的第1张图片是一件衣服（裙子），第2张图片是一位模特。"
    "请将第1张图片中的裙子自然地穿在第2张图片的模特身上。"
    "要求："
    "1. 保持模特的姿势、面部特征、发型和背景完全不变。"
    "2. 自动调整裙子的大小、角度和透视，使其完美贴合模特的身体曲线。"
    "3. 确保光影、褶皱和材质感自然逼真，像是一张真实的实拍照片。"
    "4. 输出一张高质量的全身照。"
)

# --- 辅助函数 ---

async def encode_image_to_base64(image_path):
    """异步读取并转 Base64"""
    if not os.path.exists(image_path):
        print(f"❌ 文件不存在: {image_path}")
        return None
    try:
        async with aiofiles.open(image_path, "rb") as f:
            data = await f.read()
            return base64.b64encode(data).decode('utf-8')
    except Exception as e:
        print(f"❌ 读取错误 {image_path}: {e}")
        return None

# --- 核心逻辑 ---

async def submit_edit_task(session, prompt, image_list):
    """提交通用图像编辑任务"""
    
    # 这里的模型换回你最开始用的通用模型，或者其他支持图生图的高级模型
    MODEL_NAME = "gemini-3-pro-image-preview" 

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        # 通用模型通常接受一个 images 列表，顺序很重要
        # 这里约定：index 0 是衣服，index 1 是模特，和 Prompt 里的描述对应
        "images": image_list, 
        "n": 1,
        "size": "1:1" # 或者根据原图比例调整
    }
    
    print(f"🚀 正在提交任务 (模型: {MODEL_NAME})...")
    start_time = time.perf_counter()
    
    async with session.post(SUBMIT_URL, json=payload, headers=HEADERS) as response:
        resp_json = await response.json()
        elapsed = (time.perf_counter() - start_time) * 1000 
    
    if response.status != 200:
        print(f"❌ [提交失败] 状态: {response.status} | 原因: {resp_json}")
        return None
    
    try:
        task_id = resp_json['data'][0]['task_id']
        print(f"✅ [提交成功] Task ID: {task_id} | 耗时: {elapsed:.2f}ms")
        return task_id
    except (KeyError, IndexError, TypeError):
        # 有时候直接返回结果而不是任务ID，视具体模型而定，这里假设是异步任务
        print(f"⚠️ [返回结构] API返回了非预期结构 (可能不是异步任务?): {resp_json}")
        return None

async def poll_task_status(session, task_id):
    """轮询 (逻辑不变)"""
    url = f"{TASK_BASE_URL}{task_id}"
    start_job = time.time()
    
    while True:
        async with session.get(url, headers=HEADERS) as response:
            data = await response.json()
        
        if 'data' not in data:
            print(f"⚠️ 异常数据: {data}")
            break

        task_data = data['data']
        status = task_data.get('status')
        progress = task_data.get('progress', 0)
        
        print(f"🔄 进度: {progress}% | 状态: {status}")

        if status == 'completed':
            img_url = task_data['result']['images'][0]['url'][0]
            print(f"🎉 完成! 总耗时: {time.time() - start_job:.2f}s")
            print(f"👉 结果链接: {img_url}")
            return img_url
        elif status == 'failed':
            print(f"❌ 失败: {task_data.get('error')}")
            return None
        
        await asyncio.sleep(2)

async def main():
    print(f"📂 读取本地文件...")
    # 1. 读取两张图片
    img_garment = await encode_image_to_base64(GARMENT_PATH)
    img_person = await encode_image_to_base64(PERSON_PATH)

    if not img_garment or not img_person:
        return

    # 2. 构造图片列表 [衣服, 模特]
    # 注意：顺序必须和 Prompt 里描述的 "第1张"、"第2张" 对应
    images_payload = [img_garment, img_person]

    async with aiohttp.ClientSession() as session:
        # 3. 提交任务
        print(f"📝 Prompt: {EDIT_PROMPT[:50]}...")
        task_id = await submit_edit_task(session, EDIT_PROMPT, images_payload)
        
        # 4. 轮询结果
        if task_id:
            await poll_task_status(session, task_id)

if __name__ == "__main__":
    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())