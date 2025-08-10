import React, { useState } from 'react';

// Props expected:
// { roomId, player, createRoom, joinRoom, leaveRoom, isMultiplayer }
export default function RoomControls({ roomId, player, createRoom, joinRoom, leaveRoom, isMultiplayer }){
  const [joinCode, setJoinCode] = useState('');

  const onSubmit = (e) => {
    e.preventDefault();
    const code = joinCode.trim();
    if (code) joinRoom(code);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 mt-4 items-stretch sm:items-center">
      <button
        onClick={createRoom}
        className="px-4 py-2 bg-green-500 text-white rounded shadow hover:bg-green-600 transition"
        type="button"
      >
        Create Room
      </button>
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          name="roomId"
          value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Room Code"
          className="border rounded px-2 uppercase tracking-wider w-32"
          maxLength={5}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-600 transition"
        >
          Join
        </button>
        {isMultiplayer && (
          <button
            type="button"
            onClick={leaveRoom}
            className="px-4 py-2 bg-red-500 text-white rounded shadow hover:bg-red-600 transition"
          >
            Leave
          </button>
        )}
      </form>
    </div>
  );
}
