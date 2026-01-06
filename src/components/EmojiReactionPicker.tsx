'use client';

import { useState } from 'react';

interface EmojiReactionPickerProps {
  responseId: string;
  questionId: string;
  coachId: string;
  currentReaction?: string; // Current emoji for this coach
  onReactionChange?: (emoji: string | null) => void;
  disabled?: boolean;
}

const EMOJIS = [
  { emoji: '👍', label: 'Good', color: 'hover:bg-blue-100' },
  { emoji: '🙏🏻', label: 'Thankful', color: 'hover:bg-purple-100' },
  { emoji: '❤️', label: 'Love', color: 'hover:bg-red-100' },
  { emoji: '💔', label: 'Concern', color: 'hover:bg-pink-100' },
  { emoji: '🫶', label: 'Support', color: 'hover:bg-orange-100' },
  { emoji: '😢', label: 'Sympathy', color: 'hover:bg-gray-100' },
  { emoji: '🏆', label: 'Achievement', color: 'hover:bg-yellow-100' }
];

export default function EmojiReactionPicker({
  responseId,
  questionId,
  coachId,
  currentReaction,
  onReactionChange,
  disabled = false
}: EmojiReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleEmojiClick = async (emoji: string) => {
    if (disabled || saving) return;

    // If clicking the same emoji, remove it
    if (currentReaction === emoji) {
      await removeReaction();
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/responses/${responseId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          coachId,
          emoji
        })
      });

      const data = await response.json();
      
      if (data.success) {
        onReactionChange?.(emoji);
        setIsOpen(false);
      } else {
        console.error('Failed to save reaction:', data.message);
        alert('Failed to save reaction. Please try again.');
      }
    } catch (error) {
      console.error('Error saving reaction:', error);
      alert('Failed to save reaction. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeReaction = async () => {
    if (disabled || saving) return;

    setSaving(true);
    try {
      const response = await fetch(
        `/api/responses/${responseId}/reactions?questionId=${questionId}&coachId=${coachId}`,
        {
          method: 'DELETE'
        }
      );

      const data = await response.json();
      
      if (data.success) {
        onReactionChange?.(null);
        setIsOpen(false);
      } else {
        console.error('Failed to remove reaction:', data.message);
      }
    } catch (error) {
      console.error('Error removing reaction:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative inline-block">
      {/* Current Reaction Button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || saving}
        className={`
          flex items-center justify-center w-8 h-8 rounded-full transition-all
          ${currentReaction 
            ? 'bg-blue-50 border-2 border-blue-300 hover:border-blue-400' 
            : 'bg-gray-100 border border-gray-300 hover:bg-gray-200'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${saving ? 'opacity-50' : ''}
        `}
        title={currentReaction ? `Current: ${EMOJIS.find(e => e.emoji === currentReaction)?.label}` : 'Add reaction'}
      >
        {currentReaction ? (
          <span className="text-lg">{currentReaction}</span>
        ) : (
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </button>

      {/* Emoji Picker Dropdown */}
      {isOpen && !disabled && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Picker */}
          <div className="absolute z-20 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 p-2 flex items-center space-x-1">
            {EMOJIS.map(({ emoji, label, color }) => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEmojiClick(emoji);
                }}
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all
                  ${color}
                  ${currentReaction === emoji ? 'bg-blue-100 ring-2 ring-blue-400' : ''}
                  ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-110'}
                `}
                title={label}
                disabled={saving}
              >
                {emoji}
              </button>
            ))}
            
            {/* Remove button if there's a current reaction */}
            {currentReaction && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeReaction();
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all"
                title="Remove reaction"
                disabled={saving}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
