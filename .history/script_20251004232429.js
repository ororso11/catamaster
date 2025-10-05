<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>카탈로그 자동화 업로드 솔루션</title>
    <link rel="stylesheet" href="style.css">
    <style>
        /* 시간이 흐르는 효과 - 애니메이션 추가 */
        
        /* 배경 그라데이션이 천천히 움직임 */
        .hero {
            background: linear-gradient(-45deg, #667eea, #764ba2, #f093fb, #667eea);
            background-size: 400% 400%;
            animation: gradientShift 15s ease infinite;
        }
        
        @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        
        /* 텍스트가 천천히 나타남 */
        .hero h1 {
            opacity: 0;
            animation: fadeInUp 1.5s ease forwards;
        }
        
        .hero .subtitle {
            opacity: 0;
            animation: fadeInUp 1.5s ease 0.3s forwards;
        }
        
        .hero .description {
            opacity: 0;
            animation: fadeInUp 1.5s ease 0.6s forwards;
        }
        
        .hero .cta-button {
            opacity: 0;
            animation: fadeInUp 1.5s ease 0.9s forwards;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        /* 시계 효과 - 실시간 시간 표시 */
        .time-indicator {
            position: fixed;
            top: 20px;
            right: 20px;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.7);
            font-family: monospace;
            z-index: 1000;
        }
        
        /* 떠다니는 입자 효과 */
        .particle {
            position: absolute;
            width: 4px;
            height: 4px;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 50%;
            animation: float 20s infinite linear;
        }
        
        @keyframes float {
            0% {
                transform: translateY(100vh) translateX(0);
                opacity: 0;
            }
            10% {
                opacity: 1;
            }
            90% {
                opacity: 1;
            }
            100% {
                transform: translateY(-100px) translateX(100px);
                opacity: 0;
            }
        }
        
        /* 카운트업 애니메이션 */
        .counter {
            font-size: 3.5rem;
            font-weight: bold;
            color: #667eea;
        }
        
        /* 진행 바 애니메이션 */
        .progress-line {
            position: fixed;
            top: 0;
            left: 0;
            height: 3px;
            background: linear-gradient(to right, #667eea, #764ba2);
            width: 0%;
            transition: width 0.3s ease;
            z-index: 9999;
        }
    </style>
</head>
<body>
    <!-- 진행 바 -->
    <div class="progress-line" id="progressLine"></div>
    
    <!-- 시간 표시 -->
    <div class="time-indicator" id="timeIndicator"></div>

    <!-- Header -->
    <header>
        <div class="header-container">
            <div class="logo">
                <div class="logo-icon">C</div>
                <span>CATALOG</span>
            </div>
            <nav id="mainNav">
                <a href="#home">Home</a>
                <a href="#solutions">Service</a>
                <a href="#partners">Partners</a>
                <a href="#contact">About</a>
            </nav>
        </div>
    </header>

    <!-- Hero Section -->
    <section class="hero" id="home">
        <!-- 떠다니는 입자들 -->
        <div id="particles"></div>
        
        <div class="hero-content">
            <h1>카탈로그 제작 시<br>PDF 추가·수정 너무 힘드셨죠?</h1>
            <p class="subtitle">이제 저희가 해결해드릴게요</p>
            <p class="description">해당 솔루션 도입 후 <span class="counter" data-target="90">0</span>% 자동화 및 업무 효율성 개선</p>
            <a href="dashboard.html" class="cta-button">무료 체험하기</a>
        </div>
    </section>

    <!-- 나머지 섹션들... -->

    <script>
        // 1. 실시간 시계
        function updateTime() {
            const now = new Date();
            const timeString = now.toLocaleTimeString('ko-KR', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
            document.getElementById('timeIndicator').textContent = timeString;
        }
        setInterval(updateTime, 1000);
        updateTime();
        
        // 2. 스크롤 진행 바
        window.addEventListener('scroll', function() {
            const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = (winScroll / height) * 100;
            document.getElementById('progressLine').style.width = scrolled + '%';
        });
        
        // 3. 숫자 카운트업 애니메이션
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
        
        observer.observe(document.querySelector('.hero'));
        
        // 4. 떠다니는 입자 생성
        function createParticles() {
            const particlesContainer = document.getElementById('particles');
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
        createParticles();
        
        // 5. 페이지 로드 시간 표시 (개발자용)
        window.addEventListener('load', function() {
            const loadTime = (performance.now() / 1000).toFixed(2);
            console.log(`페이지 로드 시간: ${loadTime}초`);
        });
    </script>
</body>
</html>