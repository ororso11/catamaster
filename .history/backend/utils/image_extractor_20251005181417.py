"""
Google Cloud Vision API 사용
정확한 텍스트 및 객체 인식
"""

import io
import base64
from PIL import Image
import fitz
from google.cloud import vision
import os

class ImageExtractor:
    def __init__(self):
        # 서비스 계정 키 파일 경로 설정
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'path/to/your-service-account-key.json'
        self.client = vision.ImageAnnotatorClient()
    
    def extract_from_pdf(self, pdf_bytes):
        results = []
        
        try:
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            for page_num in range(len(pdf_document)):
                print(f"Processing page {page_num + 1}...")
                
                page = pdf_document[page_num]
                
                # 페이지를 이미지로 렌더링
                zoom = 2.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                
                # Google Vision으로 객체 감지
                boxes = self._detect_objects_with_vision(img_bytes)
                print(f"  Detected {len(boxes)} objects")
                
                # 이미지로 변환
                import cv2
                import numpy as np
                nparr = np.frombuffer(img_bytes, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                products = []
                
                for idx, (x, y, w, h, label, conf) in enumerate(boxes):
                    box_crop = image[y:y+h, x:x+w]
                    
                    if box_crop.size == 0:
                        continue
                    
                    # OCR로 텍스트 추출
                    text = self._extract_text_from_region(img_bytes, x, y, w, h)
                    
                    box_pil = Image.fromarray(cv2.cvtColor(box_crop, cv2.COLOR_BGR2RGB))
                    img_base64 = self._image_to_base64(box_pil)
                    
                    product = {
                        'name': text if text else f'제품 {len(products) + 1}',
                        'details': [],
                        'specs': [],
                        'image': img_base64,
                        'confidence': conf
                    }
                    
                    products.append(product)
                
                print(f"  Extracted {len(products)} products")
                
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
            print(f"Error: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
    
    def _detect_objects_with_vision(self, image_bytes):
        """
        Google Vision으로 객체 감지
        """
        image = vision.Image(content=image_bytes)
        
        # 객체 감지
        response = self.client.object_localization(image=image)
        objects = response.localized_object_annotations
        
        boxes = []
        for obj in objects:
            # 바운딩 박스 좌표
            vertices = obj.bounding_poly.normalized_vertices
            
            # 정규화된 좌표를 픽셀로 변환
            # (이미지 크기 필요)
            x_coords = [v.x for v in vertices]
            y_coords = [v.y for v in vertices]
            
            # 여기서는 정규화된 좌표 반환 (나중에 변환)
            boxes.append({
                'x': min(x_coords),
                'y': min(y_coords),
                'w': max(x_coords) - min(x_coords),
                'h': max(y_coords) - min(y_coords),
                'label': obj.name,
                'confidence': obj.score
            })
        
        return boxes
    
    def _extract_text_from_region(self, image_bytes, x, y, w, h):
        """
        특정 영역의 텍스트 추출 (OCR)
        """
        image = vision.Image(content=image_bytes)
        
        # 텍스트 감지
        response = self.client.text_detection(image=image)
        texts = response.text_annotations
        
        if texts:
            return texts[0].description
        
        return ""
    
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