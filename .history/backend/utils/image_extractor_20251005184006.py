"""
단순하고 확실한 방법:
1. PDF 임베디드 이미지 추출 (제품 사진)
2. Vision OCR로 텍스트 추출 (제품명, 사양)
"""

import io
import base64
from PIL import Image
import fitz
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
        except:
            pass
    
    def extract_from_pdf(self, pdf_bytes):
        results = []
        
        try:
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            for page_num in range(len(pdf_document)):
                print(f"Processing page {page_num + 1}...")
                
                page = pdf_document[page_num]
                
                # 페이지 전체를 이미지로 렌더링 (OCR용)
                zoom = 2.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                page_img_bytes = pix.tobytes("png")
                
                # Vision OCR로 전체 텍스트 추출
                all_text = ""
                product_texts = []
                
                if self.use_vision:
                    all_text, product_texts = self._extract_text_with_vision(page_img_bytes)
                    print(f"  Vision OCR 완료: {len(product_texts)}개 제품명 감지")
                
                # 임베디드 이미지 추출
                products = self._extract_embedded_images(page, pdf_document, product_texts)
                
                print(f"  {len(products)}개 제품 추출")
                
                # 페이지 미리보기 이미지
                page_pil = Image.open(io.BytesIO(page_img_bytes))
                page_image = self._image_to_base64(page_pil)
                
                results.append({
                    'page': page_num + 1,
                    'image': page_image,
                    'text': all_text,
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
        """Vision API로 텍스트 추출 - 제품별로 그룹화"""
        try:
            from google.cloud import vision
            
            vision_image = vision.Image(content=img_bytes)
            response = self.vision_client.text_detection(image=vision_image)
            
            texts = response.text_annotations
            if not texts:
                return "", []
            
            # 전체 텍스트
            full_text = texts[0].description
            
            # 제품별 텍스트 그룹화
            # 제품명(COB 등)을 기준으로 그룹 나누기
            product_groups = []
            current_group = []
            
            for text in texts[1:]:
                desc = text.description.strip()
                
                # 새로운 제품 시작 (COB, SMD 등)
                if any(k in desc.upper() for k in ['COB', 'SMD', 'LED', 'MR']) and len(desc) > 3:
                    if current_group:
                        # 이전 그룹 저장
                        product_groups.append(' '.join(current_group))
                        current_group = []
                    current_group.append(desc)
                elif current_group:
                    # 현재 그룹에 추가 (사양 정보)
                    if any(c in desc for c in ['Ø', 'W', 'K', 'V', 'H', 'IP', '높이', '직경']):
                        current_group.append(desc)
            
            # 마지막 그룹
            if current_group:
                product_groups.append(' '.join(current_group))
            
            print(f"  제품 그룹: {len(product_groups)}개")
            for i, g in enumerate(product_groups[:5]):
                print(f"    {i+1}: {g[:80]}")
            
            return full_text, product_groups
            
        except Exception as e:
            print(f"  Vision OCR 오류: {e}")
            return "", []
    
    def _extract_embedded_images(self, page, pdf_document, product_texts):
        """PDF에서 임베디드 이미지 추출 (중복 제거)"""
        image_list = page.get_images(full=True)
        
        print(f"  임베디드 이미지: {len(image_list)}개 발견")
        
        products = []
        seen_hashes = set()  # 중복 체크
        
        for img_index, img in enumerate(image_list):
            try:
                xref = img[0]
                base_image = pdf_document.extract_image(xref)
                image_bytes = base_image["image"]
                
                # 중복 체크 (해시)
                import hashlib
                img_hash = hashlib.md5(image_bytes).hexdigest()
                if img_hash in seen_hashes:
                    continue
                seen_hashes.add(img_hash)
                
                pil_image = Image.open(io.BytesIO(image_bytes))
                width, height = pil_image.size
                area = width * height
                
                # 제품 이미지 필터링
                if not (300 <= width <= 1000 and 300 <= height <= 1000):
                    continue
                
                if area < 90000:
                    continue
                
                aspect = width / height
                if not (0.7 <= aspect <= 1.5):
                    continue
                
                gray_array = list(pil_image.convert('L').getdata())
                unique_colors = len(set(gray_array))
                if unique_colors < 50:
                    continue
                
                # Base64 인코딩
                img_base64 = self._image_to_base64(pil_image)
                
                # 제품명 매칭 (순서대로)
                product_name = f'제품 {len(products) + 1}'
                if len(products) < len(product_texts):
                    product_name = product_texts[len(products)]
                
                product = {
                    'name': product_name[:100],
                    'details': [],
                    'specs': [],
                    'image': img_base64
                }
                
                products.append(product)
                
            except Exception as e:
                continue
        
        return products
    
    def _image_to_base64(self, image):
        """PIL Image를 base64로 변환"""
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