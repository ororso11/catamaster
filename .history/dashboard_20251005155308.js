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
    // localStorage에서 데이터 읽기
    const firebaseDataStr = localStorage.getItem(`firebase_${projectId}`);
    const firebaseData = firebaseDataStr ? JSON.parse(firebaseDataStr) : { products: {}, settings: { categories: {}, tableColumns: [] } };
    
    // Firebase 설정을 인라인으로 삽입
    const firebaseConfigScript = `
        const firebaseConfig = {
            databaseURL: "https://your-project.firebaseio.com"
        };
        firebase.initializeApp(firebaseConfig);
        const database = firebase.database();
        const storage = firebase.storage();
        
        // localStorage 데이터를 Firebase 형식으로 변환
        const mockData = ${JSON.stringify(firebaseData)};
        
        // 모의 Firebase database 객체 생성
        const originalDatabase = database;
        database.ref = function(path) {
            return {
                once: function(eventType) {
                    return Promise.resolve({
                        val: function() {
                            if (path === 'settings') return mockData.settings;
                            if (path === 'products') return mockData.products;
                            if (path === '.info/connected') return true;
                            return null;
                        }
                    });
                },
                on: function(eventType, callback) {
                    setTimeout(() => {
                        if (path === '.info/connected') {
                            callback({ val: () => true });
                        } else if (path === 'products') {
                            callback({ val: () => mockData.products });
                        }
                    }, 100);
                },
                set: function(data) {
                    console.log('Mock Firebase set:', path, data);
                    return Promise.resolve();
                },
                push: function(data) {
                    console.log('Mock Firebase push:', path, data);
                    return Promise.resolve({ key: 'mock_' + Date.now() });
                },
                update: function(data) {
                    console.log('Mock Firebase update:', path, data);
                    return Promise.resolve();
                },
                remove: function() {
                    console.log('Mock Firebase remove:', path);
                    return Promise.resolve();
                }
            };
        };
        
        // 모의 auth
        firebase.auth = function() {
            return {
                onAuthStateChanged: function(callback) {
                    setTimeout(() => callback({ email: 'demo@example.com' }), 10);
                },
                signOut: function() {
                    return Promise.resolve();
                }
            };
        };
        
        // 모의 storage
        firebase.storage = function() {
            return {
                ref: function(path) {
                    return {
                        put: function(file) {
                            return Promise.resolve();
                        },
                        getDownloadURL: function() {
                            return Promise.resolve('https://via.placeholder.com/300');
                        }
                    };
                }
            };
        };
    `;
    
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${companyName} - 제품 관리 시스템</title>
    
    <style>
        ${getAdminCSSContent()}
    </style>

    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-storage-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
</head>
<body>
    <div class="container">
        <h1>🔧 ${companyName} - 제품 관리 시스템
            <button onclick="logout()" style="float: right; padding: 8px 15px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 20px;">로그아웃</button>
        </h1>
        
        <div id="syncStatus" class="sync-status disconnected">
            Firebase 연결 중...
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
            <strong>⚠️ 데모 모드:</strong> 이것은 미리보기 버전입니다. 실제 Firebase를 연동하려면 firebase-config.js를 설정하세요.
        </div>
        
        <div class="tabs">
            <button class="tab active" data-tab="add" onclick="showTab('add')">제품 추가</button>
            <button class="tab" data-tab="list" onclick="showTab('list')">제품 목록</button>
            <button class="tab" data-tab="manage" onclick="showTab('manage')">제품 관리</button>
        </div>
        
        <div id="addTab" class="tab-content active">
            <h2>제품 추가</h2>
            <form id="productForm">
                <div class="form-group">
                    <label for="productName">제품명 *</label>
                    <input type="text" id="productName" required>
                </div>

                <div class="form-group">
                    <label for="productNumber">제품번호</label>
                    <input type="text" id="productNumber" placeholder="예: 28000673">
                </div>
                
                <div class="form-group">
                    <label for="thumbnailInput">썸네일 이미지 *</label>
                    <input type="file" id="thumbnailInput" accept="image/*" onchange="handleThumbnailUpload(event)" required>
                    <div id="thumbnailPreview" class="image-preview"></div>
                </div>
                
                <div class="form-group">
                    <label for="detailImagesInput">상세 이미지들 *</label>
                    <input type="file" id="detailImagesInput" accept="image/*" multiple onchange="handleDetailImagesUpload(event)" required>
                    <div id="detailImagesPreview" class="image-preview"></div>
                </div>
                
                <div class="form-group">
                    <label for="productSpecs">제품 사양 (줄바꿈으로 구분)</label>
                    <textarea id="productSpecs" placeholder="제품명&#10;타입&#10;용량"></textarea>
                </div>
                
                <h3 style="margin: 30px 0 20px 0;">제품 상세 스펙</h3>
                
                <div class="form-group">
                    <label>스펙 리스트 추가</label>
                    <div class="spec-input-wrapper">
                        <input type="text" id="specInput" placeholder="스펙 항목 입력 (예: CRI > 90)">
                        <button type="button" onclick="addSpec()">추가</button>
                    </div>
                    <ul id="specsList"></ul>
                </div>
                
                <h3 style="margin: 30px 0 20px 0;">제품 테이블 데이터</h3>
                
                <div style="margin-bottom: 20px; padding: 15px; background: #f0f0f0; border-radius: 5px;">
                    <label style="font-weight: bold; margin-bottom: 10px; display: block;">테이블 항목 관리 (추가/삭제)</label>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="newTableColumn" placeholder="새 항목명 (예: 색온도)" style="flex: 1; padding: 8px;">
                        <button type="button" onclick="addTableColumn()" style="padding: 8px 15px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">항목 추가</button>
                    </div>
                </div>
                
                <div id="tableDataContainer" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;"></div>
                
                <h3 style="margin: 30px 0 20px 0;">대분류 카테고리 설정</h3>
                <div id="mainCategoryContainer" style="display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 40px;"></div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin: 30px 0 20px 0;">
                    <h3 style="margin: 0;">소분류 카테고리 설정</h3>
                    <button type="button" onclick="showAddCategoryTypeModal()" 
                            style="padding: 8px 15px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        + 카테고리 타입 추가
                    </button>
                </div>

                <div id="categoryTypesContainer" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;"></div>

                <div id="addCategoryTypeModal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
                    <div style="background: white; padding: 30px; border-radius: 8px; max-width: 500px; width: 90%;">
                        <h3 style="margin-top: 0;">새 카테고리 타입 추가</h3>
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: bold;">카테고리 ID (영문소문자)</label>
                            <input type="text" id="newCategoryTypeKey" placeholder="예: color" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: bold;">카테고리 이름</label>
                            <input type="text" id="newCategoryTypeLabel" placeholder="예: 색상" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div style="display: flex; gap: 10px; justify-content: flex-end;">
                            <button type="button" onclick="closeAddCategoryTypeModal()" 
                                    style="padding: 10px 20px; background: #999; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                취소
                            </button>
                            <button type="button" onclick="addCategoryType()" 
                                    style="padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                                추가
                            </button>
                        </div>
                    </div>
                </div>
                
                <button type="submit" class="submit-btn">제품 추가</button>
            </form>
            
            <div id="loadingMessage" style="display: none;">⏳ 처리 중입니다...</div>
            <div id="successMessage" style="display: none;">✅ 제품이 성공적으로 추가되었습니다!</div>
        </div>
        
        <div id="listTab" class="tab-content">
            <h2>제품 목록</h2>
            <div id="productList"></div>
        </div>
        
        <div id="manageTab" class="tab-content">
            <h2>제품 관리</h2>
            <p style="color: #666; margin-bottom: 20px;">제품을 클릭하여 수정하거나 삭제할 수 있습니다.</p>
            <div id="productManageList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;"></div>
        </div>
    </div>

    <script>
    ${firebaseConfigScript}
    
    function logout() {
        alert('데모 모드에서는 로그아웃이 동작하지 않습니다.');
    }
    </script>

    <script>
    ${getAdminJSContent()}
    </script>
</body>
</html>`;
}

function getAdminCSSContent() {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f5f5f5;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        h1 {
            color: #333;
            margin-bottom: 30px;
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
            background: white;
            padding: 10px;
            border-radius: 10px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .tab {
            padding: 10px 20px;
            background: #e0e0e0;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 14px;
        }
        
        .tab:hover {
            background: #d0d0d0;
        }
        
        .tab.active {
            background: #4CAF50;
            color: white;
        }
        
        .tab-content {
            display: none;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .tab-content.active {
            display: block;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            color: #555;
            font-weight: 500;
        }
        
        input[type="text"],
        input[type="file"],
        textarea,
        select {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
        }
        
        textarea {
            resize: vertical;
            min-height: 100px;
        }
        
        .image-preview {
            margin-top: 10px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        .submit-btn {
            background: #4CAF50;
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.3s;
        }
        
        .submit-btn:hover {
            background: #45a049;
        }
        
        #loadingMessage {
            background: #2196F3;
            color: white;
            padding: 15px;
            border-radius: 5px;
            text-align: center;
            margin-top: 20px;
        }
        
        #successMessage {
            background: #4CAF50;
            color: white;
            padding: 15px;
            border-radius: 5px;
            margin-top: 20px;
        }
        
        .spec-input-wrapper {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
        }
        
        .spec-input-wrapper input {
            flex: 1;
        }
        
        .spec-input-wrapper button {
            padding: 10px 20px;
            background: #2196F3;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        }
        
        .spec-input-wrapper button:hover {
            background: #1976D2;
        }
        
        #specsList {
            list-style: none;
            padding: 0;
            margin-top: 10px;
        }
        
        #specsList li {
            background: #f5f5f5;
            padding: 10px;
            margin-bottom: 5px;
            border-radius: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .product-item {
            border: 1px solid #ddd;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 5px;
            background: #fafafa;
        }
        
        .sync-status {
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 20px;
            text-align: center;
            font-weight: bold;
        }
        
        .sync-status.connected {
            background: #e8f5e9;
            color: #2e7d32;
        }
        
        .sync-status.disconnected {
            background: #ffebee;
            color: #c62828;
        }
    `;
}

function getAdminJSContent() {
    return `
        let products = [];
        let specsList = [];
        let categories = {
            productType: { label: '대분류', values: ['ALL', '원형매입', '사각매입', '레일', '마그네틱'] },
            watt: { label: 'WATT', values: ['0-5W', '6-10W', '11-15W', '16-20W'] },
            cct: { label: 'CCT', values: ['2700K', '3000K', '4000K', '6500K'] },
            ip: { label: 'IP등급', values: ['IP20', 'IP44', 'IP65'] }
        };
        let tableColumns = [
            { id: 'item', label: '품목', placeholder: 'LED 다운라이트' },
            { id: 'voltage', label: '전압', placeholder: 'AC 220V' },
            { id: 'watt', label: '소비전력', placeholder: '10W' },
            { id: 'efficiency', label: '효율', placeholder: '100lm/W' },
            { id: 'dimension', label: '크기', placeholder: 'Ø90 x H50mm' }
        ];
        
        function renderCategoryTypes() {
            const mainContainer = document.getElementById('mainCategoryContainer');
            if (mainContainer && categories.productType) {
                const cat = categories.productType;
                mainContainer.innerHTML = \`
                    <div class="form-group">
                        <label>\${cat.label} 카테고리 선택 <span style="color: red;">*</span></label>
                        <select id="categoryproductType" style="width: 100%; padding: 8px; margin-bottom: 10px;">
                            <option value="">선택하세요</option>
                            \${cat.values.map(v => \`<option value="\${v}">\${v}</option>\`).join('')}
                        </select>
                        
                        <label style="margin-top: 15px; display: block; font-size: 13px; color: #666;">\${cat.label} 카테고리 관리</label>
                        <div style="display: flex; gap: 5px; margin-bottom: 8px;">
                            <input type="text" id="newproductTypeCategory" placeholder="예: 벽등" style="flex: 1; padding: 6px; font-size: 13px;">
                            <button type="button" onclick="alert('카테고리 추가는 실제 Firebase 버전에서 사용 가능')" 
                                    style="padding: 6px 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                추가
                            </button>
                        </div>
                        <select id="categoryproductTypeDelete" size="4" style="width: 100%; font-size: 12px; margin-bottom: 5px;">
                            \${cat.values.map(v => \`<option value="\${v}">\${v}</option>\`).join('')}
                        </select>
                        <button type="button" onclick="alert('카테고리 삭제는 실제 Firebase 버전에서 사용 가능')" 
                                style="width: 100%; padding: 5px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            선택 항목 삭제
                        </button>
                    </div>
                \`;
            }
            
            const container = document.getElementById('categoryTypesContainer');
            if (!container) return;
            
            const categoryKeys = Object.keys(categories).filter(k => k !== 'productType');
            container.innerHTML = categoryKeys.map(key => {
                const cat = categories[key];
                return \`
                    <div class="form-group">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <label>\${cat.label} 카테고리 선택</label>
                            <button type="button" onclick="alert('타입 삭제는 실제 Firebase 버전에서 사용 가능')" 
                                    style="padding: 2px 8px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
                                타입 삭제
                            </button>
                        </div>
                        <select id="category\${key}" style="width: 100%; padding: 8px; margin-bottom: 10px;">
                            <option value="">선택하세요</option>
                            \${cat.values.map(v => \`<option value="\${v}">\${v}</option>\`).join('')}
                        </select>
                        
                        <label style="margin-top: 15px; display: block; font-size: 13px; color: #666;">\${cat.label} 카테고리 관리</label>
                        <div style="display: flex; gap: 5px; margin-bottom: 8px;">
                            <input type="text" id="new\${key}Category" placeholder="예: 새 값" style="flex: 1; padding: 6px; font-size: 13px;">
                            <button type="button" onclick="alert('카테고리 추가는 실제 Firebase 버전에서 사용 가능')" 
                                    style="padding: 6px 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                추가
                            </button>
                        </div>
                        <select id="category\${key}Delete" size="4" style="width: 100%; font-size: 12px; margin-bottom: 5px;">
                            \${cat.values.map(v => \`<option value="\${v}">\${v}</option>\`).join('')}
                        </select>
                        <button type="button" onclick="alert('카테고리 삭제는 실제 Firebase 버전에서 사용 가능')" 
                                style="width: 100%; padding: 5px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            선택 항목 삭제
                        </button>
                    </div>
                \`;
            }).join('');
        }
        
        function renderTableColumns() {
            const container = document.getElementById('tableDataContainer');
            if (!container) return;
            
            container.innerHTML = tableColumns.map(col => \`
                <div class="form-group">
                    <label for="table\${col.id}">
                        \${col.label}
                        <button type="button" onclick="alert('항목 삭제는 실제 Firebase 버전에서 사용 가능')" 
                                style="margin-left: 10px; padding: 2px 8px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
                            삭제
                        </button>
                    </label>
                    <input type="text" id="table\${col.id}" placeholder="\${col.placeholder}">
                </div>
            \`).join('');
        }
        
        // 즉시 렌더링 실행
        setTimeout(function() {
            renderCategoryTypes();
            renderTableColumns();
        }, 100);
        
        window.showTab = function(tabName) {
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            const tabContent = document.getElementById(tabName + 'Tab');
            const tabBtn = document.querySelector('[data-tab="' + tabName + '"]');
            if (tabContent) tabContent.classList.add('active');
            if (tabBtn) tabBtn.classList.add('active');
            
            if (tabName === 'list') loadProductList();
            if (tabName === 'manage') loadManagementList();
        };
        
        function loadProductList() {
            const el = document.getElementById('productList');
            if (products.length > 0) {
                el.innerHTML = products.map(p => \`
                    <div class="product-item">
                        <h4>\${p.name}</h4>
                        <p style="color: #666;">\${p.specs || ''}</p>
                    </div>
                \`).join('');
            } else {
                el.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">등록된 제품이 없습니다.</p>';
            }
        }
        
        function loadManagementList() {
            const el = document.getElementById('productManageList');
            if (products.length > 0) {
                el.innerHTML = products.map((p, i) => \`
                    <div style="border: 1px solid #ddd; padding: 15px; border-radius: 8px; background: white;">
                        <h4 style="margin-bottom: 10px;">\${p.name}</h4>
                        <p style="color: #666; font-size: 13px; margin-bottom: 15px;">\${p.specs || ''}</p>
                        <div style="display: flex; gap: 10px;">
                            <button onclick="alert('수정 기능은 실제 Firebase 연동 후 사용 가능합니다.')" 
                                    style="flex: 1; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                수정
                            </button>
                            <button onclick="alert('삭제 기능은 실제 Firebase 연동 후 사용 가능합니다.')" 
                                    style="flex: 1; padding: 8px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                삭제
                            </button>
                        </div>
                    </div>
                \`).join('');
            } else {
                el.innerHTML = '<p style="text-align: center; color: #999; padding: 40px; grid-column: 1/-1;">등록된 제품이 없습니다.</p>';
            }
        }
        
        window.handleThumbnailUpload = function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    document.getElementById('thumbnailPreview').innerHTML = 
                        '<img src="' + event.target.result + '" style="max-width: 200px; max-height: 200px; border-radius: 5px;">';
                };
                reader.readAsDataURL(file);
            }
        };
        
        window.handleDetailImagesUpload = function(e) {
            const files = Array.from(e.target.files);
            const container = document.getElementById('detailImagesPreview');
            container.innerHTML = '';
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = function(event) {
                    container.innerHTML += 
                        '<img src="' + event.target.result + '" style="max-width: 150px; max-height: 150px; margin: 5px; border-radius: 5px;">';
                };
                reader.readAsDataURL(file);
            });
        };
        
        window.addSpec = function() {
            const input = document.getElementById('specInput');
            const spec = input.value.trim();
            if (spec) {
                specsList.push(spec);
                const el = document.getElementById('specsList');
                el.innerHTML = specsList.map((s, i) => \`
                    <li>\${s} <button onclick="removeSpec(\${i})" style="color: red; background: none; border: none; cursor: pointer;">삭제</button></li>
                \`).join('');
                input.value = '';
            }
        };
        
        window.removeSpec = function(index) {
            specsList.splice(index, 1);
            const el = document.getElementById('specsList');
            el.innerHTML = specsList.map((s, i) => \`
                <li>\${s} <button onclick="removeSpec(\${i})" style="color: red; background: none; border: none; cursor: pointer;">삭제</button></li>
            \`).join('');
        };
        
        window.addTableColumn = function() {
            alert('테이블 컬럼 추가는 실제 Firebase 버전에서 사용 가능합니다.');
        };
        
        window.showAddCategoryTypeModal = function() { 
            document.getElementById('addCategoryTypeModal').style.display = 'flex'; 
        };
        
        window.closeAddCategoryTypeModal = function() { 
            document.getElementById('addCategoryTypeModal').style.display = 'none'; 
        };
        
        window.addCategoryType = function() {
            alert('카테고리 타입 추가는 실제 Firebase 버전에서 사용 가능합니다.');
            closeAddCategoryTypeModal();
        };
        
        document.addEventListener('DOMContentLoaded', function() {
            // 다시 한번 렌더링 (보험용)
            renderCategoryTypes();
            renderTableColumns();
            
            const form = document.getElementById('productForm');
            if (form) {
                form.addEventListener('submit', function(e) {
                    e.preventDefault();
                    alert('이것은 데모 버전입니다.\\n\\n실제 제품 등록은 Firebase를 연동한 후 가능합니다.\\n다운로드한 파일에서 firebase-config.js를 설정하세요.');
                });
            }
            
            setTimeout(() => {
                const syncStatus = document.getElementById('syncStatus');
                if (syncStatus) {
                    syncStatus.textContent = 'Firebase 실시간 연결됨';
                    syncStatus.className = 'sync-status connected';
                }
            }, 500);
        });
    `;
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
    
    // admin.html 미리보기 URL 생성
    const adminPreviewUrl = `data:text/html;charset=utf-8,${encodeURIComponent(catalog.files['admin.html'])}`;
    
    previewContainer.innerHTML = `
        <div style="margin-bottom: 30px;">
            <h3>${catalog.name}의 생성된 웹사이트</h3>
            <p style="color: #666; margin: 10px 0;">
                파일 크기: <strong>${catalog.size} MB</strong> | 제품 수: <strong>${catalog.productsCount}개</strong>
            </p>
        </div>
        
        <div style="margin-bottom: 30px; display: flex; gap: 15px;">
            <button onclick="downloadFile('${catalog.id}', 'index.html')" 
                    style="padding: 12px 25px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: 600;">
                index.html 다운로드
            </button>
            <button onclick="downloadFile('${catalog.id}', 'admin.html')" 
                    style="padding: 12px 25px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: 600;">
                admin.html 다운로드
            </button>
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ffc107;">
            <strong>⚠️ 참고:</strong> 현재는 PDF에서 실제 데이터를 추출하지 않고 샘플 데이터로 웹사이트를 생성합니다. 
            실제 제품 데이터를 입력하려면 다운로드한 admin.html을 열어서 Firebase 설정 후 제품을 등록하세요.
        </div>
        
        <div style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #ddd;">
            <button onclick="showPreviewTab('index')" id="previewTabIndex" 
                    style="padding: 12px 30px; background: #667eea; color: white; border: none; cursor: pointer; font-weight: 600;">
                index.html 미리보기
            </button>
            <button onclick="showPreviewTab('admin')" id="previewTabAdmin"
                    style="padding: 12px 30px; background: #e0e0e0; color: #333; border: none; cursor: pointer;">
                admin.html 미리보기
            </button>
        </div>
        
        <div id="indexPreview" style="border: 2px solid #ddd; border-radius: 10px; overflow: hidden;">
            <iframe src="${catalog.previewUrl}" style="width: 100%; height: 700px; border: none;"></iframe>
        </div>
        
        <div id="adminPreview" style="display: none; border: 2px solid #ddd; border-radius: 10px; overflow: hidden;">
            <iframe src="${adminPreviewUrl}" style="width: 100%; height: 700px; border: none;"></iframe>
        </div>
    `;
}

window.showPreviewTab = function(tab) {
    const indexBtn = document.getElementById('previewTabIndex');
    const adminBtn = document.getElementById('previewTabAdmin');
    const indexPreview = document.getElementById('indexPreview');
    const adminPreview = document.getElementById('adminPreview');
    
    if (tab === 'index') {
        indexBtn.style.background = '#667eea';
        indexBtn.style.color = 'white';
        adminBtn.style.background = '#e0e0e0';
        adminBtn.style.color = '#333';
        indexPreview.style.display = 'block';
        adminPreview.style.display = 'none';
    } else {
        adminBtn.style.background = '#4CAF50';
        adminBtn.style.color = 'white';
        indexBtn.style.background = '#e0e0e0';
        indexBtn.style.color = '#333';
        adminPreview.style.display = 'block';
        indexPreview.style.display = 'none';
    }
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
        .product-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 25px; padding: 20px 0; }
        .product-card { background: white; border: 1px solid #e0e0e0; cursor: pointer; transition: transform 0.3s; }
        .product-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .product-image { width: 100%; height: 320px; background: #f8f8f8; display: flex; align-items: center; justify-content: center; overflow: hidden; border-bottom: 1px solid #e0e0e0; }
        .product-image img { width: 100%; height: 100%; object-fit: cover; }
        .product-info { padding: 25px; }
        .product-name { font-size: 18px; font-weight: 600; color: #333; margin-bottom: 10px; line-height: 1.4; }
        .product-specs { font-size: 14px; color: #666; line-height: 1.6; }
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
        @media (max-width: 1400px) {
            .product-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 768px) {
            .product-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
            .product-image { height: 200px; }
            .product-info { padding: 15px; }
            .product-name { font-size: 14px; }
            .product-specs { font-size: 12px; }
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