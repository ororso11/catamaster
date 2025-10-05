import json

class TemplateGenerator:
    def __init__(self, company_name, products):
        self.company_name = company_name
        self.products = products
        self.categories = self.generate_categories()
    
    def generate_categories(self):
        """제품들로부터 카테고리 값 추출"""
        watt_values = sorted(list(set(p['categories']['watt'] for p in self.products)))
        cct_values = sorted(list(set(p['categories']['cct'] for p in self.products)))
        ip_values = sorted(list(set(p['categories']['ip'] for p in self.products)))
        
        return {
            'productType': {
                'label': '제품 타입',
                'values': ['ALL', 'DOWNLIGHT', 'SPOTLIGHT', 'TRACKLIGHT']
            },
            'watt': {'label': '소비전력', 'values': watt_values},
            'cct': {'label': '색온도', 'values': cct_values},
            'ip': {'label': '방수등급', 'values': ip_values}
        }
    
    def generate_index_html(self):
        """고객용 index.html 생성"""
        products_json = json.dumps(self.products, ensure_ascii=False)
        categories_json = json.dumps(self.categories, ensure_ascii=False)
        
        return f'''<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{self.company_name} - 제품 카탈로그</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Malgun Gothic', Arial, sans-serif; background: #fff; }}
        header {{ background: linear-gradient(to right, #1a1a1a, #2c2c2c); color: white; padding: 20px 40px; }}
        .logo {{ font-size: 20px; letter-spacing: 8px; font-weight: bold; }}
        .container {{ display: flex; max-width: 1600px; margin: 0 auto; }}
        .sidebar {{ width: 280px; background: #f8f9fa; padding: 30px 20px; min-height: calc(100vh - 60px); }}
        .sidebar h3 {{ font-size: 18px; margin-bottom: 25px; padding-bottom: 12px; border-bottom: 3px solid #333; }}
        .filter-group {{ margin-bottom: 30px; }}
        .filter-group label {{ display: block; font-weight: 600; margin-bottom: 12px; font-size: 14px; color: #333; }}
        .filter-group select {{ width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; background: white; }}
        .main-content {{ flex: 1; padding: 40px; }}
        .page-title {{ font-size: 36px; text-align: center; margin-bottom: 40px; font-weight: 800; }}
        .product-type-filters {{ display: flex; justify-content: center; gap: 12px; margin-bottom: 40px; flex-wrap: wrap; }}
        .product-type-btn {{ padding: 14px 32px; border: 2px solid #333; background: white; color: #333; cursor: pointer; font-weight: 700; font-size: 14px; transition: all 0.3s; }}
        .product-type-btn:hover {{ background: #f0f0f0; }}
        .product-type-btn.active {{ background: #333; color: white; }}
        .product-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 30px; }}
        .product-card {{ background: white; border: 2px solid #e0e0e0; cursor: pointer; transition: all 0.3s; overflow: hidden; }}
        .product-card:hover {{ transform: translateY(-8px); box-shadow: 0 12px 24px rgba(0,0,0,0.15); border-color: #333; }}
        .product-image {{ width: 100%; height: 340px; background: #f5f5f5; overflow: hidden; display: flex; align-items: center; justify-content: center; }}
        .product-image img {{ width: 100%; height: 100%; object-fit: cover; }}
        .product-info {{ padding: 25px; }}
        .product-name {{ font-size: 17px; font-weight: 700; margin-bottom: 12px; color: #222; line-height: 1.4; }}
        .product-specs {{ font-size: 13px; color: #666; line-height: 1.7; white-space: pre-line; }}
        .detail-page {{ display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: white; z-index: 1000; overflow-y: auto; }}
        .detail-page.active {{ display: block; }}
        .detail-header {{ background: #000; color: white; padding: 25px 40px; display: flex; justify-content: space-between; align-items: center; }}
        .back-btn {{ background: none; border: none; color: white; font-size: 28px; cursor: pointer; padding: 0 10px; }}
        .detail-content {{ max-width: 1200px; margin: 0 auto; padding: 50px 40px; }}
        .detail-title {{ font-size: 32px; margin-bottom: 35px; padding-bottom: 25px; border-bottom: 3px solid #e0e0e0; font-weight: 800; }}
        .detail-images {{ display: grid; grid-template-columns: 1.5fr 1fr; gap: 35px; margin-bottom: 50px; }}
        .detail-main-image {{ width: 100%; background: #f8f8f8; border-radius: 12px; overflow: hidden; border: 2px solid #e0e0e0; }}
        .detail-main-image img {{ width: 100%; height: auto; display: block; }}
        .detail-specs-box {{ background: #f9f9f9; padding: 35px; border-radius: 12px; border: 2px solid #e0e0e0; }}
        .detail-specs-box h3 {{ font-size: 20px; margin-bottom: 22px; font-weight: 700; }}
        .detail-specs-box ul {{ list-style: none; }}
        .detail-specs-box li {{ padding: 14px 0; border-bottom: 1px solid #ddd; font-size: 15px; line-height: 1.6; }}
        .detail-specs-box li:last-child {{ border-bottom: none; }}
        footer {{ background: #2a2a2a; color: #999; padding: 50px 40px; margin-top: 80px; text-align: center; font-size: 14px; }}
        .no-results {{ text-align: center; padding: 100px 20px; color: #999; }}
        .no-results h3 {{ font-size: 24px; margin-bottom: 15px; }}
        @media (max-width: 1400px) {{ .product-grid {{ grid-template-columns: repeat(3, 1fr); }} }}
        @media (max-width: 992px) {{ 
            .product-grid {{ grid-template-columns: repeat(2, 1fr); }}
            .container {{ flex-direction: column; }}
            .sidebar {{ width: 100%; min-height: auto; }}
            .detail-images {{ grid-template-columns: 1fr; }}
        }}
        @media (max-width: 576px) {{ .product-grid {{ grid-template-columns: 1fr; }} }}
    </style>
</head>
<body>
    <div id="listPage">
        <header><div class="logo">{self.company_name}</div></header>
        <div class="container">
            <aside class="sidebar">
                <h3>제품 필터</h3>
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
        <footer>COPYRIGHT © 2025 {self.company_name}. ALL RIGHTS RESERVED.</footer>
    </div>
    
    <div id="detailPage" class="detail-page">
        <div class="detail-header">
            <button class="back-btn" onclick="closeDetail()">✕</button>
            <div class="logo">{self.company_name}</div>
        </div>
        <div class="detail-content" id="detailContent"></div>
    </div>
    
    <script>
        const products = {products_json};
        let filters = {{ productType: 'ALL', watt: '', cct: '', ip: '' }};
        
        function filterProducts() {{
            return products.filter(p => {{
                if (filters.productType !== 'ALL' && p.categories.productType !== filters.productType) return false;
                if (filters.watt && p.categories.watt !== filters.watt) return false;
                if (filters.cct && p.categories.cct !== filters.cct) return false;
                if (filters.ip && p.categories.ip !== filters.ip) return false;
                return true;
            }});
        }}
        
        function renderProducts() {{
            const filtered = filterProducts();
            const grid = document.getElementById('productGrid');
            
            if (filtered.length === 0) {{
                grid.innerHTML = '<div class="no-results"><h3>검색 결과가 없습니다</h3><p>다른 필터를 선택해주세요</p></div>';
                return;
            }}
            
            grid.innerHTML = filtered.map((p, i) => `
                <div class="product-card" onclick="showDetail(${{products.indexOf(p)}})">
                    <div class="product-image"><img src="${{p.images[0] || ''}}" alt="${{p.name}}"></div>
                    <div class="product-info">
                        <div class="product-name">${{p.name}}</div>
                        <div class="product-specs">${{p.specs.substring(0, 100)}}</div>
                    </div>
                </div>
            `).join('');
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
        
        function showDetail(index) {{
            const product = products[index];
            const content = document.getElementById('detailContent');
            
            const imagesHTML = product.images.map(img => `
                <div class="detail-main-image"><img src="${{img}}" alt="${{product.name}}"></div>
            `).join('');
            
            const specsHTML = product.specsList.map(spec => `<li>${{spec}}</li>`).join('');
            
            content.innerHTML = `
                <h1 class="detail-title">${{product.name}}</h1>
                <div class="detail-images">
                    ${{imagesHTML}}
                    <div class="detail-specs-box">
                        <h3>제품 사양</h3>
                        <ul>
                            <li><strong>제품번호:</strong> ${{product.productNumber}}</li>
                            <li><strong>소비전력:</strong> ${{product.categories.watt}}</li>
                            <li><strong>색온도:</strong> ${{product.categories.cct}}</li>
                            <li><strong>방수등급:</strong> ${{product.categories.ip}}</li>
                            ${{specsHTML}}
                        </ul>
                    </div>
                </div>
                <div class="detail-specs-box">
                    <h3>상세 정보</h3>
                    <p style="line-height: 1.9; white-space: pre-line; font-size: 15px;">${{product.specs}}</p>
                </div>
            `;
            
            document.getElementById('listPage').style.display = 'none';
            document.getElementById('detailPage').classList.add('active');
            window.scrollTo(0, 0);
        }}
        
        function closeDetail() {{
            document.getElementById('detailPage').classList.remove('active');
            document.getElementById('listPage').style.display = 'block';
            window.scrollTo(0, 0);
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
        .product-item {{ border: 2px solid #e0e0e0; padding: 25px; border-radius: 10px; background: #fafafa; transition: all 0.3s; }}
        .product-item:hover {{ box-shadow: 0 6px 18px rgba(0,0,0,0.1); border-color: #333; }}
        .product-thumbnail {{ width: 100%; height: 180px; object-fit: cover; border-radius: 8px; margin-bottom: 15px; background: #e0e0e0; }}
        .product-item h3 {{ margin-bottom: 12px; font-size: 17px; font-weight: 700; }}
        .product-item p {{ color: #666; font-size: 14px; line-height: 1.7; margin-bottom: 8px; }}
        @media (max-width: 992px) {{ .product-list {{ grid-template-columns: repeat(2, 1fr); }} }}
        @media (max-width: 576px) {{ .product-list {{ grid-template-columns: 1fr; }} }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 {self.company_name} - 제품 관리 시스템</h1>
        <div class="demo-notice"><strong>⚠️ 데모 버전:</strong> 실제 Firebase 연동 시 제품 추가/수정/삭제 기능이 활성화됩니다.</div>
        <h2>등록된 제품 ({len(self.products)}개)</h2>
        <div class="product-list">
            {''.join(f'''
                <div class="product-item">
                    <img src="{p['images'][0] if p['images'] else ''}" class="product-thumbnail" alt="{p['name']}">
                    <h3>{p['name']}</h3>
                    <p><strong>제품번호:</strong> {p['productNumber']}</p>
                    <p><strong>카테고리:</strong> {p['categories']['productType']}</p>
                    <p><strong>소비전력:</strong> {p['categories']['watt']} | <strong>색온도:</strong> {p['categories']['cct']}</p>
                </div>
            ''' for p in self.products)}
        </div>
    </div>
</body>
</html>'''