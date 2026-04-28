import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, where, updateDoc } from 'firebase/firestore';
import axios from 'axios';

interface DialogueMessage {
  role: "user" | "other";
  content: string;
}

interface CoachingMessage {
  role: "user" | "ai";
  content: string;
}

interface ConverseAIRequest {
  user_input: string;
  dialogue_history: DialogueMessage[];
  coaching_history: CoachingMessage[];
}

export const sendMessageToAI = async (
  chatId: string, 
  userId: string, 
  userMessage: string
): Promise<string> => {
  try {
    // Path to the user's AI messages subcollection
    const aiMessagesPath = `chats/${chatId}/userAIChats/${userId}/aiMessages`;
    const messagesCollection = collection(db, aiMessagesPath);
    
    // Add user message to Firestore
    await addDoc(messagesCollection, {
      sender: "USER",
      text: userMessage,
      timestamp: serverTimestamp(),
    });
    
    // Add thinking message
    const thinkingDocRef = await addDoc(messagesCollection, {
      sender: "AI",
      text: "Thinking...",
      timestamp: serverTimestamp(),
    });
    
    // 1. Fetch regular chat messages between users (dialogue history)
    const chatMessagesCollection = collection(db, `chats/${chatId}/messages`);
    const chatMessagesQuery = query(chatMessagesCollection, orderBy("timestamp", "asc"));
    const chatMessagesSnapshot = await getDocs(chatMessagesQuery);
    
    // Build dialogue history from regular chat messages
    const dialogueHistory: DialogueMessage[] = [];
    
    chatMessagesSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const messageRole = data.senderId === userId ? "user" : "other";
      
      dialogueHistory.push({
        role: messageRole,
        content: data.text
      });
    });
    
    // 2. Fetch previous AI conversation messages (coaching history)
    const aiMessagesQuery = query(messagesCollection, orderBy("timestamp", "asc"));
    const aiMessagesSnapshot = await getDocs(aiMessagesQuery);
    
    // Build coaching history from AI conversation
    const coachingHistory: CoachingMessage[] = [];
    
    // Process all AI messages except the thinking message we just added
    // and the last user message (which will be sent as user_input)
    for (let i = 0; i < aiMessagesSnapshot.docs.length - 2; i++) {
      const currentDoc = aiMessagesSnapshot.docs[i];
      const currentData = currentDoc.data();
      
      // Skip the thinking message we just added
      if (currentDoc.id === thinkingDocRef.id) continue;
      
      if (currentData.sender === "USER") {
        coachingHistory.push({
          role: "user",
          content: currentData.text
        });
      } else if (currentData.sender === "AI" && currentData.text !== "Thinking...") {
        coachingHistory.push({
          role: "ai",
          content: currentData.text
        });
      }
    }
    
    // The current user message is NOT added to coaching history
    // It will be sent as the user_input parameter only
    
    // Prepare request for the AI backend
    const requestData: ConverseAIRequest = {
      user_input: userMessage,
      dialogue_history: dialogueHistory,
      coaching_history: coachingHistory
    };

    console.log("Dialogue history:", dialogueHistory);
    console.log("Coaching history:", coachingHistory);
    console.log("Sending to AI service:", JSON.stringify(requestData, null, 2));
    
    // Call hosted backend AI service
    let aiResponse: string;
    try {
      const response = await axios.post('https://converse-backend-ai.onrender.com/coach', requestData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      aiResponse = response.data.feedback || "I'm sorry, I couldn't generate a response.";
      console.log(response);
    } catch (aiError) {
      console.error("Error calling AI service:", aiError);
      aiResponse = "I'm sorry, I couldn't process your request at this time. Please try again later.";
    }
    
    // Update the thinking message with the actual AI response
    await updateDoc(thinkingDocRef, {
      text: aiResponse,
    });
    
    return aiResponse;
  } catch (error) {
    console.error("Error in sendMessageToAI:", error);
    throw new Error("Failed to process AI message");
  }
};