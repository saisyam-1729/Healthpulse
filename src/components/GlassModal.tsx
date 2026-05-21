import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export default function GlassModal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: GlassModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        >
          {/* Blur overlay */}
          <div
            className="absolute inset-0 bg-black/50"
            style={{ backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
          />

          {/* Modal card */}
          <motion.div
            className={`relative w-full ${sizeClasses[size]} z-10`}
            initial={{ scale: 0.88, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.88, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 320, damping: 28, mass: 0.8 }}
          >
            {/* Glass card */}
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.06)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(0, 243, 255, 0.2)",
                boxShadow:
                  "0 0 30px rgba(0, 243, 255, 0.12), 0 0 60px rgba(0, 243, 255, 0.06), inset 0 0 30px rgba(255,255,255,0.04)",
              }}
            >
              {/* Shimmer overlay */}
              <div
                className="absolute inset-0 pointer-events-none z-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 40%, rgba(0,243,255,0.06) 70%, transparent 100%)",
                }}
              />

              {/* Cyan top border glow */}
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{
                  background:
                    "linear-gradient(to right, transparent, rgba(0,243,255,0.6), transparent)",
                }}
              />

              <div className="relative z-10 p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    {title && (
                      <h2
                        className="font-display text-lg font-bold tracking-widest text-cyan-400"
                        style={{
                          textShadow: "0 0 10px rgba(0,243,255,0.5)",
                        }}
                      >
                        {title}
                      </h2>
                    )}
                    {description && (
                      <p className="mt-1 text-xs text-white/50 font-mono tracking-wide">
                        {description}
                      </p>
                    )}
                  </div>
                  <motion.button
                    onClick={onClose}
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    className="ml-4 flex h-8 w-8 items-center justify-center rounded-full shrink-0"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(0,243,255,0.2)",
                    }}
                  >
                    <X className="h-4 w-4 text-cyan-400" />
                  </motion.button>
                </div>

                {/* Content */}
                {children && <div className="mt-2">{children}</div>}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
