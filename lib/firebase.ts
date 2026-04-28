import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, where, setDoc, collection, addDoc, getDocs, query, orderBy, getDoc, limit, updateDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDAnH4Hm54GJ6h5gQMtExwJolE8FbHNBBg",
  authDomain: "prod-ai-dd945.firebaseapp.com",
  projectId: "prod-ai-dd945",
  storageBucket: "prod-ai-dd945.appspot.com",
  messagingSenderId: "339827130138",
  appId: "1:339827130138:web:0f785b198075e5d654b6a3",
  measurementId: "G-V3J4963LJ7"
};

export let firebaseApp: FirebaseApp;

if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApps()[0];
}

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

// Create a new Google Auth provider
export const googleProvider = new GoogleAuthProvider();

export const addUserToFirestore = async (user: any, customDisplayName?: string) => {
  if (user) {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      displayName: customDisplayName || user.displayName || 'Anonymous',
      email: user.email,
      photoURL: user.photoURL,
      lastActive: serverTimestamp(),
      profilePictureUrl: user.photoURL,
      online: true
    }, { merge: true });
  }
};

export const createNewChat = async (currentUserId: string, otherUserId?: string) => {
  const chatsCollection = collection(db, "chats");
  const participants = [currentUserId];
  if (otherUserId) {
    participants.push(otherUserId);
  }

  const timestamp = serverTimestamp();
  const newChatRef = await addDoc(chatsCollection, {
    participants: participants,
    createdAt: timestamp,
    updatedAt: timestamp,
    chatName: otherUserId ? `Direct Chat` : `New Group Chat`
  });

  return newChatRef;
};

export const addMessageToFirestore = async (chatId: string, message: any) => {
  try {
    // Create a timestamp for this message
    const messageTimestamp = serverTimestamp();
    
    // Add message to the chat
    const messageRef = collection(db, `chats/${chatId}/messages`);
    await addDoc(messageRef, {
      senderId: message.senderId,
      text: message.text,
      timestamp: messageTimestamp,
    });
    
    // Update the chat document with last message info
    const chatDocRef = doc(db, 'chats', chatId);
    await updateDoc(chatDocRef, {
      updatedAt: messageTimestamp,
      lastMessage: message.text,
      lastMessageTimestamp: messageTimestamp,
      lastSenderId: message.senderId
    });

  } catch (error) {
    console.error("Error adding message to Firestore:", error);
  }
};

export const addAIMessageToFirestore = async (chatId: string, userId: string, message: any) => {
  const aiMessageRef = collection(db, `chats/${chatId}/userAIChats/${userId}/aiMessages`);
  await addDoc(aiMessageRef, {
    sender: message.sender, // "USER" or "AI"
    text: message.text,
    timestamp: serverTimestamp(),
  });
};

export const fetchUserAIMessages = async (chatId: string, userId: string) => {
  const aiMessagesCollection = collection(db, `chats/${chatId}/userAIChats/${userId}/aiMessages`);
  const aiMessagesQuery = query(aiMessagesCollection, orderBy("timestamp", "asc"));
  const snapshot = await getDocs(aiMessagesQuery);
  const aiMessages = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  return aiMessages;
};
