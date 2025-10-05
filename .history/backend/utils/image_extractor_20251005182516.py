"""
Google Cloud Vision API를 사용한 PDF 제품 추출
"""

import io
import base64
from PIL import Image
import fitz
import cv2
import numpy as np
import os

class ImageExtractor:
    def __init__(self):
        # Google Vision API 초기화
        self.use_vision = False
        try:
            from google.cloud import vision
            
            # 서비스 계정 키 경로
            key_path = 'google-vision-key.json'
            if os.path.exists(key_path):
                os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = key_path
                self.vision_client = vision.ImageAnnotatorClient()
                self.use_vision = True
                print("Google Vision API 활성화됨")
            else:
                print("경고: google-vision-key.json 파일이 없습니다. 그리드 방식을 사용합니다.")
        except Exception as e:
            print(f"Vision API 초기화 실패: {e}")
    
    def extract_from_pdf(self, pdf_bytes):
        results = []
        
        try:
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            for page_num in range(len(pdf_document)):
                print(f"Processing page {page_num + 1}...")
                
                page = pdf_document[page_num]
                
                # 고해상도 렌더링
                zoom = 2.5
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                
                # OpenCV 변환
                nparr = np.frombuffer(img_bytes, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                print(f"  이미지 크기: {image.shape[1]}x{image.shape[0]}")
                
                # Vision API 또는 그리드 방식
                if self.use_vision:
                    products = self._extract_with_google_vision(img_bytes, image)
                else:
                    products = self._extract_with_grid(image)
                
                print(f"  {len(products)}개 제품 추출 완료")
                
                # 페이지 전체 이미지
                page_pil = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
                page_image = self._image_to_base64(page_pil)
                
                results.append({
                    'page': page_num + 1,
                    'image': page_image,
                    'text': '',
                    'products': products
                })
            
            pdf_document.close()
            return results
            
        except Exception as e:
            print(f"오류 발생: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
    
    def _extract_with_google_vision(self, img_bytes, image):
        """Google Vision API로 텍스트 감지 및 제품 추출"""
        from google.cloud import vision
        
        products = []
        
        try:
            vision_image = vision.Image(content=img_bytes)
            
            # 텍스트 감지
            response = self.vision_client.text_detection(image=vision_image)
            texts = response.text_annotations
            
            if not texts:
                print("  Vision API: 텍스트 없음, 그리드 사용")
                return self._extract_with_grid(image)
            
            print(f"  감지된 텍스트 블록: {len(texts)} 개")
            
            # 텍스트 블록을 제품 영역으로 그룹화
            height, width = image.shape[:2]
            product_boxes = []
            
            # 첫 번째(전체 텍스트) 제외, 개별 단어들 분석
            for i, text in enumerate(texts[1:], 1):
                vertices = text.bounding_poly.vertices
                
                # 바운딩 박스 좌표
                xs = [v.x for v in vertices]
                ys = [v.y for v in vertices]
                
                x = min(xs)
                y = min(ys)
                w = max(xs) - x
                h = max(ys) - y
                
                # 제품명으로 보이는 텍스트만 (COB, SMD 등 포함)
                if any(keyword in text.description.upper() for keyword in ['COB', 'SMD', 'LED', 'MR', 'Ø', 'W', 'K']):
                    # 이 텍스트가 속한 제품 박스 영역 추정
                    # 텍스트 위치 기준으로 셀 크기만큼 확장
                    cell_w = int(width / 6)
                    cell_h = int(height / 4.5)
                    
                    box_x = max(0, x - cell_w // 4)
                    box_y = max(0, y - cell_h // 2)
                    box_w = min(cell_w, width - box_x)
                    box_h = min(cell_h, height - box_y)
                    
                    product_boxes.append({
                        'box': (box_x, box_y, box_w, box_h),
                        'text': text.description,
                        'y': y  # 정렬용
                    })
            
            # Y좌표로 정렬
            product_boxes.sort(key=lambda p: (p['y'] // 400, p['box'][0]))
            
            # 중복 제거 (너무 가까운 박스)
            filtered_boxes = []
            for box_info in product_boxes:
                bx, by, bw, bh = box_info['box']
                
                too_close = False
                for existing in filtered_boxes:
                    ex, ey, ew, eh = existing['box']
                    if abs(bx - ex) < 50 and abs(by - ey) < 50:
                        too_close = True
                        break
                
                if not too_close:
                    filtered_boxes.append(box_info)
            
            print(f"  필터링 후: {len(filtered_boxes)} 개 제품")
            
            # 제품 박스 추출
            for idx, box_info in enumerate(filtered_boxes[:30]):  # 최대 30개
                x, y, w, h = box_info['box']
                
                box_crop = image[y:y+h, x:x+w]
                
                if box_crop.size == 0:
                    continue
                
                box_pil = Image.fromarray(cv2.cvtColor(box_crop, cv2.COLOR_BGR2RGB))
                img_base64 = self._image_to_base64(box_pil)
                
                product = {
                    'name': box_info['text'][:100] if box_info['text'] else f'제품 {idx + 1}',
                    'details': [],
                    'specs': [],
                    'image': img_base64
                }
                
                products.append(product)
            
            # 충분한 제품을 못 찾으면 그리드로 보완
            if len(products) < 20:
                print(f"  제품 부족 ({len(products)}개), 그리드 방식으로 보완")
                return self._extract_with_grid(image)
            
            return products
            
        except Exception as e:
            print(f"  Vision API 오류: {e}")
            import traceback
            traceback.print_exc()
            return self._extract_with_grid(image)
    
    def _extract_with_grid(self, image):
        """그리드 방식으로 제품 추출 (폴백)"""
        height, width = image.shape[:2]
        
        # 6x4 그리드
        cols, rows = 6, 4
        
        # 정확한 헤더/사이드바 계산 (1489x2105 기준)
        header = int(height * 0.14)
        sidebar = int(width * 0.04)
        
        work_width = width - sidebar
        work_height = height - header
        
        cell_width = work_width // cols
        cell_height = work_height // rows
        
        print(f"  그리드: {cols}x{rows}, 셀: {cell_width}x{cell_height}")
        
        products = []
        
        for row in range(rows):
            for col in range(cols):
                x = sidebar + (col * cell_width)
                y = header + (row * cell_height)
                
                # 여백
                padding = 8
                box_crop = image[y+padding:y+cell_height-padding, x+padding:x+cell_width-padding]
                
                if box_crop.size == 0:
                    continue
                
                # 빈 셀 체크
                gray = cv2.cvtColor(box_crop, cv2.COLOR_BGR2GRAY)
                if gray.mean() > 245:
                    continue
                
                # PIL 변환 및 base64
                box_pil = Image.fromarray(cv2.cvtColor(box_crop, cv2.COLOR_BGR2RGB))
                img_base64 = self._image_to_base64(box_pil)
                
                product = {
                    'name': f'제품 {len(products) + 1}',
                    'details': [],
                    'specs': [],
                    'image': img_base64
                }
                
                products.append(product)
        
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