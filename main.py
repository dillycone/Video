import vertexai
from vertexai.generative_models import GenerativeModel, Part
from pathlib import Path

PROJECT_ID = "noted-app-302517"

vertexai.init(project=PROJECT_ID, location="us-central1")

model = GenerativeModel("gemini-1.5-flash-002")

# Check if prompt file exists and has content
prompt_path = Path("prompts/video_transcription_prompt.txt")
if not prompt_path.exists():
    raise FileNotFoundError(f"Prompt file not found at {prompt_path}")

with open(prompt_path, "r") as f:
    prompt = f.read().strip()
    if not prompt:
        raise ValueError("Prompt file is empty")

# Check if video file exists
video_path = Path("/Users/bc/Desktop/373c1305-c6c7-4794-9b14-fa95fe611596.mp4")
if not video_path.exists():
    raise FileNotFoundError(f"Video file not found at {video_path}")

with open(video_path, "rb") as f:
    video_file = Part.from_data(data=f.read(), mime_type="video/mp4")

contents = [
    video_file,
    Part.from_text(prompt)
]

response = model.generate_content(contents)
print(response.text)
# Example response:
# Here is a description of the video.
# ... Then, the scene changes to a woman named Saeko Shimada..
# She says, "Tokyo has many faces. The city at night is totally different
# from what you see during the day."
# ...