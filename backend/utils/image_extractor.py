"""
실전용 PDF 제품 추출기 v2.0
- 검증된 휴리스틱 기반
- 방어적 프로그래밍
- 상세한 디버깅 로그
- 신뢰도 점수 제공
"""

import io
import base64
from PIL import Image, ImageDraw, ImageFont
import fitz
import os
import re
import json
from collections import defaultdict
import hashlib

class ProductExtractor:
    def __init__(self):
        self.use_vision = False
        self._init_vision_api()
        
        # 설정값 (나중에 UI로 조정 가능)
        self.config = {
            'min_image_size': 150,
            'max_image_size': 1500,
            'min_image_area': 40000,
            'text_search_radius_vertical': 150,
            'text_search_radius_horizontal': 100,
            'horizontal_overlap_threshold': 0.3,
            'grid_clustering_threshold': 0.1,
            'max_texts_per_product': 8,
        }
    
    def _init_vision_api(self):
        """Google Vision API 초기화"""
        try:
            from google.cloud import vision
            
            credentials_json = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS_JSON')
            if credentials_json:
                credentials_path = '/tmp/google-credentials.json'
                with open(credentials_path, 'w') as f:
                    f.write(credentials_json)
                os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_path
            elif os.path.exists('google-vision-key.json'):
                os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'google-vision-key.json'
            else:
                raise Exception("No credentials found")
            
            self.vision_client = vision.ImageAnnotatorClient()
            self.use_vision = True
            print("✅ Google Vision API 활성화\n")
            
        except Exception as e:
            print(f"⚠️ Vision API 비활성화: {e}")
            print("   → 제품명 추출이 제한될 수 있습니다\n")
            self.use_vision = False
    
    def extract_from_pdf(self, pdf_bytes):
        """메인 추출 함수"""
        results = []
        
        try:
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
            total_pages = len(pdf_document)
            
            print(f"\n{'='*80}")
            print(f"📄 PDF 분석: {total_pages}페이지")
            print(f"{'='*80}\n")
            
            # OCR 실행
            all_pages_text_data = {}
            if self.use_vision:
                print("🔍 OCR 실행 중...\n")
                all_pages_text_data = self._extract_all_text_once(pdf_document)
            
            for page_num in range(total_pages):
                print(f"\n{'='*80}")
                print(f"📖 페이지 {page_num + 1}/{total_pages}")
                print(f"{'='*80}\n")
                
                page = pdf_document[page_num]
                
                # 페이지 렌더링
                zoom = 2.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                page_img_bytes = pix.tobytes("png")
                page_width = pix.width
                page_height = pix.height
                
                text_blocks = all_pages_text_data.get(page_num, [])
                
                # 이미지 및 레이아웃 분석
                layout = self._analyze_page_layout(
                    page, pdf_document, text_blocks, 
                    page_width, page_height
                )
                
                # 제품 추출
                products = self._extract_products_from_layout(layout)
                
                # 결과 저장
                page_pil = Image.open(io.BytesIO(page_img_bytes))
                
                results.append({
                    'page': page_num + 1,
                    'type': layout['type'],
                    'image': self._image_to_base64(page_pil),
                    'debug_image': self._create_debug_image(page_img_bytes, layout, products),
                    'products': products,
                    'layout_info': {
                        'type': layout['type'],
                        'grid': f"{layout['grid_cols']}x{layout['grid_rows']}",
                        'images': len(layout['images']),
                        'avg_confidence': sum(p.get('confidence', 0) for p in products) / len(products) if products else 0
                    }
                })
                
                print(f"\n✅ 완료: {len(products)}개 제품 추출")
                print(f"   평균 신뢰도: {results[-1]['layout_info']['avg_confidence']:.1%}\n")
            
            pdf_document.close()
            return results
            
        except Exception as e:
            print(f"\n❌ 오류: {str(e)}\n")
            import traceback
            traceback.print_exc()
            raise
    
    def _analyze_page_layout(self, page, pdf_document, text_blocks, page_width, page_height):
        """페이지 레이아웃 분석"""
        
        # 1. 이미지 수집 및 필터링
        raw_images = self._collect_images(page, pdf_document)
        filtered_images = self._filter_product_images(raw_images)
        
        print(f"🖼️  이미지: {len(raw_images)}개 발견 → {len(filtered_images)}개 필터링")
        
        if not filtered_images:
            return {
                'type': 'no_products',
                'grid_cols': 0,
                'grid_rows': 0,
                'images': [],
                'text_blocks': text_blocks,
                'page_width': page_width,
                'page_height': page_height
            }
        
        # 2. 그리드 패턴 감지
        grid_info = self._detect_grid(filtered_images, page_width, page_height)
        
        print(f"📊 레이아웃: {grid_info['cols']}열 x {grid_info['rows']}행")
        
        # 3. 레이아웃 타입 결정
        layout_type = self._determine_layout_type(grid_info, len(filtered_images))
        
        print(f"🎯 타입: {layout_type}")
        
        return {
            'type': layout_type,
            'grid_cols': grid_info['cols'],
            'grid_rows': grid_info['rows'],
            'images': filtered_images,
            'text_blocks': text_blocks,
            'page_width': page_width,
            'page_height': page_height,
            'grid_info': grid_info
        }
    
    def _collect_images(self, page, pdf_document):
        """페이지에서 모든 이미지 수집"""
        images = []
        image_list = page.get_images(full=True)
        
        for img_index, img in enumerate(image_list):
            try:
                xref = img[0]
                rects = page.get_image_rects(xref)
                if not rects:
                    continue
                
                rect = rects[0]
                zoom = 2.0
                
                base_image = pdf_document.extract_image(xref)
                image_bytes = base_image["image"]
                pil_image = Image.open(io.BytesIO(image_bytes))
                actual_width, actual_height = pil_image.size
                
                images.append({
                    'xref': xref,
                    'index': img_index,
                    'x': rect.x0 * zoom,
                    'y': rect.y0 * zoom,
                    'w': (rect.x1 - rect.x0) * zoom,
                    'h': (rect.y1 - rect.y0) * zoom,
                    'actual_width': actual_width,
                    'actual_height': actual_height,
                    'area': actual_width * actual_height,
                    'aspect_ratio': actual_width / actual_height if actual_height > 0 else 0,
                    'image_bytes': image_bytes,
                    'pil_image': pil_image,
                    'hash': hashlib.md5(image_bytes).hexdigest()
                })
                
            except Exception as e:
                continue
        
        return images
    
    def _filter_product_images(self, images):
        """제품 이미지 필터링 (중복 제거 + 크기 필터)"""
        
        # 1. 크기 필터링
        size_filtered = []
        for img in images:
            w, h = img['actual_width'], img['actual_height']
            area = img['area']
            aspect = img['aspect_ratio']
            
            # 크기 체크
            if w < self.config['min_image_size'] or h < self.config['min_image_size']:
                continue
            if w > self.config['max_image_size'] or h > self.config['max_image_size']:
                continue
            if area < self.config['min_image_area']:
                continue
            
            # 비율 체크 (너무 길쭉하면 제외)
            if not (0.3 <= aspect <= 3.0):
                continue
            
            size_filtered.append(img)
        
        # 2. 중복 제거 (해시 기반)
        seen_hashes = set()
        hash_filtered = []
        
        for img in size_filtered:
            if img['hash'] not in seen_hashes:
                seen_hashes.add(img['hash'])
                hash_filtered.append(img)
        
        # 3. 위치 중복 제거 (비슷한 위치의 작은 이미지)
        hash_filtered.sort(key=lambda x: x['area'], reverse=True)
        
        position_filtered = []
        for img in hash_filtered:
            is_duplicate = False
            
            for existing in position_filtered:
                x_diff = abs(img['x'] - existing['x'])
                y_diff = abs(img['y'] - existing['y'])
                
                # 50px 이내 + 더 작으면 중복으로 간주
                if x_diff < 50 and y_diff < 50 and img['area'] < existing['area']:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                position_filtered.append(img)
        
        # 중심점 계산
        for img in position_filtered:
            img['center_x'] = img['x'] + img['w'] / 2
            img['center_y'] = img['y'] + img['h'] / 2
        
        return position_filtered
    
    def _detect_grid(self, images, page_width, page_height):
        """그리드 패턴 감지 (개선된 클러스터링)"""
        
        if len(images) < 2:
            return {
                'cols': 1,
                'rows': 1,
                'cell_width': page_width,
                'cell_height': page_height
            }
        
        # X좌표 클러스터링
        x_coords = sorted([img['center_x'] for img in images])
        x_threshold = page_width * self.config['grid_clustering_threshold']
        x_clusters = self._cluster_coordinates(x_coords, x_threshold)
        
        # Y좌표 클러스터링
        y_coords = sorted([img['center_y'] for img in images])
        y_threshold = page_height * self.config['grid_clustering_threshold']
        y_clusters = self._cluster_coordinates(y_coords, y_threshold)
        
        cols = len(x_clusters)
        rows = len(y_clusters)
        
        # 평균 간격 계산
        avg_img_w = sum(img['w'] for img in images) / len(images)
        avg_img_h = sum(img['h'] for img in images) / len(images)
        
        return {
            'cols': cols,
            'rows': rows,
            'cell_width': page_width / cols if cols > 0 else page_width,
            'cell_height': page_height / rows if rows > 0 else page_height,
            'x_clusters': x_clusters,
            'y_clusters': y_clusters,
            'avg_img_width': avg_img_w,
            'avg_img_height': avg_img_h
        }
    
    def _cluster_coordinates(self, coords, threshold):
        """좌표 클러스터링 (DBSCAN 간단 버전)"""
        if not coords:
            return []
        
        clusters = []
        current_cluster = [coords[0]]
        
        for coord in coords[1:]:
            if coord - current_cluster[-1] <= threshold:
                current_cluster.append(coord)
            else:
                # 클러스터 중심값 저장
                clusters.append(sum(current_cluster) / len(current_cluster))
                current_cluster = [coord]
        
        if current_cluster:
            clusters.append(sum(current_cluster) / len(current_cluster))
        
        return clusters
    
    def _determine_layout_type(self, grid_info, image_count):
        """레이아웃 타입 결정 (단순 규칙 기반)"""
        
        cols = grid_info['cols']
        rows = grid_info['rows']
        
        if image_count == 1:
            return 'single'
        elif cols >= 3:
            return 'grid'
        elif cols == 2:
            return 'two_column'
        elif rows >= 3:
            return 'vertical_list'
        else:
            return 'mixed'
    
    def _extract_products_from_layout(self, layout):
        """레이아웃에서 제품 추출"""
        
        layout_type = layout['type']
        
        if layout_type == 'no_products':
            return []
        
        # 그리드/2열은 셀 기반 매칭
        if layout_type in ['grid', 'two_column']:
            return self._extract_with_cell_matching(layout)
        
        # 세로 리스트는 구간 기반 매칭
        elif layout_type == 'vertical_list':
            return self._extract_with_region_matching(layout)
        
        # 단일 제품은 전체 텍스트 사용
        elif layout_type == 'single':
            return self._extract_single_product(layout)
        
        # 기타는 거리 기반 매칭
        else:
            return self._extract_with_distance_matching(layout)
    
    def _extract_with_cell_matching(self, layout):
        """셀 기반 매칭 (그리드 레이아웃용)"""
        
        products = []
        images = layout['images']
        text_blocks = layout['text_blocks']
        grid_info = layout['grid_info']
        
        used_texts = set()
        
        for img in images:
            # 이미지가 속한 셀 계산
            col = self._find_nearest_cluster(img['center_x'], grid_info['x_clusters'])
            row = self._find_nearest_cluster(img['center_y'], grid_info['y_clusters'])
            
            # 셀 경계 계산 (여유 공간 20% 추가)
            cell_w = grid_info['cell_width']
            cell_h = grid_info['cell_height']
            
            cell_left = col * cell_w - cell_w * 0.1
            cell_right = (col + 1) * cell_w + cell_w * 0.1
            cell_top = row * cell_h - cell_h * 0.1
            cell_bottom = (row + 1) * cell_h + cell_h * 0.1
            
            # 셀 내 텍스트 찾기
            cell_texts = []
            
            for idx, block in enumerate(text_blocks):
                if idx in used_texts:
                    continue
                
                # 텍스트가 셀 안에 있는지
                if not (cell_left <= block['center_x'] <= cell_right and
                        cell_top <= block['center_y'] <= cell_bottom):
                    continue
                
                # 이미지와의 관계 분석
                is_below = block['y'] > img['y'] + img['h']
                is_above = block['y'] + block['h'] < img['y']
                
                if is_below:
                    priority = 1
                    distance = block['y'] - (img['y'] + img['h'])
                elif is_above:
                    priority = 2
                    distance = img['y'] - (block['y'] + block['h'])
                else:
                    priority = 3
                    distance = abs(block['center_y'] - img['center_y'])
                
                # 거리 제한
                if distance > self.config['text_search_radius_vertical']:
                    continue
                
                cell_texts.append({
                    'text': block['text'],
                    'priority': priority,
                    'distance': distance,
                    'y': block['y'],
                    'x': block['x'],
                    'index': idx
                })
            
            # 텍스트 정렬 및 조합
            cell_texts.sort(key=lambda t: (t['priority'], t['distance'], t['y']))
            cell_texts = cell_texts[:self.config['max_texts_per_product']]
            
            product_info = self._build_product_info(img, cell_texts)
            
            # 사용된 텍스트 마킹
            for t in cell_texts:
                used_texts.add(t['index'])
            
            products.append(product_info)
        
        return products
    
    def _extract_with_region_matching(self, layout):
        """구간 기반 매칭 (세로 리스트용)"""
        
        products = []
        images = sorted(layout['images'], key=lambda x: x['y'])
        text_blocks = layout['text_blocks']
        
        used_texts = set()
        
        for i, img in enumerate(images):
            # 다음 이미지까지를 구간으로 설정
            y_start = img['y'] - 50  # 위쪽 여유
            y_end = images[i+1]['y'] if i < len(images)-1 else layout['page_height']
            
            region_texts = []
            
            for idx, block in enumerate(text_blocks):
                if idx in used_texts:
                    continue
                
                if y_start <= block['y'] <= y_end:
                    distance = abs(block['y'] - (img['y'] + img['h']))
                    
                    region_texts.append({
                        'text': block['text'],
                        'distance': distance,
                        'y': block['y'],
                        'x': block['x'],
                        'index': idx
                    })
            
            region_texts.sort(key=lambda t: (t['distance'], t['y']))
            region_texts = region_texts[:self.config['max_texts_per_product']]
            
            product_info = self._build_product_info(img, region_texts)
            
            for t in region_texts:
                used_texts.add(t['index'])
            
            products.append(product_info)
        
        return products
    
    def _extract_with_distance_matching(self, layout):
        """거리 기반 매칭 (기본 전략)"""
        
        products = []
        images = layout['images']
        text_blocks = layout['text_blocks']
        
        used_texts = set()
        
        for img in images:
            nearby_texts = []
            
            for idx, block in enumerate(text_blocks):
                if idx in used_texts:
                    continue
                
                distance = ((block['center_x'] - img['center_x'])**2 + 
                           (block['center_y'] - img['center_y'])**2)**0.5
                
                if distance < 300:  # 300px 이내
                    nearby_texts.append({
                        'text': block['text'],
                        'distance': distance,
                        'y': block['y'],
                        'x': block['x'],
                        'index': idx
                    })
            
            nearby_texts.sort(key=lambda t: t['distance'])
            nearby_texts = nearby_texts[:self.config['max_texts_per_product']]
            
            product_info = self._build_product_info(img, nearby_texts)
            
            for t in nearby_texts:
                used_texts.add(t['index'])
            
            products.append(product_info)
        
        return products
    
    def _extract_single_product(self, layout):
        """단일 제품 추출"""
        
        if not layout['images']:
            return []
        
        img = layout['images'][0]
        text_blocks = layout['text_blocks']
        
        all_texts = [{'text': b['text'], 'y': b['y'], 'x': b['x'], 'index': i} 
                     for i, b in enumerate(text_blocks)]
        
        product_info = self._build_product_info(img, all_texts[:15])
        
        return [product_info]
    
    def _build_product_info(self, img, texts):
        """텍스트에서 제품 정보 구성"""
        
        # 제품명과 스펙 분리
        name_parts = []
        specs = []
        
        for t in texts:
            clean = self._clean_text(t['text'])
            
            if not clean or len(clean) < 2:
                continue
            
            # 숫자 비율 계산
            digit_ratio = sum(c.isdigit() for c in clean) / len(clean)
            
            # 스펙 키워드 체크
            is_spec = (digit_ratio > 0.3 or 
                      any(kw in clean.upper() for kw in 
                          ['W', 'MM', 'V', 'K', 'LM', 'COB', 'SMD', 'IP', 'LED', 'Ø']))
            
            if is_spec:
                specs.append(clean)
            else:
                name_parts.append(clean)
        
        # 제품명: 처음 2-3개 텍스트
        product_name = ' '.join(name_parts[:3]) if name_parts else f'제품 {img["index"] + 1}'
        
        # 너무 길면 자르기
        if len(product_name) > 80:
            product_name = product_name[:80] + '...'
        
        # 신뢰도 계산
        confidence = self._calculate_confidence(texts, name_parts, specs)
        
        return {
            'name': product_name,
            'specs': specs[:5],
            'details': [],
            'image': self._image_to_base64(img['pil_image']),
            'confidence': confidence,
            'text_count': len(texts)
        }
    
    def _calculate_confidence(self, texts, name_parts, specs):
        """추출 신뢰도 계산"""
        
        score = 0.0
        
        # 텍스트가 있으면 기본 점수
        if texts:
            score += 0.3
        
        # 제품명이 있으면 점수
        if name_parts:
            score += 0.4
        
        # 스펙이 있으면 점수
        if specs:
            score += 0.2
        
        # 텍스트 개수에 따라 보너스
        if len(texts) >= 3:
            score += 0.1
        
        return min(score, 1.0)
    
    def _find_nearest_cluster(self, coord, clusters):
        """가장 가까운 클러스터 찾기"""
        if not clusters:
            return 0
        
        nearest_idx = 0
        min_dist = abs(coord - clusters[0])
        
        for i, cluster in enumerate(clusters):
            dist = abs(coord - cluster)
            if dist < min_dist:
                min_dist = dist
                nearest_idx = i
        
        return nearest_idx
    
    def _extract_all_text_once(self, pdf_document):
        """Google Vision OCR"""
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
                
                if response.error.message:
                    all_text_data[page_num] = []
                    continue
                
                texts = response.text_annotations
                if not texts:
                    all_text_data[page_num] = []
                    continue
                
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
                print(f"   페이지 {page_num + 1}: {len(text_blocks)}개 텍스트 추출")
            
            return all_text_data
            
        except Exception as e:
            print(f"❌ OCR 오류: {e}")
            return {}
    
    def _create_debug_image(self, page_img_bytes, layout, products):
        """디버그 이미지 생성"""
        try:
            img = Image.open(io.BytesIO(page_img_bytes)).convert('RGB')
            draw = ImageDraw.Draw(img)
            
            # 이미지 박스 (빨강)
            for img_data in layout['images']:
                x, y, w, h = img_data['x'], img_data['y'], img_data['w'], img_data['h']
                draw.rectangle([x, y, x+w, y+h], outline='red', width=3)
            
            # 그리드 라인 (파랑, 얇게)
            if 'grid_info' in layout:
                grid = layout['grid_info']
                if 'x_clusters' in grid:
                    for x in grid['x_clusters']:
                        draw.line([(x, 0), (x, layout['page_height'])], 
                                fill='blue', width=1)
                if 'y_clusters' in grid:
                    for y in grid['y_clusters']:
                        draw.line([(0, y), (layout['page_width'], y)], 
                                fill='blue', width=1)
            
            return self._image_to_base64(img)
        except:
            return None
    
    def _clean_text(self, text):
        """텍스트 정리"""
        if not text:
            return ""
        text = re.sub(r'\s+', ' ', str(text)).strip()
        return text[:100]
    
    def _image_to_base64(self, image):
        """이미지를 Base64로 변환"""
        buffered = io.BytesIO()
        image = image.convert('RGB')
        
        if image.width > 400:
            ratio = 400 / image.width
            new_height = int(image.height * ratio)
            image = image.resize((400, new_height), Image.LANCZOS)
        
        image.save(buffered, format="JPEG", quality=90, optimize=True)
        return f"data:image/jpeg;base64,{base64.b64encode(buffered.getvalue()).decode()}"


# 별칭
ImageExtractor = ProductExtractor