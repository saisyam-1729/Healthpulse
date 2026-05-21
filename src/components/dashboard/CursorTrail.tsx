import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function CursorTrail() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", updateMousePosition);
    return () => window.removeEventListener("mousemove", updateMousePosition);
  }, []);

  return (
    <>
      {/* Liquid Orb Core */}
      <motion.div
        className="fixed top-0 left-0 w-6 h-6 rounded-full pointer-events-none z-[9999] mix-blend-screen"
        style={{
          background: "radial-gradient(circle, rgba(0, 243, 255, 1) 0%, rgba(0, 243, 255, 0.5) 50%, rgba(0, 243, 255, 0) 100%)",
          filter: "blur(2px)",
        }}
        animate={{
          x: mousePosition.x - 12,
          y: mousePosition.y - 12,
          scale: [1, 1.2, 1],
        }}
        transition={{ 
          x: { type: "spring", stiffness: 1000, damping: 50, mass: 0.1 },
          y: { type: "spring", stiffness: 1000, damping: 50, mass: 0.1 },
          scale: { duration: 2, repeat: Infinity }
        }}
      />
      
      {/* Liquid Trail / Refraction Aura */}
      <motion.div
        className="fixed top-0 left-0 w-24 h-24 rounded-full pointer-events-none z-[9998] mix-blend-screen opacity-30"
        style={{
          background: "radial-gradient(circle, rgba(0, 102, 255, 0.4) 0%, rgba(0, 102, 255, 0) 70%)",
          backdropFilter: "blur(4px) contrast(1.2)",
        }}
        animate={{
          x: mousePosition.x - 48,
          y: mousePosition.y - 48,
        }}
        transition={{ type: "spring", stiffness: 150, damping: 25, mass: 0.5 }}
      />

      {/* Floating Refractions */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="fixed top-0 left-0 w-4 h-4 rounded-full pointer-events-none z-[9997] mix-blend-screen opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, transparent 80%)",
          }}
          animate={{
            x: mousePosition.x + (i * 10) - 20,
            y: mousePosition.y + (i * 10) - 20,
          }}
          transition={{ 
            type: "spring", 
            stiffness: 80 - (i * 10), 
            damping: 15, 
            mass: 0.2 + (i * 0.1) 
          }}
        />
      ))}
    </>
  );
}
