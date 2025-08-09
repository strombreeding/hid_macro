import cv2
import numpy as np
import mss
from image_utils import remove_alpha, to_gray

def capture_gray_screenshot(filename="test1.png", monitor_index=1):
    """전체 화면 캡처 후 알파 제거 + 그레이 변환 + 저장"""
    with mss.mss() as sct:
        monitor = sct.monitors[monitor_index]
        screenshot = sct.grab(monitor)
        img = np.array(screenshot)

    img = remove_alpha(img)
    gray = to_gray(img)
    return gray
