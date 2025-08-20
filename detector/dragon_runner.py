import sys, time
import cv2
import requests
from image_utils import load_scaled_templates
from capture_utils import capture_screenshot_bgr_and_gray
from detection_utils import find_best_match, find_best_match_fast, find_all_matches, draw_point
from detection_utils_v2 import TobiState, find_tobi_ultra_fast, race_find_tobi


job = "dragon"
monster = "skeleton"


try:
    sys.stdout.reconfigure(line_buffering=True)
except:
    pass

STATUS_INTERVAL_S = 0.1
_last_status = 0.0


def status_line(msg: str):
    global _last_status
    now = time.monotonic()
    if now - _last_status < STATUS_INTERVAL_S:
        return
    sys.stdout.write("\r"+msg.ljust(140))
    sys.stdout.flush()
    _last_status = now

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

# ===== 유틸 =====
def euclidean(a, b):
    return ((a[0]-b[0])**2 + (a[1]-b[1])**2) ** 0.5

def draw_link_with_distance(bgr_img, p1, p2, out_path="tobi_vs_monster.png", mode="horizontal"):
    """
    mode: "euclid" | "horizontal" | "vertical"
    """
    import cv2
    vis = bgr_img.copy()

    if mode == "horizontal":
        dist = abs(p2[0] - p1[0])            # Δx
        a, b = p1, (p2[0], p1[1])            # 같은 Y로 수평선
    elif mode == "vertical":
        dist = abs(p2[1] - p1[1])            # Δy
        a, b = p1, (p1[0], p2[1])            # 같은 X로 수직선
    else:  # euclid
        dist = ((p2[0]-p1[0])**2 + (p2[1]-p1[1])**2) ** 0.5
        a, b = p1, p2

    cv2.circle(vis, a, 6, (0,0,255), -1)     # Tobi
    cv2.circle(vis, b, 6, (0,255,0), -1)     # Monster(투영점 또는 실제점)
    cv2.line(vis, a, b, (255,255,255), 2)

    mid = ((a[0]+b[0])//2, (a[1]+b[1])//2)
    cv2.putText(vis, f"{dist:.1f}px", (mid[0]+8, mid[1]-8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 2, cv2.LINE_AA)
    ok = cv2.imwrite(out_path, vis)
    if ok:
        status_line(f"[draw_link_with_distance] {out_path} saved")
    else:
        status_line(f"[draw_link_with_distance] {out_path} failed")
    return dist



# ===== 템플릿 로더 =====
# def load_tobi_templates():
#     tpls = []
#     for i in range(1, 9):  # 필요 개수 맞게 조절
#         path = f"dragon{i}.png"
#         try:
#             for scale, tmpl, size in load_scaled_templates(path, SCALE_FACTORS):
#                 print(f"[dragon] {path} scale={scale} size={size}")
#                 tpls.append((path, scale, tmpl, size))  # 4튜플
#         except FileNotFoundError as e:
#             status_line(e)
#     return tpls

# 레이스용
def load_tobi_back(job):
    files = [f"images/{job}/back{i}.png" for i in range(1, 2)]
    return _load_templates_from_list(files)

def load_tobi_left(job):
    files = [f"images/{job}/left{i}.png" for i in range(1, 2)]
    return _load_templates_from_list(files)

def load_tobi_right(job):
    files = [f"images/{job}/right{i}.png" for i in range(1, 2)]
    return _load_templates_from_list(files)

def _load_templates_from_list(files):
    tpls = []
    for path in files:
        try:
            for scale, tmpl, size in load_scaled_templates(path, SCALE_FACTORS):
                # 필요하면 디버그: print(f"[tobi] {path} scale={scale} size={size}")
                tpls.append((path, scale, tmpl, size))
        except FileNotFoundError as e:
            # 네가 만든 status_line 쓰고 있으면 그걸로 찍어도 됨
            print(e)
    return tpls

def load_monster_templates():
    tpls = []
    for i in range(1, 5):  # monster7~10
        path = f"images/{job}/{monster}/{monster}{i}.png"
        try:
            for scale, tmpl, size in load_scaled_templates(path, SCALE_FACTORS):
                tpls.append((path, scale, tmpl, size))  # 4튜플
                
        except FileNotFoundError as e:
            status_line(e)
    return tpls

def main():
    # 전역 한 번만 로드 (스코프/순서 문제 방지)
    # tobi_templates = load_tobi_templates()

    # @ state별로 따로 로드
    back_templates  = load_tobi_back(job)
    left_templates  = load_tobi_left(job)
    right_templates = load_tobi_right(job)

    monster_templates = load_monster_templates()

    # 토비 스테이트
    tobi_state = TobiState()
    frame_idx = 0

    # if not tobi_templates:
    #     status_line("[err] wizard 템플릿이 없습니다.")
    #     return
    if not monster_templates:
        status_line("[warn] monster 템플릿이 없습니다. 몬스터 탐지는 스킵됩니다.")

    last_mark_time = 0.0

    while True:
        t0 = time.monotonic()
        frame_idx += 1
        # 1) 캡처 (한 프레임 재사용)
        bgr, gray = capture_screenshot_bgr_and_gray(
            bgr_filename=None, gray_filename=None, monitor_index=MONITOR_INDEX
        )

        # 2) 토비 탐지

        # best_tobi = find_tobi_ultra_fast(gray, tobi_templates, tobi_state, frame_index=frame_idx)

        start_time = time.time()
        # === Promise.race 스타일 탐색 ===
        winner_dir, best_tobi = race_find_tobi(
            gray,
            {"back": back_templates, "left": left_templates, "right": right_templates},
            seed_state=tobi_state,       # 메인 상태 객체 (우승자 상태만 반영됨)
            threshold=THRESHOLD,
            roi_margin=140,
            coarse_ratio=0.5,
            early_win=0.83,
            max_workers=4,
            full_search_every=6,
            frame_index=frame_idx,
            find_fn=find_tobi_ultra_fast  # 네가 제공한 함수 그대로 사용
        )

        # - 나중에 살려
        # best_tobi = find_tobi_ultra_fast(
        #         gray, tobi_templates, tobi_state,
        #         threshold=THRESHOLD,
        #         roi_margin=140,          # 더 줄이면 더 빠름(120~160 사이 튜닝)
        #         coarse_ratio=0.5,        # 0.4까지 내려도 됨(정확도 소폭↓)
        #         early_win=0.8,
        #         max_workers=4,
        #         full_search_every=6,     # 6프레임마다(≈1.8s@300ms) 전체 탐색
        #         frame_index=frame_idx
        #     )

        if best_tobi and best_tobi["max_val"] >= THRESHOLD:
            x, y = best_tobi["top_left"]; w, h = best_tobi["size"]
            tobi_center = (x + w // 2, y + h // 2)
            requests.get(f"http://localhost:8083/xy?x={x}&y={y}")
            # print(f"find_tobi_ultra_fast Execution Time: {time.time() - start_time:.2f}s")
            status_line(f"{x},{y} {time.time() - start_time:.2f}s {best_tobi['name']}")

            # 토비 마킹 이미지: 1초에 1번만
            # if time.monotonic() - last_mark_time > LAST_MARK_INTERVAL_S:
            #     draw_point(bgr, tobi_center, out_path="tobi_marked.png",
            #                text=f"T:{best_tobi['max_val']:.2f}")
            #     last_mark_time = time.monotonic()

            # # 3) 몬스터 후보 전체 탐색 → 토비와 가장 가까운 하나 선택
            if monster_templates:
                mons = find_all_matches(
                    gray_screen=gray,
                    templates=monster_templates,   # 4튜플 리스트
                    threshold=MONSTER_THRESHOLD,
                    max_per_template=5
                )
                if mons:
                    nearest = min(mons, key=lambda m: euclidean(tobi_center, m["center"]))
                    # status_line(f"[nearest-monster] {nearest['name']} "
                    #       f"score={nearest['score']:.3f} center={nearest['center']}")
                    draw_point(bgr, nearest["center"], out_path="tobi_monster_nearest.png", text="M*")
                    # 거리 계산
                    dist = euclidean(tobi_center, nearest["center"])
                    # status_line(f"[distance] tobi↔monster = {dist:.2f}px")

                    # 상태 메시지(가깝다/중간/멀다)
                    if dist <= NEAR_PX:
                        status_line("[range] NEAR")
                    elif dist >= FAR_PX:
                        status_line("[range] FAR")
                    else:
                        status_line("[range] MID")

                    # --- LEFT / RIGHT 판별 추가 -------------------------
                    # center가 (x, y) 튜플일 때:
                    dx = float(nearest["center"][0] - tobi_center[0])  # +면 오른쪽, -면 왼쪽
                    side_tol = 3.0  # 거의 같은 x일 때 'CENTER'로 처리할 허용 오차(px)

                    if dx > side_tol:
                        side = "RIGHT"
                    elif dx < -side_tol:
                        side = "LEFT"
                    else:
                        side = "CENTER"
                    # print(f"[side] {side} (dx={dx:+.1f}px)")

                    # 1초에 1번만 시각화 저장 (과도한 IO 방지)
                    # if time.monotonic() - last_mark_time > DIST_MARK_INTERVAL_S:
                    # if True:
                    #     status_line("아예 프린트를 안타는데 ?")
                    #     dist = draw_link_with_distance(
                    #         bgr,
                    #         tobi_center,
                    #         nearest["center"],
                    #         out_path="tobi_vs_monster.png",
                    #         mode="horizontal"  # 가로 거리만 계산/표시
                    #     )
                    #     status_line(f"[distance-x] Δx = {dist:.1f}px")
                    #     print(f"[distance-x] Δx = {dist:.1f}px")
                    #     last_mark_time = time.monotonic()
                    requests.get(f"http://localhost:8083/action?side={side}&px={dist}")
                else:
                    # status_line("[monster] 후보 없음")
                    pass
                    
        else:
            status_line("[tobi] 발견되지 않음.")

        # 4) 주기 보정
        elapsed = time.monotonic() - t0
        to_sleep = INTERVAL_S - elapsed
        if to_sleep > 0:
            time.sleep(to_sleep)

if __name__ == "__main__":
    main()
