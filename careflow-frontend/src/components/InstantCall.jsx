import { useEffect, useRef, useState } from 'react';
import { BASE, call } from '../api';

export default function InstantCall({ consultationId, roomToken, role, onEnd }) {
  const local = useRef(null), remote = useRef(null), pc = useRef(null), ws = useRef(null), stream = useRef(null);
  const [state, setState] = useState('Connecting securely…');
  useEffect(() => {
    let stopped = false;
    const start = async () => {
      if (!roomToken) throw new Error('Private room authorization is missing');
      const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }); pc.current = peer;
      peer.ontrack = event => { if (remote.current) remote.current.srcObject = event.streams[0]; setState('Connected securely'); };
      peer.onicecandidate = event => { if (event.candidate && ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify({ type: 'ICE', payload: event.candidate })); };
      stream.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); if (stopped) return;
      if (local.current) local.current.srcObject = stream.current; stream.current.getTracks().forEach(track => peer.addTrack(track, stream.current));
      const wsBase = BASE.replace(/^http/, 'ws').replace(/\/api\/v1\/?$/, '');
      const socket = new WebSocket(`${wsBase}/api/v1/instant-consultations/ws?token=${encodeURIComponent(roomToken)}`); ws.current = socket;
      const makeOffer = async () => { if (peer.signalingState !== 'stable') return; const offer = await peer.createOffer(); await peer.setLocalDescription(offer); if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'OFFER', payload: offer })); };
      socket.onopen = () => { setState('Waiting for the other participant…'); socket.send(JSON.stringify({ type: 'ready' })); };
      socket.onmessage = async event => {
        const message = JSON.parse(event.data);
        if (message.type === 'room' && message.peerCount === 2 && role === 'DOCTOR') await makeOffer();
        if (message.type === 'peer-ready' && role === 'DOCTOR') await makeOffer();
        if (message.type === 'OFFER' && role === 'PATIENT') { await peer.setRemoteDescription(message.payload); const answer = await peer.createAnswer(); await peer.setLocalDescription(answer); socket.send(JSON.stringify({ type: 'ANSWER', payload: answer })); }
        if (message.type === 'ANSWER' && role === 'DOCTOR') await peer.setRemoteDescription(message.payload);
        if (message.type === 'ICE' && message.payload) await peer.addIceCandidate(message.payload).catch(() => {});
        if (message.type === 'HANGUP') { setState('The other participant ended the call'); onEnd?.(); }
        if (message.type === 'error') setState(message.message || 'Room error');
      };
      socket.onerror = () => setState('Could not connect to the private room');
    };
    start().catch(error => setState(error.message));
    return () => { stopped = true; if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify({ type: 'HANGUP' })); ws.current?.close(); pc.current?.close(); stream.current?.getTracks().forEach(track => track.stop()); };
  }, [consultationId, roomToken, role]);
  const end = async () => { try { await call('POST', `/instant-consultations/${consultationId}/end`); } catch {} onEnd?.(); };
  return <div className="instant-call" style={{ marginTop: 16 }}><div style={{ marginBottom: 8 }}>{state} <span style={{ opacity: .7 }}>· Only you and the assigned doctor can join</span></div><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><video ref={remote} autoPlay playsInline style={{ width: 'min(560px, 100%)', background: '#05070a', borderRadius: 10 }} /><video ref={local} autoPlay muted playsInline style={{ width: 180, background: '#05070a', borderRadius: 10 }} /></div><button className="qb" onClick={end} style={{ marginTop: 10 }}>End call</button></div>;
}
