from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import os
import logging
from utils.image_extractor import ImageExtractor  # OCR 사용
from utils.template_generator import TemplateGenerator

app = Flask(__name__)
CORS(app)

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 임시 파일 저장 경로
UPLOAD_FOLDER = '/tmp'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/api/parse-pdf', methods=['POST'])
def parse_pdf():
    start_time = time.time()
    
    logger.info("=" * 50)
    logger.info("📥 PDF 업로드 요청 받음")
    
    try:
        # PDF 파일 확인
        if 'pdf' not in request.files:
            logger.error("❌ PDF 파일이 요청에 없음")
            return jsonify({'error': 'PDF 파일이 없습니다'}), 400
        
        pdf_file = request.files['pdf']
        logger.info(f"📄 파일명: {pdf_file.filename}")
        
        if pdf_file.filename == '':
            logger.error("❌ 파일이 선택되지 않음")
            return jsonify({'error': '파일이 선택되지 않았습니다'}), 400
        
        if not pdf_file.filename.endswith('.pdf'):
            logger.error("❌ PDF 파일이 아님")
            return jsonify({'error': 'PDF 파일만 업로드 가능합니다'}), 400
        
        # PDF 바이트 데이터 읽기
        pdf_bytes = pdf_file.read()
        file_size_mb = len(pdf_bytes) / (1024 * 1024)
        logger.info(f"📊 파일 크기: {file_size_mb:.2f} MB")
        
        # ===== OCR 방식으로 파싱 =====
        logger.info("🔍 OCR 파싱 시작 (Tesseract)...")
        extractor = ImageExtractor()
        ocr_results = extractor.extract_from_pdf(pdf_bytes)
        logger.info(f"✅ OCR 완료: {len(ocr_results)}개 페이지 처리")
        
        # OCR 결과를 제품 형식으로 변환
        products = []
        for page_data in ocr_results:
            page_num = page_data['page']
            logger.info(f"📄 페이지 {page_num}: {len(page_data['products'])}개 제품 발견")
            
            for idx, product_data in enumerate(page_data['products']):
                product = {
                    'name': product_data.get('name', f'제품 {len(products) + 1}'),
                    'productNumber': f'PROD_{str(len(products) + 1).zfill(4)}',
                    'images': [page_data['image']],  # 페이지 전체 이미지
                    'specs': '\n'.join(product_data.get('specs', [])),
                    'specsList': product_data.get('specs', [])[:5],
                    'categories': {
                        'productType': 'DOWNLIGHT',
                        'watt': '10W',
                        'cct': '3000K',
                        'ip': 'IP20'
                    },
                    'tableData': {
                        'model': f'PROD_{str(len(products) + 1).zfill(4)}',
                        'watt': '10W',
                        'voltage': '220V',
                        'cct': '3000K',
                        'cri': '90+',
                        'ip': 'IP20'
                    },
                    'ocrText': page_data['text']  # 전체 OCR 텍스트 포함
                }
                products.append(product)
                logger.info(f"  제품 {len(products)}: {product['name'][:50]}")
        
        logger.info(f"✅ 총 {len(products)}개 제품 추출 완료")
        
        # 회사명 추출
        company_name = pdf_file.filename.replace('.pdf', '').upper()
        logger.info(f"🏢 회사명: {company_name}")
        
        # HTML 생성
        logger.info("🌐 HTML 생성 시작...")
        generator = TemplateGenerator(company_name, products)
        index_html = generator.generate_index_html()
        admin_html = generator.generate_admin_html()
        logger.info("✅ HTML 생성 완료")
        
        processing_time = round(time.time() - start_time, 2)
        logger.info(f"⏱️ 총 처리 시간: {processing_time}초")
        logger.info("=" * 50)
        
        return jsonify({
            'success': True,
            'products_count': len(products),
            'images_count': sum(len(p['images']) for p in products),
            'processing_time': processing_time,
            'index_html': index_html,
            'admin_html': admin_html,
            'products': products[:5],  # 처음 5개만 반환
            'ocr_pages': len(ocr_results)  # OCR 처리된 페이지 수
        })
        
    except Exception as e:
        logger.error(f"💥 오류 발생: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({
            'error': f'PDF 처리 중 오류 발생: {str(e)}'
        }), 500

@app.route('/health', methods=['GET'])
def health():
    logger.info("🏥 Health check 요청")
    return jsonify({'status': 'ok', 'message': '백엔드 서버 정상 작동 중 (OCR 방식)'})

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        'message': 'LIGHTPDF Backend API (OCR Edition)',
        'version': '2.0 - Tesseract OCR',
        'endpoints': {
            '/health': 'Health check',
            '/api/parse-pdf': 'PDF 파싱 with OCR (POST)'
        }
    })

if __name__ == '__main__':
    logger.info("🚀 Flask 서버 시작 (OCR 방식)...")
    logger.info("📍 서버 주소: http://localhost:5000")
    logger.info("📍 Health Check: http://localhost:5000/health")
    logger.info("🔍 OCR 엔진: Tesseract (한글+영어)")
    logger.info("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)