'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import CoachNavigation from '@/components/CoachNavigation';
import Link from 'next/link';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  type: 'text' | 'file' | 'image';
  participants: string[];
  conversationId: string;
  responseId?: string;
  checkInContext?: {
    responseId: string;
    formTitle: string;
    submittedAt: string;
  };
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

interface Conversation {
  clientId: string;
  clientName: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  client: Client;
}

export default function CoachMessagesPage() {
  const { userProfile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showClientList, setShowClientList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Calculate total unread count
  const totalUnreadCount = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchConversations();
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClientId && userProfile?.uid) {
      // Set up real-time listener for messages
      const unsubscribe = setupRealTimeMessages(selectedClientId, userProfile.uid);
      
      // Also fetch once to ensure we have initial data
      fetchMessages(selectedClientId);
      setShowClientList(false); // Hide client list on mobile when client selected
      
      // Cleanup listener on unmount or when selectedClientId changes
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [selectedClientId, userProfile?.uid]);

  const setupRealTimeMessages = (clientId: string, coachId: string) => {
    if (!db) {
      console.error('Firestore db not initialized');
      return null;
    }

    try {
      // Query messages where participants include both client and coach
      // Try with orderBy first, fallback to without orderBy if index doesn't exist
      let messagesQuery;
      try {
        messagesQuery = query(
          collection(db, 'messages'),
          where('participants', 'array-contains', clientId),
          orderBy('timestamp', 'asc')
        );
      } catch (queryError: any) {
        // If index doesn't exist, use query without orderBy and sort client-side
        console.log('OrderBy not available, using query without orderBy:', queryError);
        messagesQuery = query(
          collection(db, 'messages'),
          where('participants', 'array-contains', clientId)
        );
      }

      const unsubscribe = onSnapshot(
        messagesQuery,
        (snapshot) => {
          const realTimeMessages: Message[] = [];
          
          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            // Filter to only include messages between this coach and client
            if (data.participants?.includes(coachId) && data.participants?.includes(clientId)) {
              let timestamp: string;
              if (data.timestamp?.toDate) {
                timestamp = data.timestamp.toDate().toISOString();
              } else if (data.timestamp?._seconds) {
                timestamp = new Date(data.timestamp._seconds * 1000).toISOString();
              } else if (data.timestamp instanceof Timestamp) {
                timestamp = data.timestamp.toDate().toISOString();
              } else {
                timestamp = data.timestamp || new Date().toISOString();
              }

              realTimeMessages.push({
                id: doc.id,
                senderId: data.senderId || '',
                senderName: data.senderName || 'Unknown',
                content: data.content || '',
                timestamp: timestamp,
                isRead: data.isRead || false,
                type: data.type || 'text',
                participants: data.participants || [],
                conversationId: data.conversationId || '',
                responseId: data.responseId || undefined,
                checkInContext: data.checkInContext || undefined
              });
            }
          });

          // Sort by timestamp if we didn't use orderBy in the query
          realTimeMessages.sort((a, b) => {
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          });

          // Update messages state with real-time data
          setMessages(realTimeMessages);
          
          // Auto-scroll to bottom when new messages arrive
          setTimeout(() => scrollToBottom(), 100);
        },
        (error) => {
          console.error('Error in real-time messages listener:', error);
          // Fallback to regular fetch on error
          fetchMessages(clientId);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up real-time messages:', error);
      // Fallback to regular fetch on error
      fetchMessages(clientId);
      return null;
    }
  };

  const fetchConversations = async () => {
    try {
      const coachId = userProfile?.uid;
      if (!coachId) return;

      const response = await fetch(`/api/messages/conversations?coachId=${coachId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setConversations(data.conversations);
        }
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const coachId = userProfile?.uid;
      if (!coachId) return;

      const response = await fetch(`/api/clients?coachId=${coachId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setClients(data.clients);
        }
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchMessages = async (clientId: string) => {
    try {
      const response = await fetch(`/api/messages?coachId=${userProfile?.uid}&clientId=${clientId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMessages(data.messages);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedClientId) return;

    // Find the most recent message in this conversation that has a responseId
    // This preserves the check-in context when coach replies
    const conversationMessages = messages.filter(
      msg => msg.participants.includes(selectedClientId) && msg.participants.includes(userProfile?.uid || '')
    );
    const lastMessageWithContext = [...conversationMessages]
      .reverse()
      .find(msg => msg.responseId || msg.checkInContext);

    const messagePayload: any = {
      coachId: userProfile?.uid,
      clientId: selectedClientId,
      content: newMessage,
      type: 'text'
    };

    // If replying to a message with check-in context, preserve it
    if (lastMessageWithContext?.responseId) {
      messagePayload.responseId = lastMessageWithContext.responseId;
      if (lastMessageWithContext.checkInContext) {
        messagePayload.checkInContext = lastMessageWithContext.checkInContext;
        // Format date for display
        let dateDisplay = '';
        if (lastMessageWithContext.checkInContext.submittedAt) {
          try {
            const date = new Date(lastMessageWithContext.checkInContext.submittedAt);
            dateDisplay = date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });
          } catch (e) {
            // If date parsing fails, skip date display
          }
        }
        // Prepend context to message with date for clarity
        const dateSuffix = dateDisplay ? ` (${dateDisplay})` : '';
        messagePayload.content = `Re: ${lastMessageWithContext.checkInContext.formTitle}${dateSuffix}\n\n${newMessage}`;
      } else {
        // If we have responseId but no full context, try to get it from the message
        messagePayload.responseId = lastMessageWithContext.responseId;
      }
    }

    setSending(true);
    
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      });

      if (response.ok) {
        setNewMessage('');
        // No need to manually fetch messages - real-time listener will update automatically
        await fetchConversations();
        setTimeout(() => scrollToBottom(), 100);
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

  const getSelectedClient = () => {
    return clients.find(client => client.id === selectedClientId);
  };

  const selectedClient = getSelectedClient();

  return (
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen bg-white flex flex-col lg:flex-row">
        {/* Desktop Sidebar Navigation */}
        <div className="hidden lg:block">
          <CoachNavigation />
        </div>

        {/* Mobile Header - Fixed at top when chat is open */}
        {selectedClientId && (
          <div className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-200">
            <div className="px-4 py-3 flex items-center justify-between">
              <button
                onClick={() => setShowClientList(true)}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <svg className="w-5 h-5 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold text-xs">
                      {selectedClient?.firstName?.charAt(0)}{selectedClient?.lastName?.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-base font-semibold text-gray-900 truncate">
                      {selectedClient?.firstName} {selectedClient?.lastName}
                    </h1>
                    <p className="text-xs text-gray-500 truncate">{selectedClient?.email}</p>
                  </div>
                </div>
              </button>
              {totalUnreadCount > 0 && (
                <div className="ml-2 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium flex-shrink-0">
                  {totalUnreadCount}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile Header - When no chat selected */}
        {!selectedClientId && (
          <div className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-200">
            <div className="px-4 py-3 flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-900">Messages</h1>
              {totalUnreadCount > 0 && (
                <div className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                  {totalUnreadCount}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col lg:ml-4 lg:mr-8 lg:mt-6 lg:mb-6 lg:max-w-7xl lg:mx-auto">
          {/* Desktop Header */}
          <div className="hidden lg:block mb-6">
            <div className="px-4 py-4 sm:px-6 sm:py-5 border-b-2 rounded-t-3xl" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Messages</h1>
                  <p className="text-gray-600 text-sm">Communicate with your clients</p>
                </div>
                {totalUnreadCount > 0 && (
                  <div className="px-4 py-2 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                    {totalUnreadCount} unread
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col lg:grid lg:grid-cols-3 gap-6 lg:h-[calc(100vh-250px)]">
            {/* Client List - Mobile: Full screen overlay, Desktop: Sidebar */}
            <div className={`${
              showClientList || !selectedClientId 
                ? 'flex flex-col' 
                : 'hidden'
            } lg:flex lg:flex-col bg-white lg:rounded-2xl lg:shadow-[0_1px_3px_rgba(0,0,0,0.1)] lg:border lg:border-gray-100 overflow-hidden`}>
              {/* Client List Header */}
              <div className="px-4 py-3 sm:px-6 sm:py-4 border-b-2 lg:rounded-t-2xl" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                <h2 className="text-lg lg:text-xl font-bold text-gray-900">Clients</h2>
                <p className="text-gray-600 text-xs lg:text-sm mt-1">Select a client to start messaging</p>
              </div>
              
              {/* Client List - Scrollable */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderBottomColor: '#daa450' }}></div>
                  </div>
                ) : clients.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <div className="text-4xl mb-2">👥</div>
                    <p className="text-gray-600 mb-1">No clients yet</p>
                    <p className="text-sm text-gray-500 mb-4">Add clients to start messaging</p>
                    <Link
                      href="/clients/create"
                      className="inline-block px-4 py-2 rounded-full text-sm font-medium text-white transition-all"
                      style={{ backgroundColor: '#daa450' }}
                    >
                      Add Client
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {clients.map((client) => {
                      const conversation = conversations.find(c => c.clientId === client.id);
                      const unreadCount = conversation?.unreadCount || 0;
                      const lastMessage = conversation?.lastMessage || 'No messages yet';
                      const lastMessageTime = conversation?.lastMessageTime || '';
                      
                      return (
                        <button
                          key={client.id}
                          onClick={() => setSelectedClientId(client.id)}
                          className={`w-full p-3 sm:p-4 text-left hover:bg-gray-50 transition-colors ${
                            selectedClientId === client.id ? 'bg-gray-50 lg:border-r-4 lg:border-[#daa450]' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-white font-semibold text-sm">
                                {client.firstName?.charAt(0)}{client.lastName?.charAt(0)}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                                  {client.firstName} {client.lastName}
                                </h3>
                                {unreadCount > 0 && (
                                  <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full flex-shrink-0">
                                    {unreadCount}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate mb-1">{client.email}</p>
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-600 truncate">{lastMessage}</p>
                                {lastMessageTime && (
                                  <p className="text-[10px] text-gray-400 ml-2 flex-shrink-0">
                                    {formatTime(lastMessageTime)}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  client.status === 'active' 
                                    ? 'bg-green-100 text-green-800' 
                                    : client.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {client.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Chat Area - WhatsApp Style */}
            {selectedClientId ? (
              <div className="flex-1 lg:col-span-2 flex flex-col bg-gray-50 lg:bg-white lg:rounded-2xl lg:shadow-[0_1px_3px_rgba(0,0,0,0.1)] lg:border lg:border-gray-100 overflow-hidden">
                {/* Check-in Context Banner - Show if there are messages with check-in context */}
                {(() => {
                  const conversationMessages = messages.filter(
                    msg => msg.participants.includes(selectedClientId) && msg.participants.includes(userProfile?.uid || '')
                  );
                  const lastMessageWithContext = [...conversationMessages]
                    .reverse()
                    .find(msg => msg.responseId || msg.checkInContext);
                  
                  if (lastMessageWithContext?.checkInContext) {
                    // Format date for display
                    let dateDisplay = '';
                    if (lastMessageWithContext.checkInContext.submittedAt) {
                      try {
                        const date = new Date(lastMessageWithContext.checkInContext.submittedAt);
                        dateDisplay = date.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        });
                      } catch (e) {
                        // If date parsing fails, skip date display
                      }
                    }
                    
                    return (
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200 px-4 py-3 lg:px-6 lg:py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">Replying to check-in:</p>
                              <p className="text-xs text-gray-600">
                                {lastMessageWithContext.checkInContext.formTitle}
                                {dateDisplay && ` • ${dateDisplay}`}
                              </p>
                            </div>
                          </div>
                          {lastMessageWithContext.responseId && (
                            <Link
                              href={`/responses/${lastMessageWithContext.responseId}`}
                              className="text-xs text-purple-600 hover:text-purple-700 font-medium underline"
                            >
                              View Response
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Chat Header - Desktop */}
                <div className="hidden lg:flex bg-white border-b border-gray-200 px-6 py-4 items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {selectedClient?.firstName?.charAt(0)}{selectedClient?.lastName?.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {selectedClient?.firstName} {selectedClient?.lastName}
                      </h2>
                      <p className="text-xs text-gray-500">{selectedClient?.email}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    selectedClient?.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : selectedClient?.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedClient?.status}
                  </span>
                </div>

                {/* Messages List - Scrollable */}
                <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-6" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-5xl mb-4">💬</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No messages yet</h3>
                      <p className="text-sm text-gray-600 px-4">
                        Start a conversation with {selectedClient?.firstName} by sending a message below.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {messages.map((message) => {
                        const isOwnMessage = message.senderId === userProfile?.uid;
                        return (
                          <div
                            key={message.id}
                            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} items-end gap-2`}
                          >
                            {/* Avatar for received messages */}
                            {!isOwnMessage && (
                              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 mb-1">
                                <span className="text-xs font-semibold text-gray-600">
                                  {message.senderName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            
                            {/* Message Bubble */}
                            <div className={`max-w-[85%] lg:max-w-md px-3 py-2 rounded-2xl ${
                              isOwnMessage
                                ? 'bg-[#dcf8c6] text-gray-900 rounded-br-sm'
                                : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
                            }`}>
                              {/* Sender name for received messages */}
                              {!isOwnMessage && (
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
                                isOwnMessage ? 'flex-row-reverse' : ''
                              }`}>
                                <p className={`text-[10px] ${
                                  isOwnMessage ? 'text-gray-500' : 'text-gray-400'
                                }`}>
                                  {formatTime(message.timestamp)}
                                </p>
                                {/* Read receipt for sent messages */}
                                {isOwnMessage && (
                                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                                {/* Unread indicator for received messages */}
                                {!message.isRead && !isOwnMessage && (
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                )}
                              </div>
                            </div>
                            
                            {/* Avatar for sent messages */}
                            {isOwnMessage && (
                              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 mb-1">
                                <span className="text-xs font-semibold text-gray-600">You</span>
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
            ) : (
              <div className="hidden lg:flex lg:col-span-2 items-center justify-center bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100">
                <div className="text-center">
                  <div className="text-6xl mb-4">💬</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Conversation</h3>
                  <p className="text-gray-600">Choose a client from the list to start messaging</p>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Navigation */}
          <div className="lg:hidden mt-4">
            <CoachNavigation />
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}