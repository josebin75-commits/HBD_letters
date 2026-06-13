// 1. Firebase 초기화 (Compat API 사용)
let db = null;
try {
  if (typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  } else {
    console.warn("firebaseConfig가 비어있거나 기본값입니다. Firebase를 연동하지 않고 로컬 시뮬레이션 데이터로 구동합니다.");
  }
} catch (e) {
  console.error("Firebase 초기화 중 에러 발생:", e);
}

// 로드된 편지 데이터 저장용 객체
let loadedLetterData = null;

// DOM 요소 선택
document.addEventListener('DOMContentLoaded', async () => {
  const loadingContainer = document.getElementById('loading-container');
  const noIdContainer = document.getElementById('no-id-container');
  const introContainer = document.getElementById('intro-container');
  const mainContainer = document.getElementById('main-container');
  
  const giftBox = document.getElementById('gift-box');
  const padlock = document.getElementById('padlock');
  const passwordPanel = document.getElementById('password-panel');
  const passwordHint = document.getElementById('password-hint');
  const passwordInput = document.getElementById('password-input');
  const passwordForm = document.getElementById('password-form');
  const errorMessage = document.getElementById('error-message');
  
  const mainTitle = document.getElementById('main-title');
  const bgmToggle = document.getElementById('bgm-toggle');
  const bgmIcon = document.getElementById('bgm-icon');
  const localAudio = document.getElementById('local-bgm');
  const slidesContainer = document.getElementById('slides-container');
  const letterContent = document.getElementById('letter-content');
  const celebrateBtn = document.getElementById('celebrate-btn');

  // 답장 관련 DOM
  const replyForm = document.getElementById('reply-form');
  const replySenderName = document.getElementById('reply-sender-name');
  const replyText = document.getElementById('reply-text');
  const replySubmitBtn = document.getElementById('reply-submit-btn');
  const replySuccessMessage = document.getElementById('reply-success-message');

  // 로딩 상태 제어 관련 DOM
  const loadingCard = document.getElementById('loading-card');
  const loadingErrorCard = document.getElementById('loading-error-card');
  const retryBtn = document.getElementById('retry-btn');

  let isBgmPlaying = false;
  let currentSlideIndex = 0;
  let slideshowInterval = null;
  let typingTimeout = null;

  // 1. URL에서 편지 ID (?id=xxxx) 획득
  const urlParams = new URLSearchParams(window.location.search);
  const letterId = urlParams.get('id');

  // 2. 분기 처리 및 데이터 로딩
  if (letterId) {
    if (letterId === 'demo' || letterId === 'local_demo') {
      // 명시적으로 데모 데이터를 요청한 경우 로컬 Fallback 실행
      loadLocalFallback();
    } else if (letterId.startsWith('local_')) {
      // ==========================================
      // [시뮬레이터 모드] LocalStorage에서 로드
      // ==========================================
      try {
        const localData = JSON.parse(localStorage.getItem(`letter_${letterId}`));
        if (localData) {
          loadedLetterData = localData;
          setupLetterUI();
        } else {
          throw new Error("로컬 시뮬레이션 데이터를 찾을 수 없습니다.");
        }
      } catch (error) {
        console.warn("로컬 스토리지 데이터 로드 에러:", error.message);
        showLoadingError();
      }
    } else {
      // ==========================================
      // [실제 배포 모드] Firebase에서 로드
      // ==========================================
      try {
        if (!db) {
          throw new Error("파이어베이스 초기화가 되지 않았습니다.");
        }

        const docRef = db.collection("letters").doc(letterId);
        
        // 6초 응답 타임아웃 레이스 처리 (무한 대기 방지)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("네트워크 연결 시간이 초과되었습니다.")), 6000)
        );

        const docSnap = await Promise.race([
          docRef.get(),
          timeoutPromise
        ]);

        if (docSnap.exists) {
          loadedLetterData = docSnap.data();
          setupLetterUI();
        } else {
          throw new Error("지정된 생일 편지를 데이터베이스에서 찾을 수 없습니다.");
        }
      } catch (error) {
        console.warn("데이터베이스 로드 에러:", error.message);
        
        // 개발 초기 모드 (키가 설정되지 않은 경우)이면서 로컬 CONFIG가 있다면 로컬 폴백 지원
        if ((typeof firebaseConfig === 'undefined' || firebaseConfig.apiKey === 'YOUR_API_KEY') && typeof CONFIG !== 'undefined') {
          console.log("로컬 데모 모드로 자동 전환합니다.");
          loadLocalFallback();
        } else {
          // 실제 서비스 구동 중 오류(네트워크 단절, 링크 분실 등)는 화면에 에러 카드 노출
          showLoadingError();
        }
      }
    }
  } else {
    // ID가 아예 없을 경우, 뷰어로 가지 않고 제작 안내 화면(no-id-container) 노출
    loadingContainer.classList.add('hidden');
    noIdContainer.classList.remove('hidden');
  }

  // 에러 발생 시 UI 처리
  function showLoadingError() {
    loadingCard.classList.add('hidden');
    loadingErrorCard.classList.remove('hidden');
    
    // 다시 시도 버튼 이벤트 바인딩
    retryBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }

  // 로컬 config.js를 이용해 오프라인 테스트 지원
  function loadLocalFallback() {
    if (typeof CONFIG !== 'undefined') {
      console.log("로컬 config.js 데이터를 로드합니다.");
      loadedLetterData = CONFIG;
      setupLetterUI();
    } else {
      // 로컬 CONFIG 파일도 없으면 최종적으로 서비스 안내 화면 노출
      loadingContainer.classList.add('hidden');
      noIdContainer.classList.remove('hidden');
    }
  }

  // 한글 받침 유무 판별하여 아/야 조사 구하는 헬퍼 함수
  function getJosa(name) {
    if (!name) return "야";
    const lastChar = name.charAt(name.length - 1);
    const code = lastChar.charCodeAt(0);
    
    // 한글 유니코드 범위 (가 ~ 힣)
    if (code >= 0xac00 && code <= 0xd7a3) {
      const hasBatchim = (code - 0xac00) % 28 !== 0;
      return hasBatchim ? "아" : "야";
    }
    return "야"; // 영문 등 한글 외 기본 조사
  }

  // 화면 UI 설정
  function setupLetterUI() {
    if (!loadedLetterData) return;
    
    // 생일 퀴즈 질문(힌트) 및 메인 축하 타이틀 바인딩
    passwordHint.innerText = loadedLetterData.passwordHint || loadedLetterData.hint || "암호를 입력해줘!";
    
    const josa = getJosa(loadedLetterData.recipientName);
    mainTitle.innerText = `${loadedLetterData.recipientName}${josa}, 생일 축하해! ✨`;
    
    // 로딩 화면 감추고 인트로 화면 보여주기
    loadingContainer.classList.add('hidden');
    introContainer.classList.remove('hidden');
  }

  // 3. 선물상자 & 자물쇠 클릭 -> 비밀번호/퀴즈 입력 카드 노출
  padlock.addEventListener('click', togglePasswordPanel);
  giftBox.addEventListener('click', (e) => {
    if (!e.target.closest('#padlock') && !giftBox.classList.contains('open')) {
      togglePasswordPanel();
    }
  });

  function togglePasswordPanel() {
    if (passwordPanel.classList.contains('hidden')) {
      passwordPanel.classList.remove('hidden');
      passwordInput.focus();
      passwordPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // 4. 생일 퀴즈 정답 제출 비교
  passwordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputVal = passwordInput.value.trim();
    const correctPassword = loadedLetterData ? (loadedLetterData.password) : '도서관';

    if (inputVal === correctPassword) {
      handleUnlockSequence();
    } else {
      handleWrongPassword();
    }
  });

  function handleWrongPassword() {
    errorMessage.classList.remove('hidden');
    passwordPanel.classList.add('shake');
    setTimeout(() => {
      passwordPanel.classList.remove('shake');
    }, 400);
    passwordInput.value = '';
    passwordInput.focus();
  }

  // 정답 시 자물쇠 해제 및 상자 열림 모션
  function handleUnlockSequence() {
    errorMessage.classList.add('hidden');
    passwordInput.blur();
    
    padlock.classList.add('unlocked');
    
    setTimeout(() => {
      giftBox.classList.add('open');
    }, 600);

    setTimeout(() => {
      introContainer.style.opacity = '0';
      introContainer.style.transform = 'scale(0.95)';
      
      setTimeout(() => {
        introContainer.classList.add('hidden');
        mainContainer.classList.remove('hidden');
        mainContainer.style.opacity = '0';
        mainContainer.style.transform = 'scale(1.05)';
        
        setTimeout(() => {
          mainContainer.style.opacity = '1';
          mainContainer.style.transform = 'scale(1)';
          
          startBgm();
          initSlideshow();
          startTypewriter();
          fireWelcomeConfetti();
        }, 50);

      }, 1000);
    }, 1500);
  }

  // 5. BGM 오디오 제어
  function startBgm() {
    isBgmPlaying = true;
    
    if (loadedLetterData && loadedLetterData.bgmUrl && loadedLetterData.bgmUrl !== '') {
      localAudio.src = loadedLetterData.bgmUrl;
      localAudio.volume = loadedLetterData.bgmVolume || 0.4;
      localAudio.play().catch(err => {
        console.log('자동 재생 정책으로 차단됨. 사용자 동작 후 재생됩니다.', err);
        isBgmPlaying = false;
        updateBgmUI();
      });
    } else {
      if (typeof musicBox !== 'undefined') {
        musicBox.start();
      }
    }
    updateBgmUI();
  }

  function toggleBgm() {
    if (isBgmPlaying) {
      if (loadedLetterData && loadedLetterData.bgmUrl && loadedLetterData.bgmUrl !== '') {
        localAudio.pause();
      } else {
        if (typeof musicBox !== 'undefined') musicBox.stop();
      }
      isBgmPlaying = false;
    } else {
      if (loadedLetterData && loadedLetterData.bgmUrl && loadedLetterData.bgmUrl !== '') {
        localAudio.play().catch(err => console.log(err));
      } else {
        if (typeof musicBox !== 'undefined') musicBox.start();
      }
      isBgmPlaying = true;
    }
    updateBgmUI();
  }

  function updateBgmUI() {
    if (isBgmPlaying) {
      bgmToggle.classList.remove('muted');
      bgmIcon.className = 'fa-solid fa-music';
    } else {
      bgmToggle.classList.add('muted');
      bgmIcon.className = 'fa-solid fa-volume-xmark';
    }
  }

  bgmToggle.addEventListener('click', toggleBgm);

  // 6. 사진 슬라이드쇼 구축
  function initSlideshow() {
    const photos = (loadedLetterData && loadedLetterData.photoUrls) ? loadedLetterData.photoUrls : (loadedLetterData && loadedLetterData.photos ? loadedLetterData.photos : ['photo1.jpg', 'photo2.jpg', 'photo3.jpg']);
    
    photos.forEach((src, idx) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = `추억 사진 ${idx + 1}`;
      img.className = 'slide-img';
      if (idx === 0) img.classList.add('active');
      
      img.onerror = () => {
        img.style.display = 'none';
        const fallback = document.createElement('div');
        fallback.className = 'slide-img active';
        fallback.style.background = 'linear-gradient(135deg, #f7ebe1 0%, #e6ccb2 100%)';
        fallback.style.display = 'flex';
        fallback.style.justifyContent = 'center';
        fallback.style.alignItems = 'center';
        fallback.style.color = '#7d6b5d';
        fallback.style.padding = '20px';
        fallback.style.textAlign = 'center';
        fallback.style.fontSize = '0.9rem';
        fallback.innerHTML = `<div><i class="fa-regular fa-image" style="font-size: 2.5rem; margin-bottom:10px; color:#c97d60;"></i><br>사진 로드에 실패했습니다.</div>`;
        slidesContainer.appendChild(fallback);
      };

      slidesContainer.appendChild(img);
    });

    if (photos.length > 1) {
      slideshowInterval = setInterval(() => {
        const slides = slidesContainer.querySelectorAll('.slide-img, div.slide-img');
        if (slides.length === 0) return;
        
        slides[currentSlideIndex].classList.remove('active');
        currentSlideIndex = (currentSlideIndex + 1) % slides.length;
        slides[currentSlideIndex].classList.add('active');
      }, 4000);
    }
  }

  // 7. 타자기 편지 효과
  function startTypewriter() {
    const letterText = loadedLetterData ? (loadedLetterData.letterText || loadedLetterData.letterText) : '생일 축하해!';
    let index = 0;
    
    letterContent.innerHTML = '';
    letterContent.classList.add('typing-cursor');
    
    const letterPaper = document.querySelector('.letter-card');

    function type() {
      if (index < letterText.length) {
        const char = letterText.charAt(index);
        
        if (char === '\n') {
          letterContent.innerHTML += '<br>';
        } else {
          letterContent.innerHTML += char;
        }
        
        index++;
        
        // 오버플로우 시 자동 스크롤 다운
        letterPaper.scrollTop = letterPaper.scrollHeight;
        
        let delay = 65;
        if (char === '.' || char === '!' || char === '?') delay = 350;
        else if (char === ',') delay = 150;
        
        typingTimeout = setTimeout(type, delay);
      } else {
        letterContent.classList.remove('typing-cursor');
      }
    }
    
    type();
  }

  // 8. 웰컴 컨페티 폭죽
  function fireWelcomeConfetti() {
    const duration = 1.5 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 },
        colors: ['#c97d60', '#e3d5ca', '#d4af37', '#e76f51', '#fdfbf7']
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 },
        colors: ['#c97d60', '#e3d5ca', '#d4af37', '#e76f51', '#fdfbf7']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  }

  // '축하해!' 버튼 폭죽
  celebrateBtn.addEventListener('click', () => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.65 },
      colors: ['#c97d60', '#e3d5ca', '#d4af37', '#e76f51', '#fdfbf7', '#b5838d', '#e07a5f'],
      scalar: 1.2
    });

    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.85 },
        colors: ['#c97d60', '#d4af37', '#fdfbf7']
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.85 },
        colors: ['#c97d60', '#d4af37', '#fdfbf7']
      });
    }, 150);

    setTimeout(() => {
      const defaults = { spread: 360, ticks: 50, gravity: 0.6, decay: 0.94, startVelocity: 15, colors: ['#ffe8a3', '#d4af37', '#ffffff'] };
      confetti({ ...defaults, particleCount: 30, scalar: 1.2, shapes: ['star'] });
      confetti({ ...defaults, particleCount: 20, scalar: 0.75, shapes: ['circle'] });
    }, 300);
  });

  // 9. 친구 답장 전송 처리
  replyForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const senderName = replySenderName.value.trim();
    const replyTextVal = replyText.value.trim();

    // ==========================================
    // [시뮬레이터 모드] LocalStorage 답장 전송
    // ==========================================
    if (!db || letterId.startsWith('local_')) {
      try {
        const replyData = {
          letterId: letterId,
          senderName: senderName,
          replyText: replyTextVal,
          createdAt: new Date().getTime()
        };
        
        // 고유 로컬 답장 ID 생성
        const localReplyId = 'reply_local_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 5);
        localStorage.setItem(localReplyId, JSON.stringify(replyData));

        replyForm.reset();
        replySuccessMessage.innerText = "답장이 로컬 브라우저 저장소에 안전하게 전송되었습니다! 💌";
        replySuccessMessage.classList.remove('hidden');
        
        confetti({
          particleCount: 40,
          angle: 90,
          spread: 50,
          origin: { y: 0.8 },
          colors: ['#c97d60', '#e76f51', '#fdfbf7']
        });

        setTimeout(() => replySuccessMessage.classList.add('hidden'), 5000);

      } catch (err) {
        console.error("로컬 답장 저장 실패:", err);
        alert("로컬 저장 중 에러가 발생했습니다: " + err.message);
      }
      return;
    }

    // ==========================================
    // [실제 배포 모드] Firebase 답장 전송
    // ==========================================
    replySubmitBtn.disabled = true;
    replySubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 전송 중...';

    try {
      await db.collection("replies").add({
        letterId: letterId,
        senderName: senderName,
        replyText: replyTextVal,
        createdAt: new Date().getTime()
      });

      replyForm.reset();
      replySuccessMessage.innerText = "답장이 안전하게 발송되었습니다! 💌";
      replySuccessMessage.classList.remove('hidden');
      
      confetti({
        particleCount: 40,
        angle: 90,
        spread: 50,
        origin: { y: 0.8 },
        colors: ['#c97d60', '#e76f51', '#fdfbf7']
      });

      setTimeout(() => {
        replySuccessMessage.classList.add('hidden');
      }, 5000);

    } catch (err) {
      console.error("답장 전송 실패:", err);
      alert("답장을 보내는 데 실패했습니다: " + err.message);
    } finally {
      replySubmitBtn.disabled = false;
      replySubmitBtn.innerHTML = '답장 보내기 💌';
    }
  });
});
