import React from 'react';
import Image from 'next/image';

export const BharatXLogoHeader = () => (
  <div className="flex items-center gap-2 my-1.5">
    <Image
      src="/icon.png"
      alt="BharatX"
      width={26}
      height={26}
      className="rounded-lg flex-shrink-0"
    />
    <h2 className="text-xl font-normal font-be-vietnam-pro text-foreground dark:text-foreground">BharatX</h2>
  </div>
);
