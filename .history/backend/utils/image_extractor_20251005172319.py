"""
OpenCV 윤곽선 검출 방식으로 제품 영역 자동 추출
- 레이아웃 무관하게 작동
- 빠른 처리 속도 (페이지당 1-2초)
"""

import io
import base64
from PIL import Image
import fitz  # PyMuPDF
import cv2
import numpy as np

class ImageExtractor:
    def __init__(self):
        self.min_product_width = 100  # 최소 제품 너비
        self.min_product_height = 100  # 최소 제품 높이
        self.max_products_per_page = 30  # 페이지당 최대 제품 수
    
    def extract_from_pdf(self, pdf_bytes):
        """
        OpenCV로 제품 영역 자동 감지 및 추출
        """
        results = []
        
        try:
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            for page_num in range(len(pdf_document)):
                print(f"Processing page {page_num + 1}...")
                
                page = pdf_document[page_num]
                
                # 페이지를 고해상도 이미지로 렌더링
                zoom = 3.0  # 고해상도
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                
                # OpenCV 형식으로 변환
                img_data = pix.tobytes("png")
                nparr = np.frombuffer(img_data, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                print(f"  Image size: {image.shape[1]}x{image.shape[0]}")
                
                # OpenCV로 제품 영역 검출
                product_regions = self._detect_product_regions(image)
                print(f"  Detected {len(product_regions)} product regions")
                
                # 각 영역을 제품 이미지로 추출
                products = []
                for idx, region in enumerate(product_regions):
                    x, y, w, h = region
                    
                    # 영역 크롭
                    product_img = image[y:y+h, x:x+w]
                    
                    # PIL Image로 변환 후 base64 인코딩
                    product_pil = Image.fromarray(cv2.cvtColor(product_img, cv2.COLOR_BGR2RGB))
                    img_base64 = self._image_to_base64(product_pil)
                    
                    product = {
                        'name': f'제품 {idx + 1}',
                        'details': [],
                        'specs': [],
                        'image': img_base64
                    }
                    
                    products.append(product)
                
                # 페이지 전체 이미지 (미리보기용)
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
    
    def _detect_product_regions(self, image):
        """
        OpenCV로 제품 영역 검출
        """
        # 1. 그레이스케일 변환
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # 2. 가우시안 블러로 노이즈 제거
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # 3. 이진화 (Adaptive Threshold)
        binary = cv2.adaptiveThreshold(
            blurred, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 11, 2
        )
        
        # 4. 모폴로지 연산으로 노이즈 제거 및 영역 강화
        kernel = np.ones((3, 3), np.uint8)
        morph = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
        morph = cv2.morphologyEx(morph, cv2.MORPH_OPEN, kernel, iterations=1)
        
        # 5. 윤곽선 검출
        contours, _ = cv2.findContours(morph, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        print(f"  Found {len(contours)} contours")
        
        # 6. 제품으로 판단되는 영역 필터링
        product_regions = []
        
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            
            # 크기 필터링
            if w < self.min_product_width or h < self.min_product_height:
                continue
            
            # 너무 큰 영역 제외 (전체 페이지 등)
            if w > image.shape[1] * 0.9 or h > image.shape[0] * 0.9:
                continue
            
            # 너비:높이 비율 체크 (너무 가늘거나 긴 것 제외)
            aspect_ratio = w / h
            if aspect_ratio < 0.3 or aspect_ratio > 3.0:
                continue
            
            product_regions.append((x, y, w, h))
        
        # 7. 크기 순으로 정렬 (큰 것부터)
        product_regions.sort(key=lambda r: r[2] * r[3], reverse=True)
        
        # 8. 최대 개수 제한
        product_regions = product_regions[:self.max_products_per_page]
        
        # 9. Y좌표 -> X좌표 순으로 정렬 (좌->우, 위->아래)
        product_regions.sort(key=lambda r: (r[1] // 200, r[0]))
        
        return product_regions
    
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