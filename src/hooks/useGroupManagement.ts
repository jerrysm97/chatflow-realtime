import { useState, useCallback } from "react";
import { ref, get, update, remove, push, set, serverTimestamp } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { rtdb, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { RTDBChat, RTDBUser } from "./useRealtimeDB";

export function useGroupManagement(groupId: string | undefined) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const isAdmin = useCallback(async (): Promise<boolean> => {
        if (!groupId || !user) return false;
        const groupRef = ref(rtdb, `chats/${groupId}`);
        const snapshot = await get(groupRef);
        if (!snapshot.exists()) return false;
        const data = snapshot.val();
        return data.admins?.[user.uid] === true;
    }, [groupId, user]);

    const updateGroupInfo = useCallback(async (updates: {
        name?: string;
        description?: string;
        icon?: string;
    }) => {
        if (!groupId || !user) return;
        setLoading(true);
        try {
            const groupRef = ref(rtdb, `chats/${groupId}`);
            await update(groupRef, updates);
        } finally {
            setLoading(false);
        }
    }, [groupId, user]);

    const uploadGroupIcon = useCallback(async (file: File): Promise<string> => {
        if (!groupId) throw new Error("No group ID");
        const iconRef = storageRef(storage, `groups/${groupId}/icon_${Date.now()}`);
        await uploadBytes(iconRef, file);
        const url = await getDownloadURL(iconRef);
        await updateGroupInfo({ icon: url });
        return url;
    }, [groupId, updateGroupInfo]);

    const addParticipant = useCallback(async (userId: string, userName: string) => {
        if (!groupId || !user) return;
        setLoading(true);
        try {
            const groupRef = ref(rtdb, `chats/${groupId}`);
            await update(groupRef, {
                [`participants/${userId}`]: true,
                [`participantNames/${userId}`]: userName,
            });
            await set(ref(rtdb, `userChats/${userId}/${groupId}`), {
                joinedAt: Date.now(),
                unreadCount: 0,
            });
        } finally {
            setLoading(false);
        }
    }, [groupId, user]);

    const removeParticipant = useCallback(async (userId: string) => {
        if (!groupId || !user) return;
        setLoading(true);
        try {
            const groupRef = ref(rtdb, `chats/${groupId}`);
            await update(groupRef, {
                [`participants/${userId}`]: null,
                [`participantNames/${userId}`]: null,
                [`admins/${userId}`]: null,
            });
            await remove(ref(rtdb, `userChats/${userId}/${groupId}`));
        } finally {
            setLoading(false);
        }
    }, [groupId, user]);

    const makeAdmin = useCallback(async (userId: string) => {
        if (!groupId || !user) return;
        const groupRef = ref(rtdb, `chats/${groupId}`);
        await update(groupRef, {
            [`admins/${userId}`]: true,
        });
    }, [groupId, user]);

    const removeAdmin = useCallback(async (userId: string) => {
        if (!groupId || !user) return;
        const groupRef = ref(rtdb, `chats/${groupId}`);
        await update(groupRef, {
            [`admins/${userId}`]: null,
        });
    }, [groupId, user]);

    const leaveGroup = useCallback(async () => {
        if (!groupId || !user) return;
        await removeParticipant(user.uid);
    }, [groupId, user, removeParticipant]);

    const deleteGroup = useCallback(async () => {
        if (!groupId || !user) return;
        setLoading(true);
        try {
            const groupRef = ref(rtdb, `chats/${groupId}`);
            const snapshot = await get(groupRef);
            if (!snapshot.exists()) return;

            const groupData = snapshot.val();
            const participants = Object.keys(groupData.participants || {});

            // Remove from all participants' userChats
            for (const pid of participants) {
                await remove(ref(rtdb, `userChats/${pid}/${groupId}`));
            }

            // Delete messages
            await remove(ref(rtdb, `messages/${groupId}`));

            // Delete group
            await remove(groupRef);
        } finally {
            setLoading(false);
        }
    }, [groupId, user]);

    const getGroupMembers = useCallback(async (): Promise<RTDBUser[]> => {
        if (!groupId) return [];

        const groupRef = ref(rtdb, `chats/${groupId}`);
        const snapshot = await get(groupRef);
        if (!snapshot.exists()) return [];

        const groupData = snapshot.val() as RTDBChat;
        const participantIds = Object.keys(groupData.participants || {});

        const members: RTDBUser[] = [];
        for (const uid of participantIds) {
            const userRef = ref(rtdb, `users/${uid}`);
            const userSnapshot = await get(userRef);
            if (userSnapshot.exists()) {
                members.push({ uid, ...userSnapshot.val() } as RTDBUser);
            }
        }

        return members;
    }, [groupId]);

    return {
        loading,
        isAdmin,
        updateGroupInfo,
        uploadGroupIcon,
        addParticipant,
        removeParticipant,
        makeAdmin,
        removeAdmin,
        leaveGroup,
        deleteGroup,
        getGroupMembers,
    };
}
