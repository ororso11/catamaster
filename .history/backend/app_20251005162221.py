from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import os
from utils.pdf_parser import PDFParser
from utils.template_generator import TemplateGenerator

app = Flask(__name__)
CORS(app)  # CORS 허용

# 임시 파일 저장 경로
UPLOAD_FOLDER = '/tmp'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/api/parse-pdf', methods=['POST'])
def parse_pdf():
    start_time = time.time()
    
    try:
        # PDF 파일 확인
        if 'pdf' not in request.files:
            return jsonify({'error': 'PDF 파일이 없습니다'}), 400
        
        pdf_file = request.files['pdf']
        
        if pdf_file.filename == '':
            return jsonify({'error': '파일이 선택되지 않았습니다'}), 400
        
        if not pdf_file.filename.endswith('.pdf'):
            return jsonify({'error': 'PDF 파일만 업로드 가능합니다'}), 400
        
        # 임시 파일로 저장
        temp_path = os.path.join(UPLOAD_FOLDER, pdf_file.filename)
        pdf_file.save(temp_path)
        
        # PDF 파싱
        parser = PDFParser(temp_path)
        products = parser.extract_products()
        
        # 회사명 추출
        company_name = pdf_file.filename.replace('.pdf', '').upper()
        
        # HTML 생성
        generator = TemplateGenerator(company_name, products)
        index_html = generator.generate_index_html()
        admin_html = generator.generate_admin_html()
        
        # 임시 파일 삭제
        os.remove(temp_path)
        
        processing_time = round(time.time() - start_time, 2)
        
        return jsonify({
            'success': True,
            'products_count': len(products),
            'images_count': sum(len(p['images']) for p in products),
            'processing_time': processing_time,
            'index_html': index_html,
            'admin_html': admin_html,
            'products': products  # 디버깅용
        })
        
    except Exception as e:
        return jsonify({
            'error': f'PDF 처리 중 오류 발생: {str(e)}'
        }), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)