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

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
        <ClientNavigation />
        
        <div className="flex-1 ml-8 p-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Messages</h1>
                <p className="text-gray-600">Communicate with your coach</p>
              </div>
              {unreadCount > 0 && (
                <div className="px-4 py-2 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          {/* Messages Container */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-8 py-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Conversation with Coach</h2>
              <p className="text-gray-600 mt-1">Send messages and get support from your wellness coach</p>
            </div>

            {/* Messages List */}
            <div className="h-96 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">💬</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No messages yet</h3>
                  <p className="text-gray-600">Start a conversation with your coach by sending a message below.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.senderId === userProfile?.uid ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                          message.senderId === userProfile?.uid
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium mb-1">
                              {message.senderId === userProfile?.uid ? 'You' : message.senderName}
                            </p>
                            <p className="text-sm">{message.content}</p>
                          </div>
                          {!message.isRead && message.senderId !== userProfile?.uid && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                        <p className={`text-xs mt-2 ${
                          message.senderId === userProfile?.uid ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {/* Scroll target for auto-scroll */}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="border-t border-gray-200 p-6">
              <form onSubmit={sendMessage} className="flex space-x-4">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </form>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <span className="text-2xl">📋</span>
                </div>
                <div className="ml-4">
                  <h3 className="font-semibold text-gray-900">Request Check-in</h3>
                  <p className="text-sm text-gray-600">Ask your coach to assign a new check-in</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <span className="text-2xl">📊</span>
                </div>
                <div className="ml-4">
                  <h3 className="font-semibold text-gray-900">Progress Review</h3>
                  <p className="text-sm text-gray-600">Request a progress review from your coach</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <span className="text-2xl">🎯</span>
                </div>
                <div className="ml-4">
                  <h3 className="font-semibold text-gray-900">Goal Support</h3>
                  <p className="text-sm text-gray-600">Get help with your wellness goals</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
} 