import React, { useState, useEffect } from 'react';

const WebSocketConfig = () => {
  const [wsHost, setWsHost] = useState(
    localStorage.getItem('wsHost') || 'localhost:8001'
  );

  const handleSave = () => {
    localStorage.setItem('wsHost', wsHost);
    alert('WebSocket host saved! Refresh the page to apply changes.');
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border z-50">
      <h3 className="font-bold mb-2">WebSocket Configuration</h3>
      <div className="mb-2">
        <label className="block text-sm mb-1">WebSocket Host:</label>
        <input
          type="text"
          value={wsHost}
          onChange={(e) => setWsHost(e.target.value)}
          className="border rounded px-2 py-1 w-full"
          placeholder="e.g., abc123.ngrok.io"
        />
      </div>
      <button
        onClick={handleSave}
        className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
      >
        Save
      </button>
      <p className="text-xs mt-2">
        For Ngrok, use only the domain without protocol (e.g., abc123.ngrok.io)
      </p>
    </div>
  );
};

export default WebSocketConfig;