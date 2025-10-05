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

// 실시간 시계
// function updateTime() {
//     const now = new Date();
//     const timeString = now.toLocaleTimeString('ko-KR', { 
//         hour: '2-digit', 
//         minute: '2-digit', 
//         second: '2-digit' 
//     });
//     const dateString = now.toLocaleDateString('ko-KR', {
//         year: 'numeric',
//         month: '2-digit',
//         day: '2-digit'
//     });
//     document.getElementById('timeIndicator').textContent = `${dateString} ${timeString}`;
// }
// setInterval(updateTime, 1000);
// updateTime();

// 스크롤 진행 바
window.addEventListener('scroll', function() {
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    document.getElementById('progressLine').style.width = scrolled + '%';
});

// 시간 대비 업무 시각화 애니메이션
function createTimeWorkVisualization() {
    const heroContent = document.querySelector('.hero-content');
    if (!heroContent) return;
    
    // 기존 description 숨기기
    const oldDesc = document.querySelector('.hero .description');
    if (oldDesc) {
        oldDesc.style.display = 'none';
    }
    
    // 새로운 비교 컨테이너 생성
    const comparisonContainer = document.createElement('div');
    comparisonContainer.className = 'time-work-comparison';
    comparisonContainer.innerHTML = `
        <div class="comparison-wrapper">
            <div class="comparison-box without-solution">
                <div class="box-label">솔루션 없이</div>
                <div class="time-display">
                    <div class="time-icon">⏰</div>
                    <div class="time-value" id="timeWithout">0</div>
                    <div class="time-unit">시간 소요</div>
                </div>
                <div class="work-pile" id="workPileWithout">
                    <div class="work-label">쌓이는 업무</div>
                    <div class="work-items" id="workItemsWithout"></div>
                </div>
            </div>
            
            <div class="vs-divider">VS</div>
            
            <div class="comparison-box with-solution">
                <div class="box-label">솔루션 사용 시</div>
                <div class="time-display saved">
                    <div class="time-icon">✨</div>
                    <div class="time-value" id="timeWith">0</div>
                    <div class="time-unit">시간으로 단축</div>
                </div>
                <div class="work-pile completed">
                    <div class="work-label">처리된 업무</div>
                    <div class="work-items" id="workItemsWith"></div>
                </div>
            </div>
        </div>
        <div class="efficiency-message">
            <span class="efficiency-number" id="efficiencyPercent">0</span>% 업무 효율 개선
        </div>
    `;
    
    // description 위치에 삽입
    if (oldDesc) {
        oldDesc.parentNode.insertBefore(comparisonContainer, oldDesc);
    }
}

// 시간/업무 증가 애니메이션
function startTimeWorkAnimation() {
    let timeElapsed = 0;
    let workCountWithout = 0;
    let workCountWith = 0;
    
    const maxTime = 10; // 10시간
    const workSpeed = 150; // ms per work item
    
    // 시간 증가
    const timeInterval = setInterval(() => {
        timeElapsed += 0.5;
        
        const timeWithoutEl = document.getElementById('timeWithout');
        const timeWithEl = document.getElementById('timeWith');
        
        if (timeWithoutEl) {
            timeWithoutEl.textContent = timeElapsed.toFixed(1);
        }
        
        // 솔루션 사용 시간 (90% 단축)
        if (timeWithEl) {
            timeWithEl.textContent = (timeElapsed * 0.1).toFixed(1);
        }
        
        if (timeElapsed >= maxTime) {
            clearInterval(timeInterval);
        }
    }, 500);
    
    // 업무 쌓이기 (솔루션 없이)
    const workIntervalWithout = setInterval(() => {
        const workItemsWithout = document.getElementById('workItemsWithout');
        if (workItemsWithout && workCountWithout < 20) {
            const workItem = document.createElement('div');
            workItem.className = 'work-item';
            workItem.textContent = '📄';
            workItem.style.animationDelay = `${workCountWithout * 0.1}s`;
            workItemsWithout.appendChild(workItem);
            workCountWithout++;
        } else {
            clearInterval(workIntervalWithout);
        }
    }, workSpeed);
    
    // 업무 처리하기 (솔루션 사용)
    const workIntervalWith = setInterval(() => {
        const workItemsWith = document.getElementById('workItemsWith');
        if (workItemsWith && workCountWith < 20) {
            const workItem = document.createElement('div');
            workItem.className = 'work-item completed-item';
            workItem.textContent = '✅';
            workItem.style.animationDelay = `${workCountWith * 0.05}s`;
            workItemsWith.appendChild(workItem);
            workCountWith++;
        } else {
            clearInterval(workIntervalWith);
        }
    }, workSpeed / 2);
    
    // 효율성 퍼센트 증가
    let efficiency = 0;
    const efficiencyInterval = setInterval(() => {
        efficiency += 2;
        const efficiencyEl = document.getElementById('efficiencyPercent');
        if (efficiencyEl) {
            efficiencyEl.textContent = efficiency;
        }
        
        if (efficiency >= 90) {
            clearInterval(efficiencyInterval);
        }
    }, 50);
}

// Intersection Observer로 화면에 보일 때 애니메이션 시작
const observerOptions = {
    threshold: 0.3
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            startTimeWorkAnimation();
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
    createTimeWorkVisualization();
    
    const heroSection = document.querySelector('.hero');
    if (heroSection) {
        observer.observe(heroSection);
    }
    
    // 스타일 추가
    const style = document.createElement('style');
    style.textContent = `
        .time-work-comparison {
            margin: 50px 0 40px;
            animation: fadeInUp 1.2s ease 0.8s forwards;
            opacity: 0;
        }
        
        .comparison-wrapper {
            display: flex;
            gap: 30px;
            justify-content: center;
            align-items: stretch;
            flex-wrap: wrap;
        }
        
        .comparison-box {
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 30px;
            min-width: 280px;
            flex: 1;
            max-width: 400px;
            border: 2px solid rgba(255, 255, 255, 0.3);
        }
        
        .box-label {
            font-size: 0.9rem;
            color: rgba(255, 255, 255, 0.8);
            margin-bottom: 20px;
            text-align: center;
            font-weight: 600;
        }
        
        .time-display {
            text-align: center;
            margin-bottom: 25px;
        }
        
        .time-icon {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        
        .time-value {
            font-size: 3.5rem;
            font-weight: bold;
            color: white;
            line-height: 1;
            margin-bottom: 5px;
            font-family: monospace;
        }
        
        .time-display.saved .time-value {
            color: #4ade80;
            text-shadow: 0 0 20px rgba(74, 222, 128, 0.5);
        }
        
        .time-unit {
            font-size: 0.9rem;
            color: rgba(255, 255, 255, 0.7);
        }
        
        .work-pile {
            min-height: 120px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 10px;
            padding: 15px;
        }
        
        .work-label {
            font-size: 0.85rem;
            color: rgba(255, 255, 255, 0.6);
            margin-bottom: 10px;
            text-align: center;
        }
        
        .work-items {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: center;
        }
        
        .work-item {
            font-size: 1.5rem;
            animation: workPileUp 0.5s ease forwards;
            opacity: 0;
            transform: translateY(-20px);
        }
        
        @keyframes workPileUp {
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .completed-item {
            animation: workComplete 0.6s ease forwards;
        }
        
        @keyframes workComplete {
            0% {
                opacity: 0;
                transform: scale(0) rotate(-180deg);
            }
            50% {
                transform: scale(1.2) rotate(0deg);
            }
            100% {
                opacity: 1;
                transform: scale(1) rotate(0deg);
            }
        }
        
        .vs-divider {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            font-weight: bold;
            color: white;
            text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
            min-width: 60px;
        }
        
        .efficiency-message {
            text-align: center;
            margin-top: 30px;
            font-size: 1.3rem;
            color: white;
            font-weight: 600;
        }
        
        .efficiency-number {
            font-size: 2.5rem;
            color: #4ade80;
            font-weight: bold;
            text-shadow: 0 0 20px rgba(74, 222, 128, 0.5);
        }
        
        @media (max-width: 768px) {
            .comparison-wrapper {
                flex-direction: column;
            }
            
            .vs-divider {
                transform: rotate(90deg);
                margin: 10px 0;
            }
            
            .comparison-box {
                max-width: 100%;
            }
        }
    `;
    document.head.appendChild(style);
});