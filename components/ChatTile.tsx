import { FC } from "react";
import Image from "next/image";
import { UserCircle } from "lucide-react";
import { Card, CardHeader } from "./ui/card";
import { formatDistanceToNow } from "date-fns";

interface UserData {
  uid: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  profilePictureUrl?: string;
}

interface ChatTileProps {
  user: UserData;
  lastMessage: string;
  timestamp?: Date;
  onClick: () => void;
  chatId?: string;
}

const ChatTile: FC<ChatTileProps> = ({ user, lastMessage, timestamp, onClick }) => {
  // Format the timestamp to relative time (e.g., "5 minutes ago", "2 hours ago")
  const formattedTime = timestamp ? formatDistanceToNow(timestamp, { addSuffix: true }) : "";

  // Use display name or fallback to email if available
  const displayName = user.displayName || (user.email ? user.email.split('@')[0] : "Unknown User");

  return (
    <Card
      className="bg-white transition-all duration-300 hover:shadow-md cursor-pointer border border-gray-100"
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center gap-4 py-3">
        {user.profilePictureUrl ? (
          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border-2 border-white shadow-sm">
            <Image
              src={user.profilePictureUrl}
              alt={displayName}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
            <UserCircle className="h-7 w-7" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-gray-900 truncate">{displayName}</h3>
            {formattedTime && (
              <span className="text-[10px] text-gray-400 whitespace-nowrap">
                {formattedTime}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 truncate mt-0.5">{lastMessage}</p>
        </div>
      </CardHeader>
    </Card>
  );
};

export default ChatTile;
