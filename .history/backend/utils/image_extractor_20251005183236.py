"""
하이브리드 방식: Vision API (텍스트) + 정확한 그리드 (이미지)
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
            else:
                print("Vision API 키 없음 - 기본 모드")
        except Exception as e:
            print(f"Vision 초기화 실패: {e}")
    
    def extract_from_pdf(self, pdf_bytes):
        results = []
        
        try:
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            for page_num in range(len(pdf_document)):
                print(f"Processing page {page_num + 1}...")
                
                page = pdf_document[page_num]
                
                zoom = 2.5
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                
                nparr = np.frombuffer(img_bytes, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                height, width = image.shape[:2]
                
                print(f"  페이지 크기: {width}x{height}")
                
                # Vision API로 텍스트 추출 (있으면)
                ocr_texts = []
                if self.use_vision:
                    ocr_texts = self._extract_text_with_vision(img_bytes)
                    print(f"  Vision OCR: {len(ocr_texts)}개 텍스트 블록")
                
                # 정확한 그리드로 제품 박스 추출
                products = self._extract_with_precise_grid(image, ocr_texts)
                
                print(f"  {len(products)}개 제품 추출")
                
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
    
    def _extract_text_with_vision(self, img_bytes):
        """Vision API로 텍스트만 추출"""
        try:
            from google.cloud import vision
            
            vision_image = vision.Image(content=img_bytes)
            response = self.vision_client.text_detection(image=vision_image)
            
            texts = response.text_annotations
            if not texts:
                return []
            
            # 텍스트와 위치 정보 추출
            ocr_results = []
            for text in texts[1:]:  # 첫 번째는 전체 텍스트
                vertices = text.bounding_poly.vertices
                x = min(v.x for v in vertices)
                y = min(v.y for v in vertices)
                
                ocr_results.append({
                    'text': text.description,
                    'x': x,
                    'y': y
                })
            
            return ocr_results
            
        except Exception as e:
            print(f"  Vision 오류: {e}")
            return []
    
    def _extract_with_precise_grid(self, image, ocr_texts):
        """PDF 실측 기반 정확한 그리드 추출"""
        height, width = image.shape[:2]
        cols, rows = 6, 4
        
        # PDF 실측 기반 정확한 비율
        header_ratio = 0.105  
        sidebar_ratio = 0.057
        
        header = int(height * header_ratio)
        sidebar = int(width * sidebar_ratio)
        
        work_width = width - sidebar
        work_height = height - header
        
        cell_width = work_width // cols
        cell_height = work_height // rows
        
        print(f"  그리드: {cols}x{rows}, 셀: {cell_width}x{cell_height}")
        print(f"  헤더: {header}px ({header_ratio*100:.1f}%), 사이드바: {sidebar}px ({sidebar_ratio*100:.1f}%)")
        
        products = self._extract_products_from_grid(image, header, sidebar, cell_width, cell_height, cols, rows, ocr_texts)
        
        return products
    
    def _extract_products_from_grid(self, image, header, sidebar, cell_width, cell_height, cols, rows, ocr_texts):
        """실제 제품 추출"""
        products = []
        
        for row in range(rows):
            for col in range(cols):
                x_start = sidebar + (col * cell_width)
                y_start = header + (row * cell_height)
                
                padding = 3
                x = x_start + padding
                y = y_start + padding
                w = cell_width - (padding * 2)
                h = cell_height - (padding * 2)
                
                box_crop = image[y:y+h, x:x+w]
                
                if box_crop.size == 0:
                    continue
                
                gray = cv2.cvtColor(box_crop, cv2.COLOR_BGR2GRAY)
                if gray.mean() > 250 or gray.mean() < 5:
                    continue
                
                cell_texts = [ocr['text'] for ocr in ocr_texts 
                             if x_start <= ocr['x'] <= x_start + cell_width 
                             and y_start <= ocr['y'] <= y_start + cell_height]
                
                product_name = 'COB'
                if cell_texts:
                    candidates = [t for t in cell_texts if any(k in t.upper() for k in ['COB', 'SMD', 'LED'])]
                    product_name = candidates[0] if candidates else cell_texts[0]
                else:
                    product_name = f'제품 {len(products) + 1}'
                
                box_pil = Image.fromarray(cv2.cvtColor(box_crop, cv2.COLOR_BGR2RGB))
                img_base64 = self._image_to_base64(box_pil)
                
                products.append({
                    'name': product_name[:100],
                    'details': cell_texts[1:4] if len(cell_texts) > 1 else [],
                    'specs': cell_texts[1:4] if len(cell_texts) > 1 else [],
                    'image': img_base64
                })
        
        return products
    
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