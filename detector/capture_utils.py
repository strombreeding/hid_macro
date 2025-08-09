import cv2
import numpy as np
import mss
from image_utils import remove_alpha, to_gray

def capture_screenshot_bgr_and_gray(bgr_filename="screen_bgr.png",
                                    gray_filename="screen_gray.png",
                                    monitor_index=1):
    with mss.mss() as sct:
        monitor = sct.monitors[monitor_index]
        screenshot = sct.grab(monitor)
        raw = np.array(screenshot)

    bgr = remove_alpha(raw)
    gray = to_gray(bgr)

    if bgr_filename:
        cv2.imwrite(bgr_filename, bgr)
        print(f"[save] {bgr_filename}")
    if gray_filename:
        cv2.imwrite(gray_filename, gray)
        print(f"[save] {gray_filename}")

    return bgr, gray
