import type { Database } from '@croppr/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type Conversation = Database['public']['Functions']['my_conversations']['Returns'][number];
export type Message = Database['public']['Tables']['messages']['Row'];

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_conversations');
      if (error) throw error;
      return data;
    },
  });
}

export function useUnreadCount(): number {
  const { data } = useConversations();
  return (data ?? []).reduce((sum, c) => sum + c.unread, 0);
}

/** Messages for one conversation, kept live with Supabase Realtime. */
export function useMessages(conversationId: string) {
  const qc = useQueryClient();
  const key = ['messages', conversationId];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          qc.setQueryData<Message[]>(['messages', conversationId], (old = []) =>
            old.some((m) => m.id === msg.id) ? old : [msg, ...old],
          );
          qc.invalidateQueries({ queryKey: ['conversations'] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);

  return query;
}

export function useSendMessage(conversationId: string, userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { data, error } = await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: userId, body })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (msg) => {
      qc.setQueryData<Message[]>(['messages', conversationId], (old = []) =>
        old.some((m) => m.id === msg.id) ? old : [msg, ...old],
      );
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export async function markRead(conversationId: string) {
  await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
}

export function useStartConversation() {
  return useMutation({
    mutationFn: async (applicationId: string) => {
      const { data, error } = await supabase.rpc('start_conversation', { p_application_id: applicationId });
      if (error) throw error;
      return data;
    },
  });
}

export type ReportReason = Database['public']['Enums']['report_reason'];

export function useSubmitReport() {
  return useMutation({
    mutationFn: async (r: {
      reason: ReportReason;
      details: string;
      conversationId?: string;
      jobId?: string;
    }) => {
      const { error } = await supabase.rpc('submit_report', {
        p_reason: r.reason,
        p_details: r.details,
        p_conversation_id: r.conversationId,
        p_job_id: r.jobId,
      });
      if (error) throw error;
    },
  });
}
