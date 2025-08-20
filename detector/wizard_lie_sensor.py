import sys, time
import cv2
import requests
from image_utils import load_scaled_templates
from capture_utils import capture_screenshot_bgr_and_gray, enhance_exposure_contrast
from detection_utils import find_best_match, find_best_match_fast, find_all_matches, draw_point
from detection_utils_v2 import TobiState, find_tobi_ultra_fast, race_find_tobi
from lie_sensor import find_korean_glyph, find_korean_glyph_multistage



# ===== 설정 =====
MONITOR_INDEX = 1
SCALE_FACTORS = [1.0]        # 윈도우=1배, 맥=2배
THRESHOLD = 0.80                  # 토비 탐지 임계값
MONSTER_THRESHOLD = 0.75          # 몬스터 탐지 임계값(조금 더 관대)

INTERVAL_S = 0.09                  # 300ms
LAST_MARK_INTERVAL_S = 1.0        # 마킹 저장 최소 간격(초)



# === 거리/표시 설정 ===
NEAR_PX = 80          # 가까움 판정 (px)
FAR_PX  = 220         # 멀음 판정 (px)
DIST_MARK_INTERVAL_S = 1.0  # 거리 시각화 저장 최소 간격(초)


def main():
    lie_template = cv2.imread("lie.png")

    while True:
        start_time = time.monotonic()
        t0 = time.monotonic()
        # 1) 캡처 (한 프레임 재사용)
        bgr, gray = capture_screenshot_bgr_and_gray(
            bgr_filename=None, gray_filename="sex.png", monitor_index=MONITOR_INDEX, fix = True
        )

        all_matches = find_korean_glyph(
            gray_screen=gray,
            template_gray=lie_template,
        )
        print(all_matches)

        # # 4) 결과 출력
        # if detected:
        #     top = detected[0]
        #     print(f"[FOUND] score={top.score:.3f} center={top.center} angle={top.angle} scale={top.scale:.3f}")
        # else:
        #     print("[NO DETECTION ABOVE THRESHOLD]")
        #     if best_report:
        #         print(f"  -> best_score={best_report['best_score']:.3f}, "
        #             f"angle={best_report['best_angle']}, scale={best_report['best_scale']:.3f}, "
        #             f"center={best_report['best_center']}")
        
        print(time.monotonic() - start_time)
        # 4) 주기 보정
        elapsed = time.monotonic() - t0
        to_sleep = INTERVAL_S - elapsed
        if to_sleep > 0:
            time.sleep(to_sleep)

if __name__ == "__main__":
    main()
