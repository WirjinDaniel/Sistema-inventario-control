import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import CommandPalette from "@/components/layout/CommandPalette";
import KeyboardShortcutsModal from "@/components/layout/KeyboardShortcutsModal";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main id="main-content" className="flex-1 overflow-auto p-6" tabIndex={-1}>
          {children}
        </main>
      </div>
      <CommandPalette />
      <KeyboardShortcutsModal />
    </div>
  );
}
