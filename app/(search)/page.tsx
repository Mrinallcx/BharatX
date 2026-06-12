// This page dynamically renders a client-only chat interface.
// Mark it as a Client Component so `next/dynamic` options like `ssr: false` are allowed.
'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const ChatInterface = dynamic(() => import('@/components/chat-interface').then(m => m.ChatInterface), {
  // `ChatInterface` is a client component (`'use client'`), so avoid SSR to prevent dev
  // route emission issues in Turbopack.
  ssr: false,
  loading: () => <div style={{ minHeight: 240 }} />,
});

import { InstallPrompt } from '@/components/InstallPrompt';

const Home = () => {
  return (
    <React.Fragment>
      <ChatInterface />
      <InstallPrompt />
    </React.Fragment>
  );
};

export default Home;
