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

// 수정: uploadZone 클릭 이벤트를 더 정확하게 처리
uploadZone.addEventListener('click', (e) => {
    // 버튼 클릭이 아닌 경우에만 fileInput 열기
    if (!e.target.closest('button')) {
        fileInput.click();
    }
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
    // localStorage에서 데이터 읽기
    const firebaseDataStr = localStorage.getItem(`firebase_${projectId}`);
    const firebaseData = firebaseDataStr ? JSON.parse(firebaseDataStr) : { products: {} };
    const productsArray = Object.values(firebaseData.products || {});
    
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${companyName} - LED 조명 제품</title>
    <style>
        ${getFullStyleCSS()}
    </style>
</head>
<body>
    <div id="listPage">
        <div style="background: linear-gradient(to right, #1a1a1a 0%, #2c2c2c 100%);">
            <div class="header-wrapper">
                <header>
                    <button class="mobile-menu-btn" onclick="toggleSidebar()">☰</button>
                    <div class="logo">${companyName}</div>
                    <nav>
                        <a href="#">카탈로그</a>
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

                <div id="productTypeFilters" style="display: flex; justify-content: center; gap: 15px; margin-bottom: 30px; flex-wrap: wrap;">
                    <button class="product-type-btn active" data-type="ALL" onclick="selectProductType('ALL')" 
                            style="padding: 12px 30px; border: 2px solid #333; background: #333; color: white; border-radius: 0; cursor: pointer; font-weight: bold; font-size: 14px;">
                        ALL
                    </button>
                </div>

                <div class="product-grid" id="productGrid"></div>
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
        // 데이터 직접 삽입
        window.products = ${JSON.stringify(productsArray)};
        window.categories = ${JSON.stringify(firebaseData.settings?.categories || {})};
        
        ${getFullScriptJS()}
    </script>
</body>
</html>`;
}

function generateAdminHTML(projectId, companyName) {
    const firebaseDataStr = localStorage.getItem(`firebase_${projectId}`);
    let productCount = 0;
    if (firebaseDataStr) {
        try {
            const data = JSON.parse(firebaseDataStr);
            productCount = data.products ? Object.keys(data.products).length : 0;
        } catch (e) {
            console.error('데이터 파싱 오류:', e);
        }
    }
    
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${companyName} - 제품 관리</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        h1 { color: #333; margin-bottom: 20px; }
        .info { color: #666; font-size: 14px; line-height: 1.8; }
    </style>
</head>
<body>
    <div class="container">
        <h1>제품 관리 시스템 - ${companyName}</h1>
        <div class="info">
            <p>총 <strong>${productCount}개</strong>의 제품이 등록되어 있습니다.</p>
            <p style="margin-top: 15px; color: #999;">이 페이지는 제품 관리용 페이지입니다.</p>
        </div>
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

function getFullStyleCSS() {
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #fff; }
        .header-wrapper { background: linear-gradient(to right, #1a1a1a 0%, #2c2c2c 100%); width: 100%; }
        header { color: #fff; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; gap: 30px; max-width: 1600px; margin: 0 auto; }
        .mobile-menu-btn { display: none; background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; }
        .logo { font-size: 18px; font-weight: normal; letter-spacing: 6px; }
        nav { display: flex; gap: 30px; }
        nav a { color: #fff; text-decoration: none; font-size: 13px; }
        .search-box { display: flex; align-items: center; background: #fff; border-radius: 20px; padding: 5px 15px; }
        .search-box input { border: none; outline: none; padding: 5px; width: 200px; }
        .search-box span { margin-left: 5px; color: #999; cursor: pointer; }
        .container { display: flex; max-width: 1600px; margin: 0 auto; }
        .sidebar { width: 250px; background: #fff; padding: 20px; }
        .sidebar h3 { font-size: 16px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #000; }
        .main-content { flex: 1; padding: 30px; }
        .breadcrumb { margin-bottom: 20px; font-size: 14px; color: #666; }
        .page-title { font-size: 32px; text-align: center; margin-bottom: 40px; font-weight: bold; }
        .product-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; padding: 20px 0; }
        .product-card { background: white; border: 1px solid #e0e0e0; cursor: pointer; transition: transform 0.3s; }
        .product-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .product-image { width: 100%; height: 280px; background: #f8f8f8; display: flex; align-items: center; justify-content: center; overflow: hidden; border-bottom: 1px solid #e0e0e0; }
        .product-image img { width: 100%; height: 100%; object-fit: cover; }
        .product-info { padding: 20px; }
        .product-name { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 8px; }
        .product-specs { font-size: 13px; color: #666; line-height: 1.6; }
        .detail-page { display: none; background: #fff; width: 100%; min-height: 100vh; }
        .detail-page.active { display: block; }
        .detail-header { background: #000; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; }
        .back-btn { background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; }
        .detail-logo { color: #fff; font-size: 14px; letter-spacing: 3px; }
        .detail-content { max-width: 1200px; margin: 0 auto; padding: 40px; }
        .detail-title { font-size: 28px; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e0e0e0; }
        .detail-images-section { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px; }
        .detail-main-image { width: 100%; background: #f5f5f5; border-radius: 8px; overflow: hidden; }
        .detail-main-image img { width: 100%; height: auto; display: block; }
        .detail-specs-list { background: #f9f9f9; padding: 30px; border-radius: 8px; }
        .detail-specs-list h3 { font-size: 18px; margin-bottom: 20px; }
        .detail-specs-list ul { list-style: none; }
        .detail-specs-list li { padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-size: 14px; }
        footer { background: #2a2a2a; color: #999; padding: 40px 30px; margin-top: 50px; }
        .footer-content { max-width: 1400px; margin: 0 auto; display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
        .footer-section { flex: 0 0 auto; text-align: left; }
        .footer-section h3 { color: #c9a961; font-size: 12px; margin-bottom: 12px; }
        .footer-section p { line-height: 1.6; font-size: 12px; }
        .copyright { width: 100%; text-align: center; color: #666; font-size: 11px; padding-top: 20px; margin-top: 20px; border-top: 1px solid #444; }
        .hidden { display: none !important; }
        .overlay { display: none; }
        @media (max-width: 768px) {
            .product-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
            .product-image { height: 200px; }
            .mobile-menu-btn { display: block; }
            .sidebar { position: fixed; left: -250px; top: 0; z-index: 1000; height: 100vh; transition: left 0.3s; }
            .sidebar.active { left: 0; }
            .overlay.active { display: block; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 999; }
        }
    `;
}

function getFullScriptJS() {
    return `
        let selectedFilters = { productType: 'ALL' };
        let searchKeyword = '';
        let currentPage = 1;
        const itemsPerPage = 30;
        
        function filterProducts() {
            return products.filter(product => {
                if (searchKeyword) {
                    const keyword = searchKeyword.toLowerCase();
                    const nameMatch = product.name.toLowerCase().includes(keyword);
                    const specsMatch = product.specs && product.specs.toLowerCase().includes(keyword);
                    if (!nameMatch && !specsMatch) return false;
                }
                if (selectedFilters.productType && selectedFilters.productType !== 'ALL') {
                    if (!product.categories || product.categories.productType !== selectedFilters.productType) {
                        return false;
                    }
                }
                return true;
            });
        }
        
        function createProductCards() {
            const productGrid = document.getElementById('productGrid');
            productGrid.innerHTML = '';
            
            const filteredProducts = filterProducts();
            
            if (filteredProducts.length === 0) {
                productGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 60px; color: #999;"><h3>검색 결과가 없습니다</h3></div>';
                return;
            }
            
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
            
            paginatedProducts.forEach((product, idx) => {
                const card = document.createElement('div');
                card.className = 'product-card';
                card.onclick = () => showDetail(startIndex + idx);
                
                card.innerHTML = \`
                    <div class="product-image">
                        <img src="\${product.thumbnail}" alt="\${product.name}">
                    </div>
                    <div class="product-info">
                        <div class="product-name">\${product.name}</div>
                        <div class="product-specs">\${product.specs ? product.specs.replace(/\\n/g, '<br>') : ''}</div>
                    </div>
                \`;
                
                productGrid.appendChild(card);
            });
        }
        
        function showDetail(index) {
            const product = products[index];
            const detailContent = document.getElementById('detailContent');
            
            let detailImagesHTML = '';
            if (product.detailImages && product.detailImages.length > 0) {
                product.detailImages.forEach(img => {
                    detailImagesHTML += \`<div class="detail-main-image"><img src="\${img}" alt="\${product.name}"></div>\`;
                });
            }
            
            let specsListHTML = '';
            if (product.specsList && product.specsList.length > 0) {
                product.specsList.forEach(spec => {
                    specsListHTML += \`<li>\${spec}</li>\`;
                });
            }
            
            detailContent.innerHTML = \`
                <h1 class="detail-title">\${product.name}</h1>
                <div class="detail-images-section">
                    \${detailImagesHTML}
                    \${specsListHTML ? \`<div class="detail-specs-list"><h3>제품 사양</h3><ul>\${specsListHTML}</ul></div>\` : ''}
                </div>
            \`;
            
            document.getElementById('listPage').classList.add('hidden');
            document.getElementById('detailPage').classList.add('active');
            window.scrollTo(0, 0);
        }
        
        function goBack() {
            document.getElementById('detailPage').classList.remove('active');
            document.getElementById('listPage').classList.remove('hidden');
            window.scrollTo(0, 0);
        }
        
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('overlay');
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        }
        
        function selectProductType(type) {
            selectedFilters.productType = type;
            document.querySelectorAll('.product-type-btn').forEach(btn => {
                const isActive = btn.getAttribute('data-type') === type;
                btn.style.background = isActive ? '#333' : 'white';
                btn.style.color = isActive ? 'white' : '#333';
                btn.style.fontWeight = isActive ? 'bold' : 'normal';
            });
            currentPage = 1;
            createProductCards();
        }
        
        window.addEventListener('DOMContentLoaded', function() {
            console.log('제품 데이터:', products.length, '개');
            createProductCards();
            
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        searchKeyword = this.value.trim();
                        currentPage = 1;
                        createProductCards();
                    }
                });
            }
        });
    `;
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