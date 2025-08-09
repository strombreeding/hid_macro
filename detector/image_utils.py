import cv2
import numpy as np

def remove_alpha(image):
    if image is None:
        raise ValueError("이미지가 None 입니다.")
    if image.ndim == 3 and image.shape[-1] == 4:
        return cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
    return image

def to_gray(image):
    if image is None:
        raise ValueError("이미지가 None 입니다.")
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

def load_scaled_templates(path, scale_factors):
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise FileNotFoundError(f"{path} 불러오기 실패!")
    img = remove_alpha(img)
    gray = to_gray(img)

    templates = []
    for scale in scale_factors:
        resized = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        templates.append((scale, resized, resized.shape[::-1]))  # (w,h)
    return templates
