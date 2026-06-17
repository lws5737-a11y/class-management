// 1. Firebase 핵심 모듈
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
// 2. Firebase 인증 모듈 (구글 로그인용)
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// 3. Firestore 모듈 및 오프라인 지속성(자동저장) 모듈 추가
import { getFirestore, enableMultiTabIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  // 아래 항목들은 기존에 발급받으신 선생님의 프로젝트 정보 그대로 유지해 주세요.
  apiKey: "본인의_API_KEY",
  authDomain: "본인의_AUTH_DOMAIN",
  projectId: "본인의_PROJECT_ID",
  storageBucket: "본인의_STORAGE_BUCKET",
  messagingSenderId: "본인의_MESSAGING_SENDER_ID",
  appId: "본인의_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);

// [추가된 기능] 오프라인 자동저장(지속성) 활성화
enableMultiTabIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn("여러 탭이 열려 있어 오프라인 모드를 한 탭에서만 활성화할 수 있습니다.");
    } else if (err.code == 'unimplemented') {
      console.warn("현재 브라우저가 오프라인 데이터 지속성을 지원하지 않습니다.");
    }
  });
