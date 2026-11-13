# 수능 고사실 3D

실제 수능 시간표대로 타종과 안내 방송이 울리는 3D 고사실입니다.
같은 주소로 들어온 사람들이 한 교실에 함께 보이고, 빈 자리에 앉아 각자 자기 진도로 시험을 봅니다.
로그인은 없습니다. 처음 들어오면 이름이 자동으로 정해지고, 설정에서 바꿀 수 있습니다.

## 기능

- 바닥을 누르면 그곳으로 걸어가고, 빈 자리를 누르면 가서 앉습니다. 키보드는 WASD나 방향키로 움직입니다.
- 같은 고사실에 있는 사람의 캐릭터, 이름, 진도(예: `2교시 수학 · 시험 중`)가 보입니다.
- 시험 진도는 사람마다 따로 흐릅니다. 타종과 듣기 음원도 내 진도에 맞춰 나한테만 들립니다.
- 사람이 적을 때는 가상 수험생이 빈 자리를 채워 교실이 비어 보이지 않게 합니다. 실제 사람이 앉을수록 줄어듭니다.
- 2027학년도 수능 시간표, 08:10 수험생 입실 완료부터 17:45 시험 종료까지
- 교시 메뉴에서 원하는 구간부터 바로 시작
- 3교시 영어 듣기평가 음원 (2025~2027학년도 6월·9월 모의평가, 수능)
- 교실 소음 설정 (조용한 교실 / 보통 / 시끄러운 교실), 타종·듣기 크기 조절
- 시간에 따라 바뀌는 창밖 풍경, 칠판의 수능 시계, 수능 D-day

## 폴더 구성

```
public/              사이트 파일 (Cloudflare가 그대로 내보냄)
  index.html         페이지 전체 (HTML, CSS, JS)
  bells/             교시별 타종·안내 방송 음원
  listening/         영어 듣기평가 음원 (학년도-월.mp3)
src/index.js         실시간 서버 (접속자 위치, 자리, 진도만 주고받음)
wrangler.jsonc       Cloudflare 배포 설정
package.json         실행 명령
```

## 올리는 방법 (GitHub + Cloudflare, 무료)

### 1. GitHub에 올리기

GitHub에서 새 저장소를 만들고(예: `suneung-classroom`) 이 폴더의 파일을 모두 올립니다.

```bash
git init
git add .
git commit -m "수능 고사실 3D"
git branch -M main
git remote add origin https://github.com/<내 아이디>/suneung-classroom.git
git push -u origin main
```

### 2. Cloudflare에 연결하기

1. https://dash.cloudflare.com 에 무료로 가입합니다.
2. 왼쪽 메뉴에서 **Workers & Pages**로 들어가 **Create application**을 누릅니다.
3. **Import a repository**에서 GitHub 계정을 연결하고 `suneung-classroom` 저장소를 고릅니다.
4. 설정은 그대로 두고(배포 명령 `npx wrangler deploy`) **Deploy**를 누릅니다.
5. 1~2분 뒤 `https://suneung-classroom.<내 계정>.workers.dev` 주소가 생깁니다. 이 주소를 친구에게 보내면 같은 교실에서 만납니다.

이후에는 GitHub에 수정한 파일을 올릴 때마다 Cloudflare가 자동으로 다시 배포합니다.
메뉴 이름은 Cloudflare 화면이 바뀌면 조금 다를 수 있습니다.

## 내 컴퓨터에서 실행하기

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:8787 을 엽니다. 창을 두 개 열면 서로의 캐릭터가 보입니다.

## 비용

Cloudflare 무료 플랜으로 운영됩니다.

- 서버가 받는 메시지는 20개를 요청 1회로 계산하고, 하루 요청 10만 회까지 무료입니다. 서버가 보내는 메시지는 무료입니다.
- 위치는 걷는 동안에만 1초에 최대 6번 보내고, 앉아 있을 때는 거의 보내지 않습니다.
- 한 고사실 최대 접속자는 30명입니다. `src/index.js`의 `MAX_PEOPLE`로 바꿀 수 있습니다.

## 고칠 때 참고

- 듣기 음원은 `public/listening/<학년도>-<06|09|11>.mp3`로 넣고, `index.html`의 `LISTEN` 목록에 길이(초)를 추가합니다.
- 타종 시각과 음원 번호는 `index.html`의 `PERIODS` 목록에 있습니다.
- 가상 수험생 수는 `index.html`의 `NPC_TARGET`으로 정합니다.

## 출처와 이용

- 타종·안내 방송과 영어 듣기평가 음원은 한국교육과정평가원 자료입니다.
- 비영리 학습용으로만 사용하고, 광고나 유료화 등 수익을 내는 용도로 쓰지 않습니다.
