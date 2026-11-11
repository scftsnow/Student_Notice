# 자동 업데이트 매뉴얼

## 1. 구조 개요

설치 버전(패키징된 Electron 앱)은 `electron-updater`를 사용해 GitHub Releases 기반으로 자동 업데이트합니다.

핵심 파일:
- `package.json`: 앱 버전 (`version`) 정의
- `electron-builder.json`: `publish` 설정 (GitHub provider/owner/repo)
- `electron/main.cjs`: 업데이트 확인/다운로드/설치 로직

동작 흐름:
1. 앱 실행 (`app.isPackaged === true`일 때만)
2. `autoUpdater.checkForUpdatesAndNotify()` 호출
3. GitHub Releases의 `latest.yml`을 조회
4. 현재 버전보다 새 버전이 있으면 설치 파일을 백그라운드 다운로드
5. 다운로드 완료 시 사용자에게 안내창 표시
   - "지금 재시작": `autoUpdater.quitAndInstall()`로 즉시 설치/재시작
   - "나중에": 앱 종료 시 자동 설치 (`autoInstallOnAppQuit = true`)
6. 상태/오류는 `%APPDATA%\student-notice\server.log`에 기록

## 2. 설정 파일

### package.json
```json
{
  "version": "0.1.1"
}
```
- 업데이트 판정 기준이 되는 버전입니다.
- 새 릴리스를 배포할 때 반드시 버전을 올립니다 (예: `0.1.2`).

### electron-builder.json
```json
{
  "publish": {
    "provider": "github",
    "owner": "scftsnow",
    "repo": "Student_Notice"
  }
}
```
- GitHub Releases를 업데이트 서버로 사용합니다.

### electron/main.cjs (핵심 로직)
```js
const { autoUpdater } = require('electron-updater');

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', (info) => { /* ... */ });
autoUpdater.on('update-downloaded', (info) => {
  // 사용자에게 재시작 여부 확인
  dialog.showMessageBox(mainWindow, { ... })
    .then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
});

// 설치 버전에서만 확인
if (!isDev) {
  autoUpdater.checkForUpdatesAndNotify();
}
```

## 3. 배포(릴리스) 절차

### 준비
- GitHub Personal Access Token (repo 권한) 발급
- 환경 변수 설정:
  - Windows: `set GH_TOKEN=your_token`

### 빌드 + 배포
```bash
npm run app:build
npx electron-builder --win --publish always
```

결과:
- GitHub Releases에 다음 파일이 자동 생성/업로드됩니다.
  - `Teacher Helper-학급 운영 Setup x.x.x.exe`
  - `latest.yml` (업데이트 메타데이터)
  - `.blockmap` (델타 업데이트용)

### 버전 올리기
1. `package.json`의 `version` 수정 (예: `0.1.2`)
2. `npm run app:build`
3. `npx electron-builder --win --publish always`

## 4. 사용자 경험

- 설치된 앱을 실행하면 백그라운드에서 업데이트를 확인합니다.
- 새 버전이 있으면 자동으로 다운로드합니다.
- 다운로드 완료 시 안내창이 표시됩니다.
  - "지금 재시작": 즉시 설치 후 재실행
  - "나중에": 앱 종료 시 자동 설치
- 설치 파일을 다시 수동으로 받을 필요가 없습니다.

## 5. 운영 시 주의사항

- 자동 업데이트는 `app.isPackaged` (설치 버전)에서만 동작합니다.
  - 개발 모드(`npm run dev`)에서는 동작하지 않습니다.
- Windows 코드 서명이 없으면 SmartScreen 경고가 뜰 수 있습니다.
  - 기능 자체는 정상 동작합니다.
- GitHub Releases가 public이거나, 토큰으로 접근 가능한 private이어야 합니다.
- 업데이트 확인 실패 시 앱 실행은 계속됩니다. (오류는 `server.log`에 기록)

## 6. 문제 해결

- 업데이트가 감지되지 않음:
  - GitHub Releases에 `latest.yml`이 있는지 확인
  - `package.json` version이 릴리스 버전보다 낮은지 확인
- 다운로드 실패:
  - 네트워크/방화벽 확인
  - `%APPDATA%\student-notice\server.log`의 `[updater]` 로그 확인
- 설치 실패:
  - 앱을 관리자 권한으로 실행 후 재시도
  - 기존 설치 폴더 권한 확인

## 7. 권장 운영 방식

1. 개발/테스트 완료 후 `package.json` 버전 증가
2. `npm run app:build`로 빌드 검증
3. GitHub에 릴리스 배포 (`--publish always`)
4. 사용자 PC에서 자동 업데이트 확인
5. 필요 시 수동 설치 파일도 바탕화면/배포 채널에 보관
'