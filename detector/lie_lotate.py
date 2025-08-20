import cv2

img = cv2.imread("lie2.png", cv2.IMREAD_UNCHANGED)

for angle in range(-45, 50, 15):  # -45, -30, ... , 45
    (h, w) = img.shape[:2]
    center = (w//2, h//2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(255,255,255,0))
    cv2.imwrite(f"lie1_rot{angle}.png", rotated)
    print(f"Saved: lie1_rot{angle}.png")