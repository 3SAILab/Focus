import http.client
import json

conn = http.client.HTTPSConnection("api.vectorengine.ai")
payload = json.dumps({
   "contents": [
      {
         "role": "user",
         "parts": [
            {
               "text": "'Hi, This is a picture of me. Can you add a llama next to me"
            },
            {
               "inline_data": {
                  "mime_type": "image/jpeg",
                  "data": ""
               }
            }
         ]
      }
   ],
   "generationConfig": {
      "responseModalities": [
         "TEXT",
         "IMAGE"
      ],
      "imageConfig": {
         "aspectRatio": "16:9"
      }
   }
})
headers = {
   'Authorization': 'Bearer <token>',
   'Content-Type': 'application/json'
}
conn.request("POST", "/v1beta/models/gemini-2.5-flash-image:generateContent?key=%7B%7BYOUR_API_KEY%7D%7D", payload, headers)
res = conn.getresponse()
data = res.read()
print(data.decode("utf-8"))