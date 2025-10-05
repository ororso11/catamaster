"""
개선된 PDF 제품 추출기:
1. 이미지 위치 기반으로 텍스트 매칭
2. Vision API 호출 최소화
3. 텍스트 매핑 시각화 및 디버깅
"""

import io
import base64
from PIL import Image, ImageDraw, ImageFont
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
            print("✗ Google Vision API 비활성화")
    
    def extract_from_pdf(self, pdf_bytes):
        results = []
        
        try:
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
            total_pages = len(pdf_document)
            print(f"\n{'='*80}")
            print(f"📄 총 {total_pages}개 페이지 처리 시작")
            print(f"{'='*80}\n")
            
            # Vision API 호출 (전체 한 번에)
            all_pages_text_data = None
            if self.use_vision:
                print("🔍 Google Vision OCR 실행 중...\n")
                all_pages_text_data = self._extract_all_text_once(pdf_document)
                print("✓ OCR 완료\n")
            
            for page_num in range(total_pages):
                print(f"\n{'='*80}")
                print(f"📖 페이지 {page_num + 1}/{total_pages}")
                print(f"{'='*80}\n")
                
                page = pdf_document[page_num]
                
                # 페이지를 이미지로 렌더링
                zoom = 2.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                page_img_bytes = pix.tobytes("png")
                page_width = pix.width
                page_height = pix.height
                
                # 텍스트 데이터
                text_blocks = []
                if all_pages_text_data and page_num in all_pages_text_data:
                    text_blocks = all_pages_text_data[page_num]
                    print(f"📝 추출된 텍스트 블록: {len(text_blocks)}개\n")
                
                # 텍스트 시각화 이미지 생성
                debug_image = self._create_text_visualization(page_img_bytes, text_blocks)
                
                # 제품 추출
                products = self._extract_with_position_matching(
                    page, pdf_document, text_blocks, page_width, page_height
                )
                
                print(f"\n✅ {len(products)}개 제품 추출 완료")
                print(f"{'-'*80}")
                for i, p in enumerate(products, 1):
                    print(f"\n제품 {i}:")
                    print(f"  이름: {p['name']}")
                    if p['specs']:
                        print(f"  스펙: {', '.join(p['specs'][:3])}")
                    if p['details']:
                        print(f"  상세: {', '.join(p['details'][:2])}")
                print(f"{'-'*80}\n")
                
                # 페이지 미리보기
                page_pil = Image.open(io.BytesIO(page_img_bytes))
                page_image = self._image_to_base64(page_pil)
                
                results.append({
                    'page': page_num + 1,
                    'type': 'list',
                    'image': page_image,
                    'debug_image': debug_image,  # 텍스트 시각화 이미지
                    'products': products,
                    'text_blocks_count': len(text_blocks)
                })
            
            pdf_document.close()
            print(f"\n{'='*80}")
            print(f"✅ 전체 처리 완료!")
            print(f"{'='*80}\n")
            return results
            
        except Exception as e:
            print(f"\n❌ 오류 발생: {str(e)}\n")
            import traceback
            traceback.print_exc()
            raise
    
    def _create_text_visualization(self, page_img_bytes, text_blocks):
        """텍스트 위치를 시각화한 이미지 생성"""
        try:
            img = Image.open(io.BytesIO(page_img_bytes)).convert('RGB')
            draw = ImageDraw.Draw(img)
            
            # 텍스트 박스 그리기
            for i, block in enumerate(text_blocks):
                x, y, w, h = block['x'], block['y'], block['w'], block['h']
                
                # 박스 그리기
                draw.rectangle([x, y, x+w, y+h], outline='red', width=2)
                
                # 텍스트 표시 (작은 폰트)
                try:
                    text = block['text'][:20]  # 20자까지만
                    draw.text((x, y-15), text, fill='blue')
                except:
                    pass
            
            return self._image_to_base64(img)
        except:
            return None
    
    def _extract_all_text_once(self, pdf_document):
        """전체 PDF의 텍스트를 한 번에 추출"""
        try:
            from google.cloud import vision
            
            all_text_data = {}
            
            for page_num in range(len(pdf_document)):
                page = pdf_document[page_num]
                
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
                
                # 전체 텍스트 출력 (디버깅)
                print(f"페이지 {page_num + 1} OCR 결과:")
                print(f"{'-'*60}")
                print(texts[0].description[:500])  # 처음 500자만
                print(f"{'-'*60}\n")
                
                # 텍스트 블록 저장
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
            print(f"❌ Vision OCR 오류: {e}\n")
            return {}
    
    def _extract_with_position_matching(self, page, pdf_document, text_blocks, page_width, page_height):
        """이미지 위치 기반으로 텍스트 매칭"""
        image_list = page.get_images(full=True)
        
        print(f"🖼️  PDF 임베디드 이미지: {len(image_list)}개 발견")
        
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
                
                print(f"  이미지 {img_index + 1}: 위치=({int(img_x)}, {int(img_y)}), 크기={int(img_w)}x{int(img_h)}")
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
                    print(f"  이미지 {img_pos['index'] + 1}: 중복 제외")
                    continue
                seen_hashes.add(img_hash)
                
                pil_image = Image.open(io.BytesIO(image_bytes))
                width, height = pil_image.size
                area = width * height
                
                # 필터링
                if not (300 <= width <= 1000 and 300 <= height <= 1000):
                    print(f"  이미지 {img_pos['index'] + 1}: 크기 부적합 ({width}x{height})")
                    continue
                if area < 90000:
                    print(f"  이미지 {img_pos['index'] + 1}: 면적 부적합 ({area})")
                    continue
                
                aspect = width / height
                if not (0.7 <= aspect <= 1.5):
                    print(f"  이미지 {img_pos['index'] + 1}: 비율 부적합 ({aspect:.2f})")
                    continue
                
                # Base64 인코딩
                img_base64 = self._image_to_base64(pil_image)
                
                # 텍스트 찾기
                product_info = self._find_text_below_image(img_pos, text_blocks)
                
                print(f"\n  ✓ 이미지 {img_pos['index'] + 1} → 제품 추출:")
                print(f"    제품명: {product_info['name']}")
                print(f"    발견된 텍스트: {len(product_info['all_nearby'])}개")
                
                product = {
                    'name': product_info['name'],
                    'specs': product_info['specs'],
                    'details': product_info['details'],
                    'image': img_base64
                }
                
                products.append(product)
                
            except Exception as e:
                print(f"  이미지 {img_pos.get('index', '?') + 1} 처리 오류: {e}")
                continue
        
        return products
    
    def _find_text_below_image(self, img_pos, text_blocks):
        """이미지 바로 아래의 텍스트 찾기"""
        if not text_blocks:
            return {
                'name': f'제품 {img_pos["index"] + 1}',
                'specs': [],
                'details': [],
                'all_nearby': []
            }
        
        img_bottom = img_pos['y'] + img_pos['h']
        img_center_x = img_pos['center_x']
        img_width = img_pos['w']
        
        # 이미지 바로 아래 텍스트 찾기
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
                'details': [],
                'all_nearby': []
            }
        
        # Y좌표로 정렬
        nearby_texts.sort(key=lambda t: (t['y'], t['x']))
        
        # 라인별 그룹화
        lines = []
        current_line = []
        last_y = -1
        y_threshold = 30
        
        for item in nearby_texts:
            if last_y < 0 or abs(item['y'] - last_y) < y_threshold:
                current_line.append(item)
            else:
                if current_line:
                    # X좌표 정렬
                    current_line.sort(key=lambda t: t['x'])
                    line_text = ' '.join([t['text'] for t in current_line])
                    lines.append(line_text)
                current_line = [item]
            last_y = item['y']
        
        if current_line:
            current_line.sort(key=lambda t: t['x'])
            line_text = ' '.join([t['text'] for t in current_line])
            lines.append(line_text)
        
        # 제품명 = 첫 번째 라인
        product_name = lines[0] if lines else f'제품 {img_pos["index"] + 1}'
        
        # 스펙 / 상세 분리
        specs = []
        details = []
        
        for line in lines[1:]:
            clean_line = self._clean_text(line)
            if re.search(r'\d+', clean_line) or any(unit in clean_line for unit in ['W', 'mm', 'V', '°', 'K', 'lm', 'COB', 'SMD']):
                specs.append(clean_line)
            else:
                details.append(clean_line)
        
        return {
            'name': self._clean_text(product_name),
            'specs': specs,
            'details': details,
            'all_nearby': [t['text'] for t in nearby_texts]
        }
    
    def _clean_text(self, text):
        """텍스트 정리"""
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
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