// src/components/ElectronLinkHandler.js
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function ElectronLinkHandler() {
  const pathname = usePathname();

  useEffect(() => {
    // Handle external link clicks
    const handleLinkClick = (event) => {
      const target = event.target.closest('a');
      if (!target) return;
      
      const href = target.getAttribute('href');
      if (!href) return;
      
      // Check if it's an external link
      if (href.startsWith('http://') || href.startsWith('https://')) {
        event.preventDefault();
          // Only run this in Electron environment
        if (typeof window !== 'undefined' && window.electron) {
          window.electron.openExternal(href).catch(error => {
            console.error('Error opening external URL:', error);
            // Fall back to normal behavior in browser
            window.open(href, '_blank');
          });
        } else {
          // Not in Electron environment, use normal browser behavior
          window.open(href, '_blank');
        }
      }
    };

    document.addEventListener('click', handleLinkClick);
    
    return () => {
      document.removeEventListener('click', handleLinkClick);
    };
  }, [pathname]);

  return null; // This component doesn't render anything
}