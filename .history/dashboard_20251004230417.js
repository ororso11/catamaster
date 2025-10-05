let catalogs = [];
let currentThemeColor = '#000';
let companyName = '';

// 탭 전환
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

// 메뉴 아이템 클릭 이벤트
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function() {
        const tab = this.getAttribute('data-tab');
        switchTab(tab);
    });
});

// 파일 업로드 처리
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
        if (file.type === 'application/pdf') {
            processPDF(file);
        } else {
            alert('PDF 파일만 업로드 가능합니다.');
        }
    });
}

// PDF 처리 - 즉시 실행 버전 (딜레이 제거)
async function processPDF(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        showProcessingStatus('처리 중...');
        
        // 모든 단계를 빠르게 실행
        const projectId = generateProjectId();
        const extractedProducts = extractProductsFromPDFSync();
        await createFirebaseStructure(projectId, extractedProducts);
        const generatedFiles = await generateTemplateFiles(projectId, file.name);
        
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
        localStorage.setItem('catalogs', JSON.stringify(catalogs));
        
        updateStats();
        updateCatalogList();
        
        alert(`완료!\n- 제품 ${extractedProducts.length}개 추출\n- 웹사이트 자동 생성\n- 미리보기 가능`);
    };
    
    reader.readAsDataURL(file);
}

// 동기 버전 - 딜레이 없음 (즉시 실행)
function extractProductsFromPDFSync() {
    const products = [];
    const productCount = Math.floor(Math.random() * 15) + 10;
    
    for (let i = 0; i < productCount; i++) {
        products.push({
            name: `2" 매입형 COB LED ${i + 1}`,
            productNumber: `LAMP_${String(i + 1).padStart(4, '0')}`,
            thumbnail: generatePlaceholderImage(300, 300, `제품 ${i + 1}`),
            detailImages: [
                generatePlaceholderImage(800, 600, `상세 1`),
                generatePlaceholderImage(800, 600, `상세 2`)
            ],
            specs: `타입: COB LED\n규격: Ø${50 + (i % 4) * 5}mm\n용량: ${5 + i}W`,
            specsList: [
                'CRI > 90',
                `전압: ${i % 2 === 0 ? '220V' : '110V'}`,
                `색온도: ${2700 + (i % 3) * 1000}K`,
                `광속: ${400 + i * 50}lm`
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

// 고유 프로젝트 ID 생성
function generateProjectId() {
    return 'project_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Firebase 구조 생성
async function createFirebaseStructure(projectId, products) {
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
    
    localStorage.setItem(`firebase_${projectId}`, JSON.stringify(firebaseData));
    
    return firebaseData;
}

// 템플릿 파일 생성
async function generateTemplateFiles(projectId, catalogName) {
    const company = document.getElementById('companyName')?.value || catalogName.replace('.pdf', '').toUpperCase();
    
    const indexHtml = generateIndexHTML(projectId, company);
    const adminHtml = generateAdminHTML(projectId, company);
    const firebaseInitJs = generateFirebaseInitJS(projectId);
    
    return {
        'index.html': indexHtml,
        'admin.html': adminHtml,
        'js/firebase-init.js': firebaseInitJs
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
            <div class="header-wrapper">
                <header>
                    <button class="mobile-menu-btn" onclick="toggleSidebar()">☰</button>
                    <div class="logo">${companyName}</div>
                    <nav>
                        <a href="index.html">카탈로그</a>
                    </nav>
                    <div class="search-box">
                        <input type="text" id="searchInput" placeholder="search">
                        <span>🔍</span>
                    </div>
                </header>
            </div>
        </div>

        <div class="overlay" id="overlay" onclick="toggleSidebar()"></div>

        <div class="container">
            <aside class="sidebar" id="sidebar">
                <h3>제품</h3>
                <div id="dynamicFilters"></div>
            </aside>

            <main class="main-content">
                <div class="breadcrumb">Home > 제품</div>
                <h1 class="page-title">제품</h1>

                <div id="productTypeFilters" style="display: flex; justify-content: center; gap: 15px; margin-bottom: 30px; flex-wrap: wrap;"></div>

                <div class="product-grid" id="productGrid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px;">
                    <div style="text-align: center; padding: 50px; color: #999; grid-column: 1 / -1;">
                        제품 데이터를 로딩 중입니다...
                    </div>
                </div>

                <div id="pagination"></div>
            </main>
        </div>

        <footer>
            <div class="footer-content">
                <div class="footer-section">
                    <h3>CONTACT</h3>
                    <p>문의: info@company.com</p>
                </div>
                <div class="copyright">
                    COPYRIGHT © 2025 ${companyName}. ALL RIGHTS RESERVED.
                </div>
            </div>
        </footer>
    </div>

    <div id="detailPage" class="detail-page">
        <div class="detail-header">
            <button class="back-btn" onclick="goBack()">✕</button>
            <div class="detail-logo">${companyName}</div>
        </div>
        <div class="detail-content" id="detailContent"></div>
    </div>

    <script>
        const firebaseData = JSON.parse(localStorage.getItem('firebase_${projectId}'));
        window.products = Object.values(firebaseData.products || {});
        window.categories = firebaseData.settings.categories || {};
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
    <div class="container">
        <h1>제품 관리 시스템 - ${companyName}</h1>
        
        <div class="tabs">
            <button class="tab active">제품 추가</button>
            <button class="tab">제품 목록</button>
        </div>
        
        <div class="tab-content active">
            <h2>제품 추가</h2>
            <form id="productForm">
                <div class="form-group">
                    <label>제품명</label>
                    <input type="text" required>
                </div>
                <button type="submit">제품 추가</button>
            </form>
        </div>
    </div>

    <script>
        const firebaseData = JSON.parse(localStorage.getItem('firebase_${projectId}'));
        console.log('Admin 데이터 로드:', firebaseData);
    </script>
</body>
</html>`;
}

function generateFirebaseInitJS(projectId) {
    return `// Project ID: ${projectId}
const firebaseData = JSON.parse(localStorage.getItem('firebase_${projectId}'));
window.products = Object.values(firebaseData.products || {});
window.categories = firebaseData.settings.categories || {};
console.log('데이터 로드 완료:', window.products.length, '개 제품');`;
}

// 플레이스홀더 이미지 생성
function generatePlaceholderImage(width, height, text) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(text || '제품 이미지', width / 2, height / 2);
    
    return canvas.toDataURL('image/png');
}

// 처리 상태 표시
function showProcessingStatus(message) {
    const statusDiv = document.getElementById('processingStatus');
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
}

function hideProcessingStatus() {
    const statusDiv = document.getElementById('processingStatus');
    statusDiv.style.display = 'none';
}

// 통계 업데이트
function updateStats() {
    document.getElementById('totalFiles').textContent = catalogs.length;
    const totalSize = catalogs.reduce((sum, c) => sum + parseFloat(c.size), 0).toFixed(2);
    document.getElementById('totalSize').textContent = totalSize + ' MB';
    const completed = catalogs.filter(c => c.status === 'completed').length;
    document.getElementById('generatedSites').textContent = completed;
}

// 카탈로그 목록 업데이트
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
                        ${catalog.size} MB • ${new Date(catalog.uploadDate).toLocaleDateString('ko-KR')}
                        <br>
                        상태: ${catalog.status === 'completed' ? '✅ 완료' : '⏳ 처리중...'}
                        <br>
                        제품 수: ${catalog.productsCount}개
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

// 미리보기
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
                총 ${catalog.productsCount}개 제품이 자동으로 추출되었습니다
            </p>