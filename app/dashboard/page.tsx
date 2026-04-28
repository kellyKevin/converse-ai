"use client"

import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { SessionContext } from "@/lib/session-context";
import { db, addUserToFirestore, createNewChat } from '@/lib/firebase';
import { collection, doc, onSnapshot, query, setDoc, orderBy, limit, getDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, MessageSquare, UserCircle, Users, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RecentChats from "@/components/RecentChats";

import { auth } from "@/lib/firebase";
interface UserData {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  online?: boolean;
  createdAt?: Date;
  lastActive?: Date;
  profilePictureUrl?: string;
}

interface ChatData {
  chatId: string;
  participants: string[];
  createdAt: Date;
  updatedAt: Date;
  chatName?: string;
}

export default function Home() {
  const { user, loading } = useContext(SessionContext);
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [chats, setChats] = useState<ChatData[]>([]);
  const [isChatStarted, setIsChatStarted] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Redirect to login if not authenticated
  useEffect(() => { 
    if (!loading && !user) {
      router.push("/");
    } else if (!loading && user) {
      setIsLoading(false);
    }
  }, [user, loading, router]);

  // Set user data in Firestore
  useEffect(() => {
    if (!user) return;

    const usersCollection = collection(db, "users");
    addUserToFirestore(user);

    const unsubscribe = onSnapshot(query(usersCollection), (snapshot) => {
      const updatedUsers: UserData[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          uid: data.uid,
          displayName: data.displayName,
          email: data.email,
          photoURL: data.photoURL,
          online: data.online,
          createdAt: data.createdAt?.toDate(),
          lastActive: data.lastActive?.toDate(),
          profilePictureUrl: data.profilePictureUrl
        } as UserData;
      });

      setUsers(updatedUsers);
    });

    return () => unsubscribe();
  }, [user]);

  // Listen for chats
  useEffect(() => {
    if (!user) return;

    const chatsCollection = collection(db, "chats");
    
    const unsubscribe = onSnapshot(query(chatsCollection), (snapshot) => {
      const updatedChats: ChatData[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          chatId: doc.id,
          participants: data.participants,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          chatName: data.chatName
        } as ChatData;
      });

      setChats(updatedChats);
    });

    return () => unsubscribe();
  }, [user]);

  // Start a new chat
  const startNewChat = async (userId?: string): Promise<void> => {
    if (!user) return;
    
    const newChatRef = await createNewChat(user.uid, userId);
    
    setIsChatStarted(true);
    router.push(`/chat/${newChatRef.id}`);
  };



  // Handle logout
  const handleLogout = async () => {
    try {
      // Set user as offline first
      if (user) {
        const userDocRef = doc(collection(db, "users"), user.uid);
        await setDoc(userDocRef, { online: false, lastActive: serverTimestamp() }, { merge: true });
      }
      
      // Sign out from Firebase
      await auth.signOut();
      
      // Redirect to login page
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Filter users based on search query and exclude current user
  const filteredUsers = users.filter(userData => 
    // Only include users who are not the current user and match search query
    userData.uid !== user?.uid && (
      userData.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userData.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Loading screen
  if (loading || isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
       <div className="flex flex-col items-center space-y-4">
          <div className="h-16 w-16 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
          <p className="text-xl font-medium text-gray-700">Loading...</p>
        </div>
        
        {/* AI Chat Button - Fixed position */}
        <div className="fixed bottom-6 right-6">
          <Button 
            onClick={() => router.push('/chat')}
            className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 transition-all duration-300 p-0 flex items-center justify-center"
          >
            <MessageSquare className="h-6 w-6" />
          </Button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Determine display name for welcome message (username or email)
  const welcomeName = user.displayName || user.email?.split('@')[0] || "there";

  return (
    <div className="flex h-screen bg-gray-50">
      
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-6xl">
          {/* Header section */}
          <header className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Welcome, {welcomeName}!</h1>
                <p className="mt-1 text-gray-600">Connect with friends and colleagues</p>
              </div>
              <div className="flex items-center">
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2 hover:bg-red-50 hover:text-red-600 transition-colors" 
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </header>
          
          {/* Recent Chats Section */}
          <section className="mt-8 mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Recent Chats</h2>
              
            </div>
            
            <RecentChats limit={7} />
          </section>
          
          {/* Tabs for All Users */}
          <Tabs defaultValue="users" className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="grid w-64 grid-cols-1">
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Available Users
                </TabsTrigger>
              </TabsList>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users..."
                  className="pl-9 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            {/* Users Tab */}
            <TabsContent value="users">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((userData) => (
                    <Card
                      key={userData.uid}
                      className="bg-white transition-all duration-300 hover:shadow-md"
                    >
                      <CardHeader className="flex flex-row items-center gap-4 pb-2">
                        {userData.profilePictureUrl ? (
                          <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-white shadow-sm">
                            <Image 
                              src={userData.profilePictureUrl} 
                              alt={userData.displayName || "User"}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            <UserCircle className="h-6 w-6" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-lg font-medium">{userData.displayName}</CardTitle>
                          <p className="text-sm text-gray-500">{userData.email}</p>
                        </div>
                        <div className="ml-auto flex flex-col items-end">
                          <div className="flex items-center">
                            <div className={`h-2.5 w-2.5 rounded-full ${userData.online ? 'bg-green-500' : 'bg-gray-300'} mr-1.5`}></div>
                            <span className="text-xs font-medium text-gray-500">
                              {userData.online ? 'Online' : 'Offline'}
                            </span>
                          </div>
                          {userData.lastActive && (
                            <span className="text-xs text-gray-400 mt-1">
                              Last active: {new Date(userData.lastActive).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          variant="outline" 
                          className="w-full hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          onClick={() => {
                            const existingChat = chats.find(chat => chat.participants.includes(userData.uid) && chat.participants.includes(user.uid));
                            if (existingChat) {
                              router.push(`/chat/${existingChat.chatId}`)
                            } else {
                              startNewChat(userData.uid);
                            }
                          }}
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Message
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full text-center py-12 bg-white rounded-lg shadow-sm">
                    <Users className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-lg font-medium text-gray-700">No users match your search</p>
                    <p className="text-gray-500 mt-1">Try adjusting your search query</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}