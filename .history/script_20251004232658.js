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

// 숫자 카운트업 애니메이션
function animateCounter(element) {
    const target = parseInt(element.getAttribute('data-target'));
    const duration = 2000;
    const step = target / (duration / 16);
    let current = 0;
    
    const timer = setInterval(() => {
        current += step;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
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
});