import http.client
import json

conn = http.client.HTTPSConnection("api.vectorengine.ai")
payload = ''
headers = {
   'new-api-user': '142538',
   # 注意：请替换为你新生成的安全 Key
   'Authorization': 'SxpO4tsw05gn5icEKyBb4iSKfE/Y3TEj'
}

# 这里的 token 也应该替换为新的，或者通过变量传入
path = "/api/token/search?keyword=&token=sk-p1YcaBj2bsGglx4bhZElqFtbKHeTEdg40pYkZFkgx7xBI9rD"

conn.request("GET", path, payload, headers)
res = conn.getresponse()
data = res.read()

# 1. 解析 JSON 数据
response_json = json.loads(data.decode("utf-8"))

# 2. 获取 remain_quota 并计算
if response_json.get("success") and response_json.get("data"):
    # 获取列表中的第一项数据
    user_data = response_json["data"][0]
    remain_quota = user_data["remain_quota"]
    used_quota = user_data["used_quota"]
    # 执行除法计算
    remain_quota_result = remain_quota / 1000000
    used_quota_result = used_quota / 1000000
    print(f"共计: {remain_quota_result}￥")
    print(f"使用了: {used_quota_result}￥")
else:
    print("获取数据失败或格式不正确")