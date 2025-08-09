import cv2
import numpy as np
import mss
import time
import requests

def capture_gray_screenshot(filename="fullScreen.png", monitor_index=1):
    """전체 화면을 캡처하고, 그레이스케일로 변환 후 저장 (1배율)"""
    with mss.mss() as sct:
        monitor = sct.monitors[monitor_index]
        screenshot = sct.grab(monitor)
        img = np.array(screenshot)

    # 알파 채널 제거
    if img.shape[-1] == 4:
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

    # 그레이 변환
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 저장
    cv2.imwrite(filename, gray)
    print(f"스크린샷이 {filename}에 저장되었습니다.")

    return gray  # 바로 템플릿 매칭에 쓸 수 있도록 반환