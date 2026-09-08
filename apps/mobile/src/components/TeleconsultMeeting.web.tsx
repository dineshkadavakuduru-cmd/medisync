/// <reference lib="dom" />
import React, { useEffect, useRef, useState } from 'react';
import type { TeleconsultMeetingProps } from './TeleconsultMeeting';
import { isMeetingLink } from '../services/teleconsultClient';
import { teleconsultCopy as copy } from '../i18n/translations/teleconsult';

interface JitsiAPI {
  addListener(event: string, handler: () => void): void;
  dispose(): void;
}
type JitsiConstructor = new (domain: string, options: Record<string, unknown>) => JitsiAPI;
declare global { interface Window { JitsiMeetExternalAPI?: JitsiConstructor } }

export function TeleconsultMeeting({ meetingLink, role, onJoined, onLeft }: TeleconsultMeetingProps) {
  const container = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onJoined, onLeft });
  callbacks.current = { onJoined, onLeft };
  const [state, setState] = useState<'loading' | 'ready' | 'joined' | 'left' | 'error'>('loading');

  useEffect(() => {
    let disposed = false;
    let joined = false;
    let api: JitsiAPI | undefined;
    let script: HTMLScriptElement | undefined;
    setState('loading');
    const timeout = window.setTimeout(() => { if (!disposed) setState('error'); }, 20000);
    const fail = () => { if (!disposed) { clearTimeout(timeout); setState('error'); } };
    const start = () => {
      if (disposed || !container.current || api) return;
      try {
        if (!window.JitsiMeetExternalAPI || !isMeetingLink(meetingLink)) { fail(); return; }
        api = new window.JitsiMeetExternalAPI('meet.jit.si', {
          roomName: new URL(meetingLink).pathname.slice(1),
          parentNode: container.current, width: '100%', height: '100%',
          userInfo: { displayName: role === 'doctor' ? 'Demo clinician' : 'Demo patient' },
          configOverwrite: {
            prejoinConfig: { enabled: true }, startWithAudioMuted: true, startWithVideoMuted: true,
            subject: 'Consultation demo', disableDeepLinking: true,
          },
          onload: () => { if (!disposed) { clearTimeout(timeout); setState('ready'); } },
        });
        api.addListener('videoConferenceJoined', () => {
          if (disposed || joined) return;
          joined = true;
          clearTimeout(timeout);
          setState('joined');
          callbacks.current.onJoined();
        });
        const leave = () => {
          if (disposed || !joined) return;
          joined = false;
          setState('left');
          callbacks.current.onLeft();
        };
        api.addListener('videoConferenceLeft', leave);
        api.addListener('readyToClose', leave);
        api.addListener('errorOccurred', fail);
      } catch { fail(); }
    };
    if (!isMeetingLink(meetingLink)) fail();
    else if (window.JitsiMeetExternalAPI) start();
    else {
      script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = start;
      script.onerror = fail;
      document.head.appendChild(script);
    }
    return () => {
      // Disposal can emit leave events. Neither cleanup nor leaving completes a session.
      disposed = true;
      clearTimeout(timeout);
      script?.remove();
      api?.dispose();
    };
  }, [meetingLink, role]);

  return <div style={{ width: '100%', minWidth: 0 }}>
    <p role="status">{state === 'error' ? copy.unavailable : state === 'joined' ? copy.connected : state === 'left' ? copy.left : copy.connecting}</p>
    <div ref={container} aria-label="Jitsi video consultation" style={{ width: '100%', height: 'min(65vh, 680px)', minHeight: 360, background: '#172b32', borderRadius: 12, overflow: 'hidden' }} />
    {isMeetingLink(meetingLink) && <p><a href={meetingLink} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{copy.external}</a></p>}
  </div>;
}
