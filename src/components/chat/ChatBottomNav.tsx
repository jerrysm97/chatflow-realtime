import { MessageCircle, Users, Phone, Settings, SquareStack } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatBottomNavProps {
    activeTab: "chats" | "groups" | "calls" | "settings";
    onTabChange: (tab: "chats" | "groups" | "calls" | "settings") => void;
}

export default function ChatBottomNav({ activeTab, onTabChange }: ChatBottomNavProps) {
    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t flex items-center justify-around h-16 pb-safe z-50">
            <TabItem
                icon={<MessageCircle className="h-6 w-6" />}
                label="Chats"
                isActive={activeTab === "chats"}
                onClick={() => onTabChange("chats")}
            />
            <TabItem
                icon={<Users className="h-6 w-6" />}
                label="Groups"
                isActive={activeTab === "groups"}
                onClick={() => onTabChange("groups")}
            />
            <TabItem
                icon={<Phone className="h-6 w-6" />}
                label="Calls"
                isActive={activeTab === "calls"}
                onClick={() => onTabChange("calls")}
            />
            <TabItem
                icon={<Settings className="h-6 w-6" />}
                label="Settings"
                isActive={activeTab === "settings"}
                onClick={() => {
                    onTabChange("settings");
                    // Also navigate for now to keep existing logic if needed
                    // window.location.href = '/settings';
                }}
            />
        </div>
    );
}

function TabItem({
    icon,
    label,
    isActive,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
        >
            {icon}
            <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
        </button>
    );
}
