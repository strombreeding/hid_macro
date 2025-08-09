import cv2
import numpy as np

def remove_alpha(image):
    """알파 채널이 있으면 제거 (BGRA → BGR)"""
    if image.shape[-1] == 4:
        return cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
    return image

def to_gray(image):
    """BGR 이미지를 그레이스케일로 변환"""
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

def load_scaled_templates(path, scale_factors):
    """
    이미지 로드 후 알파 제거 + 그레이 변환 + 다양한 스케일 버전 생성
    :return: [(scale, template_gray, (w, h)), ...]
    """
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise FileNotFoundError(f"{path} 불러오기 실패!")
    img = remove_alpha(img)
    gray = to_gray(img)

    templates = []
    for scale in scale_factors:
        resized = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        templates.append((scale, resized, resized.shape[::-1]))
    return templates
