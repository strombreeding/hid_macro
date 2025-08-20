import cv2
import numpy as np
import mss
from image_utils import remove_alpha, to_gray

def capture_screenshot_bgr_and_gray(bgr_filename="screen_bgr.png",
                                    gray_filename="screen_gray.png",
                                    monitor_index=1,
                                    fix=False
                                    ):
    with mss.mss() as sct:
        monitor = sct.monitors[monitor_index]
        screenshot = sct.grab(monitor)
        raw = np.array(screenshot)

    bgr = remove_alpha(raw)
    gray = to_gray(bgr)

    if(fix):
        gray = enhance_exposure_contrast(gray)

    if bgr_filename:
        cv2.imwrite(bgr_filename, bgr)
        print(f"[save] {bgr_filename}")
    if gray_filename:
        cv2.imwrite(gray_filename, gray)
        print(f"[save] {gray_filename}")

    return bgr, gray


def adjust_gamma(image, gamma=1):
    invGamma = 1.0 / gamma
    table = np.array([(i / 255.0) ** invGamma * 255
                      for i in np.arange(0, 256)]).astype("uint8")
    return cv2.LUT(image, table)



def enhance_exposure_contrast(bgr: np.ndarray,
                              exposure_gain: float = 1.5,   # 노출 (밝기) 20% 증가
                              contrast_gain: float = 2.0    # 대비 20% 증가
                              ) -> np.ndarray:
    """
    BGR 이미지를 받아서 노출과 대비를 동시에 올려주는 함수
    - exposure_gain: 밝기 배율 (1.0이면 변화 없음)
    - contrast_gain: 대비 배율 (1.0이면 변화 없음)
    """
    # float 변환
    bgr_f = bgr.astype(np.float32)

    # 1) 노출 (밝기) 증가
    bgr_f = bgr_f * float(exposure_gain)

    # 2) 대비 증가 (128 기준 스케일링)
    bgr_f = (bgr_f - 128.0) * float(contrast_gain) + 128.0

    # 3) [0,255]로 클리핑 후 uint8 변환
    bgr_out = np.clip(bgr_f, 0, 255).astype(np.uint8)

    bgr_out = adjust_gamma(bgr_out, gamma=0.3)


    return bgr_out
