import { Bot, X } from "lucide-react";
import { Button } from "./ui/button";
import "./floating-chat-icon.css";

export type FloatingChatIconProps = {
  /** Whether the trip planner panel is currently open. */
  isOpen: boolean;
  /** Toggles the trip planner panel. */
  onClick: () => void;
};

/** Floating action button for opening and closing the AI trip planner. */
export function FloatingChatIcon({ isOpen, onClick }: FloatingChatIconProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      aria-label={isOpen ? "Close trip planner" : "Open trip planner"}
      aria-expanded={isOpen}
      className="floating-chat-icon fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full p-0 shadow-lg transition-transform duration-200 ease-out hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      {!isOpen && (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-primary/40 animate-ping"
          />
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500"
          />
        </>
      )}
      <span className="relative z-10 flex items-center justify-center">
        {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </span>
    </Button>
  );
}
