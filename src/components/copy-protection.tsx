'use client';

import { useEffect } from 'react';

const editableSelector =
  'input, textarea, select, [contenteditable="true"], [data-allow-copy="true"]';

export default function CopyProtection() {
  useEffect(() => {
    const blockCopyFromPageContent = (event: ClipboardEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(editableSelector)) return;
      event.preventDefault();
    };

    document.addEventListener('copy', blockCopyFromPageContent, true);
    document.addEventListener('cut', blockCopyFromPageContent, true);

    return () => {
      document.removeEventListener('copy', blockCopyFromPageContent, true);
      document.removeEventListener('cut', blockCopyFromPageContent, true);
    };
  }, []);

  return null;
}
