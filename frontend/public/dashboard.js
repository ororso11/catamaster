// API 엔드포인트
const API_URL = 'https://catamaster-production.up.railway.app';

const MAX_FILE_SIZE_MB = 50;
const MAX_UPLOADS_PER_IP = 2;
let generatedFiles = null;

// 업로드 횟수 체크 (localStorage 사용)
function checkUploadLimit() {
    const uploadCount = parseInt(localStorage.getItem('uploadCount') || '0');
    const lastUploadDate = localStorage.getItem('lastUploadDate');
    const today = new Date().toDateString();
    
    // 날짜가 바뀌면 카운트 리셋
    if (lastUploadDate !== today) {
        localStorage.setItem('uploadCount', '0');
        localStorage.setItem('lastUploadDate', today);
        return true;
    }
    
    if (uploadCount >= MAX_UPLOADS_PER_IP) {
        alert(`업로드 제한에 도달했습니다.\n\n오늘은 ${uploadCount}/${MAX_UPLOADS_PER_IP}회 업로드를 완료하셨습니다.\n내일 다시 시도해주세요.\n\n더 많은 업로드가 필요하시면 유료 플랜을 이용해주세요.`);
        return false;
    }
    
    return true;
}

function incrementUploadCount() {
    const uploadCount = parseInt(localStorage.getItem('uploadCount') || '0');
    localStorage.setItem('uploadCount', (uploadCount + 1).toString());
    localStorage.setItem('lastUploadDate', new Date().toDateString());
}

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
    // 파일 존재 여부 확인
    if (!files || files.length === 0) {
        alert('파일을 선택해주세요.');
        return;
    }

    const file = files[0];
    
    // PDF 파일 확장자 검증 (엄격하게)
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
    
    if (fileExtension !== '.pdf') {
        alert(`PDF 파일만 업로드 가능합니다.\n\n업로드하신 파일: ${file.name}\n파일 형식: ${fileExtension || '알 수 없음'}\n\n.pdf 확장자를 가진 파일만 업로드해주세요.`);
        fileInput.value = ''; // 파일 선택 초기화
        return;
    }

    // MIME 타입 추가 검증
    if (file.type !== 'application/pdf' && file.type !== '') {
        alert(`올바른 PDF 파일이 아닙니다.\n\nMIME 타입: ${file.type}\n\nPDF 파일만 업로드 가능합니다.`);
        fileInput.value = '';
        return;
    }

    // 파일 크기 검증
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    if (parseFloat(fileSizeMB) > MAX_FILE_SIZE_MB) {
        alert(`파일 크기가 너무 큽니다.\n\n업로드하신 파일: ${file.name}\n파일 크기: ${fileSizeMB}MB\n최대 허용 크기: ${MAX_FILE_SIZE_MB}MB\n\n파일 크기를 줄인 후 다시 시도해주세요.`);
        fileInput.value = '';
        return;
    }

    // 업로드 횟수 제한 확인
    if (!checkUploadLimit()) {
        fileInput.value = '';
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

        // 업로드 성공 시 카운트 증가
        incrementUploadCount();
        
        const uploadCount = parseInt(localStorage.getItem('uploadCount') || '0');
        const remainingUploads = MAX_UPLOADS_PER_IP - uploadCount;

        hideProcessingStatus();
        document.querySelector('[data-tab="preview"]').click();
        displayPreview(result);

        alert(`완료!\n\n파일명: ${file.name}\n크기: ${fileSizeMB} MB\n제품 수: ${result.products_count}개\n\nindex.html과 admin.html이 생성되었습니다.\n\n남은 무료 업로드: ${remainingUploads}/${MAX_UPLOADS_PER_IP}회`);

    } catch (error) {
        hideProcessingStatus();
        alert('PDF 처리 중 오류가 발생했습니다.\n\n' + error.message);
        console.error(error);
    } finally {
        fileInput.value = ''; // 업로드 후 파일 선택 초기화
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
        <div style="background: linear-gradient(135deg, #2d5f3f 0%, #4a8c5c 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; text-align: center;">
            <h3 style="margin-bottom: 15px; font-size: 1.5rem;">✨ 웹사이트가 성공적으로 생성되었습니다!</h3>
            <p style="margin-bottom: 10px;">서버에서 PDF를 정교하게 파싱하여 ${result.products_count}개 제품을 추출했습니다.</p>
            <p style="font-size: 14px; opacity: 0.95;">
                추출된 이미지: ${result.images_count}개 | 파싱 시간: ${result.processing_time}초
            </p>
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

// 페이지 로드 시 남은 업로드 횟수 표시
window.addEventListener('DOMContentLoaded', () => {
    const uploadCount = parseInt(localStorage.getItem('uploadCount') || '0');
    const lastUploadDate = localStorage.getItem('lastUploadDate');
    const today = new Date().toDateString();
    
    // 날짜가 바뀌면 카운트 리셋
    if (lastUploadDate !== today) {
        localStorage.setItem('uploadCount', '0');
        localStorage.setItem('lastUploadDate', today);
    }
    
    const currentCount = parseInt(localStorage.getItem('uploadCount') || '0');
    const remainingUploads = MAX_UPLOADS_PER_IP - currentCount;
    
    if (currentCount > 0) {
        console.log(`오늘 남은 업로드: ${remainingUploads}/${MAX_UPLOADS_PER_IP}회`);
    }
});