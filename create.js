// 1. Firebase 초기화 (Compat API 사용)
let db = null;
let storage = null;
try {
  if (typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    storage = firebase.storage();
  } else {
    console.warn("firebaseConfig가 설정되지 않았습니다. 로컬 시뮬레이션 모드(LocalStorage)로 편지 데이터를 저장하고 관리합니다.");
  }
} catch (e) {
  console.error("Firebase 초기화 중 에러 발생:", e);
}

// 업로드할 파일들을 저장할 배열
let selectedFiles = [];

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const viewMode = urlParams.get('view');
  const letterId = urlParams.get('id');

  // 라우팅 분기 처리
  if (viewMode === 'replies' && letterId) {
    showSection('replies-section');
    loadReplies(letterId);
  } else {
    showSection('create-section');
    initCreatorMode();
  }
});

// 섹션 전환 함수
function showSection(sectionId) {
  const sections = ['create-section', 'success-section', 'replies-section'];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (id === sectionId) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

// 이미지 리사이즈 및 압축 함수 (로컬 저장소 한계 용량 5MB 초과 방지 및 트래픽 절약)
function resizeImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max_size = 700; // 최대 가로/세로 700px로 제한
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > max_size) {
            height *= max_size / width;
            width = max_size;
          }
        } else {
          if (height > max_size) {
            width *= max_size / height;
            height = max_size;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // JPEG 포맷으로 압축해 용량을 50KB 내외로 대폭 경량화
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ==========================================
// 1. 제작자 모드 (Letter Creator Mode)
// ==========================================
function initCreatorMode() {
  const creatorForm = document.getElementById('creator-form');
  const fileDropzone = document.getElementById('file-dropzone');
  const fileInput = document.getElementById('file-input');
  const previewContainer = document.getElementById('preview-container');
  const createNewBtn = document.getElementById('create-new-btn');
  
  selectedFiles = []; // 초기화

  // 드롭존 클릭 -> 파일 선택 창 열기
  fileDropzone.addEventListener('click', () => fileInput.click());

  // 파일 선택 감지
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = ''; // 동일 파일 재선택 가능하게 함
  });

  // 드래그 앤 드롭 이벤트
  ['dragenter', 'dragover'].forEach(eventName => {
    fileDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      fileDropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    fileDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      fileDropzone.classList.remove('dragover');
    }, false);
  });

  fileDropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    handleFiles(dt.files);
  });

  // 파일 정밀 필터링 및 관리
  function handleFiles(files) {
    const limit = 5;
    
    if (selectedFiles.length + files.length > limit) {
      alert(`사진은 최대 ${limit}장까지만 업로드할 수 있습니다.`);
      return;
    }

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name}은(는) 이미지 파일이 아닙니다.`);
        return;
      }
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(`${file.name}의 용량이 5MB를 초과합니다. 더 작은 크기의 이미지를 선택해 주세요.`);
        return;
      }

      selectedFiles.push(file);
      renderPreviews();
    });
  }

  // 업로드 파일 미리보기 렌더링
  function renderPreviews() {
    previewContainer.innerHTML = '';
    
    if (selectedFiles.length === 0) {
      previewContainer.style.display = 'none';
      return;
    }
    
    previewContainer.style.display = 'flex';

    selectedFiles.forEach((file, index) => {
      const previewWrapper = document.createElement('div');
      previewWrapper.className = 'preview-img-wrapper';

      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src); // 메모리 방출
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'preview-remove-btn';
      removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      removeBtn.type = 'button';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFiles.splice(index, 1);
        renderPreviews();
      });

      previewWrapper.appendChild(img);
      previewWrapper.appendChild(removeBtn);
      previewContainer.appendChild(previewWrapper);
    });
  }

  // 편지 생성 폼 제출
  creatorForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (selectedFiles.length < 1) {
      alert("추억을 담을 사진을 최소 1장 이상 업로드해 주세요!");
      return;
    }

    const recipientName = document.getElementById('recipient-name').value.trim();
    const password = document.getElementById('letter-password').value.trim();
    const passwordHint = document.getElementById('password-hint-input').value.trim();
    const letterText = document.getElementById('letter-text-input').value;

    const loadingOverlay = document.getElementById('loading-overlay');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    loadingOverlay.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.innerText = '사진을 상자에 담는 중 (0%)...';

    // 파이어베이스가 연결되어 있는지 체크
    const isFirebaseActive = (db && storage && typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey !== 'YOUR_API_KEY');

    if (!isFirebaseActive) {
      // ==========================================
      // [시뮬레이터 모드] LocalStorage 저장
      // ==========================================
      try {
        progressBar.style.width = '20%';
        progressText.innerText = '로컬 시뮬레이션 저장 준비 중...';
        
        const photoUrls = [];
        for (let i = 0; i < selectedFiles.length; i++) {
          progressBar.style.width = `${20 + Math.round((i / selectedFiles.length) * 60)}%`;
          progressText.innerText = `사진 압축 중... (${i + 1}/${selectedFiles.length}장)`;
          
          // 이미지를 리사이징 및 압축해서 base64 데이터화
          const compressedBase64 = await resizeImage(selectedFiles[i]);
          photoUrls.push(compressedBase64);
        }

        progressBar.style.width = '90%';
        progressText.innerText = '브라우저 저장소에 쓰는 중...';

        const newLetterId = 'local_' + new Date().getTime();
        const letterData = {
          recipientName,
          password,
          passwordHint,
          letterText,
          photoUrls,
          createdAt: new Date().getTime()
        };

        // 로컬스토리지에 저장
        localStorage.setItem(`letter_${newLetterId}`, JSON.stringify(letterData));
        
        progressBar.style.width = '100%';
        progressText.innerText = '저장 완료!';
        
        setTimeout(() => {
          setupSuccessSection(newLetterId);
        }, 500);

      } catch (error) {
        console.error("로컬 시뮬레이션 저장 에러:", error);
        alert("로컬 저장 중 오류가 발생했습니다. 브라우저 용량이 부족할 수 있습니다: " + error.message);
      } finally {
        loadingOverlay.classList.add('hidden');
      }
      return;
    }

    // ==========================================
    // [실제 배포 모드] Firebase 클라우드 저장
    // ==========================================
    try {
      // 1. Firestore 문서 참조 먼저 획득하여 ID 선점
      const letterDocRef = db.collection("letters").doc();
      const newLetterId = letterDocRef.id;

      // 2. Storage에 사진 업로드 진행
      const photoUrls = [];
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileExtension = file.name.split('.').pop();
        const storagePath = `images/${newLetterId}/photo_${i + 1}.${fileExtension}`;
        const storageRef = storage.ref(storagePath);

        const uploadTask = storageRef.put(file);

        // 업로드 진행도를 Promise로 감싸서 동기 처리
        const downloadUrl = await new Promise((resolve, reject) => {
          uploadTask.on('state_changed', 
            (snapshot) => {
              const fileProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              const overallProgress = Math.round(
                ((i / selectedFiles.length) * 100) + (fileProgress / selectedFiles.length)
              );
              progressBar.style.width = `${overallProgress}%`;
              progressText.innerText = `사진 업로드 중... ${overallProgress}% (${i + 1}/${selectedFiles.length}장)`;
            }, 
            (error) => {
              console.error("업로드 에러:", error);
              reject(error);
            }, 
            async () => {
              const url = await storageRef.getDownloadURL();
              resolve(url);
            }
          );
        });

        photoUrls.push(downloadUrl);
      }

      progressBar.style.width = '100%';
      progressText.innerText = '데이터 저장 중...';

      // 3. Firestore에 최종 정보 데이터 쓰기
      await letterDocRef.set({
        recipientName,
        password,
        passwordHint,
        letterText,
        photoUrls,
        createdAt: new Date().getTime()
      });

      // 4. 완료 후 공유 링크 셋업
      setupSuccessSection(newLetterId);
      
    } catch (error) {
      console.error("데이터 생성 중 실패:", error);
      alert("페이지 생성 중 오류가 발생했습니다. 다시 시도해 주세요: " + error.message);
    } finally {
      loadingOverlay.classList.add('hidden');
    }
  });

  // 새 편지 만들기 리셋
  createNewBtn.addEventListener('click', () => {
    creatorForm.reset();
    selectedFiles = [];
    previewContainer.innerHTML = '';
    previewContainer.style.display = 'none';
    showSection('create-section');
  });
}

// 생성 성공 화면 설정
function setupSuccessSection(id) {
  const currentOrigin = window.location.origin + window.location.pathname;
  const letterPath = currentOrigin.replace('create.html', 'index.html');
  const letterUrl = `${letterPath}?id=${id}`;
  const replyUrl = `${currentOrigin}?view=replies&id=${id}`;

  const shareLetterInput = document.getElementById('share-letter-url');
  const shareReplyInput = document.getElementById('share-reply-url');

  shareLetterInput.value = letterUrl;
  shareReplyInput.value = replyUrl;

  bindCopyBtn('copy-letter-btn', letterUrl);
  bindCopyBtn('copy-reply-btn', replyUrl);

  showSection('success-section');
}

function bindCopyBtn(btnId, textToCopy) {
  const btn = document.getElementById(btnId);
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      const originalText = newBtn.innerHTML;
      newBtn.innerHTML = '<i class="fa-solid fa-check"></i> 복사됨!';
      newBtn.style.backgroundColor = '#2a9d8f';
      
      setTimeout(() => {
        newBtn.innerHTML = originalText;
        newBtn.style.backgroundColor = '';
      }, 1500);
    }).catch(err => {
      console.error('클립보드 복사 실패:', err);
      const input = newBtn.previousElementSibling;
      input.select();
      document.execCommand('copy');
      alert('주소가 선택되었습니다. Ctrl+C를 눌러 복사하세요.');
    });
  });
}

// ==========================================
// 2. 답장 확인 모드 (Reply Viewer Mode)
// ==========================================
async function loadReplies(id) {
  const repliesTitle = document.getElementById('replies-title');
  const repliesList = document.getElementById('replies-list');
  const goToViewerBtn = document.getElementById('go-to-viewer-btn');

  const currentOrigin = window.location.origin + window.location.pathname;
  goToViewerBtn.href = currentOrigin.replace('create.html', 'index.html') + `?id=${id}`;

  // ==========================================
  // [시뮬레이터 모드] LocalStorage 답장 읽기
  // ==========================================
  if (id.startsWith('local_')) {
    try {
      // 1. 편지 정보를 로컬스토리지에서 읽어와 친구 이름 제목 셋업
      const localLetter = JSON.parse(localStorage.getItem(`letter_${id}`));
      if (localLetter) {
        repliesTitle.innerText = `${localLetter.recipientName}님의 소중한 답장함 💌`;
      } else {
        repliesTitle.innerText = `생일 편지 답장함 💌`;
      }

      // 2. 로컬스토리지 전체를 훑으며 해당 letterId의 답장만 수집
      const replyDocs = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('reply_local_')) {
          const reply = JSON.parse(localStorage.getItem(key));
          if (reply.letterId === id) {
            replyDocs.push(reply);
          }
        }
      }

      // 시간 내림차순 정렬
      replyDocs.sort((a, b) => b.createdAt - a.createdAt);
      renderReplies(replyDocs);

    } catch (e) {
      console.error("로컬 답장 불러오기 실패:", e);
      repliesList.innerHTML = '<div class="reply-error">로컬 답장을 불러오는 데 실패했습니다.</div>';
    }
    return;
  }

  // ==========================================
  // [실제 배포 모드] Firebase 답장 읽기
  // ==========================================
  if (!db) {
    repliesList.innerHTML = '<div class="reply-error">파이어베이스가 연결되지 않았습니다.</div>';
    return;
  }

  try {
    const letterDocRef = db.collection("letters").doc(id);
    const letterSnap = await letterDocRef.get();

    if (letterSnap.exists) {
      const letterData = letterSnap.data();
      repliesTitle.innerText = `${letterData.recipientName}님의 소중한 답장함 💌`;
    } else {
      repliesTitle.innerText = `생일 편지 답장함 💌`;
    }

    const querySnapshot = await db.collection("replies").where("letterId", "==", id).get();

    const replyDocs = [];
    querySnapshot.forEach(docSnap => {
      replyDocs.push({ id: docSnap.id, ...docSnap.data() });
    });

    // 최신순 정렬
    replyDocs.sort((a, b) => b.createdAt - a.createdAt);

    renderReplies(replyDocs);

  } catch (error) {
    console.error("답장 조회 실패:", error);
    repliesList.innerHTML = `<div class="reply-error"><i class="fa-solid fa-triangle-exclamation"></i> 답장을 불러오는데 실패했습니다: ${error.message}</div>`;
  }
}

function renderReplies(replies) {
  const repliesList = document.getElementById('replies-list');
  repliesList.innerHTML = '';

  if (replies.length === 0) {
    repliesList.innerHTML = `
      <div class="empty-replies">
        <i class="fa-regular fa-comment-dots"></i>
        <p>아직 도착한 답장이 없습니다 😢</p>
        <p class="small-text">친구가 생일 축하 페이지를 다 읽고 하단에서 답장을 남기면 여기에 실시간으로 표시됩니다.</p>
      </div>
    `;
    return;
  }

  replies.forEach(reply => {
    const replyItem = document.createElement('div');
    replyItem.className = 'reply-item-card';

    const header = document.createElement('div');
    header.className = 'reply-item-header';

    const sender = document.createElement('span');
    sender.className = 'reply-sender';
    sender.innerHTML = `<i class="fa-solid fa-circle-user"></i> ${escapeHtml(reply.senderName)}`;

    const date = document.createElement('span');
    date.className = 'reply-date';
    date.innerText = formatDate(reply.createdAt);

    header.appendChild(sender);
    header.appendChild(date);

    const body = document.createElement('div');
    body.className = 'reply-body';
    body.innerText = reply.replyText;

    replyItem.appendChild(header);
    replyItem.appendChild(body);
    repliesList.appendChild(replyItem);
  });
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function escapeHtml(string) {
  return String(string).replace(/[&<>"']/g, function (s) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[s];
  });
}
