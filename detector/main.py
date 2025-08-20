import time
import requests
import cv2
from image_utils import load_scaled_templates
from capture_utils import capture_screenshot_bgr_and_gray

scale_factors = [1.0]  # 윈도우 / 맥 대응
templates = []

# 템플릿 로드
for i in range(1, 2):
    try:
        scaled_versions = load_scaled_templates(f"images/dragon/skeleton/skeleton{i}.png", scale_factors)
        for scale, tmpl, size in scaled_versions:
            templates.append((f"images/dragon/skeleton/skeleton{i}.png", scale, tmpl, size))
    except FileNotFoundError as e:
        print(e)

last_detected_time = 0

# 탐지 루프
while True:
    if time.time() - last_detected_time < 0.5:
        time.sleep(0.5)
        continue

    # bgr, gray = capture_screenshot_bgr_and_gray("test1.png", monitor_index=1)
    bgr, gray = capture_screenshot_bgr_and_gray(
        bgr_filename=None, gray_filename="sex.png", monitor_index=1, fix = True
    )

    detected = False
    threshold = 0.80

    for name, scale, template, (w, h) in templates:
        res = cv2.matchTemplate(gray, template, cv2.TM_CCOEFF_NORMED)
        if res.max() >= threshold:
            print(f"{name} 발견! scale={scale}, 유사도={res.max():.3f} {w} {h}")
            
            # --- 발견된 위치에 점 찍고 이미지 저장하는 코드 ---
            # 가장 높은 유사도의 위치를 찾습니다.
            _, max_val, _, max_loc = cv2.minMaxLoc(res)
            
            # 발견된 템플릿의 중심점 좌표를 계산합니다.
            center_x = max_loc[0] + w // 2
            center_y = max_loc[1] + h // 2
            
            # 원본 이미지(bgr)에 빨간 점을 그립니다.
            # cv2.circle(이미지, 중심점, 반지름, 색상(BGR), 두께)
            cv2.circle(bgr, (center_x, center_y), 5, (0, 0, 255), -1) 
            
            # 수정된 이미지를 'detected_image.png' 파일로 저장합니다.
            cv2.imwrite("detected_image.png", bgr)
            
            # --- 코드 추가 끝 ---
            
            last_detected_time = time.time()
            detected = True
            break


    if not detected:
        print("발견되지 않음.")

    time.sleep(0.5)
