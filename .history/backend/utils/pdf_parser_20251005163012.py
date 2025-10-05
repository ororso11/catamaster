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
        
        # 1. 이미지 추출
        logger.info(f"   🖼️ 이미지 추출 중...")
        images = self.extract_images_from_page(page)
        logger.info(f"   찾은 이미지: {len(images)}개")
        
        # 2. 텍스트 추출 (좌표 포함)
        logger.info(f"   📝 텍스트 추출 중...")
        text_blocks = page.get_text("dict")["blocks"]
        logger.info(f"   찾은 텍스트 블록: {len(text_blocks)}개")
        
        # 3. 텍스트를 클러스터링하여 제품 영역 찾기
        logger.info(f"   🔍 제품 영역 클러스터링 중...")
        product_regions = self.cluster_text_blocks(text_blocks, page.rect)
        logger.info(f"   찾은 제품 영역: {len(product_regions)}개")
        
        # 이미지가 없고 텍스트도 없으면 샘플 데이터 생성
        if len(images) == 0 and len(product_regions) == 0:
            logger.warning(f"   ⚠️ 이미지와 텍스트를 찾지 못함. 샘플 데이터 생성")
            return self.generate_sample_products(3)
        
        # 4. 각 제품 영역에 이미지 매칭
        for idx, region in enumerate(product_regions):
            # 해당 영역의 텍스트
            product_name = region.get('name', f'제품 {len(products) + 1}')
            specs = region.get('specs', '제품 사양')
            
            logger.info(f"   제품 {idx + 1}: {product_name[:50]}")
            
            # 가장 가까운 이미지 찾기
            matched_image = None
            if images and idx < len(images):
                matched_image = images[idx]
            
            # 카테고리 자동 분류
            categories = self.classify_product(product_name, specs)
            
            product = {
                'name': product_name[:100],
                'productNumber': f'PROD_{str(len(products) + 1).zfill(4)}',
                'images': [matched_image] if matched_image else [],
                'specs': specs[:300],
                'specsList': self.extract_specs_list(specs),
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