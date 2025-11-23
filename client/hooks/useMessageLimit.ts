import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

interface MessageLimitInfo {
  canSend: boolean;
  reason?: string;
  limit: number;
  current: number;
  remaining: number;
}

export const useMessageLimit = () => {
  const { user, canSendMessage, incrementMessageCount } = useAuth();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const getMessageLimitInfo = useCallback((): MessageLimitInfo => {
    if (!user) {
      return { canSend: false, limit: 0, current: 0, remaining: 0 };
    }

    let limit = 0;
    let current = 0;

    if (user.plan === "Gratuit") {
      limit = 10;
      current = user.messageCount || 0;
    } else if (user.plan === "Forfait Classique") {
      limit = 1000;
      current = user.todayMessageCount || 0;
    } else if (user.plan === "Forfait Pro") {
      limit = 5000;
      current = user.todayMessageCount || 0;
    }

    const result = canSendMessage();

    return {
      canSend: result.allowed,
      reason: result.reason,
      limit,
      current,
      remaining: Math.max(0, limit - current),
    };
  }, [user, canSendMessage]);

  const handleSendMessage = async (callback: () => Promise<void>) => {
    const limitInfo = getMessageLimitInfo();

    if (!limitInfo.canSend) {
      setShowUpgradeModal(true);
      return;
    }

    try {
      await callback();
      await incrementMessageCount();
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return {
    getMessageLimitInfo,
    handleSendMessage,
    showUpgradeModal,
    setShowUpgradeModal,
  };
};
