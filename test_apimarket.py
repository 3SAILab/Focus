import aiohttp
import asyncio
import time
import json

# --- 配置 ---
API_KEY = "sk-hcJXXfhjsJl15fyH36vidjuMTSwHkEyk6LMuQvaHhwSAtVXZ"
SUBMIT_URL = "https://api.apimart.ai/v1/images/generations"
TASK_BASE_URL = "https://api.apimart.ai/v1/tasks/"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# --- 核心逻辑 ---

async def submit_task(session, prompt):
    """提交图像生成任务"""
    payload = {
        "model": "gemini-3-pro-image-preview",
        "prompt": prompt,
        "size": "1:1",
        "n": 1,
        "resolution": "1K"
    }
    
    start_time = time.perf_counter()
    async with session.post(SUBMIT_URL, json=payload, headers=HEADERS) as response:
        resp_json = await response.json()
        elapsed = (time.perf_counter() - start_time) * 1000 # 转换为毫秒
    
    if response.status != 200:
        print(f"❌ [提交失败] Prompt: {prompt[:10]}... | 耗时: {elapsed:.2f}ms | 原因: {resp_json}")
        return None
    
    # 提取 Task ID (根据你提供的 JSON 结构)
    task_id = resp_json['data'][0]['task_id']
    print(f"✅ [提交成功] Task ID: {task_id} | 耗时: {elapsed:.2f}ms | Prompt: {prompt}")
    return task_id

async def poll_task_status(session, task_id):
    """轮询任务状态直到完成"""
    url = f"{TASK_BASE_URL}{task_id}"
    params = {"language": "zh"}
    
    start_job_time = time.time() # 记录任务开始总时间
    
    while True:
        # 1. 发起轮询请求并计算请求耗时
        req_start = time.perf_counter()
        async with session.get(url, headers=HEADERS, params=params) as response:
            data = await response.json()
            req_elapsed = (time.perf_counter() - req_start) * 1000
        
        # 2. 解析状态
        if 'data' not in data:
            print(f"⚠️ [API 异常] Task: {task_id} | 返回数据异常: {data}")
            break

        task_data = data['data']
        status = task_data.get('status')
        progress = task_data.get('progress', 0)
        
        # 3. 打印实时进度和本次请求耗时
        print(f"🔄 [进行中] Task: {task_id} | 进度: {progress}% | 状态: {status} | 请求耗时: {req_elapsed:.2f}ms")

        # 4. 判断是否结束
        if status == 'completed':
            total_time = time.time() - start_job_time
            image_url = task_data['result']['images'][0]['url'][0]
            print(f"🎉 [任务完成] Task: {task_id} | 总耗时: {total_time:.2f}s")
            print(f"   👉 图片链接: {image_url}")
            return image_url
            
        elif status == 'failed':
            print(f"❌ [任务失败] Task: {task_id}")
            return None
        
        # 5. 等待一段时间再次轮询 (避免请求过频)
        await asyncio.sleep(1.5) 

async def process_pipeline(session, prompt):
    """将提交和轮询串联起来"""
    task_id = await submit_task(session, prompt)
    if task_id:
        # 拿到 ID 后立即开始轮询
        await poll_task_status(session, task_id)

async def main():
    # 这里定义你要并行生成的 Prompt 列表
    prompts = [
        "月光下的竹林小径",
        "赛博朋克风格的未来城市霓虹灯",
        "一只在太空中漂浮的橘猫"
    ]

    print(f"🚀 开始并行处理 {len(prompts)} 个任务...\n" + "-"*50)
    
    async with aiohttp.ClientSession() as session:
        # 创建所有任务并并行运行
        tasks = [process_pipeline(session, p) for p in prompts]
        await asyncio.gather(*tasks)

if __name__ == "__main__":
    import sys
    
    # ✅ 修复 Windows 下 asyncio + aiohttp 报错的关键代码
    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 用户手动停止任务")