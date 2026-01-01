'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  type: 'text' | 'file' | 'image';
}

export default function ClientMessagesPage() {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const clientId = userProfile?.uid;
      if (!clientId) return;

      console.log('Fetching messages for clientId:', clientId);
      const response = await fetch(`/api/client-portal/messages?clientId=${clientId}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Messages API response:', data);
        if (data.success) {
          console.log('Setting messages:', data.messages);
          setMessages(data.messages);
        }
      } else {
        console.error('Messages API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userProfile?.uid) return;

    console.log('Sending message:', newMessage);
    setSending(true);
    try {
      const response = await fetch('/api/client-portal/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: userProfile.uid,
          content: newMessage,
          type: 'text'
        }),
      });

      console.log('Send message response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Send message response:', data);
        if (data.success) {
          setNewMessage('');
          console.log('Message sent successfully, refreshing messages...');
          await fetchMessages(); // Refresh messages
          // Auto-scroll to the new message
          setTimeout(() => scrollToBottom(), 100);
        }
      } else {
        const errorData = await response.json();
        console.error('Send message error:', errorData);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const unreadCount = messages.filter(msg => !msg.isRead && msg.senderId !== userProfile?.uid).length;

  // Debug logging
  console.log('Current messages state:', messages);
  console.log('Messages length:', messages.length);
  console.log('Loading state:', loading);

  const isOwnMessage = (senderId: string) => senderId === userProfile?.uid;

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-white flex flex-col lg:flex-row">
        {/* Desktop Navigation */}
        <div className="hidden lg:block">
          <ClientNavigation />
        </div>
        
        {/* Mobile Header - Fixed at top */}
        <div className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-200">
          <div className="px-4 py-3 flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Messages</h1>
            {unreadCount > 0 && (
              <div className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                {unreadCount}
              </div>
            )}
          </div>
        </div>

        {/* Messages Area - Full width on mobile, constrained on desktop */}
        <div className="flex-1 flex flex-col lg:ml-4 lg:mr-8 lg:mt-6 lg:mb-6 lg:max-w-4xl lg:mx-auto">
          {/* Desktop Header */}
          <div className="hidden lg:block mb-6">
            <div className="px-4 py-4 sm:px-6 sm:py-5 border-b-2 rounded-t-2xl" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Messages</h1>
                  <p className="text-gray-600 text-sm">Communicate with your coach</p>
                </div>
                {unreadCount > 0 && (
                  <div className="px-4 py-2 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                    {unreadCount} unread
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat Container - WhatsApp Style */}
          <div className="flex-1 flex flex-col bg-gray-50 lg:bg-white lg:rounded-2xl lg:shadow-[0_1px_3px_rgba(0,0,0,0.1)] lg:border lg:border-gray-100 overflow-hidden">
            {/* Chat Header - Fixed */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 lg:px-6 lg:py-4 flex items-center justify-between sticky top-0 z-10">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Conversation with Coach</h2>
                <p className="text-xs text-gray-500 lg:text-sm lg:text-gray-600 mt-0.5">Send messages and get support</p>
              </div>
            </div>

            {/* Messages List - Scrollable */}
            <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-6" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderBottomColor: '#daa450' }}></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">💬</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No messages yet</h3>
                  <p className="text-sm text-gray-600 px-4">Start a conversation with your coach by sending a message below.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((message) => {
                    const own = isOwnMessage(message.senderId);
                    return (
                      <div
                        key={message.id}
                        className={`flex ${own ? 'justify-end' : 'justify-start'} items-end gap-2`}
                      >
                        {/* Avatar for received messages */}
                        {!own && (
                          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 mb-1">
                            <span className="text-xs font-semibold text-gray-600">
                              {message.senderName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        
                        {/* Message Bubble */}
                        <div className={`max-w-[85%] lg:max-w-md px-3 py-2 rounded-2xl ${
                          own
                            ? 'bg-[#dcf8c6] text-gray-900 rounded-br-sm'
                            : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
                        }`}>
                          {/* Sender name for received messages */}
                          {!own && (
                            <p className="text-xs font-semibold mb-1 text-gray-700">
                              {message.senderName}
                            </p>
                          )}
                          
                          {/* Message content */}
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                          
                          {/* Timestamp */}
                          <div className={`flex items-center justify-end gap-1 mt-1 ${
                            own ? 'flex-row-reverse' : ''
                          }`}>
                            <p className={`text-[10px] ${
                              own ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                              {formatTime(message.timestamp)}
                            </p>
                            {/* Read receipt for sent messages */}
                            {own && (
                              <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            {/* Unread indicator for received messages */}
                            {!message.isRead && !own && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>
                        </div>
                        
                        {/* Avatar for sent messages */}
                        {own && (
                          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 mb-1">
                            <span className="text-xs font-semibold text-gray-600">
                              You
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Scroll target for auto-scroll */}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input - Fixed at bottom */}
            <div className="bg-white border-t border-gray-200 px-4 py-3 lg:px-6 lg:py-4 sticky bottom-0 z-10">
              <form onSubmit={sendMessage} className="flex items-end gap-2 lg:gap-3">
                <div className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 lg:px-5 lg:py-3 flex items-center">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 bg-transparent text-sm lg:text-base focus:outline-none text-gray-900 placeholder-gray-500"
                    disabled={sending}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="rounded-full p-3 lg:p-3.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[48px] min-h-[48px]"
                  style={{ 
                    backgroundColor: !newMessage.trim() || sending ? '#9ca3af' : '#daa450'
                  }}
                  onMouseEnter={(e) => {
                    if (newMessage.trim() && !sending) {
                      e.currentTarget.style.backgroundColor = '#c89540';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (newMessage.trim() && !sending) {
                      e.currentTarget.style.backgroundColor = '#daa450';
                    }
                  }}
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Quick Actions - Only on desktop, below chat */}
          <div className="hidden lg:grid lg:grid-cols-3 gap-4 mt-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: '#fef9e7' }}>
                  <svg className="w-5 h-5" style={{ color: '#daa450' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Request Check-in</h3>
                  <p className="text-xs text-gray-600">Ask for a new check-in</p>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="lg:hidden mt-4">
            <ClientNavigation />
          </div>
        </div>
      </div>
    </RoleProtected>
  );
} 