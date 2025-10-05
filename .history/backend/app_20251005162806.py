from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import os
import logging
from utils.pdf_parser import PDFParser
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
        
        # 임시 파일로 저장
        temp_path = os.path.join(UPLOAD_FOLDER, pdf_file.filename)
        pdf_file.save(temp_path)
        logger.info(f"💾 임시 파일 저장 완료: {temp_path}")
        
        # 파일 크기 확인
        file_size_mb = os.path.getsize(temp_path) / (1024 * 1024)
        logger.info(f"📊 파일 크기: {file_size_mb:.2f} MB")
        
        # PDF 파싱
        logger.info("🔍 PDF 파싱 시작...")
        parser = PDFParser(temp_path)
        products = parser.extract_products()
        logger.info(f"✅ 파싱 완료: {len(products)}개 제품 추출")
        
        for i, p in enumerate(products[:3]):  # 처음 3개만 로그
            logger.info(f"  제품 {i+1}: {p['name'][:50]}")
        
        # 회사명 추출
        company_name = pdf_file.filename.replace('.pdf', '').upper()
        logger.info(f"🏢 회사명: {company_name}")
        
        # HTML 생성
        logger.info("🌐 HTML 생성 시작...")
        generator = TemplateGenerator(company_name, products)
        index_html = generator.generate_index_html()
        admin_html = generator.generate_admin_html()
        logger.info("✅ HTML 생성 완료")
        
        # 임시 파일 삭제
        os.remove(temp_path)
        logger.info("🗑️ 임시 파일 삭제 완료")
        
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
            'products': products[:5]  # 처음 5개만 반환 (응답 크기 줄이기)
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
        'endpoints': {
            '/health': 'Health check',
            '/api/parse-pdf': 'PDF 파싱 (POST)'
        }
    })

if __name__ == '__main__':
    logger.info("🚀 Flask 서버 시작...")
    logger.info("📍 서버 주소: http://localhost:5000")
    logger.info("📍 Health Check: http://localhost:5000/health")
    logger.info("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)