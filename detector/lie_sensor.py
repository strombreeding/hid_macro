import cv2
import numpy as np
from dataclasses import dataclass
from typing import List, Tuple

# -----------------------------
# 설정
# -----------------------------
SCALES = [0.50 ,0.75, 1.0, 1.25, 1.5, 1.75, 2.0,  2.25, 2.5]
# SCALES = [1.0]
ANGLES = list(range(-45, 50, 2))
# ANGLES = list(range(0, 360, 10))   # 0,10,...,350
THRESHOLD = 0.8                  # 매칭 점수 임계값 (필요시 조정)
EARLY_WIN = 0.8                 # 이 점수 넘으면 즉시 반환 (가장 빠른 탐색용)
USE_ROI = False                    # True면 ROI만 탐색
ROI_MARGIN = 200                   # ROI 사용할 때 마진(px)
MAX_PER_CONFIG = 5                 # scale/angle 조합당 최대 검출 개수
EDGE_LOW_HIGH = (50, 150)          # Canny 에지 임계값

@dataclass
class Match:
    score: float
    top_left: Tuple[int,int]
    bottom_right: Tuple[int,int]
    center: Tuple[int,int]
    scale: float
    angle: int

def canny_edges(img_gray: np.ndarray) -> np.ndarray:
    # 가우시안 블러로 노이즈 완화 후 Canny
    blur = cv2.GaussianBlur(img_gray, (3,3), 0)
    edges = cv2.Canny(blur, EDGE_LOW_HIGH[0], EDGE_LOW_HIGH[1])
    return edges

def rotate_bound(image: np.ndarray, angle: float) -> np.ndarray:
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    cos = np.abs(M[0, 0]); sin = np.abs(M[1, 0])
    nW = int((h * sin) + (w * cos))
    nH = int((h * cos) + (w * sin))
    M[0, 2] += (nW / 2) - center[0]
    M[1, 2] += (nH / 2) - center[1]
    return cv2.warpAffine(image, M, (nW, nH), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

def nms(rects_scores: List[Tuple[Tuple[int,int,int,int], float]], iou_thresh=0.3):
    # rect = (x1,y1,x2,y2)
    if not rects_scores: return []
    boxes = np.array([r for r, _ in rects_scores], dtype=np.float32)
    scores = np.array([s for _, s in rects_scores], dtype=np.float32)
    x1, y1, x2, y2 = boxes.T
    areas = (x2-x1+1) * (y2-y1+1)
    order = scores.argsort()[::-1]
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        w = np.maximum(0.0, xx2-xx1+1)
        h = np.maximum(0.0, yy2-yy1+1)
        inter = w*h
        ovr = inter / (areas[i] + areas[order[1:]] - inter + 1e-6)
        inds = np.where(ovr <= iou_thresh)[0]
        order = order[inds+1]
    return [rects_scores[i] for i in keep]

def prepare_templates(template_gray: np.ndarray):
    base_edges = canny_edges(template_gray)
    cache = []
    for s in SCALES:
        t_scaled = cv2.resize(base_edges, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        for ang in ANGLES:
            t_rot = rotate_bound(t_scaled, ang)
            # 너무 작거나 큰 템플릿 제외
            if min(t_rot.shape[:2]) < 8 or max(t_rot.shape[:2]) > 1024:
                continue
            cache.append(((s, ang), t_rot))
    return cache  # [ ((scale,angle), edge_template) ]

def find_korean_glyph(gray_screen: np.ndarray, template_gray: np.ndarray, roi_center=None) -> List[Match]:
    screen_edges = canny_edges(gray_screen)

    # ROI 최적화(선택)
    if USE_ROI and roi_center is not None:
        h, w = gray_screen.shape[:2]
        cx, cy = roi_center
        x1 = max(0, cx - ROI_MARGIN)
        y1 = max(0, cy - ROI_MARGIN)
        x2 = min(w, cx + ROI_MARGIN)
        y2 = min(h, cy + ROI_MARGIN)
        screen_region = screen_edges[y1:y2, x1:x2]
        roi_offset = (x1, y1)
    else:
        screen_region = screen_edges
        roi_offset = (0, 0)

    cache = prepare_templates(template_gray)
    all_matches: List[Match] = []

    print("1단계")
    for (scale, ang), t_edge in cache:
        th, tw = t_edge.shape[:2]
        if th >= screen_region.shape[0] or tw >= screen_region.shape[1]:
            continue

        res = cv2.matchTemplate(screen_region, t_edge, cv2.TM_CCOEFF_NORMED)
        loc = np.where(res >= THRESHOLD)
        rects_scores = []
        for (y, x) in zip(*loc):
            score = float(res[y, x])
            x1 = x + roi_offset[0]
            y1 = y + roi_offset[1]
            x2 = x1 + tw
            y2 = y1 + th
            rects_scores.append(((x1, y1, x2, y2), score))

        # 중복 제거
        rects_scores = nms(rects_scores, iou_thresh=0.35)[:MAX_PER_CONFIG]
        
        for (x1,y1,x2,y2), score in rects_scores:
            cx = int((x1+x2)/2)
            cy = int((y1+y2)/2)
            all_matches.append(Match(
                score=score,
                top_left=(x1,y1),
                bottom_right=(x2,y2),
                center=(cx,cy),
                scale=scale,
                angle=ang
            ))

        # 매우 높은 점수면 얼리 스탑 (선택)
        if rects_scores and max(s for _, s in rects_scores) >= EARLY_WIN:
            break
    print("2단계")
    # 점수로 정렬해서 반환
    all_matches.sort(key=lambda m: m.score, reverse=True)
    return all_matches



def max_score_from_resmap(res: np.ndarray):
    # res: matchTemplate 결과(정규화됨)
    min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)
    return max_val, max_loc  # (최고점수, 그 위치)


def find_korean_glyph_multistage(gray_screen, template_gray,
                                 coarse_angles=range(-45, 50, 9),
                                 coarse_scales=(0.9, 1.0, 1.1),
                                 refine_angle_span=4,   # ±4°
                                 refine_angle_step=1,   # 1° 간격
                                 refine_scales=(0.95, 1.0, 1.05),
                                 k_top=3):
    """
    1) 코스 탐색: 대략적인 각도/배율만 훑어서 상위 K 후보 수집
    2) 후보별 로컬 정밀 탐색: 각도/배율 촘촘히 스캔하여 최대점 갱신
    3) 임계값 이상 매칭 리스트 + (임계값 미만이어도) 전체 구간에서의 최고점 후보 리포트
    """
    screen_edges = canny_edges(gray_screen)

    # --- 1단계: 코스 탐색 ---
    print("1단계")

    coarse_candidates = []  # [(score, (x1,y1,x2,y2), scale, angle), ...]
    for s in coarse_scales:
        t_scaled = cv2.resize(canny_edges(template_gray), None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        for ang in coarse_angles:
            t_rot = rotate_bound(t_scaled, ang)
            th, tw = t_rot.shape[:2]
            if th >= screen_edges.shape[0] or tw >= screen_edges.shape[1] or min(th, tw) < 8:
                continue
            res = cv2.matchTemplate(screen_edges, t_rot, cv2.TM_CCOEFF_NORMED)

            # 1) 임계값 이상 후보 수집
            loc = np.where(res >= THRESHOLD)
            rects_scores = []
            for (y, x) in zip(*loc):
                score = float(res[y, x])
                rects_scores.append(((x, y, x+tw, y+th), score))
            rects_scores = nms(rects_scores, iou_thresh=0.35)[:MAX_PER_CONFIG]
            for (x1,y1,x2,y2), sc in rects_scores:
                coarse_candidates.append((sc, (x1,y1,x2,y2), s, ang))

            # 2) 임계값 미만이라도 전체 최고점 갱신용
            best_val, best_xy = max_score_from_resmap(res)
            bx, by = best_xy
            coarse_candidates.append((float(best_val), (bx,by,bx+tw,by+th), s, ang))

    # 상위 k_top 추림
    coarse_candidates.sort(key=lambda z: z[0], reverse=True)
    coarse_top = coarse_candidates[:k_top] if coarse_candidates else []

    # 전체 최고점 (임계값 미만이어도 리포트 용)
    overall_best = coarse_candidates[0] if coarse_candidates else None  # (score, rect, s, ang)

    # --- 2단계: 후보별 로컬 정밀 탐색 ---
    print("2단계")
    all_matches = []
    for base_score, (x1,y1,x2,y2), base_s, base_ang in coarse_top:
        # 각도/배율 근처로 좁혀 정밀 스캔
        ref_angles = range(base_ang - refine_angle_span, base_ang + refine_angle_span + 1, refine_angle_step)
        for s in refine_scales:
            t_scaled = cv2.resize(canny_edges(template_gray), None, fx=base_s*s, fy=base_s*s, interpolation=cv2.INTER_AREA)
            for ang in ref_angles:
                t_rot = rotate_bound(t_scaled, ang)
                th, tw = t_rot.shape[:2]
                if th >= screen_edges.shape[0] or tw >= screen_edges.shape[1] or min(th, tw) < 8:
                    continue
                res = cv2.matchTemplate(screen_edges, t_rot, cv2.TM_CCOEFF_NORMED)
                loc = np.where(res >= THRESHOLD)
                rects_scores = []
                for (y, x) in zip(*loc):
                    sc = float(res[y, x])
                    rects_scores.append(((x, y, x+tw, y+th), sc))
                rects_scores = nms(rects_scores, iou_thresh=0.35)[:MAX_PER_CONFIG]
                for (rx1,ry1,rx2,ry2), sc in rects_scores:
                    cx = int((rx1+rx2)/2); cy = int((ry1+ry2)/2)
                    all_matches.append(Match(
                        score=sc,
                        top_left=(rx1,ry1),
                        bottom_right=(rx2,ry2),
                        center=(cx,cy),
                        scale=base_s*s,
                        angle=ang
                    ))

    # 점수 순 정렬
    all_matches.sort(key=lambda m: m.score, reverse=True)

    # 임계값 이상은 실제 검출로 간주
    detected = [m for m in all_matches if m.score >= THRESHOLD]

    # 리포트용 overall_best를 dict로 변환
    best_report = None
    if overall_best:
        sc, (bx1,by1,bx2,by2), bs, ba = overall_best
        best_report = {
            "best_score": float(sc),
            "best_rect": (int(bx1),int(by1),int(bx2),int(by2)),
            "best_center": (int((bx1+bx2)/2), int((by1+by2)/2)),
            "best_scale": float(bs),
            "best_angle": int(ba)
        }

    return detected, best_report
