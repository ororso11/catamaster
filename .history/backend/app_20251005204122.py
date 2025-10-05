from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import os
import logging
from utils.image_extractor import ImageExtractor
from utils.template_generator import TemplateGenerator

app = Flask(__name__)
CORS(app, origins=["https://cataleaf.vercel.app"])

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

UPLOAD_FOLDER = '/tmp'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/api/parse-pdf', methods=['POST'])
def parse_pdf():
    start_time = time.time()
    
    logger.info("=" * 50)
    logger.info("📥 PDF 업로드 요청 받음")
    
    try:
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
        
        pdf_bytes = pdf_file.read()
        file_size_mb = len(pdf_bytes) / (1024 * 1024)
        logger.info(f"📊 파일 크기: {file_size_mb:.2f} MB")
        
        # 이미지 추출
        logger.info("🔍 제품 추출 시작...")
        extractor = ImageExtractor()
        page_results = extractor.extract_from_pdf(pdf_bytes)
        
        # 모든 페이지의 제품을 하나의 리스트로 합치기
        all_products = []
        for page_data in page_results:
            for product in page_data['products']:
                # 제품 형식 변환
                formatted_product = {
                    'name': product.get('name', '제품'),
                    'productNumber': f'PROD_{str(len(all_products) + 1).zfill(4)}',
                    'images': [product['image']],
                    'specs': '\n'.join(product.get('specs', [])),
                    'specsList': product.get('specs', [])[:5] or ['사양 정보'],
                    'categories': {
                        'productType': 'DOWNLIGHT',
                        'watt': '10W',
                        'cct': '3000K',
                        'ip': 'IP20'
                    },
                    'tableData': {
                        'model': f'PROD_{str(len(all_products) + 1).zfill(4)}',
                        'watt': '10W',
                        'voltage': '220V',
                        'cct': '3000K',
                        'cri': '90+',
                        'ip': 'IP20'
                    }
                }
                all_products.append(formatted_product)
        
        logger.info(f"✅ 총 {len(all_products)}개 제품 추출 완료")
        
        # 처음 5개 제품만 로그 출력
        for i, p in enumerate(all_products[:5]):
            logger.info(f"  제품 {i+1}: {p['name']}")
        
        # 페이징 처리 (30개씩)
        page_size = 30
        total_pages = (len(all_products) + page_size - 1) // page_size
        
        logger.info(f"📦 총 {total_pages}페이지 (페이지당 {page_size}개)")
        
        # 첫 페이지 제품만 전송
        paginated_products = all_products[:page_size]
        
        # 회사명 추출
        company_name = pdf_file.filename.replace('.pdf', '').upper()
        logger.info(f"🏢 회사명: {company_name}")
        
        # HTML 생성
        logger.info("🌐 HTML 생성 시작...")
        generator = TemplateGenerator(company_name, all_products)
        index_html = generator.generate_index_html()
        admin_html = generator.generate_admin_html()
        logger.info("✅ HTML 생성 완료")
        
        processing_time = round(time.time() - start_time, 2)
        logger.info(f"⏱️ 총 처리 시간: {processing_time}초")
        logger.info("=" * 50)
        
        return jsonify({
            'success': True,
            'products_count': len(all_products),
            'total_pages': total_pages,
            'current_page': 1,
            'page_size': page_size,
            'images_count': sum(len(p['images']) for p in all_products),
            'processing_time': processing_time,
            'index_html': index_html,
            'admin_html': admin_html,
            'products': paginated_products  # 첫 30개만
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
    return jsonify({'status': 'ok', 'message': '백엔드 서버 정상 작동 중'})

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        'message': 'LIGHTPDF Backend API',
        'version': '3.0 - Smart Grid',
        'endpoints': {
            '/health': 'Health check',
            '/api/parse-pdf': 'PDF 파싱 (POST)'
        }
    })

if __name__ == '__main__':
    logger.info("🚀 Flask 서버 시작 (스마트 그리드 방식)...")
    logger.info("📍 서버 주소: http://localhost:5000")
    logger.info("📍 Health Check: http://localhost:5000/health")
    logger.info("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)