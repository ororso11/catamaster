"""
개선된 PDF 제품 추출기:
1. 중복 제거 강화 (크기 기반)
2. 전방향 텍스트 탐색
3. 아이콘 제외 필터링
"""

import io
import base64
from PIL import Image, ImageDraw
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
            
            # Vision API 호출
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
                
                zoom = 2.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                page_img_bytes = pix.tobytes("png")
                page_width = pix.width
                page_height = pix.height
                
                text_blocks = []
                if all_pages_text_data and page_num in all_pages_text_data:
                    text_blocks = all_pages_text_data[page_num]
                    print(f"📝 추출된 텍스트 블록: {len(text_blocks)}개\n")
                
                debug_image = self._create_text_visualization(page_img_bytes, text_blocks)
                
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
                print(f"{'-'*80}\n")
                
                page_pil = Image.open(io.BytesIO(page_img_bytes))
                page_image = self._image_to_base64(page_pil)
                
                results.append({
                    'page': page_num + 1,
                    'type': 'list',
                    'image': page_image,
                    'debug_image': debug_image,
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
        try:
            img = Image.open(io.BytesIO(page_img_bytes)).convert('RGB')
            draw = ImageDraw.Draw(img)
            
            for block in text_blocks:
                x, y, w, h = block['x'], block['y'], block['w'], block['h']
                draw.rectangle([x, y, x+w, y+h], outline='red', width=2)
                try:
                    text = block['text'][:15]
                    draw.text((x, max(0, y-15)), text, fill='blue')
                except:
                    pass
            
            return self._image_to_base64(img)
        except:
            return None
    
    def _extract_all_text_once(self, pdf_document):
        try:
            from google.cloud import vision
            
            all_text_data = {}
            
            for page_num in range(len(pdf_document)):
                page = pdf_document[page_num]
                
                zoom = 2.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                
                vision_image = vision.Image(content=img_bytes)
                response = self.vision_client.text_detection(image=vision_image)
                
                texts = response.text_annotations
                if not texts:
                    all_text_data[page_num] = []
                    continue
                
                print(f"페이지 {page_num + 1} OCR 전체 텍스트:")
                print(f"{'-'*60}")
                print(texts[0].description[:400])
                print(f"{'-'*60}\n")
                
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
        image_list = page.get_images(full=True)
        
        print(f"🖼️  PDF 임베디드 이미지: {len(image_list)}개 발견")
        
        # 이미지 위치 및 크기 정보 수집
        image_data = []
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
                
                # 실제 이미지 크기도 확인
                base_image = pdf_document.extract_image(xref)
                image_bytes = base_image["image"]
                pil_image = Image.open(io.BytesIO(image_bytes))
                actual_width, actual_height = pil_image.size
                
                image_data.append({
                    'xref': xref,
                    'index': img_index,
                    'x': img_x,
                    'y': img_y,
                    'w': img_w,
                    'h': img_h,
                    'actual_width': actual_width,
                    'actual_height': actual_height,
                    'area': actual_width * actual_height,
                    'center_x': img_x + img_w/2,
                    'center_y': img_y + img_h/2,
                    'image_bytes': image_bytes,
                    'pil_image': pil_image
                })
                
            except:
                continue
        
        # 크기 기준으로 정렬 (큰 이미지부터)
        image_data.sort(key=lambda x: x['area'], reverse=True)
        
        # 중복 제거: 비슷한 위치의 작은 이미지 제외
        filtered_images = []
        for img in image_data:
            is_duplicate = False
            
            for existing in filtered_images:
                # 위치가 비슷하고 크기가 작으면 중복으로 간주
                x_diff = abs(img['center_x'] - existing['center_x'])
                y_diff = abs(img['center_y'] - existing['center_y'])
                
                if x_diff < 50 and y_diff < 50 and img['area'] < existing['area']:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                filtered_images.append(img)
        
        print(f"🔍 필터링 후: {len(filtered_images)}개 이미지")
        
        products = []
        seen_hashes = set()
        used_text_blocks = set()
        
        for img_data in filtered_images:
            try:
                width = img_data['actual_width']
                height = img_data['actual_height']
                area = img_data['area']
                pil_image = img_data['pil_image']
                image_bytes = img_data['image_bytes']
                
                # 중복 체크
                import hashlib
                img_hash = hashlib.md5(image_bytes).hexdigest()
                if img_hash in seen_hashes:
                    print(f"  이미지 {img_data['index'] + 1}: 중복 제외 (해시)")
                    continue
                seen_hashes.add(img_hash)
                
                # 크기 필터: 작은 아이콘 제외
                if width < 150 or height < 150:
                    print(f"  이미지 {img_data['index'] + 1}: 너무 작음 ({width}x{height})")
                    continue
                
                # 너무 큰 이미지 제외
                if width > 1500 or height > 1500:
                    print(f"  이미지 {img_data['index'] + 1}: 너무 큼 ({width}x{height})")
                    continue
                
                # 면적 필터
                if area < 40000:
                    print(f"  이미지 {img_data['index'] + 1}: 면적 부족 ({area})")
                    continue
                
                # 비율 필터
                aspect = width / height
                if not (0.5 <= aspect <= 2.0):
                    print(f"  이미지 {img_data['index'] + 1}: 비율 부적합 ({aspect:.2f})")
                    continue
                
                img_base64 = self._image_to_base64(pil_image)
                
                # 전방향 텍스트 찾기
                product_info = self._find_text_around_image(img_data, text_blocks, used_text_blocks)
                
                print(f"\n  ✓ 이미지 {img_data['index'] + 1} → 제품 추출:")
                print(f"    크기: {width}x{height} (면적: {area})")
                print(f"    제품명: {product_info['name']}")
                print(f"    텍스트 블록: {len(product_info['used_indices'])}개")
                
                products.append({
                    'name': product_info['name'],
                    'specs': product_info['specs'],
                    'details': product_info['details'],
                    'image': img_base64
                })
                
            except Exception as e:
                print(f"  이미지 처리 오류: {e}")
                continue
        
        return products
    
    def _find_text_around_image(self, img_data, text_blocks, used_text_blocks):
        """이미지 주변 전방향 텍스트 탐색"""
        if not text_blocks:
            return {
                'name': f'제품 {img_data["index"] + 1}',
                'specs': [],
                'details': [],
                'used_indices': []
            }
        
        img_x = img_data['x']
        img_y = img_data['y']
        img_w = img_data['w']
        img_h = img_data['h']
        img_bottom = img_y + img_h
        img_center_x = img_data['center_x']
        img_center_y = img_data['center_y']
        
        nearby_texts = []
        
        for idx, block in enumerate(text_blocks):
            if idx in used_text_blocks:
                continue
            
            # 텍스트 위치
            text_x = block['x']
            text_y = block['y']
            text_center_x = block['center_x']
            text_center_y = block['center_y']
            
            # 아래쪽 텍스트 (우선순위 높음)
            vertical_dist = text_y - img_bottom
            if 0 <= vertical_dist <= 200:
                horizontal_dist = abs(text_center_x - img_center_x)
                if horizontal_dist <= img_w * 0.8:
                    nearby_texts.append({
                        'text': block['text'],
                        'priority': 1,  # 최우선
                        'distance': vertical_dist,
                        'x': text_x,
                        'y': text_y,
                        'index': idx
                    })
                    continue
            
            # 위쪽 텍스트
            vertical_dist_above = img_y - (text_y + block['h'])
            if 0 <= vertical_dist_above <= 100:
                horizontal_dist = abs(text_center_x - img_center_x)
                if horizontal_dist <= img_w * 0.8:
                    nearby_texts.append({
                        'text': block['text'],
                        'priority': 2,
                        'distance': vertical_dist_above,
                        'x': text_x,
                        'y': text_y,
                        'index': idx
                    })
                    continue
            
            # 왼쪽/오른쪽 텍스트
            if abs(text_center_y - img_center_y) <= img_h * 0.5:
                horizontal_dist = abs(text_center_x - img_center_x)
                if img_w * 0.5 <= horizontal_dist <= img_w * 1.5:
                    nearby_texts.append({
                        'text': block['text'],
                        'priority': 3,
                        'distance': horizontal_dist,
                        'x': text_x,
                        'y': text_y,
                        'index': idx
                    })
        
        if not nearby_texts:
            return {
                'name': f'제품 {img_data["index"] + 1}',
                'specs': [],
                'details': [],
                'used_indices': []
            }
        
        # 우선순위 → Y좌표 순으로 정렬
        nearby_texts.sort(key=lambda t: (t['priority'], t['y'], t['x']))
        nearby_texts = nearby_texts[:12]
        
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
                    current_line.sort(key=lambda t: t['x'])
                    line_text = ' '.join([t['text'] for t in current_line])
                    lines.append(line_text)
                current_line = [item]
            last_y = item['y']
        
        if current_line:
            current_line.sort(key=lambda t: t['x'])
            line_text = ' '.join([t['text'] for t in current_line])
            lines.append(line_text)
        
        # 제품명 = 첫 3개 라인
        product_name = ' '.join(lines[:3]) if len(lines) >= 3 else ' '.join(lines) if lines else f'제품 {img_data["index"] + 1}'
        
        # 스펙 추출
        specs = []
        details = []
        
        for line in lines[3:]:
            clean_line = self._clean_text(line)
            if re.search(r'\d+', clean_line) or any(unit in clean_line for unit in ['W', 'mm', 'V', 'K', 'lm', 'COB', 'SMD', 'IP', 'Ø']):
                specs.append(clean_line)
            else:
                details.append(clean_line)
        
        # 사용된 텍스트 마킹
        used_indices = [t['index'] for t in nearby_texts]
        for idx in used_indices:
            used_text_blocks.add(idx)
        
        return {
            'name': self._clean_text(product_name),
            'specs': specs[:5],
            'details': details[:3],
            'used_indices': used_indices
        }
    
    def _clean_text(self, text):
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        text = text.replace('_', ' ')
        # 너무 긴 텍스트는 자르기
        if len(text) > 100:
            text = text[:100] + '...'
        return text
    
    def _image_to_base64(self, image):
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