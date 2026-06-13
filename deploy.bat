@echo off
chcp 65001 >nul
echo =========================================================================
echo 🚀 GitHub Pages 생일 축하 페이지 배포 도우미 🚀
echo =========================================================================
echo.
echo 이 스크립트는 현재 폴더의 모든 코드를 깃허브(GitHub) 저장소에 업로드하고
echo 친구에게 공유할 수 있는 GitHub Pages 배포를 도와줍니다.
echo.

:: 1. Git 설치 여부 검증
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [❌ 에러] Git이 시스템에 설치되어 있지 않거나 환경 변수(PATH) 설정이 안 되어 있습니다.
    echo https://git-scm.com/ 에서 Git을 설치한 후 이 창을 닫고 다시 실행해 주세요.
    echo.
    pause
    exit /b
)

:: 2. Git 저장소 초기화 및 브랜치 설정
if not exist .git (
    echo [1/3] Git 저장소를 로컬에 초기화하고 기본 브랜치를 설정합니다...
    git init
    git branch -M main
) else (
    echo [ℹ️ 안내] 이미 Git 저장소가 초기화되어 있습니다.
)

:: 3. 파일 스테이징 및 첫 커밋
echo.
echo [2/3] 모든 소스코드와 사진 파일들을 커밋(기록)합니다...
git add .
git commit -m "생일 축하 편지 서비스 최종 배포 버전"

:: 4. 원격 저장소 HTTPS 주소 획득
echo.
echo =========================================================================
echo 💡 깃허브(GitHub.com) 웹사이트에서 새로 생성한 
echo    저장소(Repository)의 HTTPS 주소를 마우스 우클릭으로 여기에 붙여넣어 주세요!
echo    예: https://github.com/사용자이름/저장소이름.git
echo =========================================================================
echo.
set /p repo_url="👉 깃허브 저장소 주소 입력: "

if "%repo_url%"=="" (
    echo.
    echo [❌ 에러] 주소가 입력되지 않았습니다. 배포 작업을 취소합니다.
    echo.
    pause
    exit /b
)

:: 기존 원격 저장소 바인딩 정보가 있다면 제거 후 재생성
git remote remove origin >nul 2>&1
git remote add origin %repo_url%

:: 5. 깃허브로 코드 푸시
echo.
echo [3/3] 깃허브 서버로 코드를 업로드합니다...
echo (※ 최초 업로드 시 깃허브 로그인 및 권한 요청 창이 뜰 수 있습니다.)
echo.
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo [❌ 에러] 업로드 중 문제가 발생했습니다. 주소를 다시 확인하거나 로그인 상태를 체크해 주세요.
    echo.
    pause
    exit /b
)

echo.
echo =========================================================================
echo 🎉 성공적으로 코드가 깃허브 저장소에 올라갔습니다! 🎉
echo =========================================================================
echo.
echo 이제 아래 가이드에 따라 [GitHub Pages] 설정을 켜서 배포를 완료하세요:
echo.
echo 1. 방금 주소를 입력하셨던 본인의 깃허브 저장소 웹페이지로 이동합니다.
echo 2. 상단 탭 중 톱니바퀴 모양의 [⚙️ Settings] 메뉴를 클릭합니다.
echo 3. 왼쪽 사이드바 메뉴 중 [Code and automation] -> [Pages] 항목을 클릭합니다.
echo 4. Build and deployment -> Branch 항목에서 'None'을 'main'으로 변경합니다.
echo 5. 폴더가 '/(root)'로 되어 있는지 확인하고 우측의 [Save] 버튼을 누릅니다.
echo 6. 약 1~2분 정도 기다린 뒤 화면을 새로고침하면 상단에 친구에게 공유할 수 있는
echo    실제 공유 주소(https://사용자이름.github.io/저장소이름/)가 생성됩니다!
echo =========================================================================
echo.
pause
