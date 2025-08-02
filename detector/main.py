import cv2
import numpy as np
import requests
import time
import mss
import mss.tools

# 준비한 이미지 불러오기 (template)
template = cv2.imread("rie.png", 0)
w, h = template.shape[::-1]

last_detected_time = 0

while True:
    current_time = time.time()
    if current_time - last_detected_time < 22:
        time.sleep(0.5)
        continue

    # 화면 캡쳐
    with mss.mss() as sct:
        monitor = sct.monitors[1]  # 전체 화면 (여러 모니터라면 번호 조절)
        screenshot = sct.grab(monitor)
        img = np.array(screenshot)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 이미지 비교 (템플릿 매칭)
    res = cv2.matchTemplate(gray, template, cv2.TM_CCOEFF_NORMED)
    threshold = 0.70
    loc = np.where(res >= threshold)

    if len(loc[0]) > 0:
        print("이미지 발견됨! GET 요청 전송.")
        requests.get("http://localhost:8083/check")
        last_detected_time = time.time()
    else:
        print("발견되지 않음.")

    time.sleep(0.5)
