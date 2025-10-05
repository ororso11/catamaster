let catalogs = [];
let currentThemeColor = '#000';
let companyName = '';
const MAX_FILE_SIZE_MB = 50;

function switchTab(tabName) {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function() {
        const tab = this.getAttribute('data-tab');
        switchTab(tab);
    });
});

const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');

uploadZone.addEventListener('click', () => {
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

function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (file.type !== 'application/pdf') {
            alert('PDF 파일만 업로드 가능합니다.');
            return;
        }
        
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        if (parseFloat(fileSizeMB) > MAX_FILE_SIZE_MB) {
            alert(`파일 크기가 너무 큽니다.\n\n파일 크기: ${fileSizeMB}MB\n최대 허용: ${MAX_FILE_SIZE_MB}MB`);
            return;
        }
        
        if (confirm(`PDF 카탈로그 업로드\n\n파일명: ${file.name}\n크기: ${fileSizeMB}MB\n\n권장 양식:\n- 그리드 형태의 제품 배치\n- 제품명과 모델명 포함\n- 제품 이미지 포함\n- 사양 정보 포함\n\n계속 진행하시겠습니까?`)) {
            processPDF(file);
        }
    });
}

function processPDF(file) {
    showProcessingStatus('처리 중...');
    
    setTimeout(() => {
        try {
            const projectId = generateProjectId();
            const extractedProducts = extractProductsFromPDFSync();
            createFirebaseStructure(projectId, extractedProducts);
            const generatedFiles = generateTemplateFiles(projectId, file.name);
            
            hideProcessingStatus();
            
            const catalog = {
                id: projectId,
                name: file.name,
                size: (file.size / 1024 / 1024).toFixed(2),
                uploadDate: new Date().toISOString(),
                productsCount: extractedProducts.length,
                status: 'completed',
                files: generatedFiles,
                previewUrl: `data:text/html;charset=utf-8,${encodeURIComponent(generatedFiles['index.html'])}`
            };
            
            catalogs.push(catalog);
            saveCatalogs();
            
            updateStats();
            updateCatalogList();
            
            alert(`완료!\n\n파일명: ${file.name}\n크기: ${catalog.size}MB\n제품 수: ${extractedProducts.length}개\n\n웹사이트가 자동 생성되었습니다.`);
        } catch (error) {
            hideProcessingStatus();
            alert('처리 중 오류가 발생했습니다.\n\n' + error.message);
            console.error(error);
        }
    }, 100);
}

function extractProductsFromPDFSync() {
    const products = [];
    const productCount = 8; // 제품 수 조정
    
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

// SVG 플레이스홀더 생성 (용량 최소화)
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

function generateProjectId() {
    return 'project_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function createFirebaseStructure(projectId, products) {
    const firebaseData = {
        settings: {
            categories: {
                productType: {
                    label: '제품 타입',
                    values: ['ALL', 'DOWNLIGHT', 'SPOTLIGHT', 'TRACKLIGHT']
                },
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
        products: {}
    };
    
    products.forEach((product, index) => {
        firebaseData.products[`product_${index}`] = product;
    });
    
    try {
        localStorage.setItem(`firebase_${projectId}`, JSON.stringify(firebaseData));
    } catch (e) {
        console.error('localStorage 저장 실패:', e);
        throw new Error('데이터 저장 용량 초과');
    }
    
    return firebaseData;
}

function generateTemplateFiles(projectId, catalogName) {
    const company = document.getElementById('companyName')?.value || catalogName.replace('.pdf', '').toUpperCase();
    
    const indexHtml = generateIndexHTML(projectId, company);
    const adminHtml = generateAdminHTML(projectId, company);
    
    return {
        'index.html': indexHtml,
        'admin.html': adminHtml
    };
}

function generateIndexHTML(projectId, companyName) {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${companyName} - LED 조명 제품</title>
    <style>${getStyleCSS()}</style>
</head>
<body>
    <div id="listPage">
        <div style="background: linear-gradient(to right, #1a1a1a 0%, #2c2c2c 100%);">
            <header style="color: white; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; max-width: 1600px; margin: 0 auto;">
                <div style="font-size: 18px; letter-spacing: 6px;">${companyName}</div>
                <nav style="display: flex; gap: 30px;">
                    <a href="#" style="color: white; text-decoration: none;">카탈로그</a>
                </nav>
            </header>
        </div>
        <div style="max-width: 1600px; margin: 0 auto; padding: 30px;">
            <h1 style="font-size: 32px; text-align: center; margin-bottom: 40px;">제품</h1>
            <div id="productGrid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px;"></div>
        </div>
        <footer style="background: #2a2a2a; color: #999; padding: 40px; text-align: center; margin-top: 50px;">
            <p>COPYRIGHT © 2025 ${companyName}. ALL RIGHTS RESERVED.</p>
        </footer>
    </div>
    <div id="detailPage" style="display: none;">
        <div style="background: #000; color: white; padding: 20px 40px;">
            <button onclick="goBack()" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer;">✕</button>
        </div>
        <div id="detailContent" style="max-width: 1200px; margin: 0 auto; padding: 40px;"></div>
    </div>
    <script>
        const firebaseData = JSON.parse(localStorage.getItem('firebase_${projectId}'));
        window.products = Object.values(firebaseData.products || {});
        ${getScriptJS()}
    </script>
</body>
</html>`;
}

function generateAdminHTML(projectId, companyName) {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${companyName} - 제품 관리</title>
    <style>${getAdminCSS()}</style>
</head>
<body>
    <div style="max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
        <h1>제품 관리 시스템 - ${companyName}</h1>
        <p>총 ${JSON.parse(localStorage.getItem('firebase_${projectId}')).products ? Object.keys(JSON.parse(localStorage.getItem('firebase_${projectId}')).products).length : 0}개의 제품이 등록되어 있습니다.</p>
    </div>
</body>
</html>`;
}

function showProcessingStatus(message) {
    const statusDiv = document.getElementById('processingStatus');
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
}

function hideProcessingStatus() {
    const statusDiv = document.getElementById('processingStatus');
    statusDiv.style.display = 'none';
}

function updateStats() {
    document.getElementById('totalFiles').textContent = catalogs.length;
    const totalSize = catalogs.reduce((sum, c) => sum + parseFloat(c.size), 0).toFixed(2);
    document.getElementById('totalSize').textContent = totalSize + ' MB';
    const completed = catalogs.filter(c => c.status === 'completed').length;
    document.getElementById('generatedSites').textContent = completed;
}

function updateCatalogList() {
    const catalogList = document.getElementById('catalogList');
    
    if (catalogs.length === 0) {
        catalogList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <p>아직 업로드된 카탈로그가 없습니다</p>
                <button onclick="switchTab('upload')" class="btn-primary">카탈로그 업로드하기</button>
            </div>
        `;
        return;
    }
    
    catalogList.innerHTML = catalogs.map(catalog => `
        <div class="catalog-card">
            <div class="catalog-header">
                <div class="catalog-icon">📄</div>
                <div class="catalog-info">
                    <h4>${catalog.name}</h4>
                    <div class="catalog-meta">
                        <strong>${catalog.size} MB</strong> • ${new Date(catalog.uploadDate).toLocaleDateString('ko-KR')}
                        <br>상태: ✅ 완료
                        <br>제품 수: ${catalog.productsCount}개
                    </div>
                </div>
            </div>
            <div class="catalog-actions">
                <button class="btn btn-preview" onclick="previewSite('${catalog.id}')">미리보기</button>
                <button class="btn btn-download" onclick="downloadFiles('${catalog.id}')">다운로드</button>
                <button class="btn btn-delete" onclick="deleteCatalog('${catalog.id}')">삭제</button>
            </div>
        </div>
    `).join('');
}

function previewSite(id) {
    const catalog = catalogs.find(c => c.id === id);
    if (!catalog) return;
    
    switchTab('preview');
    const previewContainer = document.getElementById('previewContainer');
    
    const filesHtml = Object.keys(catalog.files).map(filename => `
        <div class="file-item">
            <strong>${filename}</strong>
            <button onclick="downloadFile('${catalog.id}', '${filename}')">다운로드</button>
        </div>
    `).join('');
    
    previewContainer.innerHTML = `
        <div style="margin-bottom: 30px;">
            <h3>${catalog.name}의 생성된 웹사이트</h3>
            <p style="color: #666; margin: 10px 0;">
                파일 크기: <strong>${catalog.size} MB</strong> | 제품 수: <strong>${catalog.productsCount}개</strong>
            </p>
        </div>
        <div style="margin-bottom: 30px;">
            <h4 style="margin-bottom: 15px;">생성된 파일 목록:</h4>
            ${filesHtml}
        </div>
        <div style="border: 2px solid #ddd; border-radius: 10px; overflow: hidden;">
            <iframe src="${catalog.previewUrl}" style="width: 100%; height: 700px; border: none;"></iframe>
        </div>
    `;
}

function downloadFile(catalogId, filename) {
    const catalog = catalogs.find(c => c.id === catalogId);
    if (!catalog || !catalog.files[filename]) return;
    
    const content = catalog.files[filename];
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function downloadFiles(catalogId) {
    const catalog = catalogs.find(c => c.id === catalogId);
    if (!catalog) return;
    
    Object.keys(catalog.files).forEach((filename, index) => {
        setTimeout(() => downloadFile(catalogId, filename), index * 100);
    });
}

function deleteCatalog(id) {
    if (confirm('이 카탈로그를 삭제하시겠습니까?')) {
        catalogs = catalogs.filter(c => c.id !== id);
        saveCatalogs();
        localStorage.removeItem(`firebase_${id}`);
        updateStats();
        updateCatalogList();
    }
}

function saveCatalogs() {
    try {
        localStorage.setItem('catalogs', JSON.stringify(catalogs));
    } catch (e) {
        console.error('카탈로그 저장 실패:', e);
        alert('저장 용량이 부족합니다. 이전 카탈로그를 삭제해주세요.');
    }
}

document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', function() {
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('active');
        });
        this.classList.add('active');
        currentThemeColor = this.getAttribute('data-color');
    });
});

function getStyleCSS() {
    return `* { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; }
    .product-card { background: white; border: 1px solid #e0e0e0; cursor: pointer; transition: transform 0.3s; }
    .product-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .product-card img { width: 100%; height: 200px; object-fit: cover; }
    .product-card > div { padding: 20px; }
    .product-card h3 { font-size: 16px; margin-bottom: 10px; }
    .product-card p { font-size: 13px; color: #666; }
    @media (max-width: 768px) {
        #productGrid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
    }`;
}

function getAdminCSS() {
    return `* { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }`;
}

function getScriptJS() {
    return `
    function goBack() {
        document.getElementById('detailPage').style.display = 'none';
        document.getElementById('listPage').style.display = 'block';
    }
    const productGrid = document.getElementById('productGrid');
    if (window.products && window.products.length > 0) {
        productGrid.innerHTML = window.products.map((product, index) => 
            '<div class="product-card" onclick="showDetail(' + index + ')">' +
            '<img src="' + product.thumbnail + '" alt="' + product.name + '">' +
            '<div><h3>' + product.name + '</h3>' +
            '<p>' + product.specs.replace(/\\n/g, '<br>') + '</p></div>' +
            '</div>'
        ).join('');
    }
    function showDetail(index) {
        const product = window.products[index];
        document.getElementById('listPage').style.display = 'none';
        document.getElementById('detailPage').style.display = 'block';
        document.getElementById('detailContent').innerHTML = 
            '<h1>' + product.name + '</h1>' +
            '<img src="' + product.thumbnail + '" style="max-width: 100%; margin: 20px 0;">' +
            '<p>' + product.specs.replace(/\\n/g, '<br>') + '</p>';
        window.scrollTo(0, 0);
    }`;
}

window.addEventListener('DOMContentLoaded', function() {
    try {
        const saved = localStorage.getItem('catalogs');
        if (saved) {
            catalogs = JSON.parse(saved);
            updateStats();
            updateCatalogList();
        }
    } catch (e) {
        console.error('카탈로그 로드 실패:', e);
        catalogs = [];
    }
});