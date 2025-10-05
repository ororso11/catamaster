"""
개선된 PDF 제품 추출기:
1. 이미지 위치 기반으로 텍스트 매칭
2. Vision API 호출 최소화 (전체 PDF를 한 번만 호출)
"""

import io
import base64
from PIL import Image
import fitz
import os

class ImageExtractor:
    def __init__(self):
        self.use_vision = False
        self.vision_cache = {}  # API 호출 결과 캐싱
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
            
            # 전체 페이지를 하나의 이미지로 합치기 (Vision API 1회 호출)
            all_pages_text_data = None
            if self.use_vision:
                all_pages_text_data = self._extract_all_text_once(pdf_document)
            
            for page_num in range(len(pdf_document)):
                print(f"Processing page {page_num + 1}...")
                
                page = pdf_document[page_num]
                
                # 페이지 전체를 이미지로 렌더링
                zoom = 2.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                page_img_bytes = pix.tobytes("png")
                page_width = pix.width
                page_height = pix.height
                
                # 캐시된 텍스트 데이터 사용
                text_blocks = []
                if all_pages_text_data and page_num in all_pages_text_data:
                    text_blocks = all_pages_text_data[page_num]
                
                # 임베디드 이미지 추출 및 위치 정보 가져오기
                products = self._extract_with_position_matching(
                    page, pdf_document, text_blocks, page_width, page_height
                )
                
                print(f"  {len(products)}개 제품 추출")
                
                # 페이지 미리보기 이미지
                page_pil = Image.open(io.BytesIO(page_img_bytes))
                page_image = self._image_to_base64(page_pil)
                
                # 전체 텍스트 (디버깅용)
                all_text = " ".join([b['text'] for b in text_blocks])
                
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
    
    def _extract_all_text_once(self, pdf_document):
        """전체 PDF의 텍스트를 한 번에 추출 (Vision API 1회 호출)"""
        try:
            from google.cloud import vision
            
            all_text_data = {}
            
            for page_num in range(len(pdf_document)):
                page = pdf_document[page_num]
                
                # 페이지를 이미지로 변환
                zoom = 2.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                
                # Vision API 호출
                vision_image = vision.Image(content=img_bytes)
                response = self.vision_client.text_detection(image=vision_image)
                
                texts = response.text_annotations
                if not texts:
                    all_text_data[page_num] = []
                    continue
                
                # 텍스트 블록을 위치별로 저장
                text_blocks = []
                for text in texts[1:]:  # 첫 번째는 전체 텍스트이므로 건너뛰기
                    vertices = text.bounding_poly.vertices
                    x = min(v.x for v in vertices)
                    y = min(v.y for v in vertices)
                    w = max(v.x for v in vertices) - x
                    h = max(v.y for v in vertices) - y
                    
                    text_blocks.append({
                        'text': text.description,
                        'x': x,
                        'y': y,
                        'w': w,
                        'h': h,
                        'center_x': x + w/2,
                        'center_y': y + h/2
                    })
                
                all_text_data[page_num] = text_blocks
                print(f"  페이지 {page_num + 1}: {len(text_blocks)}개 텍스트 블록")
            
            return all_text_data
            
        except Exception as e:
            print(f"  Vision OCR 오류: {e}")
            import traceback
            traceback.print_exc()
            return {}
    
    def _extract_with_position_matching(self, page, pdf_document, text_blocks, page_width, page_height):
        """이미지 위치 기반으로 텍스트 매칭"""
        image_list = page.get_images(full=True)
        
        print(f"  임베디드 이미지: {len(image_list)}개 발견")
        
        # 이미지 위치 정보 추출
        image_positions = []
        for img_index, img in enumerate(image_list):
            try:
                xref = img[0]
                
                # 이미지의 위치 찾기
                rects = page.get_image_rects(xref)
                if not rects:
                    continue
                
                rect = rects[0]  # 첫 번째 위치 사용
                
                # PDF 좌표를 픽셀 좌표로 변환
                zoom = 2.0
                img_x = rect.x0 * zoom
                img_y = rect.y0 * zoom
                img_w = (rect.x1 - rect.x0) * zoom
                img_h = (rect.y1 - rect.y0) * zoom
                
                image_positions.append({
                    'xref': xref,
                    'index': img_index,
                    'x': img_x,
                    'y': img_y,
                    'w': img_w,
                    'h': img_h,
                    'center_x': img_x + img_w/2,
                    'center_y': img_y + img_h/2
                })
            except:
                continue
        
        # 제품 추출
        products = []
        seen_hashes = set()
        
        for img_pos in image_positions:
            try:
                xref = img_pos['xref']
                base_image = pdf_document.extract_image(xref)
                image_bytes = base_image["image"]
                
                # 중복 체크
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
                
                # 이미지 바로 아래의 텍스트 찾기
                product_name = self._find_text_below_image(img_pos, text_blocks)
                
                if not product_name:
                    product_name = f'제품 {len(products) + 1}'
                
                product = {
                    'name': product_name[:200],
                    'details': [],
                    'specs': [],
                    'image': img_base64
                }
                
                products.append(product)
                
            except Exception as e:
                print(f"    이미지 처리 오류: {e}")
                continue
        
        return products
    
    def _find_text_below_image(self, img_pos, text_blocks):
        """이미지 바로 아래의 텍스트 찾기"""
        if not text_blocks:
            return None
        
        img_bottom = img_pos['y'] + img_pos['h']
        img_center_x = img_pos['center_x']
        img_width = img_pos['w']
        
        # 이미지 바로 아래에 있는 텍스트 찾기
        nearby_texts = []
        
        for block in text_blocks:
            # 세로 방향: 이미지 아래 200px 이내
            vertical_distance = block['y'] - img_bottom
            if not (0 <= vertical_distance <= 200):
                continue
            
            # 가로 방향: 이미지 중심에서 이미지 너비만큼 이내
            horizontal_distance = abs(block['center_x'] - img_center_x)
            if horizontal_distance > img_width * 0.8:
                continue
            
            nearby_texts.append({
                'text': block['text'],
                'distance': vertical_distance,
                'x': block['x']
            })
        
        if not nearby_texts:
            return None
        
        # 가장 가까운 텍스트부터 정렬
        nearby_texts.sort(key=lambda t: (t['distance'], t['x']))
        
        # 근처 텍스트들을 합치기 (같은 Y 레벨)
        result_parts = []
        last_distance = -1
        distance_threshold = 30
        
        for item in nearby_texts:
            if last_distance < 0 or abs(item['distance'] - last_distance) < distance_threshold:
                result_parts.append(item['text'])
                last_distance = item['distance']
            else:
                break  # 다음 행으로 넘어가면 중단
        
        return ' '.join(result_parts) if result_parts else None
    
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