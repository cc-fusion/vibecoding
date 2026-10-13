import { useEffect, useRef, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  drawer?: boolean;
}

export default function Modal({ children, onClose, className = '', drawer = false }: ModalProps) {
  const panel = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !panel.current) return;

      const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]',
      )).filter((element) => element.offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first) {
        event.preventDefault();
      } else if (event.shiftKey && (document.activeElement === first || !panel.current.contains(document.activeElement) || document.activeElement === panel.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.current.contains(document.activeElement) || document.activeElement === panel.current)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <motion.div
      className={`modal-backdrop ${drawer ? 'is-drawer' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <motion.section
        ref={panel}
        className={`dialog-panel ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        initial={reduceMotion ? { opacity: 0 } : drawer ? { x: 60 } : { y: 24, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : drawer ? { x: 60 } : { y: 16, scale: 0.98 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close dialog">
          <X size={21} strokeWidth={1.6} />
        </button>
        {children}
      </motion.section>
    </motion.div>
  );
}