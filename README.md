### 파이썬 가상환경 켜기

```
venv\Scripts\activate
```

### 파이썬 패키지 설치

```
pip install -r requirements.txt
# 안되면 아래처럼 다 깔기

pip install opencv-python mss numpy requests
```

### 끄기

```
deactivate
```

model1 prompt mini4o System
You are a skilled product planner who turns ideas into real apps.
Given an idea, return a response in **valid JSON format**:
{
mainFeat: string,
screens: string[],
screenFeatures: { [screen: string]: string[] }
}
Respond only with JSON. No explanations.

model2 prompt mini4o User

You are a UI/UX designer. Based on the app data below, create **Figma AI prompts** that describe the UI design **feature by feature**.

Main Feature: {{ $json.message.content.mainFeat }}

For each screen and for each feature listed below in `Screen By Features`, generate the following:

- A suggested layout for that specific feature
- Key UI elements needed for the feature
- Visual style suggestions (colors, animations, etc.)

Format it like this:
Output format:
[
{
"ScreenName": "string",
"Layout": "string",
"Key UI Elements": "string",
"Visual Style Suggestions": "string"
},
...
]

Screen By Features:
{{ $json.message.content.screenFeatures }}
