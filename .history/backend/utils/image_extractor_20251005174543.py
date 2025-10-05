"""
템플릿 매칭 방식: 어떤 레이아웃이든 작동
첫 번째 제품 박스를 자동으로 찾아서 템플릿으로 사용
"""

import io
import base64
from PIL import Image
import fitz
import cv2
import numpy as np

class ImageExtractor:
    def __init__(self):
        self.template_match_threshold = 0.6
    
    def extract_from_pdf(self, pdf_bytes):
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
                
                img_data = pix.tobytes("png")
                nparr = np.frombuffer(img_data, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                print(f"  Image size: {image.shape[1]}x{image.shape[0]}")
                
                # 1단계: 첫 번째 제품 박스 찾기 (템플릿)
                template_box = self._find_first_product_box(image)
                
                if template_box is None:
                    print("  Could not find template box, using grid fallback")
                    boxes = self._grid_fallback(image)
                else:
                    print(f"  Template box found: {template_box}")
                    
                    # 2단계: 템플릿 매칭으로 모든 제품 박스 찾기
                    boxes = self._find_all_boxes_by_template(image, template_box)
                
                print(f"  Detected {len(boxes)} product boxes")
                
                # 각 박스에서 제품 추출
                products = []
                for idx, (x, y, w, h) in enumerate(boxes):
                    padding = 5
                    product_crop = image[y+padding:y+h-padding, x+padding:x+w-padding]
                    
                    if product_crop.size == 0:
                        continue
                    
                    product_pil = Image.fromarray(cv2.cvtColor(product_crop, cv2.COLOR_BGR2RGB))
                    img_base64 = self._image_to_base64(product_pil)
                    
                    # PyMuPDF로 텍스트 추출
                    text_rect = fitz.Rect(x / zoom, y / zoom, (x + w) / zoom, (y + h) / zoom)
                    box_text = page.get_textbox(text_rect)
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
            print(f"Error: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
    
    def _find_first_product_box(self, image):
        """
        첫 번째 제품 박스 자동 감지
        좌상단 영역에서 적절한 크기의 사각형 찾기
        """
        # 상단 1/3 영역만 검색
        search_region = image[:image.shape[0]//3, :]
        
        gray = cv2.cvtColor(search_region, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 30, 100)
        
        kernel = np.ones((5, 5), np.uint8)
        edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
        
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # 적절한 크기의 박스 찾기
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            area = w * h
            
            # 크기 조건
            if 15000 < area < 100000:
                aspect_ratio = w / h
                if 0.5 < aspect_ratio < 2.0:
                    return (x, y, w, h)
        
        return None
    
    def _find_all_boxes_by_template(self, image, template_box):
        """
        템플릿 매칭으로 모든 제품 박스 찾기
        """
        tx, ty, tw, th = template_box
        template = image[ty:ty+th, tx:tx+tw]
        
        # 템플릿을 그레이스케일로 변환
        template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)
        image_gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # 템플릿 매칭
        result = cv2.matchTemplate(image_gray, template_gray, cv2.TM_CCOEFF_NORMED)
        
        # 임계값 이상의 매칭 위치 찾기
        locations = np.where(result >= self.template_match_threshold)
        
        boxes = []
        for pt in zip(*locations[::-1]):
            boxes.append((pt[0], pt[1], tw, th))
        
        # 겹치는 박스 제거 (NMS 간소화)
        boxes = self._simple_nms(boxes)
        
        # 정렬
        boxes.sort(key=lambda b: (b[1] // (th // 2), b[0]))
        
        return boxes
    
    def _simple_nms(self, boxes):
        """
        간단한 NMS - 너무 가까운 박스 제거
        """
        if len(boxes) == 0:
            return []
        
        final = []
        boxes_sorted = sorted(boxes, key=lambda b: (b[1], b[0]))
        
        for box in boxes_sorted:
            x, y, w, h = box
            
            # 기존 박스들과 겹치는지 확인
            too_close = False
            for fx, fy, fw, fh in final:
                if abs(x - fx) < w * 0.5 and abs(y - fy) < h * 0.5:
                    too_close = True
                    break
            
            if not too_close:
                final.append(box)
        
        return final
    
    def _grid_fallback(self, image):
        """
        템플릿 매칭 실패시 그리드 방식 대체
        """
        height, width = image.shape[:2]
        
        cols, rows = 6, 4
        header = int(height * 0.12)
        sidebar = int(width * 0.08)
        
        work_width = width - sidebar
        work_height = height - header
        
        cell_width = work_width // cols
        cell_height = work_height // rows
        
        boxes = []
        for row in range(rows):
            for col in range(cols):
                x = sidebar + (col * cell_width)
                y = header + (row * cell_height)
                boxes.append((x, y, cell_width, cell_height))
        
        return boxes
    
    def _image_to_base64(self, image):
        buffered = io.BytesIO()
        image = image.convert('RGB')
        
        max_width = 300
        if image.width > max_width:
            ratio = max_width / image.width
            new_height = int(image.height * ratio)
            image = image.resize((max_width, new_height), Image.LANCZOS)
        
        image.save(buffered, format="JPEG", quality=85, optimize=True)
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return f"data:image/jpeg;base64,{img_str}"