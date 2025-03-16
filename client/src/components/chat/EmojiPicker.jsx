import React from 'react';

// Simple emoji picker with common emojis
const EmojiPicker = ({ onSelect }) => {
  const commonEmojis = [
    '😊', '😂', '❤️', '👍', '🙌',
    '😎', '😢', '😡', '🤔', '👏',
    '✨', '🔥', '💯', '🙏', '👀',
    '💪', '🤗', '🎉', '😴', '👋'
  ];
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-2 w-64 border">
      <div className="grid grid-cols-5 gap-2">
        {commonEmojis.map((emoji, index) => (
          <button
            key={index}
            onClick={() => onSelect(emoji)}
            className="text-2xl hover:bg-gray-100 rounded p-1"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;