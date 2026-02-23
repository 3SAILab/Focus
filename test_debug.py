import requests
import urllib3
import os
urllib3.disable_warnings()

# 清除代理设置
os.environ.pop('HTTP_PROXY', None)
os.environ.pop('HTTPS_PROXY', None)
os.environ.pop('http_proxy', None)
os.environ.pop('https_proxy', None)

url = "https://aiaimi.cc/api/token/search?keyword=&token=sk-2biR7jpJa9DK4sUkf2bq6K03is1wNZPPBnz8qLYqdGNfLIzV"
headers = {
    "New-Api-User": "3",
    "Authorization": "wHZXM5oncgJnmDOwvG8BijXunBXM"
}

# 禁用代理
r = requests.get(url, headers=headers, verify=False, timeout=10, proxies={"http": None, "https": None})
print(f"Status: {r.status_code}")
print(f"Headers: {dict(r.headers)}")
print(f"Text: {r.text[:1000] if r.text else 'Empty'}")
