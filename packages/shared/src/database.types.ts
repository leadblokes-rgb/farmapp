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
      farms: {
        Row: {
          abn: string;
          business_name: string;
          contact_phone: string;
          created_at: string;
          description: string;
          id: string;
          is_labour_hire: boolean;
          labour_hire_licence_number: string | null;
          logo_path: string | null;
          owner_id: string;
          postcode: string;
          rejection_reason: string | null;
          updated_at: string;
          verification_status: Database['public']['Enums']['verification_status'];
          verified_at: string | null;
          verified_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          abn: string;
          business_name: string;
          contact_phone: string;
          created_at?: string;
          description?: string;
          id?: string;
          is_labour_hire?: boolean;
          labour_hire_licence_number?: string | null;
          logo_path?: string | null;
          owner_id: string;
          postcode: string;
          rejection_reason?: string | null;
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          abn?: string;
          business_name?: string;
          contact_phone?: string;
          created_at?: string;
          description?: string;
          id?: string;
          is_labour_hire?: boolean;
          labour_hire_licence_number?: string | null;
          logo_path?: string | null;
          owner_id?: string;
          postcode?: string;
          rejection_reason?: string | null;
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
          verified_at?: string | null;
          verified_by?: string | null;
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
      jobs: {
        Row: {
          accommodation_cost_week_cents: number | null;
          accommodation_provided: boolean;
          car_required: boolean;
          created_at: string;
          description: string;
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
          role: Database['public']['Enums']['user_role'] | null;
          status: Database['public']['Enums']['account_status'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id: string;
          role?: Database['public']['Enums']['user_role'] | null;
          status?: Database['public']['Enums']['account_status'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database['public']['Enums']['user_role'] | null;
          status?: Database['public']['Enums']['account_status'];
          updated_at?: string;
        };
        Relationships: [];
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
      worker_private: {
        Row: {
          nationality: string;
          updated_at: string;
          user_id: string;
          visa_expiry: string | null;
          visa_type: Database['public']['Enums']['visa_type'];
        };
        ComputedFields: never;
        Insert: {
          nationality: string;
          updated_at?: string;
          user_id: string;
          visa_expiry?: string | null;
          visa_type: Database['public']['Enums']['visa_type'];
        };
        Update: {
          nationality?: string;
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
          group_size: number;
          has_car: boolean;
          needs_accommodation: boolean;
          photo_path: string | null;
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
          group_size?: number;
          has_car?: boolean;
          needs_accommodation?: boolean;
          photo_path?: string | null;
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
          group_size?: number;
          has_car?: boolean;
          needs_accommodation?: boolean;
          photo_path?: string | null;
          skills?: string[];
          travel_mode?: Database['public']['Enums']['travel_mode'];
          updated_at?: string;
          user_id?: string;
          years_experience?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'worker_profiles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
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
          business_name: string | null;
          description: string | null;
          id: string | null;
          is_labour_hire: boolean | null;
          locality: string | null;
          logo_path: string | null;
          postcode: string | null;
          region_id: string | null;
          verification_status: Database['public']['Enums']['verification_status'] | null;
          verified_at: string | null;
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
      admin_approve_farm: {
        Args: { p_farm_id: string; p_note?: string };
        Returns: {
          abn: string;
          business_name: string;
          contact_phone: string;
          created_at: string;
          description: string;
          id: string;
          is_labour_hire: boolean;
          labour_hire_licence_number: string | null;
          logo_path: string | null;
          owner_id: string;
          postcode: string;
          rejection_reason: string | null;
          updated_at: string;
          verification_status: Database['public']['Enums']['verification_status'];
          verified_at: string | null;
          verified_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'farms';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_reject_farm: {
        Args: { p_farm_id: string; p_reason: string };
        Returns: {
          abn: string;
          business_name: string;
          contact_phone: string;
          created_at: string;
          description: string;
          id: string;
          is_labour_hire: boolean;
          labour_hire_licence_number: string | null;
          logo_path: string | null;
          owner_id: string;
          postcode: string;
          rejection_reason: string | null;
          updated_at: string;
          verification_status: Database['public']['Enums']['verification_status'];
          verified_at: string | null;
          verified_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'farms';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_suspend_user: { Args: { p_reason: string; p_user_id: string }; Returns: undefined };
      admin_unsuspend_user: { Args: { p_note?: string; p_user_id: string }; Returns: undefined };
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      has_applied: { Args: { p_job_id: string }; Returns: boolean };
      is_active: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_valid_abn: { Args: { abn: string }; Returns: boolean };
      is_verified_farm: { Args: { p_farm_id: string }; Returns: boolean };
      job_feed: {
        Args: {
          p_accommodation_only?: boolean;
          p_from?: string;
          p_limit?: number;
          p_min_hourly_cents?: number;
          p_region_ids?: string[];
          p_to?: string;
        };
        Returns: {
          accommodation_cost_week_cents: number;
          accommodation_provided: boolean;
          car_required: boolean;
          description: string;
          end_date: string;
          farm_id: string;
          farm_is_labour_hire: boolean;
          farm_name: string;
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
          start_date: string;
          title: string;
          transport_provided: boolean;
          workers_needed: number;
        }[];
      };
      my_applications: {
        Args: Record<PropertyKey, never>;
        Returns: {
          application_id: string;
          applied_at: string;
          end_date: string;
          farm_name: string;
          job_id: string;
          job_status: Database['public']['Enums']['job_status'];
          locality: string;
          start_date: string;
          status: Database['public']['Enums']['application_status'];
          title: string;
        }[];
      };
      my_role: { Args: Record<PropertyKey, never>; Returns: Database['public']['Enums']['user_role'] };
      owns_farm: { Args: { p_farm_id: string }; Returns: boolean };
      owns_job: { Args: { p_job_id: string }; Returns: boolean };
      save_worker_profile: { Args: { p: Json }; Returns: undefined };
      set_my_role: {
        Args: { new_role: Database['public']['Enums']['user_role'] };
        Returns: {
          created_at: string;
          id: string;
          role: Database['public']['Enums']['user_role'] | null;
          status: Database['public']['Enums']['account_status'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      swipe_job: {
        Args: { p_direction: Database['public']['Enums']['swipe_direction']; p_job_id: string };
        Returns: string;
      };
      undo_swipe: { Args: { p_job_id: string }; Returns: undefined };
      withdraw_application: { Args: { p_application_id: string }; Returns: undefined };
    };
    Enums: {
      account_status: 'active' | 'suspended';
      application_status: 'applied' | 'accepted' | 'declined' | 'withdrawn' | 'completed';
      job_role_type: 'picking' | 'packing' | 'pruning' | 'planting' | 'machinery' | 'livestock' | 'general';
      job_status: 'open' | 'filled' | 'closed';
      pay_type: 'hourly' | 'piece_rate';
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
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
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
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
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
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
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
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
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
      job_role_type: ['picking', 'packing', 'pruning', 'planting', 'machinery', 'livestock', 'general'],
      job_status: ['open', 'filled', 'closed'],
      pay_type: ['hourly', 'piece_rate'],
      swipe_direction: ['like', 'pass'],
      travel_mode: ['solo', 'group'],
      user_role: ['worker', 'farm', 'admin'],
      verification_status: ['pending', 'verified', 'rejected'],
      visa_type: ['417', '462', 'other', 'citizen_pr'],
    },
  },
} as const;
