import time
import requests
import cv2
from image_utils import load_scaled_templates
from capture_utils import capture_screenshot_bgr_and_gray

scale_factors = [1.0, 2.0]  # 윈도우 / 맥 대응
templates = []

# 템플릿 로드
for i in range(1, 5):
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

    bgr, gray = capture_screenshot_bgr_and_gray("test1.png", monitor_index=1)

    detected = False
    threshold = 0.80

    for name, scale, template, (w, h) in templates:
        res = cv2.matchTemplate(gray, template, cv2.TM_CCOEFF_NORMED)
        if res.max() >= threshold:
            print(f"{name} 발견! scale={scale}, 유사도={res.max():.3f}")
            requests.get("http://localhost:8083/detect")
            last_detected_time = time.time()
            detected = True
            break

    if not detected:
        print("발견되지 않음.")
        requests.get("http://localhost:8083/notfound")

    time.sleep(0.5)
