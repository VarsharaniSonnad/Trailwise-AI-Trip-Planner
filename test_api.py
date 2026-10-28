
from google import genai

client = genai.Client(api_key="AIzaSyCbsI1izhYAiDWtPpCwMFSsrtN4pyvhLu4")

response = client.models.generate_content(
    model="gemini-3.5-flash",
    contents="Say Hello"
)

print(response.text)