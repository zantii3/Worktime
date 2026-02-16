import { motion } from "framer-motion";
import { type ReactNode } from "react";

interface Props {
  title?: string;
  children: ReactNode;
  variant?: "default" | "accent";
  className?: string;
}

export default function AdminCard({
  title,
  children,
  variant = "default",
  className = "",
}: Props) {
  if (variant === "accent") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        whileHover={{ y: -2 }}
        className={[
          "rounded-2xl overflow-hidden border border-orange-200 shadow-sm",
          className,
        ].join(" ")}
      >
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
          {title && (
            <div className="text-xs font-semibold opacity-90 mb-3">
              {title}
            </div>
          )}
          {children}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      whileHover={{ y: -2 }}
      className={[
        "bg-card rounded-2xl shadow-sm border border-slate-200 p-6",
        className,
      ].join(" ")}
    >
      {title && (
        <h2 className="text-sm font-semibold text-text-heading mb-4">
          {title}
        </h2>
      )}
      {children}
    </motion.div>
  );
}
