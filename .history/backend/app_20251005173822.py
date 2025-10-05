"""
OpenCV 박스 테두리 검출 개선 버전
회색 테두리를 정확히 인식
"""

import io
import base64
from PIL import Image
import fitz  # PyMuPDF
import cv2
import numpy as np

class ImageExtractor:
    def __init__(self):
        self.min_box_area = 15000  # 최소 박스 면적
    
    def extract_from_pdf(self, pdf_bytes):
        """
        OpenCV로 제품 박스 검출
        """
        results = []
        
        try:
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            for page_num in range(len(pdf_document)):
                print(f"Processing page {page_num + 1}...")
                
                page = pdf_document[page_num]
                
                # 고해상도 렌더링
                zoom = 3.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                
                # OpenCV 형식으로 변환
                img_data = pix.tobytes("png")
                nparr = np.frombuffer(img_data, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                print(f"  Image size: {image.shape[1]}x{image.shape[0]}")
                
                # 박스 검출
                boxes = self._detect_product_boxes(image)
                print(f"  Detected {len(boxes)} product boxes")
                
                # 각 박스에서 제품 추출
                products = []
                for idx, (x, y, w, h) in enumerate(boxes):
                    # 박스 내부의 제품 이미지만 크롭 (테두리 제외)
                    padding = 5
                    product_crop = image[y+padding:y+h-padding, x+padding:x+w-padding]
                    
                    if product_crop.size == 0:
                        continue
                    
                    # PIL Image로 변환
                    product_pil = Image.fromarray(cv2.cvtColor(product_crop, cv2.COLOR_BGR2RGB))
                    img_base64 = self._image_to_base64(product_pil)
                    
                    # PyMuPDF로 해당 영역의 텍스트 추출 (OCR 아님)
                    text_rect = fitz.Rect(x / zoom, y / zoom, (x + w) / zoom, (y + h) / zoom)
                    box_text = page.get_textbox(text_rect)
                    
                    # 텍스트 파싱
                    lines = [l.strip() for l in box_text.split('\n') if l.strip()]
                    product_name = lines[0] if lines else f'제품 {idx + 1}'
                    specs = lines[1:4] if len(lines) > 1 else []
                    
                    product = {
                        'name': product_name[:100],
                        'details': specs,
                        'specs': specs,
                        'image': img_base64
                    }
                    
                    products.append(product)
                
                # 페이지 전체 이미지
                page_pil = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
                page_image = self._image_to_base64(page_pil)
                
                results.append({
                    'page': page_num + 1,
                    'image': page_image,
                    'text': '',
                    'products': products
                })
                
                print(f"Page {page_num + 1}: {len(products)} products extracted")
            
            pdf_document.close()
            return results
            
        except Exception as e:
            print(f"Error extracting from PDF: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
    
    def _detect_product_boxes(self, image):
        """
        회색 테두리 박스 검출 (개선 - 겹침/분할 처리)
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # 여러 방법으로 엣지 검출 시도
        # 방법 1: Canny
        edges1 = cv2.Canny(blurred, 20, 80)
        
        # 방법 2: Adaptive Threshold
        edges2 = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                       cv2.THRESH_BINARY_INV, 11, 2)
        
        # 두 결과 병합
        edges = cv2.bitwise_or(edges1, edges2)
        
        # 형태학적 연산
        kernel = np.ones((5, 5), np.uint8)
        edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=2)
        
        # 윤곽선 찾기
        contours, hierarchy = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        
        print(f"  Found {len(contours)} contours")
        
        # 제품 박스 후보 수집
        box_candidates = []
        
        for i, contour in enumerate(contours):
            x, y, w, h = cv2.boundingRect(contour)
            area = w * h
            
            # 기본 필터링
            if area < self.min_box_area or area > image.shape[0] * image.shape[1] * 0.8:
                continue
            
            aspect_ratio = w / h
            if aspect_ratio < 0.4 or aspect_ratio > 2.5:
                continue
            
            # 계층 구조 확인 (중첩된 박스 제외)
            if hierarchy is not None:
                if hierarchy[0][i][3] != -1:  # 부모가 있으면 스킵
                    parent_idx = hierarchy[0][i][3]
                    parent_contour = contours[parent_idx]
                    px, py, pw, ph = cv2.boundingRect(parent_contour)
                    parent_area = pw * ph
                    if parent_area > area * 1.5:  # 부모가 충분히 크면 스킵
                        continue
            
            box_candidates.append({
                'rect': (x, y, w, h),
                'area': area,
                'center': (x + w//2, y + h//2)
            })
        
        print(f"  Candidates after filtering: {len(box_candidates)}")
        
        # NMS (Non-Maximum Suppression) - 겹치는 박스 제거
        boxes = self._non_max_suppression(box_candidates)
        
        # 정렬 (위->아래, 좌->우)
        boxes.sort(key=lambda b: (b[1] // 300, b[0]))
        
        print(f"  Final boxes after NMS: {len(boxes)}")
        
        return boxes
    
    def _non_max_suppression(self, box_candidates, overlap_thresh=0.3):
        """
        겹치는 박스 제거
        """
        if len(box_candidates) == 0:
            return []
        
        boxes = [b['rect'] for b in box_candidates]
        
        x1 = np.array([b[0] for b in boxes])
        y1 = np.array([b[1] for b in boxes])
        x2 = np.array([b[0] + b[2] for b in boxes])
        y2 = np.array([b[1] + b[3] for b in boxes])
        areas = np.array([b[2] * b[3] for b in boxes])
        
        indices = np.argsort(areas)[::-1]
        
        keep = []
        while len(indices) > 0:
            i = indices[0]
            keep.append(i)
            
            xx1 = np.maximum(x1[i], x1[indices[1:]])
            yy1 = np.maximum(y1[i], y1[indices[1:]])
            xx2 = np.minimum(x2[i], x2[indices[1:]])
            yy2 = np.minimum(y2[i], y2[indices[1:]])
            
            w = np.maximum(0, xx2 - xx1)
            h = np.maximum(0, yy2 - yy1)
            
            overlap = (w * h) / areas[indices[1:]]
            
            indices = indices[np.where(overlap <= overlap_thresh)[0] + 1]
        
        return [boxes[i] for i in keep]
    
    def _image_to_base64(self, image):
        """PIL Image를 base64로 변환"""
        buffered = io.BytesIO()
        
        image = image.convert('RGB')
        
        # 리스트 표시용 작은 크기로 최적화
        max_width = 300  # 600 -> 300으로 줄임
        if image.width > max_width:
            ratio = max_width / image.width
            new_height = int(image.height * ratio)
            image = image.resize((max_width, new_height), Image.LANCZOS)
        
        image.save(buffered, format="JPEG", quality=85, optimize=True)
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return f"data:image/jpeg;base64,{img_str}"


def test_extractor():
    """테스트 함수"""
    extractor = ImageExtractor()
    
    with open('1페이지PDF.pdf', 'rb') as f:
        pdf_bytes = f.read()
    
    results = extractor.extract_from_pdf(pdf_bytes)
    
    print(f"\n=== 추출 결과 ===")
    print(f"총 페이지: {len(results)}")
    
    for page_data in results:
        print(f"\n페이지 {page_data['page']}")
        print(f"제품 수: {len(page_data['products'])}")


if __name__ == '__main__':
    test_extractor()