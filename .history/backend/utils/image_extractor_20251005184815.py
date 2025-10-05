"""
개선된 PDF 제품 추출기:
1. 이미지 위치 기반으로 텍스트 매칭
2. Vision API 호출 최소화
3. 제품 상세페이지 추출
4. 텍스트 가독성 개선
"""

import io
import base64
from PIL import Image
import fitz
import os
import re

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
                print("✓ Google Vision API 활성화")
        except:
            print("✗ Google Vision API 비활성화 - 기본 추출만 가능")
    
    def extract_from_pdf(self, pdf_bytes):
        results = []
        
        try:
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
            total_pages = len(pdf_document)
            print(f"\n📄 총 {total_pages}개 페이지 처리 시작\n")
            
            # 전체 페이지의 텍스트를 한 번에 추출 (Vision API 1회 호출)
            all_pages_text_data = None
            if self.use_vision:
                print("🔍 Vision OCR 실행 중...")
                all_pages_text_data = self._extract_all_text_once(pdf_document)
                print("✓ OCR 완료\n")
            
            for page_num in range(total_pages):
                print(f"{'='*60}")
                print(f"📖 페이지 {page_num + 1}/{total_pages} 처리 중...")
                print(f"{'='*60}")
                
                page = pdf_document[page_num]
                
                # 페이지를 고해상도 이미지로 렌더링
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
                
                # 페이지 타입 감지 (목록 페이지 vs 상세 페이지)
                is_detail_page = self._is_detail_page(text_blocks, page)
                
                if is_detail_page:
                    # 상세 페이지 처리
                    detail_info = self._extract_detail_page(
                        page, pdf_document, text_blocks, page_width, page_height, page_img_bytes
                    )
                    print(f"📋 상세페이지: {detail_info['product_name']}")
                    results.append({
                        'page': page_num + 1,
                        'type': 'detail',
                        **detail_info
                    })
                else:
                    # 목록 페이지 처리
                    products = self._extract_with_position_matching(
                        page, pdf_document, text_blocks, page_width, page_height
                    )
                    
                    print(f"✓ {len(products)}개 제품 추출 완료")
                    for i, p in enumerate(products, 1):
                        print(f"  {i}. {p['name']}")
                    
                    # 페이지 미리보기 이미지
                    page_pil = Image.open(io.BytesIO(page_img_bytes))
                    page_image = self._image_to_base64(page_pil)
                    
                    results.append({
                        'page': page_num + 1,
                        'type': 'list',
                        'image': page_image,
                        'products': products
                    })
                
                print()
            
            pdf_document.close()
            print(f"✅ 전체 처리 완료!\n")
            return results
            
        except Exception as e:
            print(f"❌ 오류 발생: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
    
    def _is_detail_page(self, text_blocks, page):
        """페이지가 상세페이지인지 판단"""
        # 임베디드 이미지가 적으면 상세페이지일 가능성 높음
        image_count = len(page.get_images(full=True))
        
        # 텍스트에서 상세 정보 키워드 찾기
        all_text = ' '.join([b['text'] for b in text_blocks])
        detail_keywords = ['사양', '규격', '특징', 'Features', 'Specifications', '치수', '배광']
        
        has_detail_keywords = any(keyword in all_text for keyword in detail_keywords)
        
        # 이미지가 1-3개이고 상세 키워드가 있으면 상세페이지
        return image_count <= 3 and has_detail_keywords
    
    def _extract_detail_page(self, page, pdf_document, text_blocks, page_width, page_height, page_img_bytes):
        """상세 페이지 정보 추출"""
        # 제품 이미지 추출
        product_images = []
        image_list = page.get_images(full=True)
        seen_hashes = set()
        
        for img in image_list:
            try:
                xref = img[0]
                base_image = pdf_document.extract_image(xref)
                image_bytes = base_image["image"]
                
                import hashlib
                img_hash = hashlib.md5(image_bytes).hexdigest()
                if img_hash in seen_hashes:
                    continue
                seen_hashes.add(img_hash)
                
                pil_image = Image.open(io.BytesIO(image_bytes))
                width, height = pil_image.size
                
                # 제품 이미지 필터링 (로고나 아이콘 제외)
                if width < 100 or height < 100:
                    continue
                
                img_base64 = self._image_to_base64(pil_image)
                product_images.append(img_base64)
            except:
                continue
        
        # 텍스트 구조화
        structured_text = self._structure_detail_text(text_blocks)
        
        # 제품명 추출 (페이지 상단의 큰 텍스트)
        product_name = self._extract_product_name(text_blocks)
        
        # 페이지 전체 이미지
        page_pil = Image.open(io.BytesIO(page_img_bytes))
        page_image = self._image_to_base64(page_pil)
        
        return {
            'product_name': product_name,
            'page_image': page_image,
            'product_images': product_images,
            'structured_text': structured_text,
            'raw_text': ' '.join([b['text'] for b in text_blocks])
        }
    
    def _extract_product_name(self, text_blocks):
        """상세페이지에서 제품명 추출 (상단의 큰 텍스트)"""
        if not text_blocks:
            return "제품 상세"
        
        # Y좌표로 정렬하여 상단 텍스트 찾기
        sorted_blocks = sorted(text_blocks, key=lambda b: b['y'])
        
        # 상위 20% 영역에서 제품명 찾기
        top_blocks = [b for b in sorted_blocks[:max(1, len(sorted_blocks)//5)]]
        
        # LED, COB, SMD 등이 포함된 텍스트 찾기
        product_keywords = ['LED', 'COB', 'SMD', 'MR', '매입', '등']
        for block in top_blocks:
            if any(kw in block['text'] for kw in product_keywords):
                return block['text']
        
        # 없으면 첫 번째 텍스트 사용
        return top_blocks[0]['text'] if top_blocks else "제품 상세"
    
    def _structure_detail_text(self, text_blocks):
        """상세페이지 텍스트를 구조화"""
        if not text_blocks:
            return {}
        
        # Y좌표로 정렬
        sorted_blocks = sorted(text_blocks, key=lambda b: b['y'])
        
        structured = {
            'specifications': [],  # 사양
            'features': [],        # 특징
            'dimensions': [],      # 치수
            'other': []           # 기타
        }
        
        current_section = 'other'
        
        for block in sorted_blocks:
            text = block['text'].strip()
            if not text:
                continue
            
            # 섹션 감지
            text_upper = text.upper()
            if any(kw in text_upper for kw in ['사양', 'SPEC', '규격']):
                current_section = 'specifications'
                continue
            elif any(kw in text_upper for kw in ['특징', 'FEATURE']):
                current_section = 'features'
                continue
            elif any(kw in text_upper for kw in ['치수', 'DIMENSION', '크기']):
                current_section = 'dimensions'
                continue
            
            structured[current_section].append(text)
        
        return structured
    
    def _extract_all_text_once(self, pdf_document):
        """전체 PDF의 텍스트를 한 번에 추출"""
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
                for text in texts[1:]:
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
            
            return all_text_data
            
        except Exception as e:
            print(f"  ❌ Vision OCR 오류: {e}")
            return {}
    
    def _extract_with_position_matching(self, page, pdf_document, text_blocks, page_width, page_height):
        """이미지 위치 기반으로 텍스트 매칭"""
        image_list = page.get_images(full=True)
        
        # 이미지 위치 정보 추출
        image_positions = []
        for img_index, img in enumerate(image_list):
            try:
                xref = img[0]
                rects = page.get_image_rects(xref)
                if not rects:
                    continue
                
                rect = rects[0]
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
                product_info = self._find_text_below_image(img_pos, text_blocks)
                
                product = {
                    'name': product_info['name'],
                    'specs': product_info['specs'],
                    'details': product_info['details'],
                    'image': img_base64
                }
                
                products.append(product)
                
            except Exception as e:
                continue
        
        return products
    
    def _find_text_below_image(self, img_pos, text_blocks):
        """이미지 바로 아래의 텍스트 찾기 및 구조화"""
        if not text_blocks:
            return {
                'name': f'제품 {img_pos["index"] + 1}',
                'specs': [],
                'details': []
            }
        
        img_bottom = img_pos['y'] + img_pos['h']
        img_center_x = img_pos['center_x']
        img_width = img_pos['w']
        
        # 이미지 바로 아래에 있는 텍스트 찾기
        nearby_texts = []
        
        for block in text_blocks:
            vertical_distance = block['y'] - img_bottom
            if not (0 <= vertical_distance <= 300):
                continue
            
            horizontal_distance = abs(block['center_x'] - img_center_x)
            if horizontal_distance > img_width * 0.8:
                continue
            
            nearby_texts.append({
                'text': block['text'],
                'distance': vertical_distance,
                'x': block['x'],
                'y': block['y']
            })
        
        if not nearby_texts:
            return {
                'name': f'제품 {img_pos["index"] + 1}',
                'specs': [],
                'details': []
            }
        
        # Y좌표로 정렬
        nearby_texts.sort(key=lambda t: t['y'])
        
        # 텍스트 라인별로 그룹화
        lines = []
        current_line = []
        last_y = -1
        y_threshold = 30
        
        for item in nearby_texts:
            if last_y < 0 or abs(item['y'] - last_y) < y_threshold:
                current_line.append(item)
                last_y = item['y']
            else:
                if current_line:
                    line_text = ' '.join(sorted([t['text'] for t in current_line], 
                                               key=lambda t: current_line[[x['text'] for x in current_line].index(t)]['x']))
                    lines.append(line_text)
                current_line = [item]
                last_y = item['y']
        
        if current_line:
            line_text = ' '.join(sorted([t['text'] for t in current_line], 
                                       key=lambda t: current_line[[x['text'] for x in current_line].index(t)]['x']))
            lines.append(line_text)
        
        # 제품명과 스펙 분리
        product_name = lines[0] if lines else f'제품 {img_pos["index"] + 1}'
        
        # 나머지는 스펙/상세정보
        specs = []
        details = []
        
        for line in lines[1:]:
            # 숫자나 단위가 포함되면 스펙, 아니면 상세정보
            if re.search(r'\d+', line) or any(unit in line for unit in ['W', 'mm', 'V', '°', 'K', 'lm']):
                specs.append(line)
            else:
                details.append(line)
        
        return {
            'name': self._clean_text(product_name),
            'specs': [self._clean_text(s) for s in specs],
            'details': [self._clean_text(d) for d in details]
        }
    
    def _clean_text(self, text):
        """텍스트 정리 및 가독성 개선"""
        # 여러 공백을 하나로
        text = re.sub(r'\s+', ' ', text)
        # 앞뒤 공백 제거
        text = text.strip()
        # 특수문자 정리
        text = text.replace('_', ' ')
        return text
    
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