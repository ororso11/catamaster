"""
PDF에서 이미지와 텍스트 추출 (무료 OCR)
PyMuPDF 사용 - Poppler 불필요!
"""

import io
import base64
from PIL import Image
import pytesseract
import fitz  # PyMuPDF

class ImageExtractor:
    def __init__(self):
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
            # PyMuPDF로 PDF 열기
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            for page_num in range(len(pdf_document)):
                print(f"Processing page {page_num + 1}...")
                
                page = pdf_document[page_num]
                
                # 페이지를 고해상도 이미지로 렌더링
                zoom = 2.0  # 고해상도
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                
                # PIL Image로 변환
                img_data = pix.tobytes("png")
                image = Image.open(io.BytesIO(img_data))
                
                # 이미지를 base64로 인코딩
                img_base64 = self._image_to_base64(image)
                
                # OCR로 텍스트 추출
                text = self._extract_text_ocr(image)
                
                # 제품 정보 파싱
                products = self._parse_products(text)
                
                results.append({
                    'page': page_num + 1,
                    'image': img_base64,
                    'text': text,
                    'products': products
                })
                
                print(f"Page {page_num + 1}: {len(products)} products found")
            
            pdf_document.close()
            return results
            
        except Exception as e:
            print(f"Error extracting from PDF: {str(e)}")
            raise
    
    def _image_to_base64(self, image):
        """PIL Image를 base64 문자열로 변환"""
        buffered = io.BytesIO()
        
        # 이미지 최적화
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
        """
        try:
            # Tesseract OCR 실행
            text = pytesseract.image_to_string(
                image,
                lang='kor+eng',
                config='--psm 6 --oem 3'
            )
            
            return text.strip()
            
        except Exception as e:
            print(f"OCR Error: {str(e)}")
            return ""
    
    def _parse_products(self, text):
        """OCR 텍스트에서 제품 정보 추출"""
        products = []
        if not text:
            return products
        
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        current_product = None
        
        for line in lines:
            # 제품명 패턴 감지
            if any(keyword in line.upper() for keyword in ['COB', 'SMD', 'MR', 'LED', '다운라이트', '반사판', '포인트']):
                if current_product:
                    products.append(current_product)
                
                current_product = {
                    'name': line,
                    'details': [],
                    'specs': []
                }
            
            elif current_product:
                # 사이즈 정보
                if any(char in line for char in ['"', 'Ø', '㎜', 'mm', 'W', 'K']):
                    current_product['specs'].append(line)
                else:
                    current_product['details'].append(line)
        
        if current_product:
            products.append(current_product)
        
        return products


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
        
        for i, product in enumerate(page_data['products'], 1):
            print(f"  제품 {i}: {product['name']}")
            if product['specs']:
                print(f"    스펙: {', '.join(product['specs'])}")


if __name__ == '__main__':
    test_extractor()