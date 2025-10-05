// PDF.js 워커 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let generatedFiles = null;
const MAX_FILE_SIZE_MB = 50;

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
    if (parseFloat(fileSizeMB) > MAX_FILE_SIZE_MB) {
        alert(`파일 크기가 너무 큽니다.\n파일 크기: ${fileSizeMB}MB\n최대 허용: ${MAX_FILE_SIZE_MB}MB`);
        return;
    }

    await processPDF(file);
}

async function processPDF(file) {
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    showProcessingStatus('PDF 분석 중...');

    try {
        const products = await extractProductsFromPDF(file);
        
        showProcessingStatus('웹사이트 생성 중...');
        
        const companyName = file.name.replace('.pdf', '').toUpperCase();
        const firebaseData = createFirebaseStructure(products);
        
        generatedFiles = {
            'index.html': generateIndexHTML(companyName, products, firebaseData),
            'admin.html': generateAdminHTML(companyName, products, firebaseData)
        };
        
        hideProcessingStatus();
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
    const products = [];
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        
        const totalPages = Math.min(pdf.numPages, 10);
        
        // 그리드 설정: 한 페이지에 몇 개의 제품이 있는지 (예: 2x3 = 6개)
        const GRID_COLS = 3;
        const GRID_ROWS = 2;
        
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            
            // 고해상도로 렌더링
            const scale = 3.0;
            const viewport = page.getViewport({scale: scale});
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            // 텍스트 추출
            const textContent = await page.getTextContent();
            const textItems = textContent.items;
            
            // 페이지를 그리드로 분할하여 각 제품 추출
            const cellWidth = canvas.width / GRID_COLS;
            const cellHeight = canvas.height / GRID_ROWS;
            
            for (let row = 0; row < GRID_ROWS; row++) {
                for (let col = 0; col < GRID_COLS; col++) {
                    const x = col * cellWidth;
                    const y = row * cellHeight;
                    
                    // 제품 이미지 영역만 크롭 (상단 70%)
                    const imageHeight = cellHeight * 0.7;
                    const productCanvas = document.createElement('canvas');
                    const productCtx = productCanvas.getContext('2d');
                    productCanvas.width = cellWidth;
                    productCanvas.height = imageHeight;
                    
                    productCtx.drawImage(
                        canvas,
                        x, y, cellWidth, imageHeight,
                        0, 0, cellWidth, imageHeight
                    );
                    
                    const productImage = productCanvas.toDataURL('image/jpeg', 0.85);
                    
                    // 텍스트 영역 (하단 30%)에서 텍스트 추출
                    const textY = y + imageHeight;
                    const textHeight = cellHeight - imageHeight;
                    
                    const textsInArea = textItems.filter(item => {
                        const tx = item.transform[4];
                        const ty = viewport.height - item.transform[5];
                        return tx >= x && tx < x + cellWidth && 
                               ty >= textY && ty < textY + textHeight;
                    });
                    
                    // 텍스트를 y좌표 기준으로 정렬
                    textsInArea.sort((a, b) => {
                        const ay = viewport.height - a.transform[5];
                        const by = viewport.height - b.transform[5];
                        return ay - by;
                    });
                    
                    const extractedTexts = textsInArea.map(item => item.str.trim()).filter(t => t.length > 0);
                    
                    // 제품명: 가장 큰 폰트 크기의 텍스트 또는 첫 번째 긴 텍스트
                    let productName = '제품';
                    if (textsInArea.length > 0) {
                        // 폰트 크기 기준으로 정렬
                        const sortedBySize = [...textsInArea].sort((a, b) => {
                            const sizeA = Math.abs(a.transform[0]);
                            const sizeB = Math.abs(b.transform[0]);
                            return sizeB - sizeA;
                        });
                        productName = sortedBySize[0]?.str.trim() || extractedTexts.find(t => t.length > 3) || `제품 ${products.length + 1}`;
                    }
                    productName = productName.substring(0, 100);
                    
                    // 사양: 나머지 텍스트
                    const specs = extractedTexts.slice(1, 5).join('\n').substring(0, 200) || '사양 정보';
                    
                    // 제품 객체 생성
                    const productIndex = products.length + 1;
                    products.push({
                        name: productName,
                        productNumber: `PROD_${String(productIndex).padStart(4, '0')}`,
                        thumbnail: productImage,
                        detailImages: [productImage],
                        specs: specs,
                        specsList: extractedTexts.slice(1, 4).filter(t => t.length > 0).length > 0 
                            ? extractedTexts.slice(1, 4) 
                            : ['CRI > 90', '전압: 220V', '색온도: 3000K'],
                        categories: {
                            productType: productIndex % 3 === 0 ? 'DOWNLIGHT' : (productIndex % 3 === 1 ? 'SPOTLIGHT' : 'TRACKLIGHT'),
                            watt: `${5 + (productIndex % 10)}W`,
                            cct: `${2700 + (productIndex % 3) * 1000}K`,
                            ip: productIndex % 2 === 0 ? 'IP20' : 'IP44'
                        },
                        tableData: {
                            model: `PROD_${String(productIndex).padStart(4, '0')}`,
                            watt: `${5 + (productIndex % 10)}W`,
                            voltage: '220V',
                            cct: `${2700 + (productIndex % 3) * 1000}K`,
                            cri: '90+',
                            ip: productIndex % 2 === 0 ? 'IP20' : 'IP44'
                        }
                    });
                }
            }
        }
    } catch (error) {
        console.error('PDF 파싱 오류:', error);
        return generateSampleProducts();
    }
    
    return products.length > 0 ? products : generateSampleProducts();
}

function generateSampleProducts() {
    const products = [];
    for (let i = 0; i < 8; i++) {
        products.push({
            name: `2" 매입형 COB LED ${i + 1}`,
            productNumber: `LAMP_${String(i + 1).padStart(4, '0')}`,
            thumbnail: generatePlaceholderSVG(300, 300, `제품 ${i + 1}`),
            detailImages: [generatePlaceholderSVG(600, 400, `상세 이미지`)],
            specs: `타입: COB LED\n규격: Ø${50 + (i % 4) * 5}mm\n용량: ${5 + i}W`,
            specsList: ['CRI > 90', `전압: ${i % 2 === 0 ? '220V' : '110V'}`, `색온도: ${2700 + (i % 3) * 1000}K`],
            categories: {
                productType: i % 3 === 0 ? 'DOWNLIGHT' : (i % 3 === 1 ? 'SPOTLIGHT' : 'TRACKLIGHT'),
                watt: `${5 + i}W`,
                cct: `${2700 + (i % 3) * 1000}K`,
                ip: i % 2 === 0 ? 'IP20' : 'IP44'
            },
            tableData: {
                model: `LAMP_${String(i + 1).padStart(4, '0')}`,
                watt: `${5 + i}W`,
                voltage: i % 2 === 0 ? '220V' : '110V',
                cct: `${2700 + (i % 3) * 1000}K`,
                cri: '90+',
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

function createFirebaseStructure(products) {
    return {
        settings: {
            categories: {
                productType: { label: '제품 타입', values: ['ALL', 'DOWNLIGHT', 'SPOTLIGHT', 'TRACKLIGHT'] },
                watt: { label: '소비전력', values: [] },
                cct: { label: '색온도', values: [] },
                ip: { label: '방수등급', values: [] }
            },
            tableColumns: [
                { id: 'model', label: '모델명' },
                { id: 'watt', label: '소비전력' },
                { id: 'voltage', label: '전압' },
                { id: 'cct', label: '색온도' },
                { id: 'cri', label: '연색성' },
                { id: 'ip', label: '방수등급' }
            ]
        },
        products: Object.fromEntries(products.map((p, i) => [`product_${i}`, p]))
    };
}

function generateIndexHTML(companyName, products, firebaseData) {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${companyName} - LED 조명 제품</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #fff; }
        .header-wrapper { background: linear-gradient(to right, #1a1a1a 0%, #2c2c2c 100%); }
        header { color: #fff; padding: 15px 30px; max-width: 1600px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 18px; letter-spacing: 6px; }
        .container { display: flex; max-width: 1600px; margin: 0 auto; }
        .sidebar { width: 250px; background: #fff; padding: 20px; }
        .main-content { flex: 1; padding: 30px; }
        .page-title { font-size: 32px; text-align: center; margin: 40px 0; font-weight: bold; }
        .product-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 25px; }
        .product-card { background: white; border: 1px solid #e0e0e0; cursor: pointer; transition: transform 0.3s; }
        .product-card:hover { transform: translateY(-5px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        .product-image { width: 100%; height: 320px; background: #f8f8f8; overflow: hidden; }
        .product-image img { width: 100%; height: 100%; object-fit: cover; }
        .product-info { padding: 25px; }
        .product-name { font-size: 18px; font-weight: 600; margin-bottom: 10px; }
        .product-specs { font-size: 14px; color: #666; line-height: 1.6; white-space: pre-line; }
        
        /* 상세페이지 */
        .detail-page { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: white; z-index: 1000; overflow-y: auto; }
        .detail-page.active { display: block; }
        .detail-header { background: #000; color: white; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; }
        .back-btn { background: none; border: none; color: white; font-size: 24px; cursor: pointer; }
        .detail-content { max-width: 1200px; margin: 0 auto; padding: 40px; }
        .detail-title { font-size: 28px; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e0e0e0; }
        .detail-images { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px; }
        .detail-main-image { width: 100%; background: #f5f5f5; border-radius: 8px; overflow: hidden; }
        .detail-main-image img { width: 100%; height: auto; display: block; }
        .detail-specs-box { background: #f9f9f9; padding: 30px; border-radius: 8px; }
        .detail-specs-box h3 { font-size: 18px; margin-bottom: 20px; }
        .detail-specs-box ul { list-style: none; }
        .detail-specs-box li { padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-size: 14px; }
        
        footer { background: #2a2a2a; color: #999; padding: 40px; margin-top: 50px; text-align: center; }
        @media (max-width: 1200px) { .product-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 768px) { .product-grid { grid-template-columns: repeat(2, 1fr); } .detail-images { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div id="listPage">
        <div class="header-wrapper"><header><div class="logo">${companyName}</div></header></div>
        <div class="container">
            <aside class="sidebar"><h3>제품</h3></aside>
            <main class="main-content">
                <h1 class="page-title">제품</h1>
                <div class="product-grid" id="productGrid"></div>
            </main>
        </div>
        <footer><div>COPYRIGHT © 2025 ${companyName}. ALL RIGHTS RESERVED.</div></footer>
    </div>
    
    <div id="detailPage" class="detail-page">
        <div class="detail-header">
            <button class="back-btn" onclick="closeDetail()">✕</button>
            <div class="logo">${companyName}</div>
        </div>
        <div class="detail-content" id="detailContent"></div>
    </div>
    
    <script>
        const products = ${JSON.stringify(products)};
        const grid = document.getElementById('productGrid');
        
        grid.innerHTML = products.map((p, i) => \`
            <div class="product-card" onclick="showDetail(\${i})">
                <div class="product-image"><img src="\${p.thumbnail}" alt="\${p.name}"></div>
                <div class="product-info">
                    <div class="product-name">\${p.name}</div>
                    <div class="product-specs">\${p.specs}</div>
                </div>
            </div>
        \`).join('');
        
        function showDetail(index) {
            const product = products[index];
            const detailContent = document.getElementById('detailContent');
            
            let imagesHTML = '';
            if (product.detailImages && product.detailImages.length > 0) {
                imagesHTML = product.detailImages.map(img => \`
                    <div class="detail-main-image"><img src="\${img}" alt="\${product.name}"></div>
                \`).join('');
            }
            
            let specsListHTML = '';
            if (product.specsList && product.specsList.length > 0) {
                specsListHTML = product.specsList.map(spec => \`<li>\${spec}</li>\`).join('');
            }
            
            detailContent.innerHTML = \`
                <h1 class="detail-title">\${product.name}</h1>
                <div class="detail-images">
                    \${imagesHTML}
                    <div class="detail-specs-box">
                        <h3>제품 사양</h3>
                        <ul>
                            <li><strong>제품번호:</strong> \${product.productNumber}</li>
                            \${specsListHTML}
                        </ul>
                    </div>
                </div>
                <div class="detail-specs-box">
                    <h3>상세 정보</h3>
                    <p style="line-height: 1.8; white-space: pre-line;">\${product.specs}</p>
                </div>
            \`;
            
            document.getElementById('listPage').style.display = 'none';
            document.getElementById('detailPage').classList.add('active');
            window.scrollTo(0, 0);
        }
        
        function closeDetail() {
            document.getElementById('detailPage').classList.remove('active');
            document.getElementById('listPage').style.display = 'block';
            window.scrollTo(0, 0);
        }
    </script>
</body>
</html>`;
}

function generateAdminHTML(companyName, products) {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${companyName} - 제품 관리</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        h1 { margin-bottom: 30px; }
        .demo-notice { background: #fff3cd; padding: 15px; margin: 20px 0; border-left: 4px solid #ffc107; }
        .product-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px; }
        .product-item { border: 1px solid #ddd; padding: 20px; border-radius: 8px; background: #fafafa; }
        .product-item h3 { margin-bottom: 10px; font-size: 16px; }
        .product-item p { color: #666; font-size: 14px; line-height: 1.6; }
        .product-thumbnail { width: 100%; height: 150px; object-fit: cover; border-radius: 5px; margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 ${companyName} - 제품 관리 시스템</h1>
        <div class="demo-notice"><strong>⚠️ 데모 모드:</strong> 이것은 미리보기 버전입니다.</div>
        <h2>등록된 제품 (${products.length}개)</h2>
        <div class="product-list">
            ${products.map(p => `
                <div class="product-item">
                    <img src="${p.thumbnail}" class="product-thumbnail" alt="${p.name}">
                    <h3>${p.name}</h3>
                    <p><strong>제품번호:</strong> ${p.productNumber}</p>
                    <p><strong>사양:</strong><br>${p.specs}</p>
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
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🖥️</div><p>PDF를 업로드하면 생성된 웹사이트가 여기에 표시됩니다</p></div>';
        return;
    }
    const indexUrl = `data:text/html;charset=utf-8,${encodeURIComponent(generatedFiles['index.html'])}`;
    const adminUrl = `data:text/html;charset=utf-8,${encodeURIComponent(generatedFiles['admin.html'])}`;
    container.innerHTML = `
        <div class="demo-notice">
            <h3>✨ 웹사이트가 성공적으로 생성되었습니다!</h3>
            <p>PDF에서 제품을 추출하여 index.html과 admin.html을 생성했습니다.</p>
            <a href="mailto:contact@example.com" class="cta-button">정식 버전 문의하기 →</a>
        </div>
        <div class="download-buttons">
            <button class="download-btn index" onclick="downloadFile('index.html')">📥 index.html 다운로드</button>
            <button class="download-btn admin" onclick="downloadFile('admin.html')">📥 admin.html 다운로드</button>
        </div>
        <div class="preview-tabs">
            <button class="preview-tab-btn active" onclick="switchPreview('index')">index.html 미리보기</button>
            <button class="preview-tab-btn" onclick="switchPreview('admin')">admin.html 미리보기</button>
        </div>
        <div class="preview-frame-container">
            <iframe id="indexFrame" src="${indexUrl}" class="preview-frame"></iframe>
            <iframe id="adminFrame" src="${adminUrl}" class="preview-frame" style="display: none;"></iframe>
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
    document.getElementById('processingStatus').textContent = message;
    document.getElementById('processingStatus').style.display = 'block';
}

function hideProcessingStatus() {
    document.getElementById('processingStatus').style.display = 'none';
}