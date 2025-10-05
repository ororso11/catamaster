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
        """고객용 index.html 생성 - 리스트 형태"""
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
        
        header {{ background: linear-gradient(to right, #1a1a1a, #2c2c2c); color: white; padding: 25px 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .logo {{ font-size: 22px; letter-spacing: 8px; font-weight: bold; }}
        
        .container {{ max-width: 1400px; margin: 0 auto; background: white; padding: 50px; margin-top: 30px; margin-bottom: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }}
        
        h1 {{ font-size: 32px; margin-bottom: 15px; font-weight: 800; }}
        
        .filter-section {{ background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 40px; border: 2px solid #e0e0e0; }}
        .filter-section h3 {{ font-size: 18px; margin-bottom: 20px; color: #333; }}
        
        .filter-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 20px; }}
        .filter-group {{ }}
        .filter-group label {{ display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; color: #555; }}
        .filter-group select {{ width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; background: white; cursor: pointer; }}
        
        .product-type-buttons {{ display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }}
        .product-type-btn {{ padding: 12px 28px; border: 2px solid #333; background: white; color: #333; cursor: pointer; font-weight: 700; font-size: 14px; transition: all 0.2s; border-radius: 6px; }}
        .product-type-btn:hover {{ background: #f0f0f0; }}
        .product-type-btn.active {{ background: #333; color: white; }}
        
        .filter-actions {{ display: flex; gap: 10px; }}
        .reset-btn {{ padding: 12px 24px; background: #666; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }}
        .reset-btn:hover {{ background: #555; }}
        
        .filter-status {{ text-align: center; padding: 15px; background: #e3f2fd; border-radius: 8px; margin-bottom: 30px; color: #1976d2; font-weight: 600; }}
        
        .product-list {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 25px; }}
        .product-item {{ border: 2px solid #e0e0e0; padding: 25px; border-radius: 10px; background: #fafafa; transition: all 0.3s; }}
        .product-item:hover {{ box-shadow: 0 6px 18px rgba(0,0,0,0.1); border-color: #333; transform: translateY(-3px); }}
        
        .product-thumbnail {{ width: 100%; height: 220px; object-fit: contain; border-radius: 8px; margin-bottom: 18px; background: white; padding: 15px; border: 1px solid #e0e0e0; }}
        
        .product-item h3 {{ margin-bottom: 15px; font-size: 17px; font-weight: 700; color: #222; line-height: 1.4; min-height: 45px; }}
        .product-item p {{ color: #666; font-size: 14px; line-height: 1.8; margin-bottom: 8px; }}
        .product-item p strong {{ color: #333; min-width: 100px; display: inline-block; }}
        
        .spec-badges {{ display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }}
        .badge {{ display: inline-block; padding: 6px 12px; background: #e3f2fd; color: #1976d2; border-radius: 4px; font-size: 12px; font-weight: 600; }}
        
        .no-results {{ text-align: center; padding: 80px 20px; color: #999; grid-column: 1 / -1; }}
        .no-results h3 {{ font-size: 24px; margin-bottom: 10px; }}
        
        footer {{ background: #2a2a2a; color: #999; padding: 40px; text-align: center; font-size: 14px; margin-top: 50px; }}
        
        @media (max-width: 1200px) {{ 
            .filter-grid {{ grid-template-columns: repeat(2, 1fr); }}
            .product-list {{ grid-template-columns: repeat(2, 1fr); }}
        }}
        @media (max-width: 768px) {{ 
            .filter-grid {{ grid-template-columns: 1fr; }}
            .product-list {{ grid-template-columns: 1fr; }}
            .container {{ padding: 30px 20px; }}
        }}
    </style>
</head>
<body>
    <header>
        <div class="logo">{self.company_name}</div>
    </header>
    
    <div class="container">
        <h1>제품 카탈로그</h1>
        <p style="color: #666; margin-bottom: 30px; font-size: 15px;">총 <span id="totalCount">{len(self.products)}</span>개 제품</p>
        
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
        
        <div class="filter-status" id="filterStatus"></div>
        
        <div class="product-list" id="productList"></div>
    </div>
    
    <footer>
        COPYRIGHT © 2025 {self.company_name}. ALL RIGHTS RESERVED.
    </footer>
    
    <script>
        const products = {products_json};
        let filters = {{ productType: 'ALL', watt: '', cct: '', ip: '' }};
        
        console.log('총 제품 수:', products.length);
        console.log('샘플 제품:', products[0]);
        
        function filterProducts() {{
            let filtered = products;
            
            if (filters.productType !== 'ALL') {{
                filtered = filtered.filter(p => {{
                    if (!p.categories || !p.categories.productType) return false;
                    return p.categories.productType === filters.productType;
                }});
            }}
            
            if (filters.watt) {{
                filtered = filtered.filter(p => {{
                    if (!p.categories || !p.categories.watt) return false;
                    return p.categories.watt === filters.watt;
                }});
            }}
            
            if (filters.cct) {{
                filtered = filtered.filter(p => {{
                    if (!p.categories || !p.categories.cct) return false;
                    return p.categories.cct === filters.cct;
                }});
            }}
            
            if (filters.ip) {{
                filtered = filtered.filter(p => {{
                    if (!p.categories || !p.categories.ip) return false;
                    return p.categories.ip === filters.ip;
                }});
            }}
            
            console.log('필터 적용:', filters);
            console.log('필터링된 제품 수:', filtered.length);
            
            return filtered;
        }}
        
        function renderProducts() {{
            const filtered = filterProducts();
            const list = document.getElementById('productList');
            const status = document.getElementById('filterStatus');
            
            const activeFilters = [];
            if (filters.productType !== 'ALL') activeFilters.push(`타입: ${{filters.productType}}`);
            if (filters.watt) activeFilters.push(`전력: ${{filters.watt}}`);
            if (filters.cct) activeFilters.push(`색온도: ${{filters.cct}}`);
            if (filters.ip) activeFilters.push(`방수: ${{filters.ip}}`);
            
            if (activeFilters.length > 0) {{
                status.innerHTML = `활성 필터: ${{activeFilters.join(' | ')}} → ${{filtered.length}}개 제품 표시 중`;
                status.style.display = 'block';
            }} else {{
                status.style.display = 'none';
            }}
            
            if (filtered.length === 0) {{
                list.innerHTML = '<div class="no-results"><h3>검색 결과가 없습니다</h3><p>다른 필터를 선택해주세요</p></div>';
                return;
            }}
            
            list.innerHTML = filtered.map(p => {{
                const imageUrl = (p.images && p.images.length > 0) ? p.images[0] : (p.image || '');
                const specs = p.specsList || [];
                
                let specsHtml = specs.slice(0, 3).map(spec => `<p>${{spec}}</p>`).join('');
                
                let badges = '';
                if (p.categories) {{
                    if (p.categories.watt) badges += `<span class="badge">${{p.categories.watt}}</span>`;
                    if (p.categories.cct) badges += `<span class="badge">${{p.categories.cct}}</span>`;
                    if (p.categories.ip) badges += `<span class="badge">${{p.categories.ip}}</span>`;
                }}
                
                return `
                    <div class="product-item">
                        <img src="${{imageUrl}}" class="product-thumbnail" alt="${{p.name}}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'400\\'%3E%3Crect fill=\\'%23f0f0f0\\' width=\\'400\\' height=\\'400\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dy=\\'.3em\\' fill=\\'%23999\\' font-size=\\'18\\'%3E이미지 없음%3C/text%3E%3C/svg%3E'">
                        <h3>${{p.name}}</h3>
                        <p><strong>제품번호:</strong> ${{p.productNumber || 'N/A'}}</p>
                        <p><strong>카테고리:</strong> ${{p.categories?.productType || 'N/A'}}</p>
                        ${{specsHtml}}
                        <div class="spec-badges">${{badges}}</div>
                    </div>
                `;
            }}).join('');
        }}
        
        function selectProductType(type) {{
            filters.productType = type;
            document.querySelectorAll('.product-type-btn').forEach(btn => {{
                btn.classList.toggle('active', btn.dataset.type === type);
            }});
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
            document.querySelectorAll('.product-type-btn').forEach(btn => {{
                btn.classList.toggle('active', btn.dataset.type === 'ALL');
            }});
            renderProducts();
        }}
        
        renderProducts();
    </script>
</body>
</html>'''
    
    def generate_admin_html(self):
        """관리자용 admin.html 생성"""
        return f'''<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>{self.company_name} - 관리자</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1400px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
        h1 {{ margin-bottom: 35px; font-size: 28px; }}
        .demo-notice {{ background: #fff3cd; padding: 20px; margin: 25px 0; border-left: 5px solid #ffc107; border-radius: 6px; }}
        .product-list {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 25px; margin-top: 35px; }}
        .product-item {{ border: 2px solid #e0e0e0; padding: 25px; border-radius: 10px; background: #fafafa; }}
        .product-thumbnail {{ width: 100%; height: 180px; object-fit: contain; border-radius: 8px; margin-bottom: 15px; background: #fff; }}
        .product-item h3 {{ margin-bottom: 12px; font-size: 17px; font-weight: 700; }}
        .product-item p {{ color: #666; font-size: 14px; line-height: 1.7; margin-bottom: 8px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{self.company_name} - 제품 관리</h1>
        <div class="demo-notice"><strong>데모 버전</strong></div>
        <h2>등록된 제품 ({len(self.products)}개)</h2>
        <div class="product-list">
            {''.join(f'''
                <div class="product-item">
                    <img src="{(p.get('images', [p.get('image', '')])[0] if p.get('images') else p.get('image', ''))}" class="product-thumbnail" alt="{p.get('name', '제품')}">
                    <h3>{p.get('name', '제품명 없음')}</h3>
                    <p><strong>제품번호:</strong> {p.get('productNumber', 'N/A')}</p>
                    <p><strong>카테고리:</strong> {p.get('categories', {}).get('productType', 'N/A')}</p>
                </div>
            ''' for p in self.products)}
        </div>
    </div>
</body>
</html>'''