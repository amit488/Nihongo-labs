'use client';

import { useEffect } from 'react';

const editableSelector =
  'input, textarea, select, [contenteditable="true"], [data-allow-copy="true"]';

export default function CopyProtection() {
  useEffect(() => {
    const selectionIsInsideAllowedContent = () => {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
      const range = selection.getRangeAt(0);
      const findAllowedRoot = (node: Node) => {
        const element = node instanceof Element ? node : node.parentElement;
        return element?.closest('[data-allow-copy="true"]') ?? null;
      };
      const startRoot = findAllowedRoot(range.startContainer);
      const endRoot = findAllowedRoot(range.endContainer);
      return Boolean(startRoot && startRoot === endRoot);
    };

    const blockCopyFromPageContent = (event: ClipboardEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(editableSelector)) return;
      if (selectionIsInsideAllowedContent()) return;
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
