# find_monster.py (300ms 주기)
import time
import requests
import cv2
from image_utils import load_scaled_templates
from capture_utils import capture_screenshot_bgr_and_gray
from detection_utils import find_best_match, draw_point

SCALE_FACTORS = [1.0, 2.0]
THRESHOLD = 0.80
MONITOR_INDEX = 1
INTERVAL_S = 0.3  # 300ms
DETECT_URL = "http://localhost:8083/detect"
NOTFOUND_URL = "http://localhost:8083/notfound"

def load_monster_templates():
    templates = []
    for i in range(7, 15):
        path = f"monster{i}.png"
        try:
            for scale, tmpl, size in load_scaled_templates(path, SCALE_FACTORS):
                templates.append((path, scale, tmpl, size))
        except FileNotFoundError as e:
            print(e)
    return templates

def main():
    templates = load_monster_templates()
    if not templates:
        print("[err] monster 템플릿이 없습니다.")
        return

    prev_state = None  # 'detect' | 'notfound'
    last_mark_time = 0

    while True:
        t0 = time.monotonic()

        # 디스크 IO 최소화: 저장 안 함 (필요 시만 저장)
        bgr, gray = capture_screenshot_bgr_and_gray(
            bgr_filename=None, gray_filename=None, monitor_index=MONITOR_INDEX
        )

        best = find_best_match(gray, templates, method=cv2.TM_CCOEFF_NORMED)

        if best and best["max_val"] >= THRESHOLD:
            x, y = best["top_left"]; w, h = best["size"]
            cx, cy = x + w//2, y + h//2
            print(f"[monster] {best['name']} scale={best['scale']} "
                  f"score={best['max_val']:.3f} center=({cx},{cy})")

            # 상태 변화시에만 HTTP 호출 (디바운스)
            if prev_state != 'detect':
                try: requests.get(DETECT_URL, timeout=0.3)
                except Exception as e: print(f"[warn] detect 요청 실패: {e}")
                prev_state = 'detect'

            # 시각화는 과도한 디스크 IO 방지: 1초에 1번만
            if time.monotonic() - last_mark_time > 1.0:
                draw_point(bgr, (cx, cy), out_path="monster_marked.png",
                           text=f"{best['max_val']:.2f}")
                last_mark_time = time.monotonic()
        else:
            print("[monster] 발견되지 않음.")
            if prev_state != 'notfound':
                try: requests.get(NOTFOUND_URL, timeout=0.3)
                except Exception as e: print(f"[warn] notfound 요청 실패: {e}")
                prev_state = 'notfound'

        # 주기 보정 sleep (처리시간 제외)
        elapsed = time.monotonic() - t0
        to_sleep = INTERVAL_S - elapsed
        if to_sleep > 0:
            time.sleep(to_sleep)

if __name__ == "__main__":
    main()
