import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

try {
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code == 'failed-precondition') console.warn("여러 탭이 열려 있어 오프라인 캐시를 사용할 수 없습니다.");
        else if (err.code == 'unimplemented') console.warn("현재 브라우저가 오프라인 캐시를 지원하지 않습니다.");
    });
} catch (e) { 
    console.error("클라우드 서버 연결 오류:", e); 
}

export { auth, db, provider };
