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
    // 1단계: PDF 촬영 (카메라 셔터)
    setTimeout(() => {
        const step1 = document.getElementById('step1');
        const shutter = document.getElementById('cameraShutter');
        step1.classList.add('active');
        
        // 셔터 효과
        shutter.classList.add('snap');
        setTimeout(() => shutter.classList.remove('snap'), 600);
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
            
            // 변환 파티클 생성
            if (percent % 10 === 0) {
                createConversionParticle();
            }
            
            if (percent >= 100) {
                clearInterval(loaderInterval);
            }
        }, 60);
    }, 2000);
    
    // 3단계: 웹사이트 완성 (등장 애니메이션)
    setTimeout(() => {
        const step3 = document.getElementById('step3');
        const website = document.getElementById('websitePreview');
        step3.classList.add('active');
        website.classList.add('reveal');
        
        // 성공 효과
        createSuccessEffect();
    }, 4500);
}

// 변환 파티클 생성
function createConversionParticle() {
    const container = document.getElementById('conversionParticles');
    if (!container) return;
    
    const particle = document.createElement('div');
    particle.className = 'conversion-particle';
    particle.textContent = ['✨', '⚡', '🔄', '💫'][Math.floor(Math.random() * 4)];
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (1 + Math.random()) + 's';
    container.appendChild(particle);
    
    setTimeout(() => particle.remove(), 2000);
}

// 성공 효과
function createSuccessEffect() {
    const step3 = document.getElementById('step3');
    if (!step3) return;
    
    const rect = step3.getBoundingClientRect();
    
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'success-particle';
        particle.textContent = '✨';
        particle.style.position = 'fixed';
        particle.style.left = (rect.left + rect.width / 2) + 'px';
        particle.style.top = (rect.top + rect.height / 2) + 'px';
        particle.style.fontSize = '1.5rem';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '10000';
        
        document.body.appendChild(particle);
        
        const angle = (i / 12) * Math.PI * 2;
        const distance = 80;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        
        particle.animate([
            { transform: 'translate(0, 0) scale(0)', opacity: 1 },
            { transform: `translate(${tx}px, ${ty}px) scale(1)`, opacity: 0 }
        ], {
            duration: 1000,
            easing: 'ease-out'
        }).onfinish = () => particle.remove();
    }
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

// 떠다니는 입자 생성
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    const particleCount = 30;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        particlesContainer.appendChild(particle);
    }
}

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', function() {
    createParticles();
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
            margin-bottom: 40px;
        }
        
        .process-step {
            background: white;
            border-radius: 10px;
            padding: 25px;
            min-width: 200px;
            text-align: center;
            border: 1px solid #e5e7eb;
            transition: all 0.3s ease;
        }
        
        .process-step.active {
            border-color: #667eea;
        }
        
        .step-icon {
            font-size: 3rem;
            margin-bottom: 10px;
        }
        
        .step-title {
            font-size: 1rem;
            color: white;
            font-weight: 600;
            margin-bottom: 15px;
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
        
        /* 카메라 셔터 */
        .camera-shutter {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: white;
            opacity: 0;
            pointer-events: none;
        }
        
        .camera-shutter.snap {
            animation: shutterSnap 0.6s ease;
        }
        
        @keyframes shutterSnap {
            0% { opacity: 0; }
            50% { opacity: 0.8; }
            100% { opacity: 0; }
        }
        
        /* 변환 로더 */
        .conversion-loader {
            width: 150px;
        }
        
        .loader-bar {
            width: 100%;
            height: 8px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 10px;
        }
        
        .loader-bar::after {
            content: '';
            display: block;
            height: 100%;
            background: linear-gradient(90deg, #4ade80, #22c55e);
            border-radius: 10px;
            animation: loading 3s ease-in-out forwards;
        }
        
        @keyframes loading {
            from { width: 0%; }
            to { width: 100%; }
        }
        
        .loader-percent {
            font-size: 1.2rem;
            color: white;
            font-weight: bold;
            font-family: monospace;
        }
        
        .conversion-particles {
            position: absolute;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }
        
        .conversion-particle {
            position: absolute;
            font-size: 1.5rem;
            animation: particleRise 2s ease-out forwards;
        }
        
        @keyframes particleRise {
            from {
                transform: translateY(0);
                opacity: 1;
            }
            to {
                transform: translateY(-80px);
                opacity: 0;
            }
        }
        
        /* 웹사이트 프리뷰 */
        .website-preview {
            width: 140px;
            height: 100px;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            opacity: 0;
            transform: scale(0.5);
        }
        
        .website-preview.reveal {
            animation: websiteReveal 0.8s ease forwards;
        }
        
        @keyframes websiteReveal {
            to {
                opacity: 1;
                transform: scale(1);
            }
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
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 3px;
            margin-bottom: 6px;
            opacity: 0;
            animation: elementFadeIn 0.5s ease forwards;
        }
        
        .web-element:nth-child(1) { animation-delay: 0.3s; width: 70%; }
        .web-element:nth-child(2) { animation-delay: 0.5s; width: 50%; }
        .web-element.wide { animation-delay: 0.7s; width: 100%; height: 25px; }
        
        @keyframes elementFadeIn {
            from {
                opacity: 0;
                transform: translateX(-10px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        /* 화살표 */
        .process-arrow {
            display: flex;
            align-items: center;
            color: white;
            opacity: 0.6;
        }
        
        .arrow-line {
            width: 30px;
            height: 2px;
            background: white;
        }
        
        .arrow-head {
            font-size: 1.5rem;
            margin-left: -5px;
        }
        
        /* 효율성 배지 */
        .efficiency-badge {
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            border-radius: 50px;
            padding: 20px 40px;
            display: inline-flex;
            align-items: center;
            gap: 15px;
            border: 2px solid rgba(255, 255, 255, 0.3);
        }
        
        .badge-icon {
            font-size: 2rem;
        }
        
        .badge-text {
            font-size: 1.1rem;
            color: white;
            font-weight: 600;
        }
        
        .time-before {
            color: #fca5a5;
            text-decoration: line-through;
        }
        
        .time-after {
            color: #4ade80;
            font-size: 1.3rem;
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