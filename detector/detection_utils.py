import cv2

def find_best_match(gray_screen, templates, method=cv2.TM_CCOEFF_NORMED):
    """
    templates: [(name, scale, tmpl_gray, (w,h))]
    return: dict or None
    """
    best = {"name": None, "scale": None, "max_val": -1.0, "top_left": None, "size": None}
    for name, scale, tmpl, (w, h) in templates:
        res = cv2.matchTemplate(gray_screen, tmpl, method)
        _, max_val, _, max_loc = cv2.minMaxLoc(res)
        if max_val > best["max_val"]:
            best.update({
                "name": name, "scale": scale, "max_val": max_val,
                "top_left": max_loc, "size": (w, h),
            })
    return best if best["name"] else None

def find_all_matches(gray_screen, templates, threshold=0.8, method=cv2.TM_CCOEFF_NORMED, max_per_template=5):
    """
    각 템플릿마다 threshold 이상인 좌표 후보를 수집 (비최대 억제 없음: 간단 버전)
    return: [ {"name", "scale", "score", "top_left", "center", "size"} ... ]
    """
    matches = []
    for name, scale, tmpl, (w, h) in templates:
        res = cv2.matchTemplate(gray_screen, tmpl, method)
        while True:
            min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)
            if max_val < threshold:
                break
            cx, cy = max_loc[0] + w//2, max_loc[1] + h//2
            matches.append({
                "name": name, "scale": scale, "score": max_val,
                "top_left": max_loc, "center": (cx, cy), "size": (w, h)
            })
            if len([m for m in matches if m["name"] == name and m["scale"] == scale]) >= max_per_template:
                break
            # 억제: 현재 최대점 근방을 0으로
            x, y = max_loc
            res[y:y+h, x:x+w] = 0
    return matches

def draw_point(bgr_img, center, out_path, text=None):
    vis = bgr_img.copy()
    cv2.circle(vis, center, 6, (0,0,255), -1)
    if text:
        cv2.putText(vis, text, (center[0]+8, center[1]-8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,0,255), 1, cv2.LINE_AA)
    cv2.imwrite(out_path, vis)
    return out_path

def filter_by_same_x(monster_matches, x_target, tol_px=8, mode="all"):
    """
    x_target(예: tobi의 center_x)와 x좌표가 tol_px 이내인 몬스터만 필터링
    mode="nearest": 가장 가까운 1개 반환
    mode="all": 모두 반환
    """
    same_col = [m for m in monster_matches if abs(m["center"][0] - x_target) <= tol_px]
    if mode == "nearest":
        if not same_col: return None
        return sorted(same_col, key=lambda m: abs(m["center"][0]-x_target))[0]
    return same_col
