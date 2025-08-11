# utils_matching.py  (or detection_utils.py)
import cv2, os, time
from concurrent.futures import ThreadPoolExecutor, as_completed

cv2.setUseOptimized(True)
cv2.setNumThreads(min(os.cpu_count() or 4, 8))

class TobiState:
    # 프레임 간 추적 상태
    def __init__(self):
        self.center = None   # (x,y)
        self.name = None     # 마지막으로 맞은 템플릿명
        self.miss = 0        # 연속 실패 수

def _match_one(img, t):
    name, scale, tmpl, (w, h) = t
    if h > img.shape[0] or w > img.shape[1]:
        return -1.0, name, scale, (0,0), (w,h)
    res = cv2.matchTemplate(img, tmpl, cv2.TM_CCOEFF_NORMED)
    _, mv, _, ml = cv2.minMaxLoc(res)
    return mv, name, scale, ml, (w,h)

def find_tobi_ultra_fast(
    gray, templates, state:TobiState,
    threshold=0.80,
    roi_margin=140,          # ROI 크기 (줄일수록 더 빠름)
    coarse_ratio=0.5,        # 0.5x에서 1차 탐색
    early_win=0.92,          # 이 점수 넘으면 즉시 종료
    max_workers=4,
    full_search_every=6,     # N프레임마다 강제 풀서치
    frame_index=0
):
    H, W = gray.shape[:2]
    # 1) ROI 결정 (최근 좌표 기반, 실패가 누적되면 전체)
    use_full = (state.center is None) or (state.miss >= 3) or (frame_index % full_search_every == 0)
    if use_full:
        x0=y0=0; x1=W; y1=H
    else:
        cx, cy = state.center
        x0 = max(0, cx - roi_margin); x1 = min(W, cx + roi_margin)
        y0 = max(0, cy - roi_margin); y1 = min(H, cy + roi_margin)
    crop = gray[y0:y1, x0:x1]

    # 2) 코어스(다운스케일)에서 템플릿 병렬 매칭 → 상위 1개만 파인 검증
    coarse = cv2.resize(crop, (0,0), fx=coarse_ratio, fy=coarse_ratio, interpolation=cv2.INTER_AREA)
    def match_coarse(t):
        name, scale, tmpl, (w, h) = t
        cw, ch = int(w*coarse_ratio), int(h*coarse_ratio)
        if ch <= 1 or cw <= 1 or ch > coarse.shape[0] or cw > coarse.shape[1]:
            return -1.0, name, scale, (0,0), (w,h)
        t_coarse = cv2.resize(tmpl, (cw, ch), interpolation=cv2.INTER_AREA)
        res = cv2.matchTemplate(coarse, t_coarse, cv2.TM_CCOEFF_NORMED)
        _, mv, _, ml = cv2.minMaxLoc(res)
        return mv, name, scale, ml, (w,h)

    start = time.time()
    best_coarse = (-1.0, None, None, None, None)

    # 최근에 맞았던 템플릿 먼저 (조기 종료 확률↑)
    tpls = templates[:]
    if state.name:
        tpls.sort(key=lambda t: 0 if t[0]==state.name else 1)

    with ThreadPoolExecutor(max_workers=min(max_workers, len(tpls))) as ex:
        futures = [ex.submit(match_coarse, t) for t in tpls]
        for f in as_completed(futures):
            mv, name, scale, ml, size = f.result()
            if mv > best_coarse[0]:
                best_coarse = (mv, name, scale, ml, size)
            if mv >= early_win:  # 코어스에서 충분히 높으면 조기 종료
                for fu in futures: fu.cancel()
                break

    mv_c, name_c, scale_c, ml_c, (tw, th) = best_coarse
    if name_c is None:
        state.miss = min(state.miss+1, 10)
        # print(f"tobi coarse miss: {time.time()-start:.3f}s")
        return None

    # 3) 파인(원본 ROI)에서 해당 주변만 재검증
    #    코어스 최대점 근방을 원본 좌표로 역산
    px = int(ml_c[0] / coarse_ratio); py = int(ml_c[1] / coarse_ratio)
    # 원본 ROI 내에서 작은 윈도우만 재탐색 (템플릿 크기의 1.2배 주변)
    win_x0 = max(0, px - int(tw*0.2)); win_y0 = max(0, py - int(th*0.2))
    win_x1 = min(crop.shape[1], px + tw + int(tw*0.2))
    win_y1 = min(crop.shape[0], py + th + int(th*0.2))
    fine = crop[win_y0:win_y1, win_x0:win_x1]
    if fine.shape[0] < th or fine.shape[1] < tw:
        # 창이 너무 작으면 전체 ROI에서 한 번
        fine = crop
        win_x0 = 0; win_y0 = 0

    res_f = cv2.matchTemplate(fine, [t for t in templates if t[0]==name_c][0][2], cv2.TM_CCOEFF_NORMED)
    _, mv_f, _, ml_f = cv2.minMaxLoc(res_f)

    # 최종 좌표(전체 스크린 좌표로 보정)
    top_left = (x0 + win_x0 + ml_f[0], y0 + win_y0 + ml_f[1])
    result = {
        "name": name_c,
        "scale": scale_c,
        "max_val": mv_f,
        "top_left": top_left,
        "size": (tw, th),
    }

    # 상태 업데이트
    if mv_f >= threshold:
        cx = top_left[0] + tw//2
        cy = top_left[1] + th//2
        state.center = (cx, cy)
        state.name = name_c
        state.miss = 0
    else:
        state.miss = min(state.miss+1, 10)

    # print(f"tobi ultra: {time.time()-start:.3f}s mv={mv_f:.3f} ROI={'full' if use_full else 'roi'}")
    return result if result["max_val"] >= threshold else None
