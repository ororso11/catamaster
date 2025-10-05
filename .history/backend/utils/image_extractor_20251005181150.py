"""
PDF 벡터 그래픽 객체(사각형) 추출
실제 박스 윤곽선을 그대로 따름
"""

import io
import base64
from PIL import Image
import fitz
import cv2
import numpy as np

class ImageExtractor:
    def __init__(self):
        pass
    
    def extract_from_pdf(self, pdf_bytes):
        results = []
        
        try:
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            for page_num in range(len(pdf_document)):
                print(f"Processing page {page_num + 1}...")
                
                page = pdf_document[page_num]
                
                # 페이지를 고해상도 이미지로 렌더링
                zoom = 2.5
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                
                img_data = pix.tobytes("png")
                nparr = np.frombuffer(img_data, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                print(f"  Page size: {image.shape[1]}x{image.shape[0]}")
                
                # PDF에서 벡터 객체(사각형) 추출
                boxes = self._extract_vector_boxes(page, zoom)
                print(f"  Found {len(boxes)} vector boxes")
                
                products = []
                
                for idx, (x, y, w, h) in enumerate(boxes):
                    # 박스 크롭
                    box_crop = image[y:y+h, x:x+w]
                    
                    if box_crop.size == 0:
                        continue
                    
                    # PIL 변환
                    box_pil = Image.fromarray(cv2.cvtColor(box_crop, cv2.COLOR_BGR2RGB))
                    img_base64 = self._image_to_base64(box_pil)
                    
                    product = {
                        'name': f'제품 {len(products) + 1}',
                        'details': [],
                        'specs': [],
                        'image': img_base64
                    }
                    
                    products.append(product)
                
                print(f"  Extracted {len(products)} products")
                
                # 페이지 이미지
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
    
    def _extract_vector_boxes(self, page, zoom):
        """
        PDF 벡터 그래픽에서 사각형 객체 추출
        """
        boxes = []
        
        # PDF의 그려진 경로(path) 추출
        paths = page.get_drawings()
        
        for path in paths:
            # 사각형인지 확인
            if path['type'] == 're':  # rectangle
                rect = path['rect']
                
                # 좌표를 이미지 픽셀로 변환
                x = int(rect.x0 * zoom)
                y = int(rect.y0 * zoom)
                w = int((rect.x1 - rect.x0) * zoom)
                h = int((rect.y1 - rect.y0) * zoom)
                
                area = w * h
                
                # 제품 박스 크기 필터링
                if 20000 < area < 500000:
                    boxes.append((x, y, w, h))
        
        # 위치 순으로 정렬
        boxes.sort(key=lambda b: (b[1] // 200, b[0]))
        
        return boxes
    
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