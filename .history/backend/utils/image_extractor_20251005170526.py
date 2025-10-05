"""
PDF에서 이미지와 텍스트 추출 (무료 OCR)
Railway 배포용 - Tesseract OCR 사용
"""

import os
import io
import base64
from pdf2image import convert_from_bytes
from PIL import Image
import pytesseract

class ImageExtractor:
    def __init__(self):
        # Railway 환경에서는 Tesseract가 자동으로 PATH에 설정됨
        # 로컬 개발시에만 경로 지정 필요
        pass
    
    def extract_from_pdf(self, pdf_bytes):
        """
        PDF에서 이미지와 텍스트 추출
        
        Args:
            pdf_bytes: PDF 파일의 바이트 데이터
            
        Returns:
            list: 각 페이지의 이미지와 텍스트 정보
        """
        results = []
        
        try:
            # PDF를 이미지로 변환 (300 DPI)
            images = convert_from_bytes(pdf_bytes, dpi=300)
            
            for page_num, image in enumerate(images, start=1):
                print(f"Processing page {page_num}...")
                
                # 이미지를 base64로 인코딩
                img_base64 = self._image_to_base64(image)
                
                # OCR로 텍스트 추출
                text = self._extract_text_ocr(image)
                
                # 제품 정보 파싱
                products = self._parse_products(text)
                
                results.append({
                    'page': page_num,
                    'image': img_base64,
                    'text': text,
                    'products': products
                })
                
                print(f"Page {page_num}: {len(products)} products found")
            
            return results
            
        except Exception as e:
            print(f"Error extracting from PDF: {str(e)}")
            raise
    
    def _image_to_base64(self, image):
        """PIL Image를 base64 문자열로 변환"""
        buffered = io.BytesIO()
        
        # 이미지 최적화 (파일 크기 줄이기)
        image = image.convert('RGB')
        # 너무 크면 리사이즈
        max_width = 1200
        if image.width > max_width:
            ratio = max_width / image.width
            new_height = int(image.height * ratio)
            image = image.resize((max_width, new_height), Image.LANCZOS)
        
        image.save(buffered, format="JPEG", quality=85, optimize=True)
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return f"data:image/jpeg;base64,{img_str}"
    
    def _extract_text_ocr(self, image):
        """
        Tesseract OCR로 텍스트 추출
        한글 + 영어 지원
        """
        try:
            # 이미지 전처리 (선택사항 - 정확도 향상)
            # image = self._preprocess_image(image)
            
            # Tesseract OCR 실행
            text = pytesseract.image_to_string(
                image,
                lang='kor+eng',  # 한글 + 영어
                config='--psm 6 --oem 3'  # PSM 6: 균일한 텍스트 블록, OEM 3: 기본 + LSTM
            )
            
            return text.strip()
            
        except Exception as e:
            print(f"OCR Error: {str(e)}")
            return ""
    
    def _preprocess_image(self, image):
        """
        이미지 전처리 (OCR 정확도 향상)
        선택적으로 사용
        """
        import cv2
        import numpy as np
        
        # PIL -> OpenCV
        img_array = np.array(image)
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        
        # 노이즈 제거
        denoised = cv2.fastNlMeansDenoising(gray)
        
        # 이진화
        binary = cv2.adaptiveThreshold(
            denoised, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 11, 2
        )
        
        # OpenCV -> PIL
        return Image.fromarray(binary)
    
    def _parse_products(self, text):
        """
        OCR 텍스트에서 제품 정보 추출
        """
        products = []
        if not text:
            return products
        
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        current_product = None
        
        for line in lines:
            # 제품명 패턴 감지
            # COB, SMD, MR, LED 등의 키워드 포함
            if any(keyword in line.upper() for keyword in ['COB', 'SMD', 'MR', 'LED', '다운라이트', '반사판']):
                # 이전 제품 저장
                if current_product:
                    products.append(current_product)
                
                # 새 제품 시작
                current_product = {
                    'name': line,
                    'details': [],
                    'specs': []
                }
            
            elif current_product:
                # 사이즈 정보 (예: 2", Ø50 등)
                if any(char in line for char in ['"', 'Ø', '㎜', 'mm']):
                    current_product['specs'].append(line)
                # 기타 상세 정보
                else:
                    current_product['details'].append(line)
        
        # 마지막 제품 저장
        if current_product:
            products.append(current_product)
        
        return products


def test_extractor():
    """테스트 함수"""
    extractor = ImageExtractor()
    
    # 테스트 PDF 파일 읽기
    with open('제품 카탈로그(최종본).pdf', 'rb') as f:
        pdf_bytes = f.read()
    
    results = extractor.extract_from_pdf(pdf_bytes)
    
    print(f"\n=== 추출 결과 ===")
    print(f"총 페이지: {len(results)}")
    
    for page_data in results:
        print(f"\n페이지 {page_data['page']}")
        print(f"제품 수: {len(page_data['products'])}")
        
        for i, product in enumerate(page_data['products'], 1):
            print(f"  제품 {i}: {product['name']}")
            if product['specs']:
                print(f"    스펙: {', '.join(product['specs'])}")


if __name__ == '__main__':
    test_extractor()