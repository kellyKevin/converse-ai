"use client";

import { useContext, useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { SessionContext } from "@/lib/session-context";
import { db, addMessageToFirestore } from '@/lib/firebase';
import { collection, onSnapshot, query, doc, getDoc, orderBy } from "firebase/firestore";
import ChatMessage from "@/components/ChatMessage";
import RoomHeader from "@/components/RoomHeader";
import AIChatModal from "@/components/AIChatModal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Send, Sparkles } from "lucide-react";

interface MessageData {
  messageId: string;
  senderId: string;
  text: string;
  timestamp: Date;
}

export default function ChatRoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  
  const { user, loading } = useContext(SessionContext);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [roomName, setRoomName] = useState<string>("");
  const [otherUser, setOtherUser] = useState<{ uid?: string; displayName?: string; email: string; profilePictureUrl?: string } | null>(null);
  const [newMessage, setNewMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isAIChatOpen, setIsAIChatOpen] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!loading && user && roomId) {
      // Fetch chat room details
      const fetchRoomDetails = async () => {
        try {
          const chatDocRef = doc(db, "chats", roomId);
          const chatDoc = await getDoc(chatDocRef);
          
          if (chatDoc.exists()) {
            const chatData = chatDoc.data();
            // Find the other participant
            const otherParticipantId = chatData.participants.find(
              (participant: string) => participant !== user.uid
            );
            
            if (otherParticipantId) {
              const userDocRef = doc(db, "users", otherParticipantId);
              const userDoc = await getDoc(userDocRef);
              
              const otherUserData = userDoc.data();
              const otherUserObj = {
                uid: otherParticipantId,
                displayName: otherUserData?.displayName,
                email: otherUserData?.email || "No Email",
                profilePictureUrl: otherUserData?.profilePictureUrl
              };

              setOtherUser(otherUserObj);
            } else {
              setOtherUser({ email: "Group Chat" });
            }

            setRoomName(chatData.chatName || "Chat Room");

          } else {
            setError("Chat room not found");
            setRoomName("Chat Room");
          }
        } catch (error) {
          console.error("Error fetching room details:", error);
          setError("Failed to load chat details");
          setRoomName("Chat Room");
        }
      };
      
      fetchRoomDetails();

      // Listen for messages in this chat room
      const messagesCollection = collection(db, `chats/${roomId}/messages`);
      const messagesQuery = query(messagesCollection, orderBy("timestamp", "asc"));
      
      const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
        const updatedMessages: MessageData[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            messageId: doc.id,
            senderId: data.senderId,
            text: data.text,
            timestamp: data.timestamp?.toDate() || new Date(),
          };
        });

        setMessages(updatedMessages);
        setTimeout(scrollToBottom, 100);
      }, (error) => {
        console.error("Error listening to messages:", error);
        setError("Failed to load messages");
      });

      return () => unsubscribeMessages();
    }
  }, [user, loading, roomId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || !roomId) return;
    
    try {
      await addMessageToFirestore(roomId, {
        senderId: user.uid,
        receiverId: otherUser?.uid,
        text: newMessage,
      });
      
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Failed to send message");
    }
  };

  const handleOpenAiChat = () => {
    if (user && roomId) {
      setIsAIChatOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <LoadingSpinner size={40} />
        <p className="mt-4 text-gray-500 font-medium">Loading your conversation...</p>
      </div>
    );
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Please log in to access chat.</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <RoomHeader otherUser={otherUser || {email: "Unknown"}} />
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mx-4 mt-2 shadow-sm">
          {error}
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
            <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center">
               <Sparkles className="h-8 w-8" />
            </div>
            <p className="font-medium">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage
              key={message.messageId}
              message={message.text}
              isUser={message.senderId === user?.uid}
              timestamp={message.timestamp}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="border-t border-gray-100 p-4 bg-white shadow-[0_-1px_3px_rgba(0,0,0,0.02)]">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-200 transition-all outline-none text-gray-900 placeholder-gray-400"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage();
              }
            }}
          />

          <button
            onClick={handleOpenAiChat}
            className="p-3 text-purple-600 hover:bg-purple-50 rounded-xl transition-colors"
            title="Get AI help"
          >
            <Sparkles className="h-6 w-6" />
          </button>

          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all disabled:opacity-50 disabled:grayscale"
          >
            <Send className="h-6 w-6" />
          </button>
        </div>
      </div>
      
      {/* AI Chat Modal */}
      {user && (
        <AIChatModal
          isOpen={isAIChatOpen}
          onClose={() => setIsAIChatOpen(false)}
          userId={user.uid}
          roomId={roomId}
        />
      )}
    </div>
  );
}
