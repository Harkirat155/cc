import { useCallback, useEffect, useRef, useState } from "react";
// Use the prebuilt browser bundle to avoid Node stream polyfills issues
import Peer from "simple-peer/simplepeer.min.js";

// Manages one-to-many voice: when mic enabled, we publish our audio and set up peers to others in room.
// When muted, we stop sending audio but we still receive others.
export default function useVoiceChat({ socket, roomId, selfId, roster = {}, voiceRoster = {}, initialMuted = true }) {
  const [micPermission, setMicPermission] = useState(null); // 'granted' | 'denied' | 'prompt' | null
  const [micEnabled, setMicEnabled] = useState(false);
  const [muted, setMuted] = useState(initialMuted);
  const [connectedPeers, setConnectedPeers] = useState({}); // peerId -> Peer
  const [remoteAudioStreams, setRemoteAudioStreams] = useState({}); // peerId -> MediaStream
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  // Avoid stale muted value during async permission prompts
  const mutedRef = useRef(initialMuted);

  // Helpers to update state maps safely
  const setPeersMap = (fn) => {
    setConnectedPeers((prev) => {
      const next = fn(prev);
      return { ...next };
    });
  };
  const setStreamsMap = (fn) => {
    setRemoteAudioStreams((prev) => {
      const next = fn(prev);
      return { ...next };
    });
  };

  // Request mic permissions lazily
  const getMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setMicPermission("granted");
      return stream;
    } catch (e) {
      console.warn("Mic permission denied:", e);
      setMicPermission("denied");
      throw e;
    }
  }, []);

  // Create a peer connection to a target
  const createPeer = useCallback((targetId, initiatorOverride = null) => {
    const stream = localStreamRef.current || undefined;
    // Deterministic initiator selection to avoid glare: lower socketId initiates
    const defaultInitiator = typeof selfId === 'string' && typeof targetId === 'string' ? (selfId < targetId) : false;
    const initiator = (initiatorOverride === null ? defaultInitiator : initiatorOverride);
    const peer = new Peer({
      initiator,
      trickle: true,
      stream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
            // Twilio STUN URL must not include query params
            { urls: "stun:global.stun.twilio.com:3478" },
        ],
      },
    });
    peer.on("signal", (data) => {
      if (!socket) return;
      socket.emit("voice:signal", { roomId, targetId, data });
    });
    peer.on("stream", (remoteStream) => {
      setStreamsMap((prev) => ({ ...prev, [targetId]: remoteStream }));
    });
    peer.on("close", () => {
      // Remove from refs first so later loops don't touch a destroyed peer
      if (peersRef.current[targetId]) {
        delete peersRef.current[targetId];
      }
      setPeersMap((prev) => {
        const copy = { ...prev };
        delete copy[targetId];
        return copy;
      });
      setStreamsMap((prev) => {
        const copy = { ...prev };
        delete copy[targetId];
        return copy;
      });
    });
    peer.on("error", (err) => console.warn("peer error", targetId, err));
    peersRef.current[targetId] = peer;
    setConnectedPeers((prev) => ({ ...prev, [targetId]: peer }));
    return peer;
  }, [roomId, socket, selfId]);

  // Handle incoming signaling
  useEffect(() => {
    if (!socket) return;
    const onSignal = ({ from, data }) => {
      if (from === selfId) return;
      let peer = peersRef.current[from];
      if (!peer) {
        // We received a signal first; ensure we are the non-initiator to accept it
        peer = createPeer(from, false);
      }
      try {
        peer.signal(data);
      } catch (e) {
        console.warn("signal apply error", e);
      }
    };
    socket.on("voice:signal", onSignal);
    return () => {
      socket.off("voice:signal", onSignal);
    };
  }, [socket, selfId, createPeer]);

  // User joins/leaves voice and mute state updates
  useEffect(() => {
    if (!socket || !roomId) return;
    const onUserJoined = ({ socketId, muted: _muted }) => {
      if (socketId === selfId) return;
      // Do not proactively create peers here; the deterministic rule will ensure one side initiates
      // When the remote initiates, onSignal will create a non-initiator peer automatically.
    };
    const onUserLeft = ({ socketId }) => {
      const p = peersRef.current[socketId];
      if (p) {
        try { p.destroy(); } catch (err) { console.warn("peer destroy error", err); }
        delete peersRef.current[socketId];
      }
      setPeersMap((prev) => { const c = { ...prev }; delete c[socketId]; return c; });
      setStreamsMap((prev) => { const c = { ...prev }; delete c[socketId]; return c; });
    };
    socket.on("voice:user-joined", onUserJoined);
    socket.on("voice:user-left", onUserLeft);
    return () => {
      socket.off("voice:user-joined", onUserJoined);
      socket.off("voice:user-left", onUserLeft);
    };
  }, [socket, roomId, selfId, createPeer]);

  const setMutedState = useCallback((m) => {
    setMuted(m);
    mutedRef.current = m;
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getAudioTracks()) track.enabled = !m;
    }
    if (socket && roomId) socket.emit("voice:mute-state", { roomId, muted: m });
  }, [socket, roomId]);

  // Enable/disable mic (publish)
  const enableMic = useCallback(async (desiredMuted = null) => {
    if (!socket || !roomId) return;
    try {
      const stream = await getMedia();
      // Determine final mute state (explicit override wins; else latest ref)
      const finalMuted = desiredMuted !== null ? desiredMuted : mutedRef.current;
      // Ensure audio tracks enabled based on final mute state
      for (const track of stream.getAudioTracks()) track.enabled = !finalMuted;
      setMicEnabled(true);
      socket.emit("voice:join", { roomId, muted: finalMuted });
      // Sync React state if caller provided an explicit desired state
      if (desiredMuted !== null) {
        // This also updates local tracks (idempotent) and emits mute-state
        // but since we just emitted join with the same value, this keeps UIs consistent
        setMutedState(finalMuted);
      }
      // Create peers to everyone in the room roster (players + spectators) using deterministic initiator rule
      const ids = new Set();
      if (roster?.X) ids.add(roster.X);
      if (roster?.O) ids.add(roster.O);
      for (const sid of roster?.spectators || []) ids.add(sid);
      for (const targetId of ids) {
        if (!targetId || targetId === selfId) continue;
        if (!peersRef.current[targetId]) createPeer(targetId);
      }
    } catch {
      // permission denied already handled by state
      void 0;
    }
  }, [getMedia, socket, roomId, roster, selfId, createPeer, setMutedState]);

  const disableMic = useCallback(() => {
    setMicEnabled(false);
    if (socket && roomId) socket.emit("voice:leave", { roomId });
    // Stop local tracks
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) track.stop();
      localStreamRef.current = null;
    }
    // Tear down peers
    for (const id of Object.keys(peersRef.current)) {
      try { peersRef.current[id].destroy(); } catch (err) { console.warn("peer destroy error", err); }
      delete peersRef.current[id];
    }
    setConnectedPeers({});
    setRemoteAudioStreams({});
  }, [socket, roomId]);

  // Cleanup on unmount or when room changes
  useEffect(() => {
    return () => {
      disableMic();
    };
  }, [disableMic]);

  

  // When mic becomes enabled later, attach local stream to all existing peers
  useEffect(() => {
    if (!micEnabled || !localStreamRef.current) return;
    for (const id of Object.keys(peersRef.current)) {
      try {
        const peer = peersRef.current[id];
        if (!peer || peer.destroyed) continue;
        // simple-peer automatically uses provided stream at creation; for late stream, we can replace/add
        // The simplest is to recreate peers; but we attempt to addTrack if supported
        const stream = localStreamRef.current;
        // Some peer versions support addStream in older APIs; here we can renegotiate by replacing stream
        // Trigger a renegotiation by calling peer.addStream if available
        if (typeof peer.addTrack === "function") {
          for (const track of stream.getTracks()) {
            try { peer.addTrack(track, stream); } catch (err) { void err; /* ignore duplicate track errors */ }
          }
        } else if (typeof peer.addStream === "function") {
          peer.addStream(stream);
        }
      } catch (e) { console.warn("attach stream failed", e); }
    }
  }, [micEnabled]);

  // When roster changes (new people in room), if mic is enabled we initiate peers to any we missed
  useEffect(() => {
    if (!socket || !roomId || !micEnabled) return;
    const ids = new Set();
    if (roster?.X) ids.add(roster.X);
    if (roster?.O) ids.add(roster.O);
    for (const sid of roster?.spectators || []) ids.add(sid);
    for (const targetId of ids) {
      if (!targetId || targetId === selfId) continue;
      if (!peersRef.current[targetId]) createPeer(targetId);
    }
  }, [roster, socket, roomId, selfId, createPeer, micEnabled]);

  // When there are existing voice publishers and we are not yet connected, initiate peers to them to receive audio even if our mic is disabled
  useEffect(() => {
    if (!socket || !roomId) return;
    for (const targetId of Object.keys(voiceRoster || {})) {
      if (!targetId || targetId === selfId) continue;
      if (!peersRef.current[targetId]) createPeer(targetId);
    }
  }, [voiceRoster, socket, roomId, selfId, createPeer]);

  return {
    micPermission,
    micEnabled,
    muted,
    connectedPeers,
    remoteAudioStreams,
    enableMic,
    disableMic,
    setMuted: setMutedState,
  };
}
