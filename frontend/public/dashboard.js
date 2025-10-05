// API 엔드포인트 (Railway 배포 후 변경)
const API_URL = 'http://localhost:5000'; // 로컬 개발
// const API_URL = 'https://your-railway-app.railway.app'; // 배포 후 변경

const MAX_FILE_SIZE_MB = 50;
let generatedFiles = null;

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

    await uploadPDF(file);
}

async function uploadPDF(file) {
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    showProcessingStatus('PDF를 서버로 업로드 중...');

    try {
        const formData = new FormData();
        formData.append('pdf', file);

        const response = await fetch(`${API_URL}/api/parse-pdf`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'PDF 처리 실패');
        }

        showProcessingStatus('웹사이트 생성 중...');

        const result = await response.json();
        
        generatedFiles = {
            'index.html': result.index_html,
            'admin.html': result.admin_html
        };

        hideProcessingStatus();
        document.querySelector('[data-tab="preview"]').click();
        displayPreview(result);

        alert(`완료!\n\n파일명: ${file.name}\n크기: ${fileSizeMB} MB\n제품 수: ${result.products_count}개\n\nindex.html과 admin.html이 생성되었습니다.`);

    } catch (error) {
        hideProcessingStatus();
        alert('PDF 처리 중 오류가 발생했습니다.\n\n' + error.message);
        console.error(error);
    }
}

function displayPreview(result) {
    const container = document.getElementById('previewContainer');
    
    if (!generatedFiles) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🖥️</div>
                <p>PDF를 업로드하면 생성된 웹사이트가 여기에 표시됩니다</p>
            </div>
        `;
        return;
    }

    const indexUrl = `data:text/html;charset=utf-8,${encodeURIComponent(generatedFiles['index.html'])}`;
    const adminUrl = `data:text/html;charset=utf-8,${encodeURIComponent(generatedFiles['admin.html'])}`;

    container.innerHTML = `
        <div class="demo-notice">
            <h3>✨ 웹사이트가 성공적으로 생성되었습니다!</h3>
            <p>서버에서 PDF를 정교하게 파싱하여 ${result.products_count}개 제품을 추출했습니다.</p>
            <p style="margin-top: 10px; font-size: 14px; opacity: 0.9;">
                추출된 이미지: ${result.images_count}개 | 파싱 시간: ${result.processing_time}초
            </p>
            <a href="mailto:contact@lightpdf.io" class="cta-button">정식 버전 문의하기 →</a>
        </div>
        
        <div class="download-buttons">
            <button class="download-btn index" onclick="downloadFile('index.html')">
                📥 index.html 다운로드
            </button>
            <button class="download-btn admin" onclick="downloadFile('admin.html')">
                📥 admin.html 다운로드
            </button>
        </div>
        
        <div class="preview-tabs">
            <button class="preview-tab-btn active" onclick="switchPreview('index')">
                index.html 미리보기
            </button>
            <button class="preview-tab-btn" onclick="switchPreview('admin')">
                admin.html 미리보기
            </button>
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
    const statusDiv = document.getElementById('processingStatus');
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
}

function hideProcessingStatus() {
    const statusDiv = document.getElementById('processingStatus');
    statusDiv.style.display = 'none';
}