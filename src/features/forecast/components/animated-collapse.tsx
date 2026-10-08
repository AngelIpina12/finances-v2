"use client";

import {
    useEffect, useRef, useState,
    type ReactNode
} from "react";
import { AnimatePresence, motion } from "framer-motion";

export function AnimatedCollapse({ open, children }: { open: boolean; children: ReactNode }) {
    const contentRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number | "auto">("auto");

    useEffect(() => {
        const content = contentRef.current;
        if (!open || !content) return;
        const observer = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height));
        observer.observe(content);
        return () => observer.disconnect();
    }, [open]);

    return (
        <AnimatePresence initial={false}>
            {open && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height, opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                >
                    <div ref={contentRef}>{children}</div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
