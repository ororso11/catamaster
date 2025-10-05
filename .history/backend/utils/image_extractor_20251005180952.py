"""
페이지 렌더링 후 그리드로 전체 박스 추출
Ø 표시, 제품 이미지, 아이콘 모두 포함
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
                
                # 고해상도 렌더링
                zoom = 2.5
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                
                img_data = pix.tobytes("png")
                nparr = np.frombuffer(img_data, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                height, width = image.shape[:2]
                print(f"  Page size: {width}x{height}")
                
                # 그리드 설정 (6x4)
                cols, rows = 6, 4
                
                # 정확한 헤더/사이드바 계산
                # 실제 PDF 구조 분석 결과
                header = int(height * 0.15)  # 15%
                sidebar = int(width * 0.03)   # 3%
                
                work_width = width - sidebar
                work_height = height - header
                
                cell_width = work_width // cols
                cell_height = work_height // rows
                
                print(f"  Grid: {cols}x{rows}, Cell: {cell_width}x{cell_height}")
                
                products = []
                
                for row in range(rows):
                    for col in range(cols):
                        x = sidebar + (col * cell_width)
                        y = header + (row * cell_height)
                        
                        # 전체 박스 크롭 (여백 조금만)
                        padding = 10
                        box_crop = image[
                            y+padding:y+cell_height-padding,
                            x+padding:x+cell_width-padding
                        ]
                        
                        if box_crop.size == 0:
                            continue
                        
                        # 빈 셀 체크
                        if self._is_empty_cell(box_crop):
                            continue
                        
                        # PIL 변환 및 base64
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
                
                print(f"Page {page_num + 1}: {len(products)} products")
            
            pdf_document.close()
            return results
            
        except Exception as e:
            print(f"Error: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
    
    def _is_empty_cell(self, cell_image):
        """빈 셀 체크"""
        gray = cv2.cvtColor(cell_image, cv2.COLOR_BGR2GRAY)
        avg = gray.mean()
        std = gray.std()
        
        # 거의 흰색이거나 변화가 없으면 빈 셀
        if avg > 245 or std < 10:
            return True
        
        return False
    
    def _image_to_base64(self, image):
        buffered = io.BytesIO()
        image = image.convert('RGB')
        
        # 적당한 크기로 리사이즈
        max_width = 400
        if image.width > max_width:
            ratio = max_width / image.width
            new_height = int(image.height * ratio)
            image = image.resize((max_width, new_height), Image.LANCZOS)
        
        image.save(buffered, format="JPEG", quality=90, optimize=True)
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return f"data:image/jpeg;base64,{img_str}"