import cv2
import numpy as np
import requests
import time
import mss

# 템플릿 이미지 리스트 불러오기
templates = []
for i in range(1, 4):
    template = cv2.imread(f"rie{i}.png", 0)
    if template is None:
        print(f"rie{i}.png 불러오기 실패!")
        continue
    templates.append((f"rie{i}.png", template, template.shape[::-1]))

last_detected_time = 0

while True:
    current_time = time.time()
    if current_time - last_detected_time < 22:
        time.sleep(0.5)
        continue

    with mss.mss() as sct:
        monitor = sct.monitors[1]
        screenshot = sct.grab(monitor)
        img = np.array(screenshot)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    detected = False

    for name, template, (w, h) in templates:
        res = cv2.matchTemplate(gray, template, cv2.TM_CCOEFF_NORMED)
        threshold = 0.60
        loc = np.where(res >= threshold)

        if len(loc[0]) > 0:
            print(f"{name} 발견됨! GET 요청 전송.")
            requests.get("http://localhost:8083/check")
            last_detected_time = time.time()
            detected = True
            break

    if not detected:
        print("발견되지 않음.")

    time.sleep(0.5)
