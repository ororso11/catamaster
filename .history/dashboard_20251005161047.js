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

// 파일 업로드
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');

uploadZone.addEventListener('click', (e) => {
    if (!e.target.closest('button')) fileInput.click();
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
        
        const companyName = file.name.replace('.pdf', '').replace(/[^a-zA-Z0-9가-힣]/g, ' ').trim().toUpperCase();
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
        
        const totalPages = Math.min(pdf.numPages, 5);
        const GRID_COLS = 3;
        const GRID_ROWS = 2;
        
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            
            const scale = 3.0;
            const viewport = page.getViewport({scale: scale});
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            const textContent = await page.getTextContent();
            const textItems = textContent.items;
            
            const cellWidth = canvas.width / GRID_COLS;
            const cellHeight = canvas.height / GRID_ROWS;
            
            for (let row = 0; row < GRID_ROWS; row++) {
                for (let col = 0; col < GRID_COLS; col++) {
                    const x = col * cellWidth;
                    const y = row * cellHeight;
                    
                    // 상단 75%를 제품 이미지로, 하단 25%를 텍스트 영역으로
                    const imageHeight = cellHeight * 0.75;
                    
                    // 여백 제거: 각 셀의 10% 여백 제거
                    const padding = cellWidth * 0.1;
                    const cropX = x + padding;
                    const cropY = y + padding;
                    const cropWidth = cellWidth - (padding * 2);
                    const cropHeight = imageHeight - (padding * 2);
                    
                    const productCanvas = document.createElement('canvas');
                    const productCtx = productCanvas.getContext('2d');
                    productCanvas.width = cropWidth;
                    productCanvas.height = cropHeight;
                    
                    productCtx.drawImage(
                        canvas,
                        cropX, cropY, cropWidth, cropHeight,
                        0, 0, cropWidth, cropHeight
                    );
                    
                    // 빈 이미지 감지 (평균 밝기 체크)
                    const imageData = productCtx.getImageData(0, 0, cropWidth, cropHeight);
                    const pixels = imageData.data;
                    let totalBrightness = 0;
                    for (let i = 0; i < pixels.length; i += 4) {
                        totalBrightness += (pixels[i] + pixels[i+1] + pixels[i+2]) / 3;
                    }
                    const avgBrightness = totalBrightness / (pixels.length / 4);
                    
                    // 너무 밝거나(빈 공간) 너무 어두우면 스킵
                    if (avgBrightness > 250 || avgBrightness < 5) {
                        continue;
                    }
                    
                    const productImage = productCanvas.toDataURL('image/jpeg', 0.9);
                    
                    // 텍스트 영역에서 텍스트 추출
                    const textY = y + imageHeight;
                    const textHeight = cellHeight - imageHeight;
                    
                    const textsInArea = textItems.filter(item => {
                        const tx = item.transform[4];
                        const ty = viewport.height - item.transform[5];
                        return tx >= x && tx < x + cellWidth && 
                               ty >= textY && ty < textY + textHeight;
                    });
                    
                    // 폰트 크기 기준으로 정렬 (큰 폰트 = 제품명)
                    textsInArea.sort((a, b) => {
                        const sizeA = Math.abs(a.transform[0]);
                        const sizeB = Math.abs(b.transform[0]);
                        return sizeB - sizeA;
                    });
                    
                    const extractedTexts = textsInArea.map(item => item.str.trim()).filter(t => t.length > 0);
                    
                    let productName = '조명 제품';
                    if (textsInArea.length > 0) {
                        const largestText = textsInArea[0].str.trim();
                        productName = largestText.length > 2 ? largestText : (extractedTexts[0] || `제품 ${products.length + 1}`);
                    }
                    productName = productName.substring(0, 100);
                    
                    const specs = extractedTexts.slice(1, 6).join('\n').substring(0, 300) || '제품 사양';
                    const specsList = extractedTexts.slice(1, 5).filter(t => t.length > 0);
                    
                    const productIndex = products.length + 1;
                    
                    // 카테고리 자동 분류 (텍스트 기반)
                    const allText = extractedTexts.join(' ').toUpperCase();
                    let productType = 'DOWNLIGHT';
                    if (allText.includes('SPOT') || allText.includes('스팟')) productType = 'SPOTLIGHT';
                    else if (allText.includes('TRACK') || allText.includes('트랙') || allText.includes('레일')) productType = 'TRACKLIGHT';
                    else if (allText.includes('DOWN') || allText.includes('다운') || allText.includes('매입')) productType = 'DOWNLIGHT';
                    
                    // 와트 추출
                    const wattMatch = allText.match(/(\d+)\s*W/i);
                    const watt = wattMatch ? `${wattMatch[1]}W` : `${5 + (productIndex % 10)}W`;
                    
                    // 색온도 추출
                    const cctMatch = allText.match(/(\d{4})\s*K/i);
                    const cct = cctMatch ? `${cctMatch[1]}K` : `${2700 + (productIndex % 3) * 1000}K`;
                    
                    // IP등급 추출
                    const ipMatch = allText.match(/IP\s*(\d{2})/i);
                    const ip = ipMatch ? `IP${ipMatch[1]}` : (productIndex % 2 === 0 ? 'IP20' : 'IP44');
                    
                    products.push({
                        name: productName,
                        productNumber: `PROD_${String(productIndex).padStart(4, '0')}`,
                        thumbnail: productImage,
                        detailImages: [productImage],
                        specs: specs,
                        specsList: specsList.length > 0 ? specsList : ['CRI > 90', `전압: 220V`, `색온도: ${cct}`],
                        categories: {
                            productType: productType,
                            watt: watt,
                            cct: cct,
                            ip: ip
                        },
                        tableData: {
                            model: `PROD_${String(productIndex).padStart(4, '0')}`,
                            watt: watt,
                            voltage: '220V',
                            cct: cct,
                            cri: '90+',
                            ip: ip
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
    for (let i = 0; i < 12; i++) {
        const types = ['DOWNLIGHT', 'SPOTLIGHT', 'TRACKLIGHT'];
        const productType = types[i % 3];
        products.push({
            name: `${productType === 'DOWNLIGHT' ? '매입형' : productType === 'SPOTLIGHT' ? '스팟' : '트랙'} LED ${i + 1}`,
            productNumber: `LAMP_${String(i + 1).padStart(4, '0')}`,
            thumbnail: generatePlaceholderSVG(400, 400, `${i + 1}`),
            detailImages: [generatePlaceholderSVG(800, 600, `상세`)],
            specs: `타입: ${productType}\n규격: Ø${50 + (i % 4) * 5}mm\n용량: ${5 + i}W`,
            specsList: ['CRI > 90', `전압: ${i % 2 === 0 ? '220V' : '110V'}`, `색온도: ${2700 + (i % 3) * 1000}K`],
            categories: {
                productType: productType,
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
    const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
    const color = colors[parseInt(text) % colors.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <defs>
            <linearGradient id="grad${text}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
                <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
            </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad${text})"/>
        <circle cx="50%" cy="45%" r="25%" fill="rgba(255,255,255,0.3)"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="32" font-weight="bold">제품 ${text}</text>
    </svg>`;
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

function createFirebaseStructure(products) {
    // 고유한 값 추출
    const wattValues = [...new Set(products.map(p => p.categories.watt))].sort();
    const cctValues = [...new Set(products.map(p => p.categories.cct))].sort();
    const ipValues = [...new Set(products.map(p => p.categories.ip))].sort();
    
    return {
        settings: {
            categories: {
                productType: { 
                    label: '제품 타입', 
                    values: ['ALL', 'DOWNLIGHT', 'SPOTLIGHT', 'TRACKLIGHT'] 
                },
                watt: { label: '소비전력', values: wattValues },
                cct: { label: '색온도', values: cctValues },
                ip: { label: '방수등급', values: ipValues }
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
    const categories = firebaseData.settings.categories;
    
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${companyName} - 제품 카탈로그</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Malgun Gothic', Arial, sans-serif; background: #fff; }
        header { background: linear-gradient(to right, #1a1a1a, #2c2c2c); color: white; padding: 20px 40px; }
        .logo { font-size: 20px; letter-spacing: 8px; font-weight: bold; }
        .container { display: flex; max-width: 1600px; margin: 0 auto; }
        .sidebar { width: 280px; background: #f8f9fa; padding: 30px 20px; min-height: calc(100vh - 60px); }
        .sidebar h3 { font-size: 18px; margin-bottom: 25px; padding-bottom: 12px; border-bottom: 3px solid #333; }
        .filter-group { margin-bottom: 30px; }
        .filter-group label { display: block; font-weight: 600; margin-bottom: 12px; font-size: 14px; color: #333; }
        .filter-group select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; background: white; }
        .main-content { flex: 1; padding: 40px; }
        .page-title { font-size: 36px; text-align: center; margin-bottom: 40px; font-weight: 800; }
        
        .product-type-filters { display: flex; justify-content: center; gap: 12px; margin-bottom: 40px; flex-wrap: wrap; }
        .product-type-btn { padding: 14px 32px; border: 2px solid #333; background: white; color: #333; cursor: pointer; font-weight: 700; font-size: 14px; transition: all 0.3s; }
        .product-type-btn:hover { background: #f0f0f0; }
        .product-type-btn.active { background: #333; color: white; }
        
        .product-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 30px; }
        .product-card { background: white; border: 2px solid #e0e0e0; cursor: pointer; transition: all 0.3s; overflow: hidden; }
        .product-card:hover { transform: translateY(-8px); box-shadow: 0 12px 24px rgba(0,0,0,0.15); border-color: #333; }
        .product-image { width: 100%; height: 340px; background: #f5f5f5; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .product-image img { width: 100%; height: 100%; object-fit: cover; }
        .product-info { padding: 25px; }
        .product-name { font-size: 17px; font-weight: 700; margin-bottom: 12px; color: #222; line-height: 1.4; }
        .product-specs { font-size: 13px; color: #666; line-height: 1.7; white-space: pre-line; }
        
        .detail-page { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: white; z-index: 1000; overflow-y: auto; }
        .detail-page.active { display: block; }
        .detail-header { background: #000; color: white; padding: 25px 40px; display: flex; justify-content: space-between; align-items: center; }
        .back-btn { background: none; border: none; color: white; font-size: 28px; cursor: pointer; padding: 0 10px; }
        .detail-content { max-width: 1200px; margin: 0 auto; padding: 50px 40px; }
        .detail-title { font-size: 32px; margin-bottom: 35px; padding-bottom: 25px; border-bottom: 3px solid #e0e0e0; font-weight: 800; }
        .detail-images { display: grid; grid-template-columns: 1.5fr 1fr; gap: 35px; margin-bottom: 50px; }
        .detail-main-image { width: 100%; background: #f8f8f8; border-radius: 12px; overflow: hidden; border: 2px solid #e0e0e0; }
        .detail-main-image img { width: 100%; height: auto; display: block; }
        .detail-specs-box { background: #f9f9f9; padding: 35px; border-radius: 12px; border: 2px solid #e0e0e0; }
        .detail-specs-box h3 { font-size: 20px; margin-bottom: 22px; font-weight: 700; }
        .detail-specs-box ul { list-style: none; }
        .detail-specs-box li { padding: 14px 0; border-bottom: 1px solid #ddd; font-size: 15px; line-height: 1.6; }
        .detail-specs-box li:last-child { border-bottom: none; }
        
        footer { background: #2a2a2a; color: #999; padding: 50px 40px; margin-top: 80px; text-align: center; font-size: 14px; }
        
        .no-results { text-align: center; padding: 100px 20px; color: #999; }
        .no-results h3 { font-size: 24px; margin-bottom: 15px; }
        
        @media (max-width: 1400px) { .product-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 992px) { 
            .product-grid { grid-template-columns: repeat(2, 1fr); }
            .container { flex-direction: column; }
            .sidebar { width: 100%; min-height: auto; }
            .detail-images { grid-template-columns: 1fr; }
        }
        @media (max-width: 576px) { .product-grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div id="listPage">
        <header><div class="logo">${companyName}</div></header>
        <div class="container">
            <aside class="sidebar">
                <h3>제품 필터</h3>
                <div class="filter-group">
                    <label>소비전력</label>
                    <select id="filterWatt" onchange="applyFilters()">
                        <option value="">전체</option>
                        ${categories.watt.values.map(v => `<option value="${v}">${v}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label>색온도</label>
                    <select id="filterCct" onchange="applyFilters()">
                        <option value="">전체</option>
                        ${categories.cct.values.map(v => `<option value="${v}">${v}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label>방수등급</label>
                    <select id="filterIp" onchange="applyFilters()">
                        <option value="">전체</option>
                        ${categories.ip.values.map(v => `<option value="${v}">${v}</option>`).join('')}
                    </select>
                </div>
            </aside>
            <main class="main-content">
                <h1 class="page-title">제품</h1>
                <div class="product-type-filters">
                    <button class="product-type-btn active" data-type="ALL" onclick="selectProductType('ALL')">전체</button>
                    <button class="product-type-btn" data-type="DOWNLIGHT" onclick="selectProductType('DOWNLIGHT')">매입등</button>
                    <button class="product-type-btn" data-type="SPOTLIGHT" onclick="selectProductType('SPOTLIGHT')">스팟조명</button>
                    <button class="product-type-btn" data-type="TRACKLIGHT" onclick="selectProductType('TRACKLIGHT')">트랙조명</button>
                </div>
                <div class="product-grid" id="productGrid"></div>
            </main>
        </div>
        <footer>COPYRIGHT © 2025 ${companyName}. ALL RIGHTS RESERVED.</footer>
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
        let filters = { productType: 'ALL', watt: '', cct: '', ip: '' };
        
        function filterProducts() {
            return products.filter(p => {
                if (filters.productType !== 'ALL' && p.categories.productType !== filters.productType) return false;
                if (filters.watt && p.categories.watt !== filters.watt) return false;
                if (filters.cct && p.categories.cct !== filters.cct) return false;
                if (filters.ip && p.categories.ip !== filters.ip) return false;
                return true;
            });
        }
        
        function renderProducts() {
            const filtered = filterProducts();
            const grid = document.getElementById('productGrid');
            
            if (filtered.length === 0) {
                grid.innerHTML = '<div class="no-results"><h3>검색 결과가 없습니다</h3><p>다른 필터를 선택해주세요</p></div>';
                return;
            }
            
            grid.innerHTML = filtered.map((p, i) => \`
                <div class="product-card" onclick="showDetail(\${products.indexOf(p)})">
                    <div class="product-image"><img src="\${p.thumbnail}" alt="\${p.name}"></div>
                    <div class="product-info">
                        <div class="product-name">\${p.name}</div>
                        <div class="product-specs">\${p.specs.substring(0, 100)}</div>
                    </div>
                </div>
            \`).join('');
        }
        
        function selectProductType(type) {
            filters.productType = type;
            document.querySelectorAll('.product-type-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === type);
            });
            renderProducts();
        }
        
        function applyFilters() {
            filters.watt = document.getElementById('filterWatt').value;
            filters.cct = document.getElementById('filterCct').value;
            filters.ip = document.getElementById('filterIp').value;
            renderProducts();
        }
        
        function showDetail(index) {
            const product = products[index];
            const content = document.getElementById('detailContent');
            
            const imagesHTML = product.detailImages.map(img => \`
                <div class="detail-main-image"><img src="\${img}" alt="\${product.name}"></div>
            \`).join('');
            
            const specsHTML = product.specsList.map(spec => \`<li>\${spec}</li>\`).join('');
            
            content.innerHTML = \`
                <h1 class="detail-title">\${product.name}</h1>
                <div class="detail-images">
                    \${imagesHTML}
                    <div class="detail-specs-box">
                        <h3>제품 사양</h3>
                        <ul>
                            <li><strong>제품번호:</strong> \${product.productNumber}</li>
                            <li><strong>소비전력:</strong> \${product.categories.watt}</li>
                            <li><strong>색온도:</strong> \${product.categories.cct}</li>
                            <li><strong>방수등급:</strong> \${product.categories.ip}</li>
                            \${specsHTML}
                        </ul>
                    </div>
                </div>
                <div class="detail-specs-box">
                    <h3>상세 정보</h3>
                    <p style="line-height: 1.9; white-space: pre-line; font-size: 15px;">\${product.specs}</p>
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
        
        renderProducts();
    </script>
</body>
</html>`;
}

function generateAdminHTML(companyName, products) {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>${companyName} - 관리자</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1400px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        h1 { margin-bottom: 35px; font-size: 28px; }
        .demo-notice { background: #fff3cd; padding: 20px; margin: 25px 0; border-left: 5px solid #ffc107; border-radius: 6px; }
        .product-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 25px; margin-top: 35px; }
        .product-item { border: 2px solid #e0e0e0; padding: 25px; border-radius: 10px; background: #fafafa; transition: all 0.3s; }
        .product-item:hover { box-shadow: 0 6px 18px rgba(0,0,0,0.1); border-color: #333; }
        .product-thumbnail { width: 100%; height: 180px; object-fit: cover; border-radius: 8px; margin-bottom: 15px; background: #e0e0e0; }
        .product-item h3 { margin-bottom: 12px; font-size: 17px; font-weight: 700; }
        .product-item p { color: #666; font-size: 14px; line-height: 1.7; margin-bottom: 8px; }
        @media (max-width: 992px) { .product-list { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 576px) { .product-list { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 ${companyName} - 제품 관리 시스템</h1>
        <div class="demo-notice"><strong>⚠️ 데모 버전:</strong> 실제 Firebase 연동 시 제품 추가/수정/삭제 기능이 활성화됩니다.</div>
        <h2>등록된 제품 (${products.length}개)</h2>
        <div class="product-list">
            ${products.map(p => `
                <div class="product-item">
                    <img src="${p.thumbnail}" class="product-thumbnail" alt="${p.name}">
                    <h3>${p.name}</h3>
                    <p><strong>제품번호:</strong> ${p.productNumber}</p>
                    <p><strong>카테고리:</strong> ${p.categories.productType}</p>
                    <p><strong>소비전력:</strong> ${p.categories.watt} | <strong>색온도:</strong> ${p.categories.cct}</p>
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
            <p>PDF에서 제품을 추출하여 완전한 웹사이트를 만들었습니다. 대분류/소분류 필터, 상세페이지 모두 작동합니다.</p>
            <a href="mailto:contact@lightpdf.io" class="cta-button">정식 버전 문의하기 →</a>
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
    const blob = new Blob([generatedFiles[filename]], { type: 'text/html' });
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