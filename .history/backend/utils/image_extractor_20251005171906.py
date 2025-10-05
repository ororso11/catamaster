"""
하이브리드 방식: 임베디드 이미지 추출 + 제품명만 OCR
- 빠른 속도 (페이지당 1-2초)
- Railway 배포 가능
"""

import io
import base64
from PIL import Image
import pytesseract
import fitz  # PyMuPDF
import re

class ImageExtractor:
    def __init__(self):
        # Tesseract 경로 (Windows 로컬 개발용)
        # Railway에서는 자동으로 PATH에 설정됨
        try:
            pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        except:
            pass
    
    def extract_from_pdf(self, pdf_bytes):
        """
        PDF에서 임베디드 이미지와 제품명 추출
        
        Returns:
            list: 각 페이지의 제품 정보
        """
        results = []
        
        try:
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            for page_num in range(len(pdf_document)):
                print(f"Processing page {page_num + 1}...")
                
                page = pdf_document[page_num]
                
                # 1. 임베디드 이미지 추출 (빠름)
                product_images = self._extract_embedded_images(page, pdf_document)
                print(f"  Found {len(product_images)} embedded images")
                
                # 2. 텍스트 블록 추출 (PyMuPDF 내장, OCR 아님)
                text_dict = page.get_text("dict")
                text_blocks = self._extract_text_blocks(text_dict)
                print(f"  Found {len(text_blocks)} text blocks")
                
                # 3. 이미지와 텍스트 매칭
                products = self._match_images_with_text(product_images, text_blocks)
                
                # 4. 페이지 전체 이미지도 생성 (미리보기용)
                page_image = self._render_page_image(page)
                
                results.append({
                    'page': page_num + 1,
                    'image': page_image,
                    'text': '\n'.join([b['text'] for b in text_blocks]),
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
    
    def _extract_embedded_images(self, page, pdf_document):
        """PDF에서 임베디드 이미지 객체 추출"""
        images = []
        image_list = page.get_images(full=True)
        
        for img_index, img in enumerate(image_list):
            try:
                xref = img[0]
                base_image = pdf_document.extract_image(xref)
                image_bytes = base_image["image"]
                
                # PIL로 이미지 열기
                pil_image = Image.open(io.BytesIO(image_bytes))
                
                # 너무 작은 이미지 제외 (아이콘, 로고 등)
                if pil_image.width < 80 or pil_image.height < 80:
                    continue
                
                # 너무 큰 배경 이미지 제외
                if pil_image.width > 2000 or pil_image.height > 2000:
                    continue
                
                # Base64 인코딩
                img_base64 = self._image_to_base64(pil_image)
                
                images.append({
                    'image': img_base64,
                    'width': pil_image.width,
                    'height': pil_image.height,
                    'bbox': img[1:5] if len(img) > 4 else None  # 이미지 위치
                })
                
            except Exception as e:
                print(f"  Image {img_index} extraction failed: {e}")
                continue
        
        return images
    
    def _extract_text_blocks(self, text_dict):
        """PyMuPDF로 텍스트 블록 추출 (OCR 아님, 내장 텍스트)"""
        text_blocks = []
        
        for block in text_dict.get("blocks", []):
            if block.get("type") == 0:  # 텍스트 블록
                block_text = ""
                bbox = block.get("bbox", [0, 0, 0, 0])
                
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text = span.get("text", "").strip()
                        if text:
                            block_text += text + " "
                
                block_text = block_text.strip()
                
                if block_text and len(block_text) > 2:
                    text_blocks.append({
                        'text': block_text,
                        'bbox': bbox,
                        'y': bbox[1]  # Y 좌표 (위치 매칭용)
                    })
        
        return text_blocks
    
    def _match_images_with_text(self, images, text_blocks):
        """이미지와 가까운 텍스트 블록을 매칭"""
        products = []
        
        # 텍스트 블록을 제품명으로 분류
        product_names = [b for b in text_blocks if self._is_product_name(b['text'])]
        other_texts = [b for b in text_blocks if not self._is_product_name(b['text'])]
        
        print(f"  Product names detected: {len(product_names)}")
        print(f"  Other text blocks: {len(other_texts)}")
        
        # 각 이미지마다 제품 정보 생성
        for idx, img_data in enumerate(images):
            product_name = f'제품 {idx + 1}'
            specs = []
            
            # 가장 가까운 제품명 찾기
            if product_names:
                closest_name = min(product_names, key=lambda x: abs(x['y'] - 100))
                product_name = closest_name['text']
                product_names.remove(closest_name)  # 한 번만 사용
            
            # 사양 정보 추출
            for text_block in other_texts[:3]:  # 상위 3개만
                text = text_block['text']
                # 사이즈, 와트, 색온도 등의 정보만
                if any(char in text for char in ['Ø', 'W', 'K', 'mm', '"', 'IP', 'V']):
                    specs.append(text)
            
            product = {
                'name': product_name[:100],
                'details': specs,
                'specs': specs,
                'image': img_data['image']
            }
            
            products.append(product)
        
        return products
    
    def _is_product_name(self, text):
        """제품명인지 판단"""
        # COB, SMD, LED 등의 키워드 포함 여부
        keywords = ['COB', 'SMD', 'MR', 'LED', '다운라이트', '반사판', '포인트', 
                   '매입', '노출', '스팟', '트랙', '라이트', 'DOWN', 'SPOT']
        
        text_upper = text.upper()
        return any(keyword in text_upper for keyword in keywords)
    
    def _render_page_image(self, page):
        """페이지 전체를 이미지로 렌더링 (미리보기용)"""
        zoom = 1.5
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        
        img_data = pix.tobytes("png")
        image = Image.open(io.BytesIO(img_data))
        
        return self._image_to_base64(image)
    
    def _image_to_base64(self, image):
        """PIL Image를 base64로 변환"""
        buffered = io.BytesIO()
        
        image = image.convert('RGB')
        
        # 최적화
        max_width = 800
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
        
        for i, product in enumerate(page_data['products'], 1):
            print(f"  제품 {i}: {product['name']}")
            if product['specs']:
                print(f"    스펙: {', '.join(product['specs'][:3])}")


if __name__ == '__main__':
    test_extractor()