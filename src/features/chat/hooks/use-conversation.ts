import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/shared/api/api-client";
import { useFocusedPolling } from "@/shared/hooks/use-focused-polling";
import { getSessionRevision, subscribeSessionChanged } from "@/shared/session/session-events";
import { getConversation, getMessages, markConversationRead, sendMessage } from "../services/chat-service";
import { ChatMessage, Conversation } from "../types/chat";
import { mergeMessages } from "../utils/messages";
import { newMessageId } from "../utils/message-id";

export interface PendingMessage { clientMessageId: string; text: string; status: "sending" | "failed" }

export function useConversation(id: string, isReadingLatest: () => boolean) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isLoadingOlder, setLoadingOlder] = useState(false);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [error, setError] = useState("");
  const loaded = useRef(false), newest = useRef(0), lastRead = useRef(0);
  const sending = useRef<string | null>(null), olderBusy = useRef(false), focused = useRef(false), generation = useRef(0);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => {
      focused.current = false; generation.current += 1; sending.current = null; olderBusy.current = false;
      setLoadingOlder(false);
      setPending(items => items.map(item => item.status === "sending" ? { ...item, status: "failed" } : item));
    };
  }, []));
  useEffect(() => subscribeSessionChanged(() => {
    generation.current += 1; setConversation(null); setMessages([]); setPending([]); setError("");
    router.replace("/");
  }), []);

  const apply = (items: ChatMessage[]) => {
    setMessages(current => mergeMessages(current, items));
    setPending(current => current.filter(item => !items.some(message => message.senderAccountId === conversation?.myAccountId && message.clientMessageId === item.clientMessageId)));
  };
  const failure = (requestError: unknown) => {
    if (requestError instanceof ApiError && requestError.status === 401) { router.replace("/"); return; }
    setError(requestError instanceof Error ? requestError.message : "Nie udało się połączyć z czatem.");
  };

  useFocusedPolling(async isCurrent => {
    try {
      const [metadata, page] = await Promise.all([
        getConversation(id), getMessages(id, loaded.current ? { after: newest.current } : {})
      ]);
      if (!isCurrent()) return;
      setConversation(metadata.conversation); apply(page.items);
      if (!loaded.current) setNextBefore(page.nextBefore);
      newest.current = Math.max(newest.current, page.nextAfter);
      loaded.current = true; setLoading(false); setError("");
      if (isReadingLatest() && newest.current > lastRead.current) {
        const read = await markConversationRead(id, newest.current);
        if (!isCurrent()) return;
        lastRead.current = read.readSequence;
        setConversation(current => current ? { ...current, ...read } : current);
      }
    } catch (requestError) { if (isCurrent()) { setLoading(false); failure(requestError); } }
  });

  const scope = () => {
    const revision = getSessionRevision(), currentGeneration = generation.current;
    return () => focused.current && revision === getSessionRevision() && currentGeneration === generation.current;
  };
  const transmit = async (item: PendingMessage) => {
    if (sending.current || !conversation?.canSend) return;
    const isCurrent = scope(); sending.current = item.clientMessageId;
    setPending(current => [...current.filter(entry => entry.clientMessageId !== item.clientMessageId), { ...item, status: "sending" }]);
    setError("");
    try {
      const result = await sendMessage(id, { text: item.text, clientMessageId: item.clientMessageId });
      if (isCurrent()) apply([result.message]);
    } catch (requestError) {
      if (isCurrent()) {
        setPending(current => current.map(entry => entry.clientMessageId === item.clientMessageId ? { ...entry, status: "failed" } : entry));
        failure(requestError);
      }
    } finally { if (sending.current === item.clientMessageId) sending.current = null; }
  };
  const send = (text: string) => {
    if (!text.trim() || text.trim().length > 4000 || sending.current || !conversation?.canSend) return false;
    void transmit({ text: text.trim(), clientMessageId: newMessageId(), status: "sending" });
    return true;
  };
  const loadOlder = async () => {
    if (!nextBefore || olderBusy.current) return false;
    const isCurrent = scope(); olderBusy.current = true; setLoadingOlder(true);
    try {
      const page = await getMessages(id, { before: nextBefore });
      if (isCurrent()) { apply(page.items); setNextBefore(page.nextBefore); setError(""); return true; }
      return false;
    } catch (requestError) { if (isCurrent()) failure(requestError); return false; }
    finally { if (isCurrent()) { olderBusy.current = false; setLoadingOlder(false); } }
  };
  return { conversation, messages, pending, isLoading, isLoadingOlder, nextBefore, error, send,
    retry: (item: PendingMessage) => void transmit(item), loadOlder, isSending: pending.some(item => item.status === "sending") };
}
