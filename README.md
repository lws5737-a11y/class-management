# 스마트 체육수업 관리

동산초등학교 체육수업을 위한 스마트폰·PC 대응 웹 앱입니다.

## 접근 계정

앱과 Firestore 규칙 모두 `lws5737@seoul-dongsan.es.kr` 계정만 허용합니다. 클라이언트 검사만으로는 데이터가 보호되지 않으므로, Vercel 배포와 별도로 Firestore 규칙을 반드시 배포해야 합니다.

```bash
firebase login
firebase deploy --only firestore:rules
```

Firebase Authentication의 Google 로그인 제공업체와 Vercel 운영 도메인도 Firebase Console의 승인된 도메인 목록에 등록되어 있어야 합니다.

## Vercel

정적 사이트이므로 저장소를 Vercel에 연결해 배포할 수 있습니다. `vercel.json`은 기본 보안 헤더와 `index.html` 캐시 방지 설정을 적용합니다.

## 검사

```bash
npm test
```

검사는 허용 계정, Firestore 규칙, 학급 선택 첫 화면, CSV 인코딩 오류 및 누락된 HTML 이벤트 핸들러를 확인합니다.

