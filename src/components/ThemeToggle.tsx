import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface ThemeToggleProps {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label="Toggle Theme"
      className={`relative flex items-center gap-2 rounded-xl transition-all duration-200 active:scale-95 border font-semibold ${
        isDark
          ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400 shadow-sm"
          : "bg-white hover:bg-slate-100 border-slate-300 text-slate-800 shadow-sm"
      } ${compact ? "p-2" : "px-3.5 py-1.5 text-xs"}`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {isDark ? (
          <Moon className="w-4 h-4 text-indigo-400 animate-in fade-in duration-300" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500 animate-in fade-in duration-300" />
        )}
      </div>

      {!compact && (
        <span className="hidden sm:inline select-none font-bold">
          {isDark ? "Dark Theme" : "Light Theme"}
        </span>
      )}
    </button>
  );
}
