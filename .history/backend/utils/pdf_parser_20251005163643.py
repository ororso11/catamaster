import fitz  # PyMuPDF
import base64
from io import BytesIO
from PIL import Image
import re

class PDFParser:
    def __init__(self, pdf_path):
        self.pdf_path = pdf_path
        self.doc = fitz.open(pdf_path)
    
    def extract_products(self):
        """PDF에서 모든 제품 추출"""
        import logging
        logger = logging.getLogger(__name__)
        
        all_products = []
        
        logger.info(f"📖 PDF 총 페이지 수: {len(self.doc)}")
        
        # 최대 10페이지만 처리
        for page_num in range(min(len(self.doc), 10)):
            page = self.doc[page_num]
            logger.info(f"📄 페이지 {page_num + 1} 처리 중...")
            products = self.extract_products_from_page(page, page_num)
            logger.info(f"   추출된 제품 수: {len(products)}")
            all_products.extend(products)
        
        self.doc.close()
        return all_products
    
    def extract_products_from_page(self, page, page_num):
        """페이지에서 제품 추출"""
        import logging
        logger = logging.getLogger(__name__)
        
        products = []
        
        # 페이지를 고해상도 이미지로 렌더링
        logger.info(f"   🖼️ 페이지를 이미지로 렌더링 중...")
        zoom = 2.5  # 더 높은 해상도
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        
        # PIL Image로 변환
        img_data = pix.tobytes("png")
        from PIL import Image
        from io import BytesIO
        img = Image.open(BytesIO(img_data))
        
        logger.info(f"   페이지 크기: {img.width} x {img.height}")
        
        # 그리드 설정 (카탈로그에 따라 조정)
        # 상단 헤더 영역 제외 (약 15%)
        header_height = int(img.height * 0.15)
        working_height = img.height - header_height
        
        # 그리드: 5열 x 4행
        COLS = 5
        ROWS = 4
        
        cell_width = img.width // COLS
        cell_height = working_height // ROWS
        
        logger.info(f"   그리드: {COLS}x{ROWS}, 셀 크기: {cell_width}x{cell_height}")
        
        # 텍스트 추출
        text_dict = page.get_text("dict")
        
        for row in range(ROWS):
            for col in range(COLS):
                # 셀의 전체 좌표
                x = col * cell_width
                y = header_height + (row * cell_height)
                
                # 이미지 영역: 셀의 상단 70%만 (제품 사진 부분)
                image_height = int(cell_height * 0.7)
                
                # 여백 제거 (좌우 10%, 상하 5%)
                padding_x = int(cell_width * 0.1)
                padding_y = int(image_height * 0.05)
                
                crop_box = (
                    x + padding_x,
                    y + padding_y,
                    x + cell_width - padding_x,
                    y + image_height - padding_y
                )
                
                # 제품 이미지만 크롭
                cell_img = img.crop(crop_box)
                
                # 빈 이미지 체크
                import numpy as np
                arr = np.array(cell_img.convert('L'))
                avg_brightness = arr.mean()
                
                # 너무 밝거나 어두우면 스킵
                if avg_brightness > 245 or avg_brightness < 10:
                    logger.info(f"   셀 [{row},{col}]: 빈 영역 (밝기: {avg_brightness:.1f})")
                    continue
                
                # 이미지를 base64로 변환
                buffered = BytesIO()
                cell_img.save(buffered, format="JPEG", quality=90)
                img_str = base64.b64encode(buffered.getvalue()).decode()
                img_data_url = f"data:image/jpeg;base64,{img_str}"
                
                # 텍스트 영역: 셀의 하단 30% (제품명/사양 부분)
                text_y = y + image_height
                text_rect = fitz.Rect(
                    x / zoom, 
                    text_y / zoom, 
                    (x + cell_width) / zoom, 
                    (y + cell_height) / zoom
                )
                
                # 해당 영역의 텍스트 추출
                cell_text = page.get_textbox(text_rect)
                
                # 제품명과 사양 파싱
                lines = [l.strip() for l in cell_text.split('\n') if l.strip()]
                
                # 첫 번째 줄: 제품명 (가장 큰 텍스트)
                product_name = lines[0] if lines else f'제품 {len(products) + 1}'
                
                # 나머지: 사양
                specs_lines = lines[1:6] if len(lines) > 1 else []
                specs = '\n'.join(specs_lines)
                
                logger.info(f"   셀 [{row},{col}]: {product_name[:40]}")
                
                # 카테고리 자동 분류
                categories = self.classify_product(product_name, specs)
                
                product = {
                    'name': product_name[:100],
                    'productNumber': f'PROD_{str(len(products) + 1).zfill(4)}',
                    'images': [img_data_url],
                    'specs': specs[:300] if specs else '제품 사양',
                    'specsList': specs_lines[:5] if specs_lines else ['CRI > 90', '전압: 220V'],
                    'categories': categories,
                    'tableData': {
                        'model': f'PROD_{str(len(products) + 1).zfill(4)}',
                        'watt': categories['watt'],
                        'voltage': '220V',
                        'cct': categories['cct'],
                        'cri': '90+',
                        'ip': categories['ip']
                    }
                }
                
                products.append(product)
        
        logger.info(f"   ✅ 총 추출된 제품: {len(products)}개")
        return products
    
    def extract_images_from_page(self, page):
        """페이지에서 이미지 객체 직접 추출"""
        images = []
        image_list = page.get_images(full=True)
        
        for img_index, img in enumerate(image_list):
            try:
                xref = img[0]
                base_image = self.doc.extract_image(xref)
                image_bytes = base_image["image"]
                
                # PIL로 이미지 열기
                pil_image = Image.open(BytesIO(image_bytes))
                
                # 너무 작은 이미지 제외 (아이콘 등)
                if pil_image.width < 50 or pil_image.height < 50:
                    continue
                
                # Base64 인코딩
                buffered = BytesIO()
                pil_image.save(buffered, format="JPEG", quality=85)
                img_str = base64.b64encode(buffered.getvalue()).decode()
                img_data_url = f"data:image/jpeg;base64,{img_str}"
                
                images.append(img_data_url)
                
            except Exception as e:
                print(f"이미지 추출 실패: {e}")
                continue
        
        return images
    
    def cluster_text_blocks(self, blocks, page_rect):
        """텍스트 블록을 클러스터링하여 제품 영역 찾기"""
        text_items = []
        
        for block in blocks:
            if block['type'] == 0:  # 텍스트 블록
                for line in block.get('lines', []):
                    for span in line.get('spans', []):
                        text = span['text'].strip()
                        if text:
                            text_items.append({
                                'text': text,
                                'bbox': span['bbox'],
                                'size': span['size']
                            })
        
        # 간단한 클러스터링: y좌표 기준으로 그룹화
        text_items.sort(key=lambda x: (x['bbox'][1], x['bbox'][0]))
        
        regions = []
        current_region_texts = []
        last_y = 0
        y_threshold = 100  # y좌표 차이 임계값
        
        for item in text_items:
            y = item['bbox'][1]
            
            if last_y > 0 and abs(y - last_y) > y_threshold:
                # 새로운 제품 영역
                if current_region_texts:
                    regions.append(self.parse_region_texts(current_region_texts))
                current_region_texts = []
            
            current_region_texts.append(item)
            last_y = y
        
        # 마지막 영역
        if current_region_texts:
            regions.append(self.parse_region_texts(current_region_texts))
        
        return regions[:20]  # 최대 20개 제품
    
    def parse_region_texts(self, texts):
        """텍스트 영역에서 제품명과 사양 추출"""
        # 가장 큰 폰트 = 제품명
        texts.sort(key=lambda x: x['size'], reverse=True)
        
        name = texts[0]['text'] if texts else '제품'
        specs = '\n'.join([t['text'] for t in texts[1:6]])
        
        return {
            'name': name,
            'specs': specs
        }
    
    def extract_specs_list(self, specs):
        """사양 텍스트에서 리스트 추출"""
        lines = specs.split('\n')
        specs_list = [line.strip() for line in lines if line.strip() and len(line.strip()) > 2]
        return specs_list[:5] if specs_list else ['CRI > 90', '전압: 220V', '색온도: 3000K']
    
    def classify_product(self, name, specs):
        """텍스트 기반 자동 분류"""
        text = (name + ' ' + specs).upper()
        
        # 제품 타입
        product_type = 'DOWNLIGHT'
        if 'SPOT' in text or '스팟' in text:
            product_type = 'SPOTLIGHT'
        elif 'TRACK' in text or '트랙' in text or '레일' in text:
            product_type = 'TRACKLIGHT'
        elif 'DOWN' in text or '다운' in text or '매입' in text:
            product_type = 'DOWNLIGHT'
        
        # 와트 추출
        watt_match = re.search(r'(\d+)\s*W', text)
        watt = f"{watt_match.group(1)}W" if watt_match else '10W'
        
        # 색온도 추출
        cct_match = re.search(r'(\d{4})\s*K', text)
        cct = f"{cct_match.group(1)}K" if cct_match else '3000K'
        
        # IP등급 추출
        ip_match = re.search(r'IP\s*(\d{2})', text)
        ip = f"IP{ip_match.group(1)}" if ip_match else 'IP20'
        
        return {
            'productType': product_type,
            'watt': watt,
            'cct': cct,
            'ip': ip
        }
    
    def generate_sample_products(self, count):
        """샘플 제품 생성 (파싱 실패 시)"""
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"   📦 샘플 제품 {count}개 생성")
        
        products = []
        for i in range(count):
            products.append({
                'name': f'LED 조명 제품 {i + 1}',
                'productNumber': f'SAMPLE_{str(i + 1).zfill(4)}',
                'images': [],
                'specs': f'샘플 제품입니다.\nPDF에서 데이터를 추출할 수 없어 생성되었습니다.',
                'specsList': ['CRI > 90', '전압: 220V', '색온도: 3000K'],
                'categories': {
                    'productType': 'DOWNLIGHT',
                    'watt': f'{10 + i}W',
                    'cct': '3000K',
                    'ip': 'IP20'
                },
                'tableData': {
                    'model': f'SAMPLE_{str(i + 1).zfill(4)}',
                    'watt': f'{10 + i}W',
                    'voltage': '220V',
                    'cct': '3000K',
                    'cri': '90+',
                    'ip': 'IP20'
                }
            })
        return products