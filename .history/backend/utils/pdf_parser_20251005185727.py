"""
PDF 파서 - 카테고리 자동 추출 기능 추가
"""
import re

class PDFParser:
    def __init__(self, image_extractor):
        self.extractor = image_extractor
    
    def parse(self, pdf_bytes):
        """PDF를 파싱하여 제품 데이터 추출"""
        pages_data = self.extractor.extract_from_pdf(pdf_bytes)
        
        all_products = []
        product_counter = 1
        
        for page_data in pages_data:
            if page_data.get('type') == 'list':
                products = page_data.get('products', [])
                
                for product in products:
                    # 카테고리 자동 추출
                    categories = self._extract_categories(product)
                    
                    # 제품 번호 생성
                    product_number = f"P{product_counter:04d}"
                    product_counter += 1
                    
                    # 스펙 리스트 생성
                    specs_list = product.get('specs', []) + product.get('details', [])
                    
                    # 전체 스펙 텍스트
                    all_specs_text = '\n'.join(specs_list)
                    
                    parsed_product = {
                        'productNumber': product_number,
                        'name': product.get('name', f'제품 {product_counter}'),
                        'categories': categories,
                        'images': [product.get('image', '')],
                        'image': product.get('image', ''),
                        'specs': all_specs_text,
                        'specsList': specs_list
                    }
                    
                    all_products.append(parsed_product)
        
        return all_products
    
    def _extract_categories(self, product):
        """제품 정보에서 카테고리 추출"""
        name = product.get('name', '')
        specs = product.get('specs', [])
        details = product.get('details', [])
        
        # 모든 텍스트 합치기
        all_text = name + ' ' + ' '.join(specs) + ' ' + ' '.join(details)
        all_text = all_text.upper()
        
        # 제품 타입 추출
        product_type = self._extract_product_type(all_text, name)
        
        # 소비전력 추출
        watt = self._extract_watt(all_text)
        
        # 색온도 추출
        cct = self._extract_cct(all_text)
        
        # 방수등급 추출
        ip = self._extract_ip(all_text)
        
        return {
            'productType': product_type,
            'watt': watt,
            'cct': cct,
            'ip': ip
        }
    
    def _extract_product_type(self, text, name):
        """제품 타입 추출"""
        name_upper = name.upper()
        
        # 매입등 키워드
        if any(keyword in name_upper for keyword in ['매입', '다운라이트', 'DOWNLIGHT', '천장']):
            return 'DOWNLIGHT'
        
        # 스팟조명 키워드
        if any(keyword in name_upper for keyword in ['스팟', 'SPOT', '포인트', 'POINT']):
            return 'SPOTLIGHT'
        
        # 트랙조명 키워드
        if any(keyword in name_upper for keyword in ['트랙', 'TRACK', '레일']):
            return 'TRACKLIGHT'
        
        # 기본값
        return 'DOWNLIGHT'
    
    def _extract_watt(self, text):
        """소비전력 추출 (예: 10W, 20W, 10~20W)"""
        # 패턴 1: "10W", "20W"
        match = re.search(r'(\d+)\s*W(?!\d)', text)
        if match:
            return f"{match.group(1)}W"
        
        # 패턴 2: "10~20W", "10-20W"
        match = re.search(r'(\d+)\s*[~\-]\s*(\d+)\s*W', text)
        if match:
            return f"{match.group(1)}~{match.group(2)}W"
        
        # 패턴 3: "10 W" (공백 포함)
        match = re.search(r'(\d+)\s+W(?!\d)', text)
        if match:
            return f"{match.group(1)}W"
        
        return 'N/A'
    
    def _extract_cct(self, text):
        """색온도 추출 (예: 3000K, 4000K, 2700K)"""
        # 패턴 1: "3000K", "4000K"
        match = re.search(r'(\d{4})\s*K(?!\d)', text)
        if match:
            return f"{match.group(1)}K"
        
        # 패턴 2: "27", "30", "40" (색온도 축약형)
        match = re.search(r'\b(27|30|40|50|57|65)\b', text)
        if match:
            value = match.group(1)
            return f"{value}00K"
        
        # 패턴 3: "전구색", "주광색", "자연색"
        if '전구색' in text or 'WARM' in text:
            return '3000K'
        if '주광색' in text or 'DAY' in text:
            return '6500K'
        if '자연색' in text or 'NATURAL' in text:
            return '4000K'
        
        return 'N/A'
    
    def _extract_ip(self, text):
        """방수등급 추출 (예: IP20, IP44, IP65)"""
        # 패턴 1: "IP65", "IP44"
        match = re.search(r'IP\s*(\d{2})', text)
        if match:
            return f"IP{match.group(1)}"
        
        # 패턴 2: 실내/실외 기준 추정
        if any(keyword in text for keyword in ['실외', 'OUTDOOR', '방수']):
            return 'IP65'
        if any(keyword in text for keyword in ['실내', 'INDOOR']):
            return 'IP20'
        
        return 'IP20'  # 기본값


# 사용 예시
def parse_pdf(pdf_bytes, image_extractor):
    """PDF 파싱 메인 함수"""
    parser = PDFParser(image_extractor)
    products = parser.parse(pdf_bytes)
    
    print(f"\n{'='*80}")
    print(f"파싱 완료: {len(products)}개 제품")
    print(f"{'='*80}\n")
    
    # 샘플 출력
    for i, p in enumerate(products[:3], 1):
        print(f"제품 {i}:")
        print(f"  이름: {p['name']}")
        print(f"  타입: {p['categories']['productType']}")
        print(f"  전력: {p['categories']['watt']}")
        print(f"  색온도: {p['categories']['cct']}")
        print(f"  방수: {p['categories']['ip']}")
        print()
    
    return products