import { FC, useContext, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { SessionContext } from "@/lib/session-context";
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit, onSnapshot, documentId } from "firebase/firestore";
import { Card, CardContent } from "./ui/card";
import ChatTile from "./ChatTile";
import { MessageSquare } from "lucide-react";
import { LoadingSpinner } from "./ui/LoadingSpinner";

interface ChatData {
  chatId: string;
  participants: string[];
  createdAt: Date;
  updatedAt: Date;
  chatName?: string;
  lastMessage?: string;
  lastMessageTimestamp?: any;
}

interface UserData {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  profilePictureUrl?: string;
}

interface RecentChatsProps {
  limit?: number;
}

const RecentChats: FC<RecentChatsProps> = ({ limit: chatLimit = 7 }) => {
  const { user, loading: sessionLoading } = useContext(SessionContext);
  const router = useRouter();
  const [chats, setChats] = useState<ChatData[]>([]);
  const [users, setUsers] = useState<Record<string, UserData>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Use a ref for users to avoid stale closures in the onSnapshot listener
  // while keeping the dependency array stable.
  const usersRef = useRef<Record<string, UserData>>({});
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    if (!user) return;

    // Listen to chats directly - optimized with lastMessage denormalization
    const chatsCollection = collection(db, "chats");
    const chatsQuery = query(
      chatsCollection,
      where("participants", "array-contains", user.uid),
      orderBy("updatedAt", "desc"),
      limit(chatLimit)
    );

    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
      const chatsData: ChatData[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          chatId: doc.id,
          participants: data.participants,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          chatName: data.chatName,
          lastMessage: data.lastMessage,
          lastMessageTimestamp: data.lastMessageTimestamp?.toDate(),
        };
      });

      // Fetch user data for all participants that we don't have yet
      const newUserIds = new Set<string>();
      chatsData.forEach(chat => {
        chat.participants.forEach(participantId => {
          if (participantId !== user.uid && !usersRef.current[participantId]) {
            newUserIds.add(participantId);
          }
        });
      });

      if (newUserIds.size > 0) {
        const fetchUserData = async () => {
          const fetchedUsers: Record<string, UserData> = {};
          const ids = Array.from(newUserIds);

          // Firestore 'in' query supports up to 30 values
          // For more, we would need to chunk, but here it's limited by chatLimit (7)
          const usersQuery = query(
            collection(db, "users"),
            where("uid", "in", ids)
          );
          
          const usersSnapshot = await getDocs(usersQuery);
          usersSnapshot.forEach(doc => {
            const data = doc.data();
            fetchedUsers[data.uid] = {
              uid: data.uid,
              displayName: data.displayName,
              email: data.email,
              photoURL: data.photoURL,
              profilePictureUrl: data.profilePictureUrl
            };
          });

          if (Object.keys(fetchedUsers).length > 0) {
            setUsers(prev => ({ ...prev, ...fetchedUsers }));
          }
        };
        
        fetchUserData();
      }

      setChats(chatsData);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to chats:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, chatLimit]);

  if (sessionLoading || loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (!user) return null;

  if (chats.length === 0) {
    return (
      <Card className="bg-white border-dashed border-2 border-gray-100 shadow-none">
        <CardContent className="pt-10 pb-10 flex flex-col items-center justify-center">
          <div className="bg-gray-50 p-4 rounded-full mb-4">
            <MessageSquare className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-base font-semibold text-gray-900">No conversations yet</p>
          <p className="text-sm text-gray-500 mt-1 max-w-[200px] text-center">Start a conversation with someone to see it here.</p>
        </CardContent>
      </Card>
    );
  }

  const getChatPartnerInfo = (chat: ChatData) => {
    const partnerId = chat.participants.find(id => id !== user.uid);
    if (!partnerId) return null;
    return users[partnerId] || null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {chats.map(chat => {
        const partner = getChatPartnerInfo(chat);
        return (
          <ChatTile 
            key={chat.chatId}
            user={partner || {
              uid: "unknown",
              displayName: chat.chatName || "Chat",
            }}
            lastMessage={chat.lastMessage || "No messages yet"}
            timestamp={chat.lastMessageTimestamp || chat.updatedAt}
            onClick={() => router.push(`/chat/${chat.chatId}`)}
          />
        );
      })}
    </div>
  );
};

export default RecentChats;
