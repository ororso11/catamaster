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
                    padding = 5  # 테두리 픽셀 제외
                    product_crop = image[y+padding:y+h-padding, x+padding:x+w-padding]
                    
                    if product_crop.size == 0:
                        continue
                    
                    # PIL Image로 변환
                    product_pil = Image.fromarray(cv2.cvtColor(product_crop, cv2.COLOR_BGR2RGB))
                    img_base64 = self._image_to_base64(product_pil)
                    
                    product = {
                        'name': f'제품 {idx + 1}',
                        'details': [],
                        'specs': [],
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
        회색 테두리 박스 검출 (개선)
        """
        # 그레이스케일 변환
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # 가우시안 블러
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        
        # Canny 엣지 검출 (회색 테두리 감지)
        edges = cv2.Canny(blurred, 30, 100)
        
        # 형태학적 연산으로 테두리 강화
        kernel = np.ones((3, 3), np.uint8)
        edges = cv2.dilate(edges, kernel, iterations=1)
        edges = cv2.erode(edges, kernel, iterations=1)
        
        # 윤곽선 찾기
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        print(f"  Found {len(contours)} contours")
        
        # 제품 박스 필터링
        boxes = []
        
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            area = w * h
            
            # 면적 필터링
            if area < self.min_box_area:
                continue
            
            # 너무 큰 박스 제외 (페이지 전체 등)
            if w > image.shape[1] * 0.95 or h > image.shape[0] * 0.95:
                continue
            
            # 가로세로 비율 체크 (정사각형에 가까운 박스만)
            aspect_ratio = w / h
            if aspect_ratio < 0.5 or aspect_ratio > 2.0:
                continue
            
            boxes.append((x, y, w, h))
        
        # Y좌표 -> X좌표 순으로 정렬
        boxes.sort(key=lambda b: (b[1] // 200, b[0]))
        
        print(f"  Filtered to {len(boxes)} valid boxes")
        
        return boxes
    
    def _image_to_base64(self, image):
        """PIL Image를 base64로 변환"""
        buffered = io.BytesIO()
        
        image = image.convert('RGB')
        
        # 최적화
        max_width = 600
        if image.width > max_width:
            ratio = max_width / image.width
            new_height = int(image.height * ratio)
            image = image.resize((max_width, new_height), Image.LANCZOS)
        
        image.save(buffered, format="JPEG", quality=90, optimize=True)
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