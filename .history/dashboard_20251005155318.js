// PDF.js 워커 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let generatedFiles = null; // 생성된 index.html, admin.html 저장 (메모리에만)

// 탭 전환
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function() {
        const tab = this.getAttribute('data-tab');
        
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        this.classList.add('active');
        document.getElementById(tab).classList.add('active');
    });
});

// 파일 업로드 처리
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');

uploadZone.addEventListener('click', (e) => {
    if (!e.target.closest('button')) {
        fileInput.click();
    }
});

document.querySelector('.upload-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
});

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

async function handleFiles(files) {
    const file = files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        alert('PDF 파일만 업로드 가능합니다.');
        return;
    }

    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    if (parseFloat(fileSizeMB) > 50) {
        alert(`파일 크기가 너무 큽니다.\n파일 크기: ${fileSizeMB}MB\n최대 허용: 50MB`);
        return;
    }

    await processPDF(file);
}

async function processPDF(file) {
    showProcessingStatus('PDF 분석 중...');

    try {
        // PDF에서 샘플 데이터 추출 (실제로는 PDF 파싱)
        const products = await extractProductsFromPDF(file);
        
        showProcessingStatus('웹사이트 생성 중...');
        
        // 회사명 추출 (파일명 기반)
        const companyName = file.name.replace('.pdf', '').toUpperCase();
        
        // index.html과 admin.html 생성
        generatedFiles = {
            'index.html': generateIndexHTML(companyName, products),
            'admin.html': generateAdminHTML(companyName, products)
        };
        
        hideProcessingStatus();
        
        // 미리보기 탭으로 이동
        document.querySelector('[data-tab="preview"]').click();
        displayPreview();
        
        alert(`완료!\n\n파일명: ${file.name}\n크기: ${fileSizeMB} MB\n제품 수: ${products.length}개\n\nindex.html과 admin.html이 생성되었습니다.`);
        
    } catch (error) {
        hideProcessingStatus();
        alert('PDF 처리 중 오류가 발생했습니다.\n\n' + error.message);
        console.error(error);
    }
}

async function extractProductsFromPDF(file) {
    // PDF 파싱 (실제로는 여기서 PDF.js로 분석)
    // 데모 버전에서는 샘플 데이터 반환
    
    const products = [];
    const productCount = 8;
    
    for (let i = 0; i < productCount; i++) {
        products.push({
            name: `2" 매입형 COB LED ${i + 1}`,
            productNumber: `LAMP_${String(i + 1).padStart(4, '0')}`,
            thumbnail: generatePlaceholderSVG(300, 300, `제품 ${i + 1}`),
            detailImages: [
                generatePlaceholderSVG(600, 400, `상세 이미지`)
            ],
            specs: `타입: COB LED\n규격: Ø${50 + (i % 4) * 5}mm\n용량: ${5 + i}W`,
            specsList: [
                'CRI > 90',
                `전압: ${i % 2 === 0 ? '220V' : '110V'}`,
                `색온도: ${2700 + (i % 3) * 1000}K`
            ],
            categories: {
                productType: i % 3 === 0 ? 'DOWNLIGHT' : (i % 3 === 1 ? 'SPOTLIGHT' : 'TRACKLIGHT'),
                watt: `${5 + i}W`,
                cct: `${2700 + (i % 3) * 1000}K`,
                ip: i % 2 === 0 ? 'IP20' : 'IP44'
            }
        });
    }
    
    return products;
}

function generatePlaceholderSVG(width, height, text) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <defs>
            <linearGradient id="grad${Date.now()}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
            </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad${Date.now()})"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="20" font-weight="bold">${text}</text>
    </svg>`;
    
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

function generateIndexHTML(companyName, products) {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${companyName} - LED 조명 제품</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #fff; }
        header { background: linear-gradient(to right, #1a1a1a 0%, #2c2c2c 100%); color: #fff; padding: 15px 30px; }
        .logo { font-size: 18px; font-weight: normal; letter-spacing: 6px; }
        .container { max-width: 1400px; margin: 0 auto; padding: 30px; }
        .page-title { font-size: 32px; text-align: center; margin: 40px 0; font-weight: bold; }
        .product-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 25px; }
        .product-card { background: white; border: 1px solid #e0e0e0; cursor: pointer; }
        .product-image { width: 100%; height: 320px; background: #f8f8f8; }
        .product-image img { width: 100%; height: 100%; object-fit: cover; }
        .product-info { padding: 25px; }
        .product-name { font-size: 18px; font-weight: 600; margin-bottom: 10px; }
        .product-specs { font-size: 14px; color: #666; }
        footer { background: #2a2a2a; color: #999; padding: 40px; margin-top: 50px; text-align: center; }
        @media (max-width: 1200px) { .product-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 768px) { .product-grid { grid-template-columns: repeat(2, 1fr); } }
    </style>
</head>
<body>
    <header>
        <div class="logo">${companyName}</div>
    </header>
    
    <div class="container">
        <h1 class="page-title">제품</h1>
        <div class="product-grid">
            ${products.map(p => `
                <div class="product-card">
                    <div class="product-image">
                        <img src="${p.thumbnail}" alt="${p.name}">
                    </div>
                    <div class="product-info">
                        <div class="product-name">${p.name}</div>
                        <div class="product-specs">${p.specs.replace(/\n/g, '<br>')}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
    
    <footer>
        <div>COPYRIGHT © 2025 ${companyName}. ALL RIGHTS RESERVED.</div>
    </footer>
</body>
</html>`;
}

function generateAdminHTML(companyName, products) {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${companyName} - 제품 관리 시스템</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        h1 { margin-bottom: 30px; color: #333; }
        .demo-notice { background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107; }
        .product-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 30px; }
        .product-item { border: 1px solid #ddd; padding: 20px; border-radius: 8px; background: #fafafa; }
        .product-item h3 { margin-bottom: 10px; font-size: 16px; }
        .product-item p { color: #666; font-size: 14px; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 ${companyName} - 제품 관리 시스템</h1>
        
        <div class="demo-notice">
            <strong>⚠️ 데모 모드:</strong> 이것은 미리보기 버전입니다. 실제 Firebase를 연동하려면 설정이 필요합니다.
        </div>
        
        <h2>등록된 제품 목록 (${products.length}개)</h2>
        
        <div class="product-list">
            ${products.map(p => `
                <div class="product-item">
                    <h3>${p.name}</h3>
                    <p><strong>제품번호:</strong> ${p.productNumber}</p>
                    <p><strong>사양:</strong><br>${p.specs.replace(/\n/g, '<br>')}</p>
                    <p style="margin-top: 10px;"><strong>스펙:</strong><br>${p.specsList.join('<br>')}</p>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
}

function displayPreview() {
    const container = document.getElementById('previewContainer');
    
    if (!generatedFiles) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🖥️</div>
                <p>PDF를 업로드하면 생성된 웹사이트가 여기에 표시됩니다</p>
            </div>
        `;
        return;
    }

    const indexPreviewUrl = `data:text/html;charset=utf-8,${encodeURIComponent(generatedFiles['index.html'])}`;
    const adminPreviewUrl = `data:text/html;charset=utf-8,${encodeURIComponent(generatedFiles['admin.html'])}`;

    container.innerHTML = `
        <div class="demo-notice">
            <h3>✨ 웹사이트가 성공적으로 생성되었습니다!</h3>
            <p>index.html (고객용)과 admin.html (관리자용)을 확인하고 다운로드하세요.</p>
            <a href="mailto:contact@example.com" class="cta-button">정식 버전 문의하기 →</a>
        </div>
        
        <div class="download-buttons">
            <button class="download-btn index" onclick="downloadFile('index.html')">
                📥 index.html 다운로드
            </button>
            <button class="download-btn admin" onclick="downloadFile('admin.html')">
                📥 admin.html 다운로드
            </button>
        </div>
        
        <div class="preview-tabs">
            <button class="preview-tab-btn active" onclick="switchPreview('index')">
                index.html 미리보기
            </button>
            <button class="preview-tab-btn" onclick="switchPreview('admin')">
                admin.html 미리보기
            </button>
        </div>
        
        <div class="preview-frame-container">
            <iframe id="indexFrame" src="${indexPreviewUrl}" class="preview-frame"></iframe>
            <iframe id="adminFrame" src="${adminPreviewUrl}" class="preview-frame" style="display: none;"></iframe>
        </div>
    `;
}

window.switchPreview = function(type) {
    const indexFrame = document.getElementById('indexFrame');
    const adminFrame = document.getElementById('adminFrame');
    const buttons = document.querySelectorAll('.preview-tab-btn');
    
    if (type === 'index') {
        indexFrame.style.display = 'block';
        adminFrame.style.display = 'none';
        buttons[0].classList.add('active');
        buttons[1].classList.remove('active');
    } else {
        indexFrame.style.display = 'none';
        adminFrame.style.display = 'block';
        buttons[0].classList.remove('active');
        buttons[1].classList.add('active');
    }
};

window.downloadFile = function(filename) {
    if (!generatedFiles || !generatedFiles[filename]) return;
    
    const content = generatedFiles[filename];
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

function showProcessingStatus(message) {
    const statusDiv = document.getElementById('processingStatus');
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
}

function hideProcessingStatus() {
    const statusDiv = document.getElementById('processingStatus');
    statusDiv.style.display = 'none';
}