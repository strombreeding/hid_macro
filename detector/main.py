import cv2
import numpy as np
import requests
import time
import mss

# 템플릿 이미지 리스트 불러오기
templates = []

for i in range(7, 9):
    template = cv2.imread(f"monster{i}.png", cv2.IMREAD_UNCHANGED)  # 알파 채널 포함된 PNG 대응
    if template is None:
        print(f"monster{i}.png 불러오기 실패!")
        continue

    if template.shape[-1] == 4:
        # 알파 채널이 있는 경우 제거
        template = cv2.cvtColor(template, cv2.COLOR_BGRA2BGR)

    template = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)  # 그레이 변환
    template = cv2.resize(template, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)  # 템플릿도 0.5배 축소

    templates.append((f"monster{i}.png", template, template.shape[::-1]))

last_detected_time = 0

while True:
    current_time = time.time()
    if current_time - last_detected_time < 0.5:
        time.sleep(0.5)
        continue

    with mss.mss() as sct:
        monitor = sct.monitors[1]
        screenshot = sct.grab(monitor)
        img = np.array(screenshot)

        # 알파 채널 제거 (macOS 스크린샷은 BGRA일 수 있음)
        if img.shape[-1] == 4:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 스크린샷도 0.5배 축소
        gray = cv2.resize(gray, (0, 0), fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)

        # ./test1.png로 저장
        output_path = "test1.png"
        cv2.imwrite(output_path, gray)  # 변환된 흑백 이미지 저장
        print(f"스크린샷이 {output_path}에 저장되었습니다.")

    detected = False

    for name, template, (w, h) in templates:
        res = cv2.matchTemplate(gray, template, cv2.TM_CCOEFF_NORMED)
        threshold = 0.80
        loc = np.where(res >= threshold)
        print(f"{name} 최대 유사도: {res.max():.3f}, 위치: {loc}")

        if len(loc[0]) > 0:
            print(f"{name} 발견됨! GET 요청 전송.")
            requests.get("http://localhost:8083/check")
            last_detected_time = time.time()
            detected = True
            break

    if not detected:
        print("발견되지 않음.")

    time.sleep(0.5)
