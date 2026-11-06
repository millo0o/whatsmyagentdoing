# 귀여운 오피스: Windows 설치 가이드

Claude Code와 Codex 에이전트가 지금 뭘 하는지 보여주는 오피스를 Windows에 설치하는 방법이에요.
브라우저에서 보거나, 바탕화면 위에 항상 떠 있는 투명한 창으로 띄울 수 있어요.

## 1. 필요한 프로그램 설치 (처음 한 번만)

- **Node.js**: https://nodejs.org 에서 **LTS** 버전을 받아 설치해요. 옵션은 기본값 그대로 두면 돼요.
- **Git**: https://git-scm.com/download/win 에서 받아 설치해요. 이것도 기본값 그대로요.

설치가 끝나면 열려 있던 터미널 창은 닫고 새로 열어요.

## 2. 오피스 내려받기

시작 메뉴에서 **PowerShell**을 열고 아래를 붙여넣어요.

```powershell
git clone --depth 1 -b cute-office https://github.com/millo0o/whatsmyagentdoing "$env:USERPROFILE\.claude\skills\myoffice"
```

## 3. 브라우저에서 오피스 켜기

```powershell
node "$env:USERPROFILE\.claude\skills\myoffice\bin\cli.js"
```

브라우저에 사무실이 열리면 성공이에요. Claude Code에서는 `/myoffice`라고 입력해도 돼요.

## 4. 바탕화면에 떠다니는 창 띄우기

1. 파일 탐색기 주소창에 아래를 붙여넣고 Enter를 눌러요.
   ```
   %USERPROFILE%\.claude\skills\myoffice\desktop\windows
   ```
2. **`start.bat`** 을 더블클릭해요.
   - 처음 한 번은 Electron(약 100MB)을 받느라 1~2분 걸려요. 검은 창이 잠깐 떴다가 닫혀요.
   - 바탕화면에 **Floating Office** 바로가기가 생겨요. 다음부터는 이것만 더블클릭하면 돼요.
3. 오피스 서버가 꺼져 있어도 앱이 알아서 켜요. 3번 단계를 안 해도 돼요.

"Windows의 PC 보호" 경고가 뜨면 **추가 정보 → 실행**을 눌러요.

설치한 뒤에는 브라우저 오피스 화면의 **팝아웃** 버튼으로도 떠다니는 창이 열려요.

## 5. 쓰는 법

- **옮기기**: 창을 끌어요.
- **크기 조절**: 마우스를 올리면 나오는 오른쪽 아래 빗금을 끌어요.
- **툴바**: 마우스를 올리면 위쪽에 툴바(오늘 토큰, 필터, 설정)와 에이전트 목록 탭이 나와요.
- **메뉴**: 창이나 작업 표시줄 오른쪽 트레이(분홍 건물 아이콘)를 오른쪽 클릭해요.
  사무실 보기/가구만 보기, 크기, 클릭 통과, 새로고침, 브라우저에서 열기, 종료가 있어요.
- **클릭 통과 끄기**: 클릭 통과를 켜면 창이 클릭을 안 받아요. 끌 때는 **트레이 아이콘 메뉴**에서 꺼요.
  트레이에 아이콘이 안 보이면 작업 표시줄의 **^** 를 눌러 찾아요.

## 6. 자기 캐릭터 넣기 (선택)

1. `%USERPROFILE%\.claude\skills\myoffice\assets\chars` 폴더를 만들어요.
2. 거기에 캐릭터 시트 이미지와 `chars.json`을 넣어요.

형식은 [CHARACTERS.md](../../CHARACTERS.md)에 있어요. 안 넣으면 예시 캐릭터 3종(찹쌀떡, 병아리, 새싹)이 나와요.

## 업데이트

PowerShell에서 아래를 실행한 뒤, 떠다니는 창을 껐다 켜요.

```powershell
cd "$env:USERPROFILE\.claude\skills\myoffice"; git pull
```

## 잘 안 될 때

- **`node`나 `git`을 찾을 수 없다고 나와요**: 설치 후 PowerShell을 새로 열었는지 확인해요.
- **`start.bat`이 "npm install failed"로 멈춰요**: Node.js가 설치됐는지 확인하고 다시 실행해요.
- **창이 비어 있어요**: 트레이 메뉴에서 **새로고침**을 눌러요. 그래도 비어 있으면 3번 명령으로 서버를 직접 켜요.
