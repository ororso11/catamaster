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
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    const dateString = now.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    document.getElementById('timeIndicator').textContent = `${dateString} ${timeString}`;
}
setInterval(updateTime, 1000);
updateTime();

// 스크롤 진행 바
window.addEventListener('scroll', function() {
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    document.getElementById('progressLine').style.width = scrolled + '%';
});

// 개선된 숫자 카운트업 애니메이션 (이징 효과 추가)
function animateCounter(element) {
    const target = parseInt(element.getAttribute('data-target'));
    const duration = 2500;
    const startTime = performance.now();
    
    // 이징 함수 (easeOutExpo)
    function easeOutExpo(t) {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }
    
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutExpo(progress);
        const current = Math.floor(easedProgress * target);
        
        element.textContent = current;
        
        // 숫자가 변할 때마다 강조 효과
        element.style.transform = `scale(${1 + (1 - progress) * 0.1})`;
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = target;
            element.style.transform = 'scale(1)';
            
            // 완료 후 펄스 효과
            element.style.animation = 'counterPulse 0.6s ease';
            setTimeout(() => {
                element.style.animation = '';
            }, 600);
        }
    }
    
    requestAnimationFrame(updateCounter);
}

// 마우스 호버 시 숫자 강조 효과
document.addEventListener('DOMContentLoaded', function() {
    const counters = document.querySelectorAll('.counter');
    
    counters.forEach(counter => {
        // 마우스 호버 효과
        counter.addEventListener('mouseenter', function() {
            this.style.textShadow = '0 0 20px rgba(255, 255, 255, 0.8)';
            this.style.transform = 'scale(1.15)';
            this.style.transition = 'all 0.3s ease';
        });
        
        counter.addEventListener('mouseleave', function() {
            this.style.textShadow = 'none';
            this.style.transform = 'scale(1)';
        });
        
        // 클릭 시 재생 효과
        counter.addEventListener('click', function() {
            const target = parseInt(this.getAttribute('data-target'));
            this.textContent = '0';
            animateCounter(this);
            
            // 클릭 파티클 효과
            createClickParticles(this);
        });
    });
});

// 클릭 파티클 효과
function createClickParticles(element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    for (let i = 0; i < 8; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'fixed';
        particle.style.left = centerX + 'px';
        particle.style.top = centerY + 'px';
        particle.style.width = '8px';
        particle.style.height = '8px';
        particle.style.background = 'white';
        particle.style.borderRadius = '50%';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '10000';
        
        document.body.appendChild(particle);
        
        const angle = (i / 8) * Math.PI * 2;
        const distance = 50;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        
        particle.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
        ], {
            duration: 600,
            easing: 'ease-out'
        }).onfinish = () => particle.remove();
    }
}

// Intersection Observer로 화면에 보일 때 카운터 시작
const observerOptions = {
    threshold: 0.5
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const counters = entry.target.querySelectorAll('.counter');
            counters.forEach(counter => {
                if (counter.textContent === '0') {
                    animateCounter(counter);
                }
            });
        }
    });
}, observerOptions);

const heroSection = document.querySelector('.hero');
if (heroSection) {
    observer.observe(heroSection);
}

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
    
    // CSS 애니메이션 추가
    const style = document.createElement('style');
    style.textContent = `
        @keyframes counterPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
        
        .counter {
            cursor: pointer;
            display: inline-block;
            transition: all 0.3s ease;
            user-select: none;
        }
        
        .counter:hover {
            animation: counterFloat 1s ease-in-out infinite;
        }
        
        @keyframes counterFloat {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-5px) scale(1.1); }
        }
    `;
    document.head.appendChild(style);
});