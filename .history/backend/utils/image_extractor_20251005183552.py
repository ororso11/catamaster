"""
2가지 방법 병행:
1. 정확한 그리드 (하단 푸터 제외)
2. OpenCV 윤곽선 검출 재시도
"""

import io
import base64
from PIL import Image
import fitz
import cv2
import numpy as np
import os

class ImageExtractor:
    def __init__(self):
        self.use_vision = False
        try:
            from google.cloud import vision
            key_path = 'google-vision-key.json'
            if os.path.exists(key_path):
                os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = key_path
                self.vision_client = vision.ImageAnnotatorClient()
                self.use_vision = True
                print("Google Vision API 활성화")
        except:
            pass
    
    def extract_from_pdf(self, pdf_bytes):
        results = []
        
        try:
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            for page_num in range(len(pdf_document)):
                print(f"\n=== Processing page {page_num + 1} ===")
                
                page = pdf_document[page_num]
                
                zoom = 2.5
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                
                nparr = np.frombuffer(img_bytes, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                height, width = image.shape[:2]
                
                print(f"페이지 크기: {width}x{height}")
                
                # Vision API로 텍스트 추출
                ocr_texts = []
                if self.use_vision:
                    ocr_texts = self._extract_text_with_vision(img_bytes)
                    print(f"Vision OCR: {len(ocr_texts)}개 텍스트")
                
                # 방법 1: 정확한 그리드 (푸터 제외)
                print("\n[방법 1] 정확한 그리드 시도...")
                products_grid = self._method1_precise_grid(image, ocr_texts)
                print(f"그리드 방식: {len(products_grid)}개 추출")
                
                # 방법 2: OpenCV 윤곽선 검출
                print("\n[방법 2] OpenCV 윤곽선 검출 시도...")
                products_contour = self._method2_contour_detection(image, ocr_texts)
                print(f"윤곽선 방식: {len(products_contour)}개 추출")
                
                # 더 많은 제품을 추출한 방법 선택
                if len(products_grid) >= 20 and len(products_grid) <= 30:
                    products = products_grid
                    print(f"\n선택: 그리드 방식 ({len(products)}개)")
                elif len(products_contour) >= 20 and len(products_contour) <= 30:
                    products = products_contour
                    print(f"\n선택: 윤곽선 방식 ({len(products)}개)")
                else:
                    # 둘 다 이상하면 더 가까운 쪽
                    diff_grid = abs(24 - len(products_grid))
                    diff_contour = abs(24 - len(products_contour))
                    products = products_grid if diff_grid < diff_contour else products_contour
                    print(f"\n선택: {'그리드' if diff_grid < diff_contour else '윤곽선'} 방식 ({len(products)}개)")
                
                page_pil = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
                page_image = self._image_to_base64(page_pil)
                
                results.append({
                    'page': page_num + 1,
                    'image': page_image,
                    'text': '',
                    'products': products
                })
            
            pdf_document.close()
            return results
            
        except Exception as e:
            print(f"오류: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
    
    def _method1_precise_grid(self, image, ocr_texts):
        """방법 1: 정확한 그리드 (하단 푸터 제외)"""
        height, width = image.shape[:2]
        cols, rows = 6, 4
        
        # 상단 헤더 (로고 + 타공)
        header = int(height * 0.105)
        # 하단 푸터 (회사 정보 + DIMMING)
        footer = int(height * 0.08)
        # 왼쪽 사이드바
        sidebar = int(width * 0.057)
        
        work_width = width - sidebar
        work_height = height - header - footer  # 푸터 제외
        
        cell_width = work_width // cols
        cell_height = work_height // rows
        
        print(f"  헤더: {header}px, 푸터: {footer}px, 사이드바: {sidebar}px")
        print(f"  작업 영역: {work_width}x{work_height}, 셀: {cell_width}x{cell_height}")
        
        products = []
        
        for row in range(rows):
            for col in range(cols):
                x = sidebar + (col * cell_width)
                y = header + (row * cell_height)
                
                padding = 5
                box_crop = image[y+padding:y+cell_height-padding, x+padding:x+cell_width-padding]
                
                if box_crop.size == 0:
                    continue
                
                gray = cv2.cvtColor(box_crop, cv2.COLOR_BGR2GRAY)
                if gray.mean() > 250:
                    continue
                
                # OCR 텍스트 매칭
                cell_texts = [t['text'] for t in ocr_texts 
                             if x <= t['x'] <= x + cell_width and y <= t['y'] <= y + cell_height]
                
                product_name = f'제품 {len(products) + 1}'
                if cell_texts:
                    candidates = [t for t in cell_texts if any(k in t.upper() for k in ['COB', 'SMD', 'LED', 'MR'])]
                    product_name = candidates[0] if candidates else cell_texts[0]
                
                box_pil = Image.fromarray(cv2.cvtColor(box_crop, cv2.COLOR_BGR2RGB))
                img_base64 = self._image_to_base64(box_pil)
                
                products.append({
                    'name': product_name[:100],
                    'details': cell_texts[1:4] if len(cell_texts) > 1 else [],
                    'specs': cell_texts[1:4] if len(cell_texts) > 1 else [],
                    'image': img_base64
                })
        
        return products
    
    def _method2_contour_detection(self, image, ocr_texts):
        """방법 2: OpenCV 윤곽선 검출"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # 이진화
        _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
        
        # 모폴로지
        kernel = np.ones((15, 15), np.uint8)
        morph = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
        
        # 윤곽선 검출
        contours, _ = cv2.findContours(morph, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        print(f"  감지된 윤곽선: {len(contours)}개")
        
        boxes = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            area = w * h
            
            # 제품 박스 크기 필터링 (면적 기준)
            if 50000 < area < 200000:
                aspect = w / h
                if 0.6 < aspect < 1.8:
                    boxes.append((x, y, w, h, area))
        
        # 면적 순 정렬 후 상위 30개
        boxes.sort(key=lambda b: b[4], reverse=True)
        boxes = boxes[:30]
        
        # 위치 순 정렬
        boxes.sort(key=lambda b: (b[1] // 400, b[0]))
        
        print(f"  필터링 후: {len(boxes)}개")
        
        products = []
        for idx, (x, y, w, h, _) in enumerate(boxes):
            box_crop = image[y:y+h, x:x+w]
            
            if box_crop.size == 0:
                continue
            
            cell_texts = [t['text'] for t in ocr_texts 
                         if x <= t['x'] <= x + w and y <= t['y'] <= y + h]
            
            product_name = f'제품 {len(products) + 1}'
            if cell_texts:
                candidates = [t for t in cell_texts if any(k in t.upper() for k in ['COB', 'SMD', 'LED'])]
                product_name = candidates[0] if candidates else cell_texts[0]
            
            box_pil = Image.fromarray(cv2.cvtColor(box_crop, cv2.COLOR_BGR2RGB))
            img_base64 = self._image_to_base64(box_pil)
            
            products.append({
                'name': product_name[:100],
                'details': cell_texts[1:3] if len(cell_texts) > 1 else [],
                'specs': cell_texts[1:3] if len(cell_texts) > 1 else [],
                'image': img_base64
            })
        
        return products
    
    def _extract_text_with_vision(self, img_bytes):
        """Vision API로 텍스트 추출"""
        try:
            from google.cloud import vision
            vision_image = vision.Image(content=img_bytes)
            response = self.vision_client.text_detection(image=vision_image)
            
            texts = response.text_annotations
            if not texts:
                return []
            
            ocr_results = []
            for text in texts[1:]:
                vertices = text.bounding_poly.vertices
                x = min(v.x for v in vertices)
                y = min(v.y for v in vertices)
                ocr_results.append({'text': text.description, 'x': x, 'y': y})
            
            return ocr_results
        except:
            return []
    
    def _image_to_base64(self, image):
        buffered = io.BytesIO()
        image = image.convert('RGB')
        
        max_width = 400
        if image.width > max_width:
            ratio = max_width / image.width
            new_height = int(image.height * ratio)
            image = image.resize((max_width, new_height), Image.LANCZOS)
        
        image.save(buffered, format="JPEG", quality=90, optimize=True)
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return f"data:image/jpeg;base64,{img_str}"