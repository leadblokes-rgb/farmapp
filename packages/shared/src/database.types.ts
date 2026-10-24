export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action: string;
          created_at: string;
          id: number;
          note: string | null;
          performed_by: string;
          target_farm_id: string | null;
          target_user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          created_at?: string;
          id?: never;
          note?: string | null;
          performed_by?: string;
          target_farm_id?: string | null;
          target_user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: never;
          note?: string | null;
          performed_by?: string;
          target_farm_id?: string | null;
          target_user_id?: string | null;
        };
        Relationships: [];
      };
      applications: {
        Row: {
          completed_at: string | null;
          created_at: string;
          decided_at: string | null;
          id: string;
          job_id: string;
          match_score: number | null;
          ranker_version: string | null;
          score_breakdown: Json | null;
          status: Database['public']['Enums']['application_status'];
          worker_id: string;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          decided_at?: string | null;
          id?: string;
          job_id: string;
          match_score?: number | null;
          ranker_version?: string | null;
          score_breakdown?: Json | null;
          status?: Database['public']['Enums']['application_status'];
          worker_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          decided_at?: string | null;
          id?: string;
          job_id?: string;
          match_score?: number | null;
          ranker_version?: string | null;
          score_breakdown?: Json | null;
          status?: Database['public']['Enums']['application_status'];
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'applications_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'applications_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      attendance: {
        Row: {
          application_id: string;
          dispute_outcome: string | null;
          dispute_report_id: number | null;
          disputed_at: string | null;
          marked_at: string;
          resolved_at: string | null;
          status: Database['public']['Enums']['attendance_status'];
        };
        ComputedFields: never;
        Insert: {
          application_id: string;
          dispute_outcome?: string | null;
          dispute_report_id?: number | null;
          disputed_at?: string | null;
          marked_at?: string;
          resolved_at?: string | null;
          status: Database['public']['Enums']['attendance_status'];
        };
        Update: {
          application_id?: string;
          dispute_outcome?: string | null;
          dispute_report_id?: number | null;
          disputed_at?: string | null;
          marked_at?: string;
          resolved_at?: string | null;
          status?: Database['public']['Enums']['attendance_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: true;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_dispute_report_fk';
            columns: ['dispute_report_id'];
            isOneToOne: false;
            referencedRelation: 'admin_open_reports';
            referencedColumns: ['report_id'];
          },
          {
            foreignKeyName: 'attendance_dispute_report_fk';
            columns: ['dispute_report_id'];
            isOneToOne: false;
            referencedRelation: 'reports';
            referencedColumns: ['id'];
          },
        ];
      };
      contact_share_attempts: {
        Row: {
          conversation_id: string;
          created_at: string;
          id: number;
          original_body: string;
          sender_id: string;
        };
        ComputedFields: never;
        Insert: {
          conversation_id: string;
          created_at?: string;
          id?: never;
          original_body: string;
          sender_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          id?: never;
          original_body?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contact_share_attempts_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contact_share_attempts_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          application_id: string;
          created_at: string;
          farm_id: string;
          id: string;
          last_message_at: string | null;
          started_by: string | null;
          worker_id: string;
        };
        ComputedFields: never;
        Insert: {
          application_id: string;
          created_at?: string;
          farm_id: string;
          id?: string;
          last_message_at?: string | null;
          started_by?: string | null;
          worker_id: string;
        };
        Update: {
          application_id?: string;
          created_at?: string;
          farm_id?: string;
          id?: string;
          last_message_at?: string | null;
          started_by?: string | null;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: true;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'admin_pending_farms';
            referencedColumns: ['farm_id'];
          },
          {
            foreignKeyName: 'conversations_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'farms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'farms_public';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_started_by_fkey';
            columns: ['started_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      employers_worked: {
        Row: {
          abn: string | null;
          counts_as_specified: boolean;
          created_at: string;
          farm_id: string | null;
          id: string;
          job_id: string | null;
          name: string;
          postcode: string | null;
          postcode_eligible: boolean | null;
          worker_id: string;
        };
        ComputedFields: never;
        Insert: {
          abn?: string | null;
          counts_as_specified?: boolean;
          created_at?: string;
          farm_id?: string | null;
          id?: string;
          job_id?: string | null;
          name: string;
          postcode?: string | null;
          postcode_eligible?: boolean | null;
          worker_id: string;
        };
        Update: {
          abn?: string | null;
          counts_as_specified?: boolean;
          created_at?: string;
          farm_id?: string | null;
          id?: string;
          job_id?: string | null;
          name?: string;
          postcode?: string | null;
          postcode_eligible?: boolean | null;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'employers_worked_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'admin_pending_farms';
            referencedColumns: ['farm_id'];
          },
          {
            foreignKeyName: 'employers_worked_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'farms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employers_worked_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'farms_public';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employers_worked_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employers_worked_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      farm_ratings: {
        Row: {
          accommodation: number | null;
          application_id: string;
          comment: string;
          created_at: string;
          farm_id: string;
          hidden_at: string | null;
          overall: number;
          worker_id: string;
          would_work_again: boolean;
        };
        ComputedFields: never;
        Insert: {
          accommodation?: number | null;
          application_id: string;
          comment?: string;
          created_at?: string;
          farm_id: string;
          hidden_at?: string | null;
          overall: number;
          worker_id: string;
          would_work_again: boolean;
        };
        Update: {
          accommodation?: number | null;
          application_id?: string;
          comment?: string;
          created_at?: string;
          farm_id?: string;
          hidden_at?: string | null;
          overall?: number;
          worker_id?: string;
          would_work_again?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'farm_ratings_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: true;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'farm_ratings_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'admin_pending_farms';
            referencedColumns: ['farm_id'];
          },
          {
            foreignKeyName: 'farm_ratings_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'farms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'farm_ratings_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'farms_public';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'farm_ratings_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      farms: {
        Row: {
          abn: string;
          accommodation_details: string;
          business_name: string;
          contact_phone: string;
          created_at: string;
          description: string;
          id: string;
          is_labour_hire: boolean;
          labour_hire_licence_number: string | null;
          logo_path: string | null;
          owner_id: string;
          photos: string[];
          postcode: string;
          rejection_reason: string | null;
          updated_at: string;
          verification_status: Database['public']['Enums']['verification_status'];
          verified_at: string | null;
          verified_by: string | null;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          abn: string;
          accommodation_details?: string;
          business_name: string;
          contact_phone: string;
          created_at?: string;
          description?: string;
          id?: string;
          is_labour_hire?: boolean;
          labour_hire_licence_number?: string | null;
          logo_path?: string | null;
          owner_id: string;
          photos?: string[];
          postcode: string;
          rejection_reason?: string | null;
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
          verified_at?: string | null;
          verified_by?: string | null;
          website?: string | null;
        };
        Update: {
          abn?: string;
          accommodation_details?: string;
          business_name?: string;
          contact_phone?: string;
          created_at?: string;
          description?: string;
          id?: string;
          is_labour_hire?: boolean;
          labour_hire_licence_number?: string | null;
          logo_path?: string | null;
          owner_id?: string;
          photos?: string[];
          postcode?: string;
          rejection_reason?: string | null;
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
          verified_at?: string | null;
          verified_by?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'farms_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      job_alerts: {
        Row: {
          accommodation_only: boolean;
          available_from: string | null;
          available_to: string | null;
          enabled: boolean;
          min_hourly_cents: number | null;
          region_ids: string[];
          updated_at: string;
          worker_id: string;
        };
        ComputedFields: never;
        Insert: {
          accommodation_only?: boolean;
          available_from?: string | null;
          available_to?: string | null;
          enabled?: boolean;
          min_hourly_cents?: number | null;
          region_ids?: string[];
          updated_at?: string;
          worker_id: string;
        };
        Update: {
          accommodation_only?: boolean;
          available_from?: string | null;
          available_to?: string | null;
          enabled?: boolean;
          min_hourly_cents?: number | null;
          region_ids?: string[];
          updated_at?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'job_alerts_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      jobs: {
        Row: {
          accommodation_cost_week_cents: number | null;
          accommodation_provided: boolean;
          car_required: boolean;
          created_at: string;
          description: string;
          eligible_417: boolean;
          eligible_462: boolean;
          employment_type: Database['public']['Enums']['employment_type'];
          end_date: string;
          farm_id: string;
          hours_per_week: number;
          id: string;
          lat: number | null;
          likely_specified_work: boolean;
          lng: number | null;
          min_hourly_guarantee_cents: number | null;
          pay_rate_cents: number;
          pay_type: Database['public']['Enums']['pay_type'];
          piece_rate_unit: string | null;
          postcode: string;
          region_id: string | null;
          role_type: Database['public']['Enums']['job_role_type'];
          start_date: string;
          status: Database['public']['Enums']['job_status'];
          title: string;
          transport_provided: boolean;
          updated_at: string;
          workers_needed: number;
        };
        ComputedFields: never;
        Insert: {
          accommodation_cost_week_cents?: number | null;
          accommodation_provided?: boolean;
          car_required?: boolean;
          created_at?: string;
          description?: string;
          eligible_417?: boolean;
          eligible_462?: boolean;
          employment_type?: Database['public']['Enums']['employment_type'];
          end_date: string;
          farm_id: string;
          hours_per_week: number;
          id?: string;
          lat?: number | null;
          likely_specified_work?: boolean;
          lng?: number | null;
          min_hourly_guarantee_cents?: number | null;
          pay_rate_cents: number;
          pay_type: Database['public']['Enums']['pay_type'];
          piece_rate_unit?: string | null;
          postcode: string;
          region_id?: string | null;
          role_type: Database['public']['Enums']['job_role_type'];
          start_date: string;
          status?: Database['public']['Enums']['job_status'];
          title: string;
          transport_provided?: boolean;
          updated_at?: string;
          workers_needed: number;
        };
        Update: {
          accommodation_cost_week_cents?: number | null;
          accommodation_provided?: boolean;
          car_required?: boolean;
          created_at?: string;
          description?: string;
          eligible_417?: boolean;
          eligible_462?: boolean;
          employment_type?: Database['public']['Enums']['employment_type'];
          end_date?: string;
          farm_id?: string;
          hours_per_week?: number;
          id?: string;
          lat?: number | null;
          likely_specified_work?: boolean;
          lng?: number | null;
          min_hourly_guarantee_cents?: number | null;
          pay_rate_cents?: number;
          pay_type?: Database['public']['Enums']['pay_type'];
          piece_rate_unit?: string | null;
          postcode?: string;
          region_id?: string | null;
          role_type?: Database['public']['Enums']['job_role_type'];
          start_date?: string;
          status?: Database['public']['Enums']['job_status'];
          title?: string;
          transport_provided?: boolean;
          updated_at?: string;
          workers_needed?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'jobs_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'admin_pending_farms';
            referencedColumns: ['farm_id'];
          },
          {
            foreignKeyName: 'jobs_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'farms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jobs_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'farms_public';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jobs_region_id_fkey';
            columns: ['region_id'];
            isOneToOne: false;
            referencedRelation: 'regions';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          broadcast_id: string | null;
          contact_masked: boolean;
          conversation_id: string;
          created_at: string;
          id: string;
          read_at: string | null;
          sender_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          broadcast_id?: string | null;
          contact_masked?: boolean;
          conversation_id: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id: string;
        };
        Update: {
          body?: string;
          broadcast_id?: string | null;
          contact_masked?: boolean;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_log: {
        Row: {
          body: string | null;
          created_at: string;
          event: string;
          id: number;
          outcome: string;
          recipient_id: string | null;
          title: string | null;
          tokens: number;
          url: string | null;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          created_at?: string;
          event: string;
          id?: never;
          outcome: string;
          recipient_id?: string | null;
          title?: string | null;
          tokens?: number;
          url?: string | null;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          event?: string;
          id?: never;
          outcome?: string;
          recipient_id?: string | null;
          title?: string | null;
          tokens?: number;
          url?: string | null;
        };
        Relationships: [];
      };
      payslips: {
        Row: {
          created_at: string;
          days_worked: number;
          employer_id: string;
          file_path: string | null;
          hours_total: number;
          id: string;
          period_end: string;
          period_start: string;
          worker_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          days_worked: number;
          employer_id: string;
          file_path?: string | null;
          hours_total: number;
          id?: string;
          period_end: string;
          period_start: string;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          days_worked?: number;
          employer_id?: string;
          file_path?: string | null;
          hours_total?: number;
          id?: string;
          period_end?: string;
          period_start?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payslips_employer_id_fkey';
            columns: ['employer_id'];
            isOneToOne: false;
            referencedRelation: 'employers_worked';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payslips_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      postcodes: {
        Row: {
          lat: number;
          lng: number;
          locality: string;
          postcode: string;
          region_id: string | null;
          state: string;
        };
        ComputedFields: never;
        Insert: {
          lat: number;
          lng: number;
          locality: string;
          postcode: string;
          region_id?: string | null;
          state: string;
        };
        Update: {
          lat?: number;
          lng?: number;
          locality?: string;
          postcode?: string;
          region_id?: string | null;
          state?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'postcodes_region_id_fkey';
            columns: ['region_id'];
            isOneToOne: false;
            referencedRelation: 'regions';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          privacy_version: string | null;
          role: Database['public']['Enums']['user_role'] | null;
          status: Database['public']['Enums']['account_status'];
          terms_accepted_at: string | null;
          terms_version: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id: string;
          privacy_version?: string | null;
          role?: Database['public']['Enums']['user_role'] | null;
          status?: Database['public']['Enums']['account_status'];
          terms_accepted_at?: string | null;
          terms_version?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          privacy_version?: string | null;
          role?: Database['public']['Enums']['user_role'] | null;
          status?: Database['public']['Enums']['account_status'];
          terms_accepted_at?: string | null;
          terms_version?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          expo_token: string;
          platform: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          expo_token: string;
          platform: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          expo_token?: string;
          platform?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      regions: {
        Row: {
          centroid_lat: number;
          centroid_lng: number;
          id: string;
          name: string;
          state: string;
        };
        ComputedFields: never;
        Insert: {
          centroid_lat: number;
          centroid_lng: number;
          id: string;
          name: string;
          state: string;
        };
        Update: {
          centroid_lat?: number;
          centroid_lng?: number;
          id?: string;
          name?: string;
          state?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          conversation_id: string | null;
          created_at: string;
          details: string;
          id: number;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id: string;
          resolution_note: string | null;
          resolved_at: string | null;
          review_application_id: string | null;
          review_kind: string | null;
          status: Database['public']['Enums']['report_status'];
          target_job_id: string | null;
          target_user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          conversation_id?: string | null;
          created_at?: string;
          details?: string;
          id?: never;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          review_application_id?: string | null;
          review_kind?: string | null;
          status?: Database['public']['Enums']['report_status'];
          target_job_id?: string | null;
          target_user_id?: string | null;
        };
        Update: {
          conversation_id?: string | null;
          created_at?: string;
          details?: string;
          id?: never;
          reason?: Database['public']['Enums']['report_reason'];
          reporter_id?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          review_application_id?: string | null;
          review_kind?: string | null;
          status?: Database['public']['Enums']['report_status'];
          target_job_id?: string | null;
          target_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reports_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_review_application_id_fkey';
            columns: ['review_application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_target_job_id_fkey';
            columns: ['target_job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_target_user_id_fkey';
            columns: ['target_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      saved_jobs: {
        Row: {
          created_at: string;
          job_id: string;
          worker_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          job_id: string;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          job_id?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'saved_jobs_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saved_jobs_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      shift_logs: {
        Row: {
          created_at: string;
          employer_id: string;
          hours: number;
          id: string;
          notes: string;
          work_date: string;
          worker_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          employer_id: string;
          hours: number;
          id?: string;
          notes?: string;
          work_date: string;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          employer_id?: string;
          hours?: number;
          id?: string;
          notes?: string;
          work_date?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shift_logs_employer_id_fkey';
            columns: ['employer_id'];
            isOneToOne: false;
            referencedRelation: 'employers_worked';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shift_logs_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      specified_work_lists: {
        Row: {
          category: string;
          created_at: string;
          id: number;
          is_current: boolean;
          label: string;
          last_checked: string;
          needs_expert_review: boolean;
          notes: string;
          source_url: string;
          version: string;
          visa_subclass: string;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          created_at?: string;
          id?: never;
          is_current?: boolean;
          label: string;
          last_checked: string;
          needs_expert_review?: boolean;
          notes?: string;
          source_url: string;
          version: string;
          visa_subclass: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: never;
          is_current?: boolean;
          label?: string;
          last_checked?: string;
          needs_expert_review?: boolean;
          notes?: string;
          source_url?: string;
          version?: string;
          visa_subclass?: string;
        };
        Relationships: [];
      };
      specified_work_postcodes: {
        Row: {
          list_id: number;
          postcode_from: number;
          postcode_to: number;
        };
        ComputedFields: never;
        Insert: {
          list_id: number;
          postcode_from: number;
          postcode_to: number;
        };
        Update: {
          list_id?: number;
          postcode_from?: number;
          postcode_to?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'specified_work_postcodes_list_id_fkey';
            columns: ['list_id'];
            isOneToOne: false;
            referencedRelation: 'specified_work_lists';
            referencedColumns: ['id'];
          },
        ];
      };
      specified_work_role_categories: {
        Row: {
          category: string;
          role_type: Database['public']['Enums']['job_role_type'];
        };
        ComputedFields: never;
        Insert: {
          category: string;
          role_type: Database['public']['Enums']['job_role_type'];
        };
        Update: {
          category?: string;
          role_type?: Database['public']['Enums']['job_role_type'];
        };
        Relationships: [];
      };
      swipes: {
        Row: {
          created_at: string;
          direction: Database['public']['Enums']['swipe_direction'];
          job_id: string;
          worker_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          direction: Database['public']['Enums']['swipe_direction'];
          job_id: string;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          direction?: Database['public']['Enums']['swipe_direction'];
          job_id?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'swipes_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'swipes_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      worker_availability: {
        Row: {
          end_date: string;
          id: string;
          start_date: string;
          worker_id: string;
        };
        ComputedFields: never;
        Insert: {
          end_date: string;
          id?: string;
          start_date: string;
          worker_id: string;
        };
        Update: {
          end_date?: string;
          id?: string;
          start_date?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'worker_availability_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      worker_groups: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          invite_code: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          invite_code?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          invite_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'worker_groups_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      worker_private: {
        Row: {
          nationality: string;
          tracker_goal: string;
          updated_at: string;
          user_id: string;
          visa_expiry: string | null;
          visa_type: Database['public']['Enums']['visa_type'];
        };
        ComputedFields: never;
        Insert: {
          nationality: string;
          tracker_goal?: string;
          updated_at?: string;
          user_id: string;
          visa_expiry?: string | null;
          visa_type: Database['public']['Enums']['visa_type'];
        };
        Update: {
          nationality?: string;
          tracker_goal?: string;
          updated_at?: string;
          user_id?: string;
          visa_expiry?: string | null;
          visa_type?: Database['public']['Enums']['visa_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'worker_private_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      worker_profiles: {
        Row: {
          created_at: string;
          current_postcode: string;
          experience_summary: string;
          full_name: string;
          group_id: string | null;
          group_size: number;
          has_car: boolean;
          needs_accommodation: boolean;
          photo_path: string | null;
          resume_name: string | null;
          resume_path: string | null;
          skills: string[];
          travel_mode: Database['public']['Enums']['travel_mode'];
          updated_at: string;
          user_id: string;
          years_experience: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          current_postcode: string;
          experience_summary?: string;
          full_name: string;
          group_id?: string | null;
          group_size?: number;
          has_car?: boolean;
          needs_accommodation?: boolean;
          photo_path?: string | null;
          resume_name?: string | null;
          resume_path?: string | null;
          skills?: string[];
          travel_mode?: Database['public']['Enums']['travel_mode'];
          updated_at?: string;
          user_id: string;
          years_experience?: number;
        };
        Update: {
          created_at?: string;
          current_postcode?: string;
          experience_summary?: string;
          full_name?: string;
          group_id?: string | null;
          group_size?: number;
          has_car?: boolean;
          needs_accommodation?: boolean;
          photo_path?: string | null;
          resume_name?: string | null;
          resume_path?: string | null;
          skills?: string[];
          travel_mode?: Database['public']['Enums']['travel_mode'];
          updated_at?: string;
          user_id?: string;
          years_experience?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'worker_profiles_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'worker_groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'worker_profiles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      worker_ratings: {
        Row: {
          application_id: string;
          comment: string;
          created_at: string;
          farm_id: string;
          hidden_at: string | null;
          quality: number;
          reliability: number;
          worker_id: string;
        };
        ComputedFields: never;
        Insert: {
          application_id: string;
          comment?: string;
          created_at?: string;
          farm_id: string;
          hidden_at?: string | null;
          quality: number;
          reliability: number;
          worker_id: string;
        };
        Update: {
          application_id?: string;
          comment?: string;
          created_at?: string;
          farm_id?: string;
          hidden_at?: string | null;
          quality?: number;
          reliability?: number;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'worker_ratings_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: true;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'worker_ratings_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'admin_pending_farms';
            referencedColumns: ['farm_id'];
          },
          {
            foreignKeyName: 'worker_ratings_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'farms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'worker_ratings_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'farms_public';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'worker_ratings_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      worker_regions: {
        Row: {
          region_id: string;
          worker_id: string;
        };
        ComputedFields: never;
        Insert: {
          region_id: string;
          worker_id: string;
        };
        Update: {
          region_id?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'worker_regions_region_id_fkey';
            columns: ['region_id'];
            isOneToOne: false;
            referencedRelation: 'regions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'worker_regions_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      admin_contact_share_attempts: {
        Row: {
          attempts_30_days: number | null;
          latest_attempt: string | null;
          latest_original: string | null;
          sender_email: string | null;
          sender_id: string | null;
          sender_role: Database['public']['Enums']['user_role'] | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'contact_share_attempts_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      admin_open_reports: {
        Row: {
          conversation_id: string | null;
          created_at: string | null;
          details: string | null;
          farm_name: string | null;
          job_title: string | null;
          reason: Database['public']['Enums']['report_reason'] | null;
          report_id: number | null;
          reporter_email: string | null;
          reporter_role: Database['public']['Enums']['user_role'] | null;
          reports_against_target: number | null;
          review_application_id: string | null;
          review_comment: string | null;
          review_kind: string | null;
          target_email: string | null;
          target_job_id: string | null;
          target_role: Database['public']['Enums']['user_role'] | null;
          target_status: Database['public']['Enums']['account_status'] | null;
          target_user_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'reports_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_review_application_id_fkey';
            columns: ['review_application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_target_job_id_fkey';
            columns: ['target_job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_target_user_id_fkey';
            columns: ['target_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      admin_pending_farms: {
        Row: {
          abn: string | null;
          business_name: string | null;
          contact_phone: string | null;
          created_at: string | null;
          farm_id: string | null;
          is_labour_hire: boolean | null;
          labour_hire_licence_number: string | null;
          locality: string | null;
          owner_email: string | null;
          postcode: string | null;
          updated_at: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      farms_public: {
        Row: {
          accommodation_details: string | null;
          business_name: string | null;
          description: string | null;
          id: string | null;
          is_labour_hire: boolean | null;
          locality: string | null;
          logo_path: string | null;
          photos: string[] | null;
          postcode: string | null;
          rating_avg: number | null;
          rating_count: number | null;
          region_id: string | null;
          verification_status: Database['public']['Enums']['verification_status'] | null;
          verified_at: string | null;
          website: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'postcodes_region_id_fkey';
            columns: ['region_id'];
            isOneToOne: false;
            referencedRelation: 'regions';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      accept_legal: { Args: { p_privacy_version: string; p_terms_version: string }; Returns: undefined };
      admin_activate_specified_work_list: {
        Args: { p_list_id: number; p_note?: string };
        Returns: undefined;
      };
      admin_approve_farm: {
        Args: { p_farm_id: string; p_note?: string };
        Returns: {
          abn: string;
          accommodation_details: string;
          business_name: string;
          contact_phone: string;
          created_at: string;
          description: string;
          id: string;
          is_labour_hire: boolean;
          labour_hire_licence_number: string | null;
          logo_path: string | null;
          owner_id: string;
          photos: string[];
          postcode: string;
          rejection_reason: string | null;
          updated_at: string;
          verification_status: Database['public']['Enums']['verification_status'];
          verified_at: string | null;
          verified_by: string | null;
          website: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'farms';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_hide_review: {
        Args: { p_application_id: string; p_kind: string; p_note: string };
        Returns: undefined;
      };
      admin_reject_farm: {
        Args: { p_farm_id: string; p_reason: string };
        Returns: {
          abn: string;
          accommodation_details: string;
          business_name: string;
          contact_phone: string;
          created_at: string;
          description: string;
          id: string;
          is_labour_hire: boolean;
          labour_hire_licence_number: string | null;
          logo_path: string | null;
          owner_id: string;
          photos: string[];
          postcode: string;
          rejection_reason: string | null;
          updated_at: string;
          verification_status: Database['public']['Enums']['verification_status'];
          verified_at: string | null;
          verified_by: string | null;
          website: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'farms';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_resolve_no_show_dispute: {
        Args: { p_note: string; p_outcome: string; p_report_id: number };
        Returns: undefined;
      };
      admin_resolve_report: {
        Args: { p_note: string; p_report_id: number; p_status: Database['public']['Enums']['report_status'] };
        Returns: undefined;
      };
      admin_suspend_user: { Args: { p_reason: string; p_user_id: string }; Returns: undefined };
      admin_unsuspend_user: { Args: { p_note?: string; p_user_id: string }; Returns: undefined };
      applicant_visa_summary: {
        Args: { p_application_id: string };
        Returns: {
          visa_type: Database['public']['Enums']['visa_type'];
          visa_valid_through_job_end: boolean;
        }[];
      };
      broadcast_to_crew: { Args: { p_audience?: string; p_body: string; p_job_id: string }; Returns: number };
      can_rate_farm: { Args: { p_application_id: string }; Returns: boolean };
      can_rate_worker: { Args: { p_application_id: string }; Returns: boolean };
      complete_finished_jobs: { Args: Record<PropertyKey, never>; Returns: number };
      create_group: { Args: Record<PropertyKey, never>; Returns: string };
      decide_applications: {
        Args: { p_application_ids: string[]; p_decision: Database['public']['Enums']['application_status'] };
        Returns: number;
      };
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      dispute_no_show: { Args: { p_application_id: string; p_details?: string }; Returns: number };
      employer_postcode_eligible: { Args: { p_postcode: string; p_worker_id: string }; Returns: boolean };
      employer_suggestions: {
        Args: Record<PropertyKey, never>;
        Returns: {
          business_name: string;
          farm_id: string;
          job_id: string;
          job_title: string;
          likely_specified_work: boolean;
          postcode: string;
        }[];
      };
      farm_open_jobs: {
        Args: { p_farm_id: string };
        Returns: {
          accommodation_provided: boolean;
          applied: boolean;
          employment_type: Database['public']['Enums']['employment_type'];
          end_date: string;
          hours_per_week: number;
          id: string;
          locality: string;
          min_hourly_guarantee_cents: number;
          pay_rate_cents: number;
          pay_type: Database['public']['Enums']['pay_type'];
          piece_rate_unit: string;
          role_type: Database['public']['Enums']['job_role_type'];
          start_date: string;
          title: string;
        }[];
      };
      farm_reviews: {
        Args: { p_farm_id: string };
        Returns: {
          accommodation: number;
          application_id: string;
          comment: string;
          job_title: string;
          overall: number;
          rated_at: string;
          reviewer_name: string;
          would_work_again: boolean;
        }[];
      };
      has_applied: { Args: { p_job_id: string }; Returns: boolean };
      is_active: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_conversation_participant: { Args: { p_conversation_id: string }; Returns: boolean };
      is_my_applicant: { Args: { p_worker_id: string }; Returns: boolean };
      is_my_applicant_folder: { Args: { p_folder: string }; Returns: boolean };
      is_specified_work_postcode: { Args: { p_postcode: string; p_subclass: string }; Returns: boolean };
      is_valid_abn: { Args: { abn: string }; Returns: boolean };
      is_verified_farm: { Args: { p_farm_id: string }; Returns: boolean };
      job_alert_recipients: {
        Args: { p_job_id: string };
        Returns: {
          worker_id: string;
        }[];
      };
      job_feed: {
        Args: {
          p_accommodation_only?: boolean;
          p_from?: string;
          p_limit?: number;
          p_min_hourly_cents?: number;
          p_region_ids?: string[];
          p_saved_only?: boolean;
          p_to?: string;
        };
        Returns: {
          accommodation_cost_week_cents: number;
          accommodation_provided: boolean;
          car_required: boolean;
          description: string;
          employment_type: Database['public']['Enums']['employment_type'];
          end_date: string;
          farm_id: string;
          farm_is_labour_hire: boolean;
          farm_logo_path: string;
          farm_name: string;
          farm_rating_avg: number;
          farm_rating_count: number;
          hours_per_week: number;
          id: string;
          lat: number;
          likely_specified_work: boolean;
          lng: number;
          locality: string;
          min_hourly_guarantee_cents: number;
          pay_rate_cents: number;
          pay_type: Database['public']['Enums']['pay_type'];
          piece_rate_unit: string;
          postcode: string;
          region_name: string;
          role_type: Database['public']['Enums']['job_role_type'];
          specified_work_eligible: boolean;
          specified_work_label: string;
          start_date: string;
          title: string;
          transport_provided: boolean;
          viewer_visa_subclass: string;
          workers_needed: number;
        }[];
      };
      job_owner: { Args: { p_job_id: string }; Returns: string };
      job_shortlist: {
        Args: { p_job_id: string };
        Returns: {
          application_id: string;
          applied_at: string;
          attendance: Database['public']['Enums']['attendance_status'];
          attendance_disputed: boolean;
          experience_summary: string;
          full_name: string;
          group_id: string;
          group_size: number;
          has_car: boolean;
          locality: string;
          match_score: number;
          needs_accommodation: boolean;
          no_show_count: number;
          photo_path: string;
          quality_avg: number;
          rating_count: number;
          reliability_avg: number;
          score_breakdown: Json;
          skills: string[];
          status: Database['public']['Enums']['application_status'];
          travel_mode: Database['public']['Enums']['travel_mode'];
          visa_type: Database['public']['Enums']['visa_type'];
          visa_valid_through_job_end: boolean;
          worker_id: string;
          years_experience: number;
        }[];
      };
      join_group: { Args: { p_invite_code: string }; Returns: undefined };
      leave_group: { Args: Record<PropertyKey, never>; Returns: undefined };
      mark_attendance: {
        Args: { p_application_ids: string[]; p_status: Database['public']['Enums']['attendance_status'] };
        Returns: number;
      };
      mark_conversation_read: { Args: { p_conversation_id: string }; Returns: undefined };
      mask_contact_details: { Args: { p_body: string }; Returns: string };
      my_applications: {
        Args: Record<PropertyKey, never>;
        Returns: {
          application_id: string;
          applied_at: string;
          attendance: Database['public']['Enums']['attendance_status'];
          dispute_outcome: string;
          disputed: boolean;
          end_date: string;
          farm_id: string;
          farm_name: string;
          job_id: string;
          job_status: Database['public']['Enums']['job_status'];
          locality: string;
          start_date: string;
          status: Database['public']['Enums']['application_status'];
          title: string;
        }[];
      };
      my_conversations: {
        Args: Record<PropertyKey, never>;
        Returns: {
          application_id: string;
          application_status: Database['public']['Enums']['application_status'];
          conversation_id: string;
          job_title: string;
          last_message: string;
          last_message_at: string;
          other_name: string;
          unread: number;
        }[];
      };
      my_group: {
        Args: Record<PropertyKey, never>;
        Returns: {
          invite_code: string;
          is_me: boolean;
          member_id: string;
          member_name: string;
        }[];
      };
      my_role: { Args: Record<PropertyKey, never>; Returns: Database['public']['Enums']['user_role'] };
      notify: { Args: { p_event: string; p_payload: Json }; Returns: undefined };
      owns_application_job: { Args: { p_application_id: string }; Returns: boolean };
      owns_employer: { Args: { p_employer_id: string }; Returns: boolean };
      owns_farm: { Args: { p_farm_id: string }; Returns: boolean };
      owns_job: { Args: { p_job_id: string }; Returns: boolean };
      pending_reviews: {
        Args: Record<PropertyKey, never>;
        Returns: {
          application_id: string;
          end_date: string;
          job_id: string;
          job_title: string;
          kind: string;
          subject_name: string;
        }[];
      };
      rate_farm: {
        Args: {
          p_accommodation?: number;
          p_application_id: string;
          p_comment?: string;
          p_overall: number;
          p_would_work_again: boolean;
        };
        Returns: undefined;
      };
      rate_worker: {
        Args: { p_application_id: string; p_comment?: string; p_quality: number; p_reliability: number };
        Returns: undefined;
      };
      ratings_revealed: { Args: { p_application_id: string }; Returns: boolean };
      report_review: {
        Args: { p_application_id: string; p_details?: string; p_kind: string };
        Returns: number;
      };
      run_daily_jobs: { Args: Record<PropertyKey, never>; Returns: undefined };
      save_match_scores: { Args: { p_ranker_version: string; p_scores: Json }; Returns: number };
      save_worker_profile: { Args: { p: Json }; Returns: undefined };
      set_my_role: {
        Args: { new_role: Database['public']['Enums']['user_role'] };
        Returns: {
          created_at: string;
          id: string;
          privacy_version: string | null;
          role: Database['public']['Enums']['user_role'] | null;
          status: Database['public']['Enums']['account_status'];
          terms_accepted_at: string | null;
          terms_version: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      specified_work_check: {
        Args: { p_postcode: string; p_role_type?: Database['public']['Enums']['job_role_type'] };
        Returns: {
          eligible_417: boolean;
          eligible_462: boolean;
          label: string;
          last_checked: string;
          list_version: string;
          my_visa_subclass: string;
        }[];
      };
      specified_work_label: {
        Args: {
          p_postcode: string;
          p_role_type: Database['public']['Enums']['job_role_type'];
          p_subclass: string;
        };
        Returns: string;
      };
      start_conversation: { Args: { p_application_id: string }; Returns: string };
      submit_report: {
        Args: {
          p_conversation_id?: string;
          p_details?: string;
          p_job_id?: string;
          p_reason: Database['public']['Enums']['report_reason'];
        };
        Returns: number;
      };
      swipe_job: {
        Args: { p_direction: Database['public']['Enums']['swipe_direction']; p_job_id: string };
        Returns: string;
      };
      undo_swipe: { Args: { p_job_id: string }; Returns: undefined };
      withdraw_application: { Args: { p_application_id: string }; Returns: undefined };
      worker_reputation: {
        Args: { p_worker_ids: string[] };
        Returns: {
          no_show_count: number;
          quality_avg: number;
          rating_count: number;
          reliability_avg: number;
          reliability_score: number;
          worker_id: string;
        }[];
      };
      worker_reviews: {
        Args: { p_worker_id: string };
        Returns: {
          application_id: string;
          comment: string;
          farm_name: string;
          job_title: string;
          quality: number;
          rated_at: string;
          reliability: number;
        }[];
      };
    };
    Enums: {
      account_status: 'active' | 'suspended';
      application_status: 'applied' | 'accepted' | 'declined' | 'withdrawn' | 'completed';
      attendance_status: 'showed' | 'no_show' | 'left_early';
      employment_type: 'casual' | 'part_time' | 'full_time';
      job_role_type: 'picking' | 'packing' | 'pruning' | 'planting' | 'machinery' | 'livestock' | 'general';
      job_status: 'open' | 'filled' | 'closed';
      pay_type: 'hourly' | 'piece_rate';
      report_reason:
        | 'unsafe'
        | 'harassment'
        | 'scam'
        | 'underpaid'
        | 'no_show'
        | 'fake_profile'
        | 'other'
        | 'no_show_dispute'
        | 'inappropriate_review';
      report_status: 'open' | 'actioned' | 'dismissed';
      swipe_direction: 'like' | 'pass';
      travel_mode: 'solo' | 'group';
      user_role: 'worker' | 'farm' | 'admin';
      verification_status: 'pending' | 'verified' | 'rejected';
      visa_type: '417' | '462' | 'other' | 'citizen_pr';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ['active', 'suspended'],
      application_status: ['applied', 'accepted', 'declined', 'withdrawn', 'completed'],
      attendance_status: ['showed', 'no_show', 'left_early'],
      employment_type: ['casual', 'part_time', 'full_time'],
      job_role_type: ['picking', 'packing', 'pruning', 'planting', 'machinery', 'livestock', 'general'],
      job_status: ['open', 'filled', 'closed'],
      pay_type: ['hourly', 'piece_rate'],
      report_reason: [
        'unsafe',
        'harassment',
        'scam',
        'underpaid',
        'no_show',
        'fake_profile',
        'other',
        'no_show_dispute',
        'inappropriate_review',
      ],
      report_status: ['open', 'actioned', 'dismissed'],
      swipe_direction: ['like', 'pass'],
      travel_mode: ['solo', 'group'],
      user_role: ['worker', 'farm', 'admin'],
      verification_status: ['pending', 'verified', 'rejected'],
      visa_type: ['417', '462', 'other', 'citizen_pr'],
    },
  },
} as const;
