import cv2
import numpy as np

# 1. 이미지 로드
background = cv2.imread("first.png")   # 전체 화면
target = cv2.imread("second.png")      # 찾을 캐릭터

# 알파 채널 제거
if background.shape[-1] == 4:
    background = cv2.cvtColor(background, cv2.COLOR_BGRA2BGR)
if target.shape[-1] == 4:
    target = cv2.cvtColor(target, cv2.COLOR_BGRA2BGR)

# 2. 그레이 변환
bg_gray = cv2.cvtColor(background, cv2.COLOR_BGR2GRAY)
target_gray = cv2.cvtColor(target, cv2.COLOR_BGR2GRAY)

# 3. 템플릿 매칭
result = cv2.matchTemplate(bg_gray, target_gray, cv2.TM_CCOEFF_NORMED)
min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

# 4. 좌표 계산
top_left = max_loc
h, w = target_gray.shape
center_x = top_left[0] + w // 2
center_y = top_left[1] + h // 2

print(f"캐릭터 좌표: ({center_x}, {center_y}), 유사도: {max_val:.3f}")

# 5. 빨간 점 표시
marked_image = background.copy()
cv2.circle(marked_image, (center_x, center_y), radius=5, color=(0, 0, 255), thickness=-1)

# 6. 저장
cv2.imwrite("result_marked.png", marked_image)
print("result_marked.png 저장 완료")
