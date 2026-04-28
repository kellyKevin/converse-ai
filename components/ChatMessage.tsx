import React from 'react';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  timestamp?: Date | { seconds: number; nanoseconds: number };
}

function ChatMessage({ message, isUser, timestamp }: ChatMessageProps) {
  return (
    <div className={cn(
      "flex w-full mb-4",
      isUser ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[75%] px-4 py-2.5 shadow-sm transition-all duration-200",
        isUser
          ? "bg-purple-600 text-white rounded-2xl rounded-tr-none"
          : "bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-none"
      )}>
        <p className="text-sm md:text-base leading-relaxed">{message}</p>
        {timestamp && (
          <div className={cn(
            "text-[10px] mt-1 opacity-70",
            isUser ? "text-right text-purple-100" : "text-left text-gray-400"
          )}>
            {(() => {
              const date = timestamp instanceof Date
                ? timestamp
                : new Date((timestamp as any).seconds * 1000);
              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;
