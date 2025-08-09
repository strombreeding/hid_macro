import cv2
import numpy as np
import requests
import time
import mss

# 템플릿 이미지 리스트
templates = []

# 1배, 2배 버전 생성
scale_factors = [1.0, 2.0]

for i in range(7, 13):
    img = cv2.imread(f"monster{i}.png", cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f"monster{i}.png 불러오기 실패!")
        continue

    if img.shape[-1] == 4:  # 알파 채널 제거
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

    img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    for scale in scale_factors:
        resized = cv2.resize(img_gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        templates.append((f"monster{i}.png", scale, resized, resized.shape[::-1]))

last_detected_time = 0

while True:
    current_time = time.time()
    if current_time - last_detected_time < 0.5:
        time.sleep(0.5)
        continue

    # 스크린샷 캡처
    with mss.mss() as sct:
        monitor = sct.monitors[1]
        screenshot = sct.grab(monitor)
        img = np.array(screenshot)

    if img.shape[-1] == 4:
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

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
