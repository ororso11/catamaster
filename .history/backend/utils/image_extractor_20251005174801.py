"""
PyMuPDF 임베디드 이미지 직접 추출
가장 안정적이고 빠른 방법
"""

import io
import base64
from PIL import Image
import fitz

class ImageExtractor:
    def __init__(self):
        self.min_image_size = 100  # 최소 이미지 크기
        self.max_image_size = 2000  # 최대 이미지 크기 (배경 제외)
    
    def extract_from_pdf(self, pdf_bytes):
        results = []
        
        try:
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            for page_num in range(len(pdf_document)):
                print(f"Processing page {page_num + 1}...")
                
                page = pdf_document[page_num]
                
                # 임베디드 이미지 추출
                image_list = page.get_images(full=True)
                print(f"  Found {len(image_list)} embedded images")
                
                products = []
                
                for img_index, img in enumerate(image_list):
                    try:
                        xref = img[0]
                        base_image = pdf_document.extract_image(xref)
                        image_bytes = base_image["image"]
                        
                        # PIL로 이미지 열기
                        pil_image = Image.open(io.BytesIO(image_bytes))
                        
                        # 크기 필터링
                        if not self._is_product_image(pil_image):
                            continue
                        
                        # Base64 인코딩
                        img_base64 = self._image_to_base64(pil_image)
                        
                        product = {
                            'name': f'제품 {len(products) + 1}',
                            'details': [],
                            'specs': [],
                            'image': img_base64
                        }
                        
                        products.append(product)
                        
                    except Exception as e:
                        print(f"  Image {img_index} failed: {e}")
                        continue
                
                print(f"  Extracted {len(products)} product images")
                
                # 페이지 전체 이미지 생성
                zoom = 1.5
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                page_img_data = pix.tobytes("png")
                page_pil = Image.open(io.BytesIO(page_img_data))
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
            print(f"Error: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
    
    def _is_product_image(self, image):
        """
        제품 이미지인지 판단 (크기 기반)
        """
        width, height = image.size
        
        # 너무 작은 이미지 제외 (아이콘, 로고)
        if width < self.min_image_size or height < self.min_image_size:
            return False
        
        # 너무 큰 이미지 제외 (배경, 전체 페이지)
        if width > self.max_image_size or height > self.max_image_size:
            return False
        
        # 가로세로 비율 체크
        aspect_ratio = width / height
        if aspect_ratio < 0.3 or aspect_ratio > 3.0:
            return False
        
        # 이미지 복잡도 체크 (단색 배경 제외)
        img_array = list(image.convert('L').getdata())
        unique_colors = len(set(img_array))
        
        # 색상이 너무 적으면 단색 배경
        if unique_colors < 10:
            return False
        
        return True
    
    def _image_to_base64(self, image):
        """PIL Image를 base64로 변환"""
        buffered = io.BytesIO()
        
        image = image.convert('RGB')
        
        # 리사이즈
        max_width = 300
        if image.width > max_width:
            ratio = max_width / image.width
            new_height = int(image.height * ratio)
            image = image.resize((max_width, new_height), Image.LANCZOS)
        
        image.save(buffered, format="JPEG", quality=85, optimize=True)
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return f"data:image/jpeg;base64,{img_str}"