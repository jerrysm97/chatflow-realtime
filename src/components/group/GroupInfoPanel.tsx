import { useState, useEffect } from "react";
import { useGroupManagement } from "@/hooks/useGroupManagement";
import { RTDBUser, RTDBChat, useRTDBUserSearch } from "@/hooks/useRealtimeDB";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Users,
    Camera,
    MoreVertical,
    UserPlus,
    UserMinus,
    Shield,
    ShieldOff,
    LogOut,
    Trash2,
    Loader2,
    Edit2,
    Check,
    X,
    Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface GroupInfoPanelProps {
    group: RTDBChat;
    trigger?: React.ReactNode;
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

export default function GroupInfoPanel({ group, trigger }: GroupInfoPanelProps) {
    const { user } = useAuth();
    const {
        loading,
        isAdmin,
        updateGroupInfo,
        uploadGroupIcon,
        removeParticipant,
        makeAdmin,
        removeAdmin,
        leaveGroup,
        deleteGroup,
        getGroupMembers,
        addParticipant,
    } = useGroupManagement(group.id);

    // Search for new members
    const { results, searching, searchUsers, clearResults } = useRTDBUserSearch();
    const [members, setMembers] = useState<RTDBUser[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [addingMember, setAddingMember] = useState(false);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [editingDescription, setEditingDescription] = useState(false);
    const [newName, setNewName] = useState(group.name || "");
    const [newDescription, setNewDescription] = useState(group.description || "");

    useEffect(() => {
        const loadData = async () => {
            setLoadingMembers(true);
            try {
                const [memberList, adminStatus] = await Promise.all([
                    getGroupMembers(),
                    isAdmin(),
                ]);
                setMembers(memberList);
                setIsCurrentUserAdmin(adminStatus);
            } finally {
                setLoadingMembers(false);
            }
        };
        loadData();
    }, [getGroupMembers, isAdmin]);

    const handleUpdateName = async () => {
        if (newName.trim() && newName !== group.name) {
            await updateGroupInfo({ name: newName.trim() });
            toast.success("Group name updated");
        }
        setEditingName(false);
    };

    const handleUpdateDescription = async () => {
        if (newDescription !== group.description) {
            await updateGroupInfo({ description: newDescription.trim() });
            toast.success("Description updated");
        }
        setEditingDescription(false);
    };

    const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                await uploadGroupIcon(file);
                toast.success("Group icon updated");
            } catch (error) {
                toast.error("Failed to upload icon");
            }
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        await removeParticipant(memberId);
        setMembers(members.filter((m) => m.uid !== memberId));
        toast.success("Member removed");
    };

    const handleToggleAdmin = async (memberId: string, currentlyAdmin: boolean) => {
        if (currentlyAdmin) {
            await removeAdmin(memberId);
        } else {
            await makeAdmin(memberId);
        }
        toast.success(currentlyAdmin ? "Admin removed" : "Admin added");
    };

    const handleLeaveGroup = async () => {
        await leaveGroup();
        toast.success("You left the group");
    };

    const handleDeleteGroup = async () => {
        await deleteGroup();
        toast.success("Group deleted");
    };

    return (
        <Sheet>
            <SheetTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="icon">
                        <Users className="h-5 w-5" />
                    </Button>
                )}
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md p-0">
                <SheetHeader className="p-6 bg-muted/50 border-b">
                    <SheetTitle>Group Info</SheetTitle>
                </SheetHeader>

                <ScrollArea className="h-[calc(100vh-80px)]">
                    <div className="p-6 space-y-6">
                        {/* Group Avatar */}
                        <div className="flex flex-col items-center">
                            <div className="relative">
                                <Avatar className="h-24 w-24">
                                    {group.icon ? (
                                        <AvatarImage src={group.icon} />
                                    ) : (
                                        <AvatarFallback className="text-2xl bg-chat-avatar text-primary-foreground">
                                            {getInitials(group.name || "G")}
                                        </AvatarFallback>
                                    )}
                                </Avatar>
                                {isCurrentUserAdmin && (
                                    <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center cursor-pointer hover:bg-primary/90">
                                        <Camera className="w-4 h-4 text-primary-foreground" />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleIconUpload}
                                        />
                                    </label>
                                )}
                            </div>

                            {/* Group Name */}
                            <div className="mt-4 flex items-center gap-2">
                                {editingName ? (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            className="w-48"
                                            autoFocus
                                        />
                                        <Button size="icon" variant="ghost" onClick={handleUpdateName}>
                                            <Check className="h-4 w-4 text-green-500" />
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={() => setEditingName(false)}>
                                            <X className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <h2 className="text-xl font-semibold">{group.name || "Group"}</h2>
                                        {isCurrentUserAdmin && (
                                            <Button size="icon" variant="ghost" onClick={() => setEditingName(true)}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>

                            <p className="text-sm text-muted-foreground">
                                {Object.keys(group.participants).length} members
                            </p>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium">Description</h3>
                                {isCurrentUserAdmin && !editingDescription && (
                                    <Button size="icon" variant="ghost" onClick={() => setEditingDescription(true)}>
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            {editingDescription ? (
                                <div className="space-y-2">
                                    <Textarea
                                        value={newDescription}
                                        onChange={(e) => setNewDescription(e.target.value)}
                                        placeholder="Add group description..."
                                        rows={3}
                                    />
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={handleUpdateDescription}>Save</Button>
                                        <Button size="sm" variant="outline" onClick={() => setEditingDescription(false)}>Cancel</Button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {group.description || "No description"}
                                </p>
                            )}
                        </div>

                        {/* Add Member Section (Admin Only) */}
                        {isCurrentUserAdmin && (
                            <div className="space-y-3 pt-4 border-t">
                                <h3 className="font-medium flex items-center gap-2">
                                    <UserPlus className="h-4 w-4" />
                                    Add Members
                                </h3>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Search by ID or Email"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && searchQuery.trim() && searchUsers(searchQuery)}
                                    />
                                    <Button
                                        size="icon"
                                        onClick={() => searchQuery.trim() && searchUsers(searchQuery)}
                                        disabled={searching || !searchQuery.trim()}
                                    >
                                        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    </Button>
                                </div>

                                {results.length > 0 && (
                                    <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                                        {results.map((result) => {
                                            const isAlreadyMember = members.some(m => m.uid === result.uid);
                                            return (
                                                <div key={result.uid} className="flex items-center justify-between p-2 hover:bg-muted/50">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={result.photoURL || ""} />
                                                            <AvatarFallback>{getInitials(result.displayName || "U")}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium truncate">{result.displayName}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{result.email}</p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant={isAlreadyMember ? "ghost" : "default"}
                                                        disabled={isAlreadyMember || addingMember}
                                                        onClick={async () => {
                                                            if (isAlreadyMember) return;
                                                            setAddingMember(true);
                                                            await addParticipant(result.uid, result.displayName || "User");
                                                            setMembers(prev => [...prev, result]);
                                                            toast.success(`${result.displayName} added`);
                                                            setAddingMember(false);
                                                            clearResults();
                                                            setSearchQuery("");
                                                        }}
                                                    >
                                                        {isAlreadyMember ? "Joined" : "Add"}
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Members List */}
                        <div className="space-y-3">
                            <h3 className="font-medium">{members.length} Members</h3>

                            {loadingMembers ? (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {members.map((member) => {
                                        const isMemberAdmin = group.admins?.[member.uid];
                                        const isCurrentUser = member.uid === user?.uid;

                                        return (
                                            <div
                                                key={member.uid}
                                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted"
                                            >
                                                <Avatar className="h-10 w-10">
                                                    <AvatarImage src={member.photoURL || ""} />
                                                    <AvatarFallback>{getInitials(member.displayName || "U")}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium truncate">{member.displayName}</p>
                                                        {isCurrentUser && (
                                                            <span className="text-xs text-muted-foreground">(You)</span>
                                                        )}
                                                    </div>
                                                    {isMemberAdmin && (
                                                        <span className="text-xs text-primary flex items-center gap-1">
                                                            <Shield className="h-3 w-3" />
                                                            Admin
                                                        </span>
                                                    )}
                                                </div>
                                                <div
                                                    className={cn(
                                                        "h-2 w-2 rounded-full",
                                                        member.isOnline ? "bg-green-500" : "bg-gray-400"
                                                    )}
                                                />
                                                {isCurrentUserAdmin && !isCurrentUser && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => handleToggleAdmin(member.uid, !!isMemberAdmin)}>
                                                                {isMemberAdmin ? (
                                                                    <>
                                                                        <ShieldOff className="mr-2 h-4 w-4" />
                                                                        Remove Admin
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Shield className="mr-2 h-4 w-4" />
                                                                        Make Admin
                                                                    </>
                                                                )}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="text-destructive"
                                                                onClick={() => handleRemoveMember(member.uid)}
                                                            >
                                                                <UserMinus className="mr-2 h-4 w-4" />
                                                                Remove from Group
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="space-y-2 pt-4 border-t">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="w-full text-destructive">
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Leave Group
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Leave Group?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            You will no longer receive messages from this group.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleLeaveGroup}>Leave</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            {isCurrentUserAdmin && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" className="w-full">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete Group
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Group?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete the group and all messages. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground">
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
