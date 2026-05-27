// 1. Firebase 핵심 모듈
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

// 2. Firebase 인증 모듈 (구글 로그인용)
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// 3. Firebase 데이터베이스 모듈 (🌟 오프라인 캐시 지원 모듈 포함)
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 📌 선생님의 Firebase 프로젝트 환경설정
// (주의: 이 부분은 선생님의 기존 firebase-config.js에 있던 실제 값으로 꼭 변경해 주세요!)
const firebaseConfig = {
    apiKey: "AIzaSyA-vIm-4bfeI73KIBTXfkUCaW2sLu5jRzc",
    authDomain: "lws5737-a6105.firebaseapp.com",
    projectId: "lws5737-a6105",
    storageBucket: "lws5737-a6105.firebasestorage.app",
    messagingSenderId: "729062934950",
    appId: "1:729062934950:web:615529a26e02081c182767",
    measurementId: "G-LVB2WTXNGV"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// 인증(Auth) 및 구글 로그인 프로바이더 설정
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 🌟 오프라인 데이터 영구 저장(캐싱)을 적용한 Firestore 초기화 🌟
// 이제 인터넷이 끊겨도 스마트폰 저장소에 데이터를 안전하게 보관했다가 자동으로 동기화합니다.
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// app.js에서 사용할 수 있도록 내보내기
export { auth, db, provider };
