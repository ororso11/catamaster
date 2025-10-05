let catalogs = [];
let currentThemeColor = '#000';

// Tab switching
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

// Setup menu items
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function() {
        const tab = this.getAttribute('data-tab');
        switchTab(tab);
    });
});

// File upload handling
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

function processPDF(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const catalog = {
            id: Date.now() + Math.random(),
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(2),
            date: new Date().toLocaleString('ko-KR'),
            data: e.target.result,
            status: 'processing'
        };
        
        catalogs.push(catalog);
        updateStats();
        updateCatalogList();
        
        // Simulate processing
        setTimeout(() => {
            catalog.status = 'completed';
            catalog.siteUrl = `generated-site-${catalog.id}.html`;
            updateCatalogList();
            alert(`${file.name} 처리 완료! 웹사이트가 생성되었습니다.`);
        }, 2000);
    };
    reader.readAsDataURL(file);
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
                        ${catalog.size} MB • ${catalog.date}
                        <br>
                        상태: ${catalog.status === 'completed' ? '✅ 완료' : '⏳ 처리중...'}
                    </div>
                </div>
            </div>
            <div class="catalog-actions">
                <button class="btn btn-view" onclick="viewCatalog(${catalog.id})">보기</button>
                ${catalog.status === 'completed' ? 
                    `<button class="btn btn-preview" onclick="previewSite(${catalog.id})">미리보기</button>` : 
                    ''}
                <button class="btn btn-delete" onclick="deleteCatalog(${catalog.id})">삭제</button>
            </div>
        </div>
    `).join('');
}

function viewCatalog(id) {
    const catalog = catalogs.find(c => c.id === id);
    if (catalog) {
        window.open(catalog.data);
    }
}

function previewSite(id) {
    const catalog = catalogs.find(c => c.id === id);
    if (catalog && catalog.status === 'completed') {
        switchTab('preview');
        const previewContainer = document.getElementById('previewContainer');
        previewContainer.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3>${catalog.name}의 생성된 웹사이트</h3>
                <p style="color: #666;">반응형으로 자동 생성된 카탈로그 웹사이트입니다</p>
            </div>
            <iframe class="preview-frame" src="${catalog.data}"></iframe>
            <div style="margin-top: 20px; text-align: center;">
                <button class="btn-primary" onclick="downloadSite(${id})">웹사이트 다운로드</button>
            </div>
        `;
    }
}

function deleteCatalog(id) {
    if (confirm('이 카탈로그를 삭제하시겠습니까?')) {
        catalogs = catalogs.filter(c => c.id !== id);
        updateStats();
        updateCatalogList();
    }
}

function downloadSite(id) {
    alert('웹사이트 파일을 다운로드합니다. (실제 구현 시 ZIP 파일로 제공됩니다)');
}

// Theme color selection
document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', function() {
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('active');
        });
        this.classList.add('active');
        currentThemeColor = this.getAttribute('data-color');
    });
});

// Initialize
updateStats();