import json

class TemplateGenerator:
    def __init__(self, company_name, products):
        self.company_name = company_name
        self.products = products
        self.categories = self.generate_categories()
    
    def generate_categories(self):
        """제품들로부터 카테고리 값 추출"""
        watt_values = set()
        cct_values = set()
        ip_values = set()
        
        for p in self.products:
            if 'categories' in p:
                if 'watt' in p['categories'] and p['categories']['watt']:
                    watt_values.add(p['categories']['watt'])
                if 'cct' in p['categories'] and p['categories']['cct']:
                    cct_values.add(p['categories']['cct'])
                if 'ip' in p['categories'] and p['categories']['ip']:
                    ip_values.add(p['categories']['ip'])
        
        return {
            'productType': {
                'label': '제품 타입',
                'values': ['ALL', 'DOWNLIGHT', 'SPOTLIGHT', 'TRACKLIGHT']
            },
            'watt': {'label': '소비전력', 'values': sorted(list(watt_values))},
            'cct': {'label': '색온도', 'values': sorted(list(cct_values))},
            'ip': {'label': '방수등급', 'values': sorted(list(ip_values))}
        }
    
    def generate_index_html(self):
        """고객용 index.html 생성"""
        products_json = json.dumps(self.products, ensure_ascii=False)
        
        return f'''<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{self.company_name} - 제품 카탈로그</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Malgun Gothic', Arial, sans-serif; background: #f5f5f5; }}
        header {{ background: linear-gradient(to right, #1a1a1a, #2c2c2c); color: white; padding: 25px 40px; }}
        .logo {{ font-size: 22px; letter-spacing: 8px; font-weight: bold; }}
        .container {{ max-width: 1400px; margin: 30px auto; background: white; padding: 50px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }}
        h1 {{ font-size: 32px; margin-bottom: 15px; font-weight: 800; }}
        .filter-section {{ background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 40px; border: 2px solid #e0e0e0; }}
        .filter-section h3 {{ font-size: 18px; margin-bottom: 20px; }}
        .filter-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 20px; }}
        .filter-group label {{ display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; }}
        .filter-group select {{ width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; }}
        .product-type-buttons {{ display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }}
        .product-type-btn {{ padding: 12px 28px; border: 2px solid #333; background: white; cursor: pointer; font-weight: 700; border-radius: 6px; }}
        .product-type-btn.active {{ background: #333; color: white; }}
        .reset-btn {{ padding: 12px 24px; background: #666; color: white; border: none; border-radius: 6px; cursor: pointer; }}
        .filter-status {{ text-align: center; padding: 15px; background: #e3f2fd; border-radius: 8px; margin-bottom: 30px; }}
        .product-list {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 25px; }}
        .product-item {{ border: 2px solid #e0e0e0; padding: 25px; border-radius: 10px; transition: all 0.3s; }}
        .product-item:hover {{ box-shadow: 0 6px 18px rgba(0,0,0,0.1); }}
        .product-thumbnail {{ width: 100%; height: 220px; object-fit: contain; border-radius: 8px; margin-bottom: 18px; background: white; }}
        .product-item h3 {{ font-size: 17px; font-weight: 700; margin-bottom: 15px; min-height: 45px; }}
        .badge {{ display: inline-block; padding: 6px 12px; background: #e3f2fd; color: #1976d2; border-radius: 4px; font-size: 12px; margin: 3px; }}
        footer {{ background: #2a2a2a; color: #999; padding: 40px; text-align: center; margin-top: 50px; }}
    </style>
</head>
<body>
    <header><div class="logo">{self.company_name}</div></header>
    <div class="container">
        <h1>제품 카탈로그</h1>
        <p style="color: #666; margin-bottom: 30px;">총 {len(self.products)}개 제품</p>
        <div class="filter-section">
            <h3>필터</h3>
            <div class="product-type-buttons">
                <button class="product-type-btn active" data-type="ALL" onclick="selectProductType('ALL')">전체</button>
                <button class="product-type-btn" data-type="DOWNLIGHT" onclick="selectProductType('DOWNLIGHT')">매입등</button>
                <button class="product-type-btn" data-type="SPOTLIGHT" onclick="selectProductType('SPOTLIGHT')">스팟조명</button>
                <button class="product-type-btn" data-type="TRACKLIGHT" onclick="selectProductType('TRACKLIGHT')">트랙조명</button>
            </div>
            <div class="filter-grid">
                <div class="filter-group">
                    <label>소비전력</label>
                    <select id="filterWatt" onchange="applyFilters()">
                        <option value="">전체</option>
                        {''.join(f'<option value="{v}">{v}</option>' for v in self.categories['watt']['values'])}
                    </select>
                </div>
                <div class="filter-group">
                    <label>색온도</label>
                    <select id="filterCct" onchange="applyFilters()">
                        <option value="">전체</option>
                        {''.join(f'<option value="{v}">{v}</option>' for v in self.categories['cct']['values'])}
                    </select>
                </div>
                <div class="filter-group">
                    <label>방수등급</label>
                    <select id="filterIp" onchange="applyFilters()">
                        <option value="">전체</option>
                        {''.join(f'<option value="{v}">{v}</option>' for v in self.categories['ip']['values'])}
                    </select>
                </div>
                <div class="filter-group" style="display: flex; align-items: flex-end;">
                    <button class="reset-btn" onclick="resetFilters()" style="width: 100%;">초기화</button>
                </div>
            </div>
        </div>
        <div class="filter-status" id="filterStatus" style="display:none;"></div>
        <div class="product-list" id="productList"></div>
    </div>
    <footer>COPYRIGHT © 2025 {self.company_name}. ALL RIGHTS RESERVED.</footer>
    <script>
        const products = {products_json};
        let filters = {{ productType: 'ALL', watt: '', cct: '', ip: '' }};
        
        function filterProducts() {{
            let filtered = products;
            if (filters.productType !== 'ALL') filtered = filtered.filter(p => p.categories?.productType === filters.productType);
            if (filters.watt) filtered = filtered.filter(p => p.categories?.watt === filters.watt);
            if (filters.cct) filtered = filtered.filter(p => p.categories?.cct === filters.cct);
            if (filters.ip) filtered = filtered.filter(p => p.categories?.ip === filters.ip);
            return filtered;
        }}
        
        function renderProducts() {{
            const filtered = filterProducts();
            const list = document.getElementById('productList');
            const status = document.getElementById('filterStatus');
            
            const active = [];
            if (filters.productType !== 'ALL') active.push(`타입: ${{filters.productType}}`);
            if (filters.watt) active.push(`전력: ${{filters.watt}}`);
            if (filters.cct) active.push(`색온도: ${{filters.cct}}`);
            if (filters.ip) active.push(`방수: ${{filters.ip}}`);
            
            if (active.length > 0) {{
                status.innerHTML = `${{active.join(' | ')}} → ${{filtered.length}}개`;
                status.style.display = 'block';
            }} else {{
                status.style.display = 'none';
            }}
            
            list.innerHTML = filtered.map(p => `
                <div class="product-item">
                    <img src="${{p.images?.[0] || p.image || ''}}" class="product-thumbnail" alt="${{p.name}}">
                    <h3>${{p.name}}</h3>
                    <p><strong>제품번호:</strong> ${{p.productNumber || 'N/A'}}</p>
                    <div>
                        ${{p.categories?.watt ? `<span class="badge">${{p.categories.watt}}</span>` : ''}}
                        ${{p.categories?.cct ? `<span class="badge">${{p.categories.cct}}</span>` : ''}}
                        ${{p.categories?.ip ? `<span class="badge">${{p.categories.ip}}</span>` : ''}}
                    </div>
                </div>
            `).join('');
        }}
        
        function selectProductType(type) {{
            filters.productType = type;
            document.querySelectorAll('.product-type-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.type === type));
            renderProducts();
        }}
        
        function applyFilters() {{
            filters.watt = document.getElementById('filterWatt').value;
            filters.cct = document.getElementById('filterCct').value;
            filters.ip = document.getElementById('filterIp').value;
            renderProducts();
        }}
        
        function resetFilters() {{
            filters = {{ productType: 'ALL', watt: '', cct: '', ip: '' }};
            document.getElementById('filterWatt').value = '';
            document.getElementById('filterCct').value = '';
            document.getElementById('filterIp').value = '';
            document.querySelectorAll('.product-type-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.type === 'ALL'));
            renderProducts();
        }}
        
        renderProducts();
    </script>
</body>
</html>'''
    
    def generate_admin_html(self):
        """관리자용 admin.html - 4개 탭 버전"""
        products_json = json.dumps(self.products, ensure_ascii=False)
        
        return f'''<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>{self.company_name} - 관리자</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Malgun Gothic', Arial, sans-serif; background: #f5f5f5; }}
        .container {{ max-width: 1400px; margin: 0 auto; padding: 30px; }}
        h1 {{ font-size: 28px; margin-bottom: 30px; }}
        
        .tabs {{
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
            border-bottom: 2px solid #e0e0e0;
        }}
        .tab {{
            padding: 12px 24px;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 15px;
            font-weight: 600;
            color: #666;
            border-bottom: 3px solid transparent;
        }}
        .tab.active {{
            color: #2196F3;
            border-bottom-color: #2196F3;
        }}
        
        .tab-content {{
            display: none;
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        }}
        .tab-content.active {{ display: block; }}
        
        .pdf-upload-zone {{
            border: 3px dashed #2196F3;
            border-radius: 10px;
            padding: 60px 40px;
            text-align: center;
            background: #f5f9ff;
            cursor: pointer;
            margin-bottom: 30px;
        }}
        .pdf-upload-zone:hover {{ background: #e3f2fd; }}
        
        .pdf-status {{
            background: #fff3cd;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            display: none;
        }}
        
        .page-result {{
            background: #fafafa;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            padding: 25px;
            margin-bottom: 25px;
        }}
        
        .extracted-products {{
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-top: 20px;
        }}
        .extracted-product {{
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            background: white;
        }}
        .extracted-product img {{
            width: 100%;
            height: 150px;
            object-fit: contain;
            background: #f8f8f8;
            border-radius: 6px;
            margin-bottom: 10px;
        }}
        
        .product-list {{
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 25px;
        }}
        .product-item {{
            border: 2px solid #e0e0e0;
            padding: 25px;
            border-radius: 10px;
        }}
        .product-thumbnail {{
            width: 100%;
            height: 180px;
            object-fit: contain;
            background: #fff;
            border-radius: 8px;
            margin-bottom: 15px;
        }}
        
        .form-group {{
            margin-bottom: 20px;
        }}
        .form-group label {{
            display: block;
            font-weight: 600;
            margin-bottom: 8px;
        }}
        .form-group input,
        .form-group textarea,
        .form-group select {{
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
        }}
        
        .submit-btn {{
            background: #4CAF50;
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 16px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{self.company_name} - 제품 관리</h1>
        
        <div class="tabs">
            <button class="tab active" data-tab="pdf" onclick="showTab('pdf')">📄 PDF 업로드</button>
            <button class="tab" data-tab="add" onclick="showTab('add')">➕ 제품 추가</button>
            <button class="tab" data-tab="list" onclick="showTab('list')">📋 제품 목록</button>
            <button class="tab" data-tab="manage" onclick="showTab('manage')">⚙️ 제품 관리</button>
        </div>
        
        <!-- PDF 업로드 탭 -->
        <div id="pdfTab" class="tab-content active">
            <h2>PDF에서 제품 일괄 추출</h2>
            <p style="color: #666; margin-bottom: 30px;">제품 카탈로그 PDF를 업로드하면 자동으로 분석합니다.</p>
            
            <div class="pdf-upload-zone" onclick="document.getElementById('pdfInput').click()">
                <div style="font-size: 60px; margin-bottom: 20px;">📁</div>
                <h3>PDF 파일을 클릭하여 업로드</h3>
                <input type="file" id="pdfInput" accept=".pdf" style="display: none;" onchange="handlePDFUpload(event)">
            </div>
            
            <div id="pdfStatus" class="pdf-status"></div>
            <div id="pdfResults"></div>
        </div>
        
        <!-- 제품 추가 탭 -->
        <div id="addTab" class="tab-content">
            <h2>제품 추가</h2>
            <form id="productForm" onsubmit="addProduct(event)">
                <div class="form-group">
                    <label>제품명 *</label>
                    <input type="text" id="productName" required>
                </div>
                <div class="form-group">
                    <label>제품번호</label>
                    <input type="text" id="productNumber">
                </div>
                <div class="form-group">
                    <label>카테고리</label>
                    <select id="productType">
                        <option value="DOWNLIGHT">매입등</option>
                        <option value="SPOTLIGHT">스팟조명</option>
                        <option value="TRACKLIGHT">트랙조명</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>소비전력</label>
                    <input type="text" id="watt" placeholder="예: 10W">
                </div>
                <div class="form-group">
                    <label>색온도</label>
                    <input type="text" id="cct" placeholder="예: 3000K">
                </div>
                <div class="form-group">
                    <label>방수등급</label>
                    <input type="text" id="ip" placeholder="예: IP20">
                </div>
                <button type="submit" class="submit-btn">제품 추가</button>
            </form>
        </div>
        
        <!-- 제품 목록 탭 -->
        <div id="listTab" class="tab-content">
            <h2>제품 목록 ({len(self.products)}개)</h2>
            <div class="product-list">
                {''.join(f'''
                    <div class="product-item">
                        <img src="{p.get('images', [p.get('image', '')])[0] if p.get('images') else p.get('image', '')}" class="product-thumbnail" alt="{p.get('name', '')}">
                        <h3>{p.get('name', '제품명 없음')}</h3>
                        <p><strong>제품번호:</strong> {p.get('productNumber', 'N/A')}</p>
                        <p><strong>카테고리:</strong> {p.get('categories', {}).get('productType', 'N/A')}</p>
                    </div>
                ''' for p in self.products)}
            </div>
        </div>
        
        <!-- 제품 관리 탭 -->
        <div id="manageTab" class="tab-content">
            <h2>제품 관리</h2>
            <p style="color: #666; margin-bottom: 20px;">제품을 클릭하여 수정하거나 삭제할 수 있습니다.</p>
            <div id="manageList" class="product-list"></div>
        </div>
    </div>

    <script>
    const allProducts = {products_json};
    
    function showTab(tabName) {{
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector(`[data-tab="${{tabName}}"]`).classList.add('active');
        document.getElementById(`${{tabName}}Tab`).classList.add('active');
        
        if (tabName === 'manage') renderManageList();
    }}
    
    async function handlePDFUpload(event) {{
        const file = event.target.files[0];
        if (!file) return;
        
        const statusDiv = document.getElementById('pdfStatus');
        const resultsDiv = document.getElementById('pdfResults');
        
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '⏳ PDF 분석 중...';
        
        try {{
            const formData = new FormData();
            formData.append('pdf', file);
            
            const response = await fetch('http://localhost:5000/api/parse-pdf', {{
                method: 'POST',
                body: formData
            }});
            
            const result = await response.json();
            statusDiv.innerHTML = `✅ {len(self.products)}개 제품 추출 완료!`;
            
            let html = '';
            const pages = {{}};
            result.products.forEach(p => {{
                if (!pages[p.page]) pages[p.page] = [];
                pages[p.page].push(p);
            }});
            
            Object.keys(pages).forEach(pageNum => {{
                const products = pages[pageNum];
                html += `
                    <div class="page-result">
                        <h3>페이지 ${{pageNum}} (${{products.length}}개)</h3>
                        <div class="extracted-products">
                            ${{products.map(p => `
                                <div class="extracted-product">
                                    <img src="${{p.image}}" alt="${{p.name}}">
                                    <h4>${{p.name}}</h4>
                                    <p>${{p.specs ? p.specs.substring(0, 80) : ''}}</p>
                                </div>
                            `).join('')}}
                        </div>
                    </div>
                `;
            }});
            
            resultsDiv.innerHTML = html;
        }} catch (error) {{
            statusDiv.innerHTML = `❌ 오류: ${{error.message}}`;
        }}
    }}
    
    function addProduct(e) {{
        e.preventDefault();
        alert('데모 버전 - 제품 추가 기능');
    }}
    
    function renderManageList() {{
        const list = document.getElementById('manageList');
        list.innerHTML = allProducts.map((p, idx) => `
            <div class="product-item" style="cursor: pointer;" onclick="editProduct(${{idx}})">
                <img src="${{p.images?.[0] || p.image || ''}}" class="product-thumbnail" alt="${{p.name}}">
                <h3>${{p.name}}</h3>
                <p><strong>제품번호:</strong> ${{p.productNumber || 'N/A'}}</p>
                <button onclick="event.stopPropagation(); deleteProduct(${{idx}})" style="background: #f44336; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin-top: 10px;">삭제</button>
            </div>
        `).join('');
    }}
    
    function editProduct(idx) {{
        alert(`제품 수정: ${{allProducts[idx].name}}`);
    }}
    
    function deleteProduct(idx) {{
        if (confirm('정말 삭제하시겠습니까?')) {{
            alert('데모 버전 - 삭제 기능');
        }}
    }}
    </script>
</body>
</html>'''