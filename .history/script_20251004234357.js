// 모바일 메뉴
function toggleMenu() {
    const nav = document.getElementById('mainNav');
    nav.classList.toggle('active');
}

// 부드러운 스크롤
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            document.getElementById('mainNav').classList.remove('active');
        }
    });
});

// 스크롤 진행 바
window.addEventListener('scroll', function() {
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    document.getElementById('progressLine').style.width = scrolled + '%';
});

// PDF → 웹사이트 자동 변환 프로세스 시각화
function createConversionVisualization() {
    const heroContent = document.querySelector('.hero-content');
    if (!heroContent) return;
    
    // 기존 description 숨기기
    const oldDesc = document.querySelector('.hero .description');
    if (oldDesc) {
        oldDesc.style.display = 'none';
    }
    
    // 변환 프로세스 컨테이너 생성
    const conversionContainer = document.createElement('div');
    conversionContainer.className = 'conversion-process';
    conversionContainer.innerHTML = `
        <div class="process-flow">
            <div class="process-step" id="step1">
                <div class="step-icon">📱</div>
                <div class="step-title">PDF 촬영</div>
                <div class="step-visual">
                    <div class="pdf-document">
                        <div class="pdf-page"></div>
                        <div class="pdf-page"></div>
                        <div class="pdf-page"></div>
                    </div>
                    <div class="camera-shutter" id="cameraShutter"></div>
                </div>
            </div>
            
            <div class="process-arrow">
                <div class="arrow-line"></div>
                <div class="arrow-head">→</div>
            </div>
            
            <div class="process-step" id="step2">
                <div class="step-icon">⚡</div>
                <div class="step-title">자동 변환 중</div>
                <div class="step-visual">
                    <div class="conversion-loader">
                        <div class="loader-bar"></div>
                        <div class="loader-percent" id="loaderPercent">0%</div>
                    </div>
                    <div class="conversion-particles" id="conversionParticles"></div>
                </div>
            </div>
            
            <div class="process-arrow">
                <div class="arrow-line"></div>
                <div class="arrow-head">→</div>
            </div>
            
            <div class="process-step" id="step3">
                <div class="step-icon">🌐</div>
                <div class="step-title">웹사이트 완성</div>
                <div class="step-visual">
                    <div class="website-preview" id="websitePreview">
                        <div class="browser-bar">
                            <div class="browser-dots">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                        <div class="website-content">
                            <div class="web-element"></div>
                            <div class="web-element"></div>
                            <div class="web-element wide"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="efficiency-badge">
            <div class="badge-icon">🚀</div>
            <div class="badge-text">
                수동 작업 <span class="time-before">4시간</span> → 
                자동 변환 <span class="time-after">1분</span>
            </div>
        </div>
    `;
    
    // description 위치에 삽입
    if (oldDesc) {
        oldDesc.parentNode.insertBefore(conversionContainer, oldDesc);
    }
}

// 변환 프로세스 애니메이션
function startConversionAnimation() {
    // 1단계: PDF 촬영
    setTimeout(() => {
        const step1 = document.getElementById('step1');
        step1.classList.add('active');
    }, 500);
    
    // 2단계: 변환 중 (로딩 바)
    setTimeout(() => {
        const step2 = document.getElementById('step2');
        step2.classList.add('active');
        
        // 로딩 퍼센트 증가
        let percent = 0;
        const loaderInterval = setInterval(() => {
            percent += 5;
            const loaderPercent = document.getElementById('loaderPercent');
            if (loaderPercent) {
                loaderPercent.textContent = percent + '%';
            }
            
            if (percent >= 100) {
                clearInterval(loaderInterval);
            }
        }, 40);
    }, 1500);
    
    // 3단계: 웹사이트 완성 (등장 애니메이션)
    setTimeout(() => {
        const step3 = document.getElementById('step3');
        const website = document.getElementById('websitePreview');
        step3.classList.add('active');
        website.classList.add('reveal');
    }, 3500);
}

// Intersection Observer로 화면에 보일 때 애니메이션 시작
const observerOptions = {
    threshold: 0.3
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            startConversionAnimation();
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// 떠다니는 입자 생성 - 제거
function createParticles() {
    // 입자 효과 제거
}

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', function() {
    // createParticles(); - 제거
    createConversionVisualization();
    
    const heroSection = document.querySelector('.hero');
    if (heroSection) {
        observer.observe(heroSection);
    }
    
    // 스타일 추가
    const style = document.createElement('style');
    style.textContent = `
        .conversion-process {
            margin: 50px 0 40px;
            opacity: 1;
        }
        
        .process-flow {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 20px;
            flex-wrap: wrap;
            margin-bottom: 50px;
            padding: 30px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 20px;
            position: relative;
            max-width: 1100px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .process-flow::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><circle cx="2" cy="2" r="1" fill="rgba(255,255,255,0.1)"/></svg>');
            border-radius: 20px;
            pointer-events: none;
        }
        
        .process-step {
            background: white;
            border-radius: 15px;
            padding: 30px;
            min-width: 220px;
            text-align: center;
            border: none;
            transition: all 0.4s ease;
            transform: scale(0.95);
            opacity: 0.6;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            position: relative;
            z-index: 1;
        }
        
        .process-step.active {
            transform: scale(1.05);
            opacity: 1;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        
        .step-icon {
            font-size: 3.5rem;
            margin-bottom: 15px;
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
        }
        
        .step-title {
            font-size: 1rem;
            color: #333;
            font-weight: 700;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .step-visual {
            height: 120px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        
        /* PDF 문서 */
        .pdf-document {
            position: relative;
            width: 80px;
        }
        
        .pdf-page {
            width: 80px;
            height: 100px;
            background: white;
            border-radius: 5px;
            margin-bottom: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
        
        .pdf-page:nth-child(2) {
            position: absolute;
            top: 5px;
            left: 5px;
            opacity: 0.7;
            z-index: -1;
        }
        
        .pdf-page:nth-child(3) {
            position: absolute;
            top: 10px;
            left: 10px;
            opacity: 0.4;
            z-index: -2;
        }
        
        /* 카메라 셔터 - 제거 */
        
        /* 변환 로더 */
        .conversion-loader {
            width: 150px;
        }
        
        .loader-bar {
            width: 100%;
            height: 6px;
            background: #e5e7eb;
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 10px;
        }
        
        .loader-bar::after {
            content: '';
            display: block;
            height: 100%;
            background: #667eea;
            border-radius: 10px;
            animation: loading 2s ease-in-out forwards;
        }
        
        @keyframes loading {
            from { width: 0%; }
            to { width: 100%; }
        }
        
        .loader-percent {
            font-size: 1rem;
            color: #333;
            font-weight: 600;
            font-family: monospace;
        }
        
        .conversion-particles {
            display: none;
        }
        
        /* 웹사이트 프리뷰 */
        .website-preview {
            width: 140px;
            height: 100px;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border: 1px solid #e5e7eb;
        }
        
        .website-preview.reveal {
            animation: none;
        }
        
        .browser-bar {
            background: #e5e7eb;
            height: 20px;
            display: flex;
            align-items: center;
            padding: 0 8px;
        }
        
        .browser-dots {
            display: flex;
            gap: 4px;
        }
        
        .browser-dots span {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #9ca3af;
        }
        
        .website-content {
            padding: 10px;
        }
        
        .web-element {
            height: 12px;
            background: #667eea;
            border-radius: 3px;
            margin-bottom: 6px;
        }
        
        .web-element:nth-child(1) { width: 70%; }
        .web-element:nth-child(2) { width: 50%; }
        .web-element.wide { width: 100%; height: 25px; }
        
        /* 화살표 */
        .process-arrow {
            display: flex;
            align-items: center;
            color: white;
            position: relative;
            z-index: 1;
        }
        
        .arrow-line {
            width: 40px;
            height: 3px;
            background: white;
            border-radius: 2px;
        }
        
        .arrow-head {
            font-size: 2rem;
            margin-left: -8px;
            font-weight: bold;
        }
        
        /* 효율성 배지 */
        .efficiency-badge {
            background: white;
            border-radius: 60px;
            padding: 25px 50px;
            display: inline-flex;
            align-items: center;
            gap: 20px;
            border: 3px solid #667eea;
            box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3);
        }
        
        .badge-icon {
            font-size: 2.5rem;
        }
        
        .badge-text {
            font-size: 1.1rem;
            color: #333;
            font-weight: 700;
        }
        
        .time-before {
            color: #ef4444;
            text-decoration: line-through;
            font-weight: 600;
        }
        
        .time-after {
            color: #10b981;
            font-size: 1.4rem;
            font-weight: 800;
        }
        
        @media (max-width: 768px) {
            .process-flow {
                flex-direction: column;
            }
            
            .process-arrow {
                transform: rotate(90deg);
            }
            
            .efficiency-badge {
                flex-direction: column;
                text-align: center;
            }
        }
    `;
    document.head.appendChild(style);
});