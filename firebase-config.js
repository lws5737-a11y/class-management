// 1. Firebase 핵심 모듈
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
// 2. Firebase 인증 모듈 (구글 로그인용)
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// 3. Firestore 모듈 및 오프라인 지속성(자동저장) 모듈 추가
import { getFirestore, enableMultiTabIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-vIm-4bfeI73KIBTXfkUCaW2sLu5jRzc",
  authDomain: "lws5737-a6105.firebaseapp.com",
  projectId: "lws5737-a6105",
  storageBucket: "lws5737-a6105.firebasestorage.app",
  messagingSenderId: "729062934950",
  appId: "1:729062934950:web:615529a26e02081c182767",
  measurementId: "G-LVB2WTXNGV"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  hd: 'seoul-dongsan.es.kr',
  prompt: 'select_account'
});
export const db = getFirestore(app);

// 오프라인 저장 준비 결과를 앱 화면에서도 확인할 수 있도록 내보냅니다.
export const firestorePersistenceState = { enabled: false, error: null };
export const firestorePersistenceReady = enableMultiTabIndexedDbPersistence(db)
  .then(() => {
    firestorePersistenceState.enabled = true;
    return true;
  })
  .catch((err) => {
    firestorePersistenceState.error = err;
    if (err.code == 'failed-precondition') {
      console.warn("여러 탭이 열려 있어 오프라인 모드를 한 탭에서만 활성화할 수 있습니다.");
    } else if (err.code == 'unimplemented') {
      console.warn("현재 브라우저가 오프라인 데이터 지속성을 지원하지 않습니다.");
    }
    return false;
  });
