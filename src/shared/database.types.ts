// AUTO-GENERATED from the live Supabase project (zglbgqeccebqnijcqfkb) via
// `supabase gen types typescript`. Do not hand-edit — regenerate
// instead so this never silently diverges from production.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      asset_pages: {
        Row: {
          asset_id: string
          created_at: string
          duration_ms: number | null
          extracted_text: string | null
          height: number | null
          id: string
          metadata: Json
          page_number: number
          title: string | null
          updated_at: string
          width: number | null
          workspace_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          duration_ms?: number | null
          extracted_text?: string | null
          height?: number | null
          id?: string
          metadata?: Json
          page_number: number
          title?: string | null
          updated_at?: string
          width?: number | null
          workspace_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          duration_ms?: number | null
          extracted_text?: string | null
          height?: number | null
          id?: string
          metadata?: Json
          page_number?: number
          title?: string | null
          updated_at?: string
          width?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_pages_workspace_id_asset_id_fkey"
            columns: ["workspace_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      asset_processing_jobs: {
        Row: {
          asset_id: string
          attempt_count: number
          available_at: string
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message_safe: string | null
          expected_outputs: Json
          heartbeat_at: string | null
          id: string
          job_type: string
          lease_expires_at: string | null
          lease_owner: string | null
          lease_token_hash: string | null
          max_attempts: number
          priority: number
          started_at: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_id: string
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message_safe?: string | null
          expected_outputs?: Json
          heartbeat_at?: string | null
          id?: string
          job_type: string
          lease_expires_at?: string | null
          lease_owner?: string | null
          lease_token_hash?: string | null
          max_attempts?: number
          priority?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_id?: string
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message_safe?: string | null
          expected_outputs?: Json
          heartbeat_at?: string | null
          id?: string
          job_type?: string
          lease_expires_at?: string | null
          lease_owner?: string | null
          lease_token_hash?: string | null
          max_attempts?: number
          priority?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_processing_jobs_lease_owner_fkey"
            columns: ["lease_owner"]
            isOneToOne: false
            referencedRelation: "media_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_processing_jobs_workspace_id_asset_id_fkey"
            columns: ["workspace_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      asset_upload_events: {
        Row: {
          asset_id: string | null
          created_at: string
          id: string
          quota_month: string
          source_size_bytes: number
          uploaded_by: string
          workspace_id: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          id?: string
          quota_month: string
          source_size_bytes: number
          uploaded_by: string
          workspace_id: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          id?: string
          quota_month?: string
          source_size_bytes?: number
          uploaded_by?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_upload_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_upload_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_upload_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "asset_upload_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_variants: {
        Row: {
          asset_id: string
          asset_page_id: string | null
          bucket_id: string
          checksum_sha256: string | null
          created_at: string
          duration_ms: number | null
          height: number | null
          id: string
          metadata: Json
          mime_type: string
          object_path: string
          size_bytes: number | null
          variant_type: string
          width: number | null
          workspace_id: string
        }
        Insert: {
          asset_id: string
          asset_page_id?: string | null
          bucket_id?: string
          checksum_sha256?: string | null
          created_at?: string
          duration_ms?: number | null
          height?: number | null
          id?: string
          metadata?: Json
          mime_type: string
          object_path: string
          size_bytes?: number | null
          variant_type: string
          width?: number | null
          workspace_id: string
        }
        Update: {
          asset_id?: string
          asset_page_id?: string | null
          bucket_id?: string
          checksum_sha256?: string | null
          created_at?: string
          duration_ms?: number | null
          height?: number | null
          id?: string
          metadata?: Json
          mime_type?: string
          object_path?: string
          size_bytes?: number | null
          variant_type?: string
          width?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_variants_workspace_id_asset_id_asset_page_id_fkey"
            columns: ["workspace_id", "asset_id", "asset_page_id"]
            isOneToOne: false
            referencedRelation: "asset_pages"
            referencedColumns: ["workspace_id", "asset_id", "id"]
          },
          {
            foreignKeyName: "asset_variants_workspace_id_asset_id_fkey"
            columns: ["workspace_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      assets: {
        Row: {
          archived_at: string | null
          asset_kind: string
          created_at: string
          error_code: string | null
          error_message_safe: string | null
          id: string
          metadata: Json
          mime_type: string
          original_filename: string
          page_count: number | null
          processed_at: string | null
          source_bucket: string
          source_checksum_sha256: string | null
          source_object_path: string | null
          source_size_bytes: number | null
          source_uploaded_at: string | null
          status: string
          updated_at: string
          uploaded_by: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          asset_kind: string
          created_at?: string
          error_code?: string | null
          error_message_safe?: string | null
          id?: string
          metadata?: Json
          mime_type: string
          original_filename: string
          page_count?: number | null
          processed_at?: string | null
          source_bucket?: string
          source_checksum_sha256?: string | null
          source_object_path?: string | null
          source_size_bytes?: number | null
          source_uploaded_at?: string | null
          status?: string
          updated_at?: string
          uploaded_by: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          asset_kind?: string
          created_at?: string
          error_code?: string | null
          error_message_safe?: string | null
          id?: string
          metadata?: Json
          mime_type?: string
          original_filename?: string
          page_count?: number | null
          processed_at?: string | null
          source_bucket?: string
          source_checksum_sha256?: string | null
          source_object_path?: string | null
          source_size_bytes?: number | null
          source_uploaded_at?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          action_result: Json
          action_type: string | null
          actor_type: string
          attempt: number
          automation_id: string
          claimed_at: string | null
          created_at: string
          error_code: string | null
          error_message_safe: string | null
          finished_at: string | null
          id: string
          lease_expires_at: string | null
          lease_owner: string | null
          org_id: string
          scheduled_for: string
          session_id: string | null
          source: string
          started_at: string | null
          status: string
        }
        Insert: {
          action_result?: Json
          action_type?: string | null
          actor_type?: string
          attempt?: number
          automation_id: string
          claimed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message_safe?: string | null
          finished_at?: string | null
          id?: string
          lease_expires_at?: string | null
          lease_owner?: string | null
          org_id: string
          scheduled_for: string
          session_id?: string | null
          source?: string
          started_at?: string | null
          status?: string
        }
        Update: {
          action_result?: Json
          action_type?: string | null
          actor_type?: string
          attempt?: number
          automation_id?: string
          claimed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message_safe?: string | null
          finished_at?: string | null
          id?: string
          lease_expires_at?: string | null
          lease_owner?: string | null
          org_id?: string
          scheduled_for?: string
          session_id?: string | null
          source?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "display_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "automation_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "display_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_health_summary"
            referencedColumns: ["session_id"]
          },
        ]
      }
      billing_customers: {
        Row: {
          created_at: string
          stripe_customer_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          stripe_customer_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          stripe_customer_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          error_message: string | null
          event_type: string
          livemode: boolean
          payload: Json
          processed_at: string | null
          processing_status: string
          received_at: string
          stripe_event_id: string
        }
        Insert: {
          error_message?: string | null
          event_type: string
          livemode: boolean
          payload: Json
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          stripe_event_id: string
        }
        Update: {
          error_message?: string | null
          event_type?: string
          livemode?: boolean
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      billing_notification_outbox: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          last_error: string | null
          notification_type: string
          org_id: string | null
          payload: Json
          send_after: string
          sent_at: string | null
          status: string
          stripe_event_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          notification_type: string
          org_id?: string | null
          payload?: Json
          send_after?: string
          sent_at?: string | null
          status?: string
          stripe_event_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          notification_type?: string
          org_id?: string | null
          payload?: Json
          send_after?: string
          sent_at?: string | null
          status?: string
          stripe_event_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_notification_outbox_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_notification_outbox_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "billing_notification_outbox_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      board_publications: {
        Row: {
          board_id: string
          created_at: string
          error_code: string | null
          error_message_safe: string | null
          id: string
          manifest: Json
          published_by: string
          ready_at: string | null
          retired_at: string | null
          revision_id: string
          status: string
          workspace_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          error_code?: string | null
          error_message_safe?: string | null
          id?: string
          manifest?: Json
          published_by: string
          ready_at?: string | null
          retired_at?: string | null
          revision_id: string
          status?: string
          workspace_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          error_code?: string | null
          error_message_safe?: string | null
          id?: string
          manifest?: Json
          published_by?: string
          ready_at?: string | null
          retired_at?: string | null
          revision_id?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_publications_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "board_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_publications_workspace_id_board_id_fkey"
            columns: ["workspace_id", "board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      board_revisions: {
        Row: {
          board_id: string
          board_version: number
          created_at: string
          created_by: string
          id: string
          label: string | null
          snapshot: Json
          workspace_id: string
        }
        Insert: {
          board_id: string
          board_version: number
          created_at?: string
          created_by: string
          id?: string
          label?: string | null
          snapshot: Json
          workspace_id: string
        }
        Update: {
          board_id?: string
          board_version?: number
          created_at?: string
          created_by?: string
          id?: string
          label?: string | null
          snapshot?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_revisions_workspace_id_board_id_fkey"
            columns: ["workspace_id", "board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      board_scenes: {
        Row: {
          background: Json
          board_id: string
          config: Json
          created_at: string
          duration_ms: number
          id: string
          is_hidden: boolean
          name: string
          scene_type: string
          sort_order: number
          transition_config: Json
          transition_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          background?: Json
          board_id: string
          config?: Json
          created_at?: string
          duration_ms?: number
          id?: string
          is_hidden?: boolean
          name: string
          scene_type?: string
          sort_order?: number
          transition_config?: Json
          transition_type?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          background?: Json
          board_id?: string
          config?: Json
          created_at?: string
          duration_ms?: number
          id?: string
          is_hidden?: boolean
          name?: string
          scene_type?: string
          sort_order?: number
          transition_config?: Json
          transition_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_scenes_workspace_id_board_id_fkey"
            columns: ["workspace_id", "board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      boards: {
        Row: {
          archived_at: string | null
          background_color: string
          canvas_height: number
          canvas_width: number
          created_at: string
          created_by: string
          id: string
          name: string
          status: string
          updated_at: string
          updated_by: string
          version: number
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          background_color?: string
          canvas_height?: number
          canvas_width?: number
          created_at?: string
          created_by: string
          id?: string
          name: string
          status?: string
          updated_at?: string
          updated_by: string
          version?: number
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          background_color?: string
          canvas_height?: number
          canvas_width?: number
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
          updated_by?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "boards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_sessions: {
        Row: {
          amount_total: number | null
          billing_mode: string
          completed_at: string | null
          created_at: string
          currency: string | null
          expires_at: string | null
          id: string
          plan_code: string
          provisioned_workspace_id: string | null
          requested_team_name: string | null
          requested_team_slug: string | null
          requested_workspace_name: string
          requested_workspace_slug: string
          status: string
          stripe_checkout_session_id: string
          stripe_customer_id: string
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
          workspace_type: string
        }
        Insert: {
          amount_total?: number | null
          billing_mode: string
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          id?: string
          plan_code: string
          provisioned_workspace_id?: string | null
          requested_team_name?: string | null
          requested_team_slug?: string | null
          requested_workspace_name: string
          requested_workspace_slug: string
          status?: string
          stripe_checkout_session_id: string
          stripe_customer_id: string
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
          workspace_type: string
        }
        Update: {
          amount_total?: number | null
          billing_mode?: string
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          id?: string
          plan_code?: string
          provisioned_workspace_id?: string | null
          requested_team_name?: string | null
          requested_team_slug?: string | null
          requested_workspace_name?: string
          requested_workspace_slug?: string
          status?: string
          stripe_checkout_session_id?: string
          stripe_customer_id?: string
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
          workspace_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["plan_code"]
          },
          {
            foreignKeyName: "checkout_sessions_provisioned_workspace_id_fkey"
            columns: ["provisioned_workspace_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_provisioned_workspace_id_fkey"
            columns: ["provisioned_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "checkout_sessions_provisioned_workspace_id_fkey"
            columns: ["provisioned_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      community_replies: {
        Row: {
          author_id: string | null
          author_name: string
          body: string
          created_at: string
          id: string
          is_accepted: boolean
          thread_id: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          body: string
          created_at?: string
          id?: string
          is_accepted?: boolean
          thread_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          is_accepted?: boolean
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "community_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      community_threads: {
        Row: {
          author_id: string | null
          author_name: string
          body: string
          category: string
          created_at: string
          id: string
          is_answered: boolean
          last_activity_at: string
          reply_count: number
          title: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          body: string
          category?: string
          created_at?: string
          id?: string
          is_answered?: boolean
          last_activity_at?: string
          reply_count?: number
          title: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_answered?: boolean
          last_activity_at?: string
          reply_count?: number
          title?: string
        }
        Relationships: []
      }
      display_automations: {
        Row: {
          action_type: string
          consecutive_failures: number
          created_at: string
          created_by: string | null
          cron_expression: string | null
          disabled_reason: string | null
          id: string
          is_enabled: boolean
          last_error_code: string | null
          last_error_message_safe: string | null
          last_run_at: string | null
          last_status: string | null
          location_id: string
          max_attempts: number
          name: string
          next_run_at: string | null
          org_id: string
          retry_backoff_seconds: number
          run_once_at: string | null
          schedule_kind: string
          schedule_type: string
          session_id: string
          target_display_mode: string | null
          target_id: string
          target_layout_id: string | null
          target_session_screen_id: string | null
          target_type: string
          timezone: string
          updated_at: string
        }
        Insert: {
          action_type: string
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          cron_expression?: string | null
          disabled_reason?: string | null
          id?: string
          is_enabled?: boolean
          last_error_code?: string | null
          last_error_message_safe?: string | null
          last_run_at?: string | null
          last_status?: string | null
          location_id: string
          max_attempts?: number
          name: string
          next_run_at?: string | null
          org_id: string
          retry_backoff_seconds?: number
          run_once_at?: string | null
          schedule_kind?: string
          schedule_type: string
          session_id: string
          target_display_mode?: string | null
          target_id: string
          target_layout_id?: string | null
          target_session_screen_id?: string | null
          target_type?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          cron_expression?: string | null
          disabled_reason?: string | null
          id?: string
          is_enabled?: boolean
          last_error_code?: string | null
          last_error_message_safe?: string | null
          last_run_at?: string | null
          last_status?: string | null
          location_id?: string
          max_attempts?: number
          name?: string
          next_run_at?: string | null
          org_id?: string
          retry_backoff_seconds?: number
          run_once_at?: string | null
          schedule_kind?: string
          schedule_type?: string
          session_id?: string
          target_display_mode?: string | null
          target_id?: string
          target_layout_id?: string | null
          target_session_screen_id?: string | null
          target_type?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "display_automations_session_id_org_id_location_id_fkey"
            columns: ["session_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "display_sessions"
            referencedColumns: ["id", "org_id", "location_id"]
          },
          {
            foreignKeyName: "display_automations_target_layout_id_org_id_location_id_fkey"
            columns: ["target_layout_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "display_layouts"
            referencedColumns: ["id", "org_id", "location_id"]
          },
          {
            foreignKeyName: "display_automations_target_session_screen_id_org_id_locati_fkey"
            columns: [
              "target_session_screen_id",
              "org_id",
              "location_id",
              "session_id",
            ]
            isOneToOne: false
            referencedRelation: "display_session_screens"
            referencedColumns: ["id", "org_id", "location_id", "session_id"]
          },
        ]
      }
      display_group_members: {
        Row: {
          added_at: string
          added_by: string | null
          group_id: string
          id: string
          member_order: number
          org_id: string
          screen_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          group_id: string
          id?: string
          member_order?: number
          org_id: string
          screen_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          group_id?: string
          id?: string
          member_order?: number
          org_id?: string
          screen_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "display_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "display_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "display_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "display_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_group_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_group_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "display_group_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_group_members_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      display_groups: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          fallback_board_id: string | null
          id: string
          location_id: string
          name: string
          org_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          fallback_board_id?: string | null
          id?: string
          location_id: string
          name: string
          org_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          fallback_board_id?: string | null
          id?: string
          location_id?: string
          name?: string
          org_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "display_groups_fallback_board_id_fkey"
            columns: ["fallback_board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_groups_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "display_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      display_health: {
        Row: {
          cached_content_state: string
          connection_state: string
          current_board_id: string | null
          current_config_revision: number | null
          current_session_id: string | null
          health_state: string
          last_error_code: string | null
          last_error_message_safe: string | null
          last_heartbeat_at: string | null
          last_sync_started_at: string | null
          last_sync_success_at: string | null
          network_quality: string | null
          org_id: string
          orientation: string | null
          player_version: string | null
          resolution_height: number | null
          resolution_width: number | null
          screen_id: string
          sync_state: string
          updated_at: string
        }
        Insert: {
          cached_content_state?: string
          connection_state?: string
          current_board_id?: string | null
          current_config_revision?: number | null
          current_session_id?: string | null
          health_state?: string
          last_error_code?: string | null
          last_error_message_safe?: string | null
          last_heartbeat_at?: string | null
          last_sync_started_at?: string | null
          last_sync_success_at?: string | null
          network_quality?: string | null
          org_id: string
          orientation?: string | null
          player_version?: string | null
          resolution_height?: number | null
          resolution_width?: number | null
          screen_id: string
          sync_state?: string
          updated_at?: string
        }
        Update: {
          cached_content_state?: string
          connection_state?: string
          current_board_id?: string | null
          current_config_revision?: number | null
          current_session_id?: string | null
          health_state?: string
          last_error_code?: string | null
          last_error_message_safe?: string | null
          last_heartbeat_at?: string | null
          last_sync_started_at?: string | null
          last_sync_success_at?: string | null
          network_quality?: string | null
          org_id?: string
          orientation?: string | null
          player_version?: string | null
          resolution_height?: number | null
          resolution_width?: number | null
          screen_id?: string
          sync_state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "display_health_current_board_id_fkey"
            columns: ["current_board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_health_current_session_id_fkey"
            columns: ["current_session_id"]
            isOneToOne: false
            referencedRelation: "display_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_health_current_session_id_fkey"
            columns: ["current_session_id"]
            isOneToOne: false
            referencedRelation: "session_health_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "display_health_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_health_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "display_health_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_health_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: true
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      display_health_events: {
        Row: {
          error_code: string | null
          error_message_safe: string | null
          event_type: string
          from_state: string | null
          id: number
          metadata: Json
          occurred_at: string
          org_id: string
          screen_id: string
          session_id: string | null
          to_state: string | null
        }
        Insert: {
          error_code?: string | null
          error_message_safe?: string | null
          event_type: string
          from_state?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          org_id: string
          screen_id: string
          session_id?: string | null
          to_state?: string | null
        }
        Update: {
          error_code?: string | null
          error_message_safe?: string | null
          event_type?: string
          from_state?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          org_id?: string
          screen_id?: string
          session_id?: string | null
          to_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "display_health_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_health_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "display_health_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_health_events_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_health_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "display_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_health_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_health_summary"
            referencedColumns: ["session_id"]
          },
        ]
      }
      display_layout_tiles: {
        Row: {
          config: Json
          created_at: string
          height_percent: number
          id: string
          is_visible: boolean
          layout_id: string
          location_id: string
          org_id: string
          scene_id: string
          updated_at: string
          width_percent: number
          x_percent: number
          y_percent: number
          z_index: number
        }
        Insert: {
          config?: Json
          created_at?: string
          height_percent?: number
          id?: string
          is_visible?: boolean
          layout_id: string
          location_id: string
          org_id: string
          scene_id: string
          updated_at?: string
          width_percent?: number
          x_percent?: number
          y_percent?: number
          z_index?: number
        }
        Update: {
          config?: Json
          created_at?: string
          height_percent?: number
          id?: string
          is_visible?: boolean
          layout_id?: string
          location_id?: string
          org_id?: string
          scene_id?: string
          updated_at?: string
          width_percent?: number
          x_percent?: number
          y_percent?: number
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "display_layout_tiles_layout_id_org_id_location_id_fkey"
            columns: ["layout_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "display_layouts"
            referencedColumns: ["id", "org_id", "location_id"]
          },
          {
            foreignKeyName: "display_layout_tiles_scene_id_org_id_location_id_fkey"
            columns: ["scene_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id", "org_id", "location_id"]
          },
        ]
      }
      display_layouts: {
        Row: {
          background_color: string
          canvas_height: number
          canvas_width: number
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          location_id: string
          name: string
          org_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          background_color?: string
          canvas_height?: number
          canvas_width?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          location_id: string
          name: string
          org_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          background_color?: string
          canvas_height?: number
          canvas_width?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          location_id?: string
          name?: string
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "display_layouts_location_id_org_id_fkey"
            columns: ["location_id", "org_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      display_session_screens: {
        Row: {
          activated_at: string | null
          added_at: string
          added_by: string | null
          assignment_status: string
          board_id: string | null
          id: string
          is_enabled: boolean
          is_primary: boolean
          layout_id: string | null
          location_id: string
          org_id: string
          removed_at: string | null
          removed_by: string | null
          rotation_degrees: number
          screen_id: string
          screen_order: number
          session_id: string
          viewport_height_percent: number
          viewport_width_percent: number
          viewport_x_percent: number
          viewport_y_percent: number
        }
        Insert: {
          activated_at?: string | null
          added_at?: string
          added_by?: string | null
          assignment_status?: string
          board_id?: string | null
          id?: string
          is_enabled?: boolean
          is_primary?: boolean
          layout_id?: string | null
          location_id: string
          org_id: string
          removed_at?: string | null
          removed_by?: string | null
          rotation_degrees?: number
          screen_id: string
          screen_order?: number
          session_id: string
          viewport_height_percent?: number
          viewport_width_percent?: number
          viewport_x_percent?: number
          viewport_y_percent?: number
        }
        Update: {
          activated_at?: string | null
          added_at?: string
          added_by?: string | null
          assignment_status?: string
          board_id?: string | null
          id?: string
          is_enabled?: boolean
          is_primary?: boolean
          layout_id?: string | null
          location_id?: string
          org_id?: string
          removed_at?: string | null
          removed_by?: string | null
          rotation_degrees?: number
          screen_id?: string
          screen_order?: number
          session_id?: string
          viewport_height_percent?: number
          viewport_width_percent?: number
          viewport_x_percent?: number
          viewport_y_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "display_session_screens_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_session_screens_layout_id_org_id_location_id_fkey"
            columns: ["layout_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "display_layouts"
            referencedColumns: ["id", "org_id", "location_id"]
          },
          {
            foreignKeyName: "display_session_screens_screen_id_org_id_location_id_fkey"
            columns: ["screen_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id", "org_id", "location_id"]
          },
          {
            foreignKeyName: "display_session_screens_session_id_org_id_location_id_fkey"
            columns: ["session_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "display_sessions"
            referencedColumns: ["id", "org_id", "location_id"]
          },
        ]
      }
      display_sessions: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          board_id: string | null
          config_revision: number
          created_at: string
          created_by: string | null
          description: string | null
          display_mode: string
          failed_at: string | null
          failure_code: string | null
          failure_message_safe: string | null
          fallback_board_id: string | null
          fallback_policy: string
          health_state: string
          id: string
          last_health_at: string | null
          location_id: string
          name: string
          org_id: string
          paused_at: string | null
          paused_by: string | null
          readiness_checked_at: string | null
          readiness_state: string
          recovered_at: string | null
          resumed_at: string | null
          session_type: string
          settings: Json
          shared_layout_id: string | null
          started_at: string | null
          started_by: string | null
          starting_at: string | null
          status: string
          stopped_at: string | null
          stopped_by: string | null
          stopping_at: string | null
          template_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          board_id?: string | null
          config_revision?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_mode?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message_safe?: string | null
          fallback_board_id?: string | null
          fallback_policy?: string
          health_state?: string
          id?: string
          last_health_at?: string | null
          location_id: string
          name: string
          org_id: string
          paused_at?: string | null
          paused_by?: string | null
          readiness_checked_at?: string | null
          readiness_state?: string
          recovered_at?: string | null
          resumed_at?: string | null
          session_type?: string
          settings?: Json
          shared_layout_id?: string | null
          started_at?: string | null
          started_by?: string | null
          starting_at?: string | null
          status?: string
          stopped_at?: string | null
          stopped_by?: string | null
          stopping_at?: string | null
          template_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          board_id?: string | null
          config_revision?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_mode?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message_safe?: string | null
          fallback_board_id?: string | null
          fallback_policy?: string
          health_state?: string
          id?: string
          last_health_at?: string | null
          location_id?: string
          name?: string
          org_id?: string
          paused_at?: string | null
          paused_by?: string | null
          readiness_checked_at?: string | null
          readiness_state?: string
          recovered_at?: string | null
          resumed_at?: string | null
          session_type?: string
          settings?: Json
          shared_layout_id?: string | null
          started_at?: string | null
          started_by?: string | null
          starting_at?: string | null
          status?: string
          stopped_at?: string | null
          stopped_by?: string | null
          stopping_at?: string | null
          template_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "display_sessions_board_workspace_fk"
            columns: ["org_id", "board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "display_sessions_fallback_board_fk"
            columns: ["fallback_board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_sessions_location_id_org_id_fkey"
            columns: ["location_id", "org_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "display_sessions_shared_layout_id_org_id_location_id_fkey"
            columns: ["shared_layout_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "display_layouts"
            referencedColumns: ["id", "org_id", "location_id"]
          },
          {
            foreignKeyName: "display_sessions_template_fk"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "session_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          slug: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      media_workers: {
        Row: {
          capabilities: string[]
          created_at: string
          id: string
          last_seen_at: string | null
          max_concurrent_jobs: number
          metadata: Json
          name: string
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          capabilities?: string[]
          created_at?: string
          id?: string
          last_seen_at?: string | null
          max_concurrent_jobs?: number
          metadata?: Json
          name: string
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          capabilities?: string[]
          created_at?: string
          id?: string
          last_seen_at?: string | null
          max_concurrent_jobs?: number
          metadata?: Json
          name?: string
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_sold_out: boolean
          is_visible: boolean
          name: string
          org_id: string
          price: number
          section_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_sold_out?: boolean
          is_visible?: boolean
          name: string
          org_id: string
          price: number
          section_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_sold_out?: boolean
          is_visible?: boolean
          name?: string
          org_id?: string
          price?: number
          section_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_section_id_org_id_fkey"
            columns: ["section_id", "org_id"]
            isOneToOne: false
            referencedRelation: "menu_sections"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      menu_sections: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          menu_id: string
          name: string
          org_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean
          menu_id: string
          name: string
          org_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean
          menu_id?: string
          name?: string
          org_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_sections_menu_id_org_id_fkey"
            columns: ["menu_id", "org_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_location_id_org_id_fkey"
            columns: ["location_id", "org_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      organization_entitlements: {
        Row: {
          allow_display_groups: boolean
          allow_operational_notifications: boolean
          allow_resource_access_controls: boolean
          allow_session_groups: boolean
          allow_session_templates: boolean
          automation_tier: string
          health_retention_days: number
          history_retention_days: number
          max_asset_uploads_per_month: number | null
          max_boards: number
          max_concurrent_sessions: number
          max_display_groups: number
          max_displays: number
          max_displays_per_display_group: number
          max_displays_per_session: number
          max_displays_per_session_group: number
          max_members: number
          max_session_groups: number
          max_sessions_per_session_group: number
          org_id: string
          plan_code: string
          updated_at: string
        }
        Insert: {
          allow_display_groups?: boolean
          allow_operational_notifications?: boolean
          allow_resource_access_controls?: boolean
          allow_session_groups?: boolean
          allow_session_templates?: boolean
          automation_tier?: string
          health_retention_days?: number
          history_retention_days?: number
          max_asset_uploads_per_month?: number | null
          max_boards?: number
          max_concurrent_sessions?: number
          max_display_groups?: number
          max_displays?: number
          max_displays_per_display_group?: number
          max_displays_per_session?: number
          max_displays_per_session_group?: number
          max_members?: number
          max_session_groups?: number
          max_sessions_per_session_group?: number
          org_id: string
          plan_code: string
          updated_at?: string
        }
        Update: {
          allow_display_groups?: boolean
          allow_operational_notifications?: boolean
          allow_resource_access_controls?: boolean
          allow_session_groups?: boolean
          allow_session_templates?: boolean
          automation_tier?: string
          health_retention_days?: number
          history_retention_days?: number
          max_asset_uploads_per_month?: number | null
          max_boards?: number
          max_concurrent_sessions?: number
          max_display_groups?: number
          max_displays?: number
          max_displays_per_display_group?: number
          max_displays_per_session?: number
          max_displays_per_session_group?: number
          max_members?: number
          max_session_groups?: number
          max_sessions_per_session_group?: number
          org_id?: string
          plan_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_entitlements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_entitlements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_entitlements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          invited_by: string | null
          joined_at: string
          org_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          joined_at?: string
          org_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          joined_at?: string
          org_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_preferences: {
        Row: {
          branding: Json
          created_at: string
          default_session_settings: Json
          locale: string
          org_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          branding?: Json
          created_at?: string
          default_session_settings?: Json
          locale?: string
          org_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          branding?: Json
          created_at?: string
          default_session_settings?: Json
          locale?: string
          org_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_preferences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_preferences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_preferences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          owner_user_id: string
          provisioning_kind: string
          slug: string
          status: string
          updated_at: string
          workspace_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          owner_user_id: string
          provisioning_kind?: string
          slug: string
          status?: string
          updated_at?: string
          workspace_type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          owner_user_id?: string
          provisioning_kind?: string
          slug?: string
          status?: string
          updated_at?: string
          workspace_type?: string
        }
        Relationships: []
      }
      plan_entitlements: {
        Row: {
          allow_display_groups: boolean
          allow_operational_notifications: boolean
          allow_resource_access_controls: boolean
          allow_session_groups: boolean
          allow_session_templates: boolean
          automation_tier: string
          availability: string
          availability_note: string | null
          health_retention_days: number
          history_retention_days: number
          max_asset_uploads_per_month: number | null
          max_boards: number
          max_concurrent_sessions: number
          max_display_groups: number
          max_displays: number
          max_displays_per_display_group: number
          max_displays_per_session: number
          max_displays_per_session_group: number
          max_members: number
          max_session_groups: number
          max_sessions_per_session_group: number
          plan_code: string
          updated_at: string
        }
        Insert: {
          allow_display_groups?: boolean
          allow_operational_notifications?: boolean
          allow_resource_access_controls?: boolean
          allow_session_groups?: boolean
          allow_session_templates?: boolean
          automation_tier?: string
          availability?: string
          availability_note?: string | null
          health_retention_days?: number
          history_retention_days?: number
          max_asset_uploads_per_month?: number | null
          max_boards: number
          max_concurrent_sessions: number
          max_display_groups?: number
          max_displays: number
          max_displays_per_display_group?: number
          max_displays_per_session?: number
          max_displays_per_session_group?: number
          max_members: number
          max_session_groups?: number
          max_sessions_per_session_group?: number
          plan_code: string
          updated_at?: string
        }
        Update: {
          allow_display_groups?: boolean
          allow_operational_notifications?: boolean
          allow_resource_access_controls?: boolean
          allow_session_groups?: boolean
          allow_session_templates?: boolean
          automation_tier?: string
          availability?: string
          availability_note?: string | null
          health_retention_days?: number
          history_retention_days?: number
          max_asset_uploads_per_month?: number | null
          max_boards?: number
          max_concurrent_sessions?: number
          max_display_groups?: number
          max_displays?: number
          max_displays_per_display_group?: number
          max_displays_per_session?: number
          max_displays_per_session_group?: number
          max_members?: number
          max_session_groups?: number
          max_sessions_per_session_group?: number
          plan_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          billing_interval: string | null
          billing_mode: string
          created_at: string
          currency: string | null
          is_active: boolean
          name: string
          plan_code: string
          stripe_price_id: string | null
          stripe_product_id: string | null
          unit_amount: number | null
          updated_at: string
          workspace_type: string
        }
        Insert: {
          billing_interval?: string | null
          billing_mode?: string
          created_at?: string
          currency?: string | null
          is_active?: boolean
          name: string
          plan_code: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          unit_amount?: number | null
          updated_at?: string
          workspace_type?: string
        }
        Update: {
          billing_interval?: string | null
          billing_mode?: string
          created_at?: string
          currency?: string | null
          is_active?: boolean
          name?: string
          plan_code?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          unit_amount?: number | null
          updated_at?: string
          workspace_type?: string
        }
        Relationships: []
      }
      presentation_assets: {
        Row: {
          checksum_sha256: string | null
          created_at: string
          error_message: string | null
          id: string
          lxc_manifest_key: string | null
          lxc_source_key: string | null
          mime_type: string
          org_id: string
          original_filename: string
          size_bytes: number | null
          slide_count: number | null
          status: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          checksum_sha256?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lxc_manifest_key?: string | null
          lxc_source_key?: string | null
          mime_type: string
          org_id: string
          original_filename: string
          size_bytes?: number | null
          slide_count?: number | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          checksum_sha256?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lxc_manifest_key?: string | null
          lxc_source_key?: string | null
          mime_type?: string
          org_id?: string
          original_filename?: string
          size_bytes?: number | null
          slide_count?: number | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presentation_assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "presentation_assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          onboarding_state: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          onboarding_state?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          onboarding_state?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resource_grants: {
        Row: {
          access_level: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          note: string | null
          org_id: string
          resource_id: string
          resource_type: string
          user_id: string
        }
        Insert: {
          access_level: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          org_id: string
          resource_id: string
          resource_type: string
          user_id: string
        }
        Update: {
          access_level?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          org_id?: string
          resource_id?: string
          resource_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "resource_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      scene_elements: {
        Row: {
          asset_id: string | null
          asset_page_id: string | null
          board_id: string
          config: Json
          created_at: string
          element_type: string
          height: number
          id: string
          is_locked: boolean
          is_visible: boolean
          name: string | null
          opacity: number
          render_mode: string
          rotation: number
          scene_id: string
          updated_at: string
          width: number
          workspace_id: string
          x: number
          y: number
          z_index: number
        }
        Insert: {
          asset_id?: string | null
          asset_page_id?: string | null
          board_id: string
          config?: Json
          created_at?: string
          element_type: string
          height: number
          id?: string
          is_locked?: boolean
          is_visible?: boolean
          name?: string | null
          opacity?: number
          render_mode: string
          rotation?: number
          scene_id: string
          updated_at?: string
          width: number
          workspace_id: string
          x?: number
          y?: number
          z_index?: number
        }
        Update: {
          asset_id?: string | null
          asset_page_id?: string | null
          board_id?: string
          config?: Json
          created_at?: string
          element_type?: string
          height?: number
          id?: string
          is_locked?: boolean
          is_visible?: boolean
          name?: string | null
          opacity?: number
          render_mode?: string
          rotation?: number
          scene_id?: string
          updated_at?: string
          width?: number
          workspace_id?: string
          x?: number
          y?: number
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "scene_elements_workspace_id_asset_id_asset_page_id_fkey"
            columns: ["workspace_id", "asset_id", "asset_page_id"]
            isOneToOne: false
            referencedRelation: "asset_pages"
            referencedColumns: ["workspace_id", "asset_id", "id"]
          },
          {
            foreignKeyName: "scene_elements_workspace_id_asset_id_fkey"
            columns: ["workspace_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "scene_elements_workspace_id_board_id_scene_id_fkey"
            columns: ["workspace_id", "board_id", "scene_id"]
            isOneToOne: false
            referencedRelation: "board_scenes"
            referencedColumns: ["workspace_id", "board_id", "id"]
          },
        ]
      }
      scenes: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          location_id: string
          menu_id: string | null
          name: string
          org_id: string
          presentation_asset_id: string | null
          scene_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          location_id: string
          menu_id?: string | null
          name: string
          org_id: string
          presentation_asset_id?: string | null
          scene_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          location_id?: string
          menu_id?: string | null
          name?: string
          org_id?: string
          presentation_asset_id?: string | null
          scene_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scenes_location_id_org_id_fkey"
            columns: ["location_id", "org_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "scenes_menu_id_org_id_location_id_fkey"
            columns: ["menu_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id", "org_id", "location_id"]
          },
          {
            foreignKeyName: "scenes_presentation_asset_id_org_id_fkey"
            columns: ["presentation_asset_id", "org_id"]
            isOneToOne: false
            referencedRelation: "presentation_assets"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      screen_pairing_codes: {
        Row: {
          attempt_count: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          locked_until: string | null
          screen_id: string
        }
        Insert: {
          attempt_count?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          locked_until?: string | null
          screen_id: string
        }
        Update: {
          attempt_count?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          locked_until?: string | null
          screen_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_pairing_codes_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: true
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      screens: {
        Row: {
          claimed_at: string | null
          created_at: string
          device_token_hash: string
          id: string
          last_seen_at: string | null
          location_id: string | null
          name: string
          org_id: string | null
          revoked_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          device_token_hash: string
          id?: string
          last_seen_at?: string | null
          location_id?: string | null
          name?: string
          org_id?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          device_token_hash?: string
          id?: string
          last_seen_at?: string | null
          location_id?: string | null
          name?: string
          org_id?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screens_location_id_org_id_fkey"
            columns: ["location_id", "org_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      session_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          correlation_id: string | null
          event_type: string
          id: number
          metadata: Json
          occurred_at: string
          org_id: string
          resource_id: string | null
          resource_type: string | null
          screen_id: string | null
          session_id: string | null
          source: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string
          correlation_id?: string | null
          event_type: string
          id?: never
          metadata?: Json
          occurred_at?: string
          org_id: string
          resource_id?: string | null
          resource_type?: string | null
          screen_id?: string | null
          session_id?: string | null
          source?: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          correlation_id?: string | null
          event_type?: string
          id?: never
          metadata?: Json
          occurred_at?: string
          org_id?: string
          resource_id?: string | null
          resource_type?: string | null
          screen_id?: string | null
          session_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "session_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_events_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "display_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_health_summary"
            referencedColumns: ["session_id"]
          },
        ]
      }
      session_group_members: {
        Row: {
          added_at: string
          added_by: string | null
          group_id: string
          id: string
          member_order: number
          org_id: string
          session_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          group_id: string
          id?: string
          member_order?: number
          org_id: string
          session_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          group_id?: string
          id?: string
          member_order?: number
          org_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "session_group_health"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "session_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "session_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_group_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_group_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "session_group_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_group_members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "display_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_group_members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_health_summary"
            referencedColumns: ["session_id"]
          },
        ]
      }
      session_groups: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          org_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          org_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "session_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      session_template_slots: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          is_primary: boolean
          layout_id: string | null
          org_id: string
          rotation_degrees: number
          slot_label: string | null
          slot_order: number
          template_id: string
          viewport_height_percent: number
          viewport_width_percent: number
          viewport_x_percent: number
          viewport_y_percent: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          is_primary?: boolean
          layout_id?: string | null
          org_id: string
          rotation_degrees?: number
          slot_label?: string | null
          slot_order?: number
          template_id: string
          viewport_height_percent?: number
          viewport_width_percent?: number
          viewport_x_percent?: number
          viewport_y_percent?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          is_primary?: boolean
          layout_id?: string | null
          org_id?: string
          rotation_degrees?: number
          slot_label?: string | null
          slot_order?: number
          template_id?: string
          viewport_height_percent?: number
          viewport_width_percent?: number
          viewport_x_percent?: number
          viewport_y_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_template_slots_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "display_layouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_template_slots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_template_slots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "session_template_slots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_template_slots_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "session_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      session_templates: {
        Row: {
          archived_at: string | null
          board_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_mode: string
          fallback_board_id: string | null
          fallback_policy: string
          id: string
          name: string
          org_id: string
          settings: Json
          shared_layout_id: string | null
          source_session_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          archived_at?: string | null
          board_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_mode?: string
          fallback_board_id?: string | null
          fallback_policy?: string
          id?: string
          name: string
          org_id: string
          settings?: Json
          shared_layout_id?: string | null
          source_session_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          archived_at?: string | null
          board_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_mode?: string
          fallback_board_id?: string | null
          fallback_policy?: string
          id?: string
          name?: string
          org_id?: string
          settings?: Json
          shared_layout_id?: string | null
          source_session_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_templates_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_templates_fallback_board_id_fkey"
            columns: ["fallback_board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "session_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_templates_shared_layout_id_fkey"
            columns: ["shared_layout_id"]
            isOneToOne: false
            referencedRelation: "display_layouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_templates_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "display_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_templates_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "session_health_summary"
            referencedColumns: ["session_id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          role: string
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          org_id: string
          role?: string
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: string
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "team_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          last_org_id: string | null
          locale: string
          notifications: Json
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_org_id?: string | null
          locale?: string
          notifications?: Json
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_org_id?: string | null
          locale?: string
          notifications?: Json
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_last_org_id_fkey"
            columns: ["last_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_preferences_last_org_id_fkey"
            columns: ["last_org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "user_preferences_last_org_id_fkey"
            columns: ["last_org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_entitlement_snapshots: {
        Row: {
          changed_by: string | null
          entitlements: Json
          id: number
          org_id: string
          plan_code: string
          recorded_at: string
        }
        Insert: {
          changed_by?: string | null
          entitlements: Json
          id?: never
          org_id: string
          plan_code: string
          recorded_at?: string
        }
        Update: {
          changed_by?: string | null
          entitlements?: Json
          id?: never
          org_id?: string
          plan_code?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_entitlement_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_entitlement_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "workspace_entitlement_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_limits_overrides: {
        Row: {
          approved_at: string
          approved_by: string | null
          created_at: string
          expires_at: string | null
          max_asset_uploads_per_month: number | null
          max_boards: number | null
          max_concurrent_sessions: number | null
          max_displays: number | null
          max_members: number | null
          org_id: string
          reason: string
          updated_at: string
        }
        Insert: {
          approved_at?: string
          approved_by?: string | null
          created_at?: string
          expires_at?: string | null
          max_asset_uploads_per_month?: number | null
          max_boards?: number | null
          max_concurrent_sessions?: number | null
          max_displays?: number | null
          max_members?: number | null
          org_id: string
          reason: string
          updated_at?: string
        }
        Update: {
          approved_at?: string
          approved_by?: string | null
          created_at?: string
          expires_at?: string | null
          max_asset_uploads_per_month?: number | null
          max_boards?: number | null
          max_concurrent_sessions?: number | null
          max_displays?: number | null
          max_members?: number | null
          org_id?: string
          reason?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_limits_overrides_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_limits_overrides_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "workspace_limits_overrides_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_purchases: {
        Row: {
          amount_total: number
          created_at: string
          currency: string
          id: string
          offering_code: string
          purchased_at: string
          stripe_checkout_session_id: string
          stripe_customer_id: string
          stripe_payment_intent_id: string
          stripe_price_id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          amount_total: number
          created_at?: string
          currency: string
          id?: string
          offering_code: string
          purchased_at?: string
          stripe_checkout_session_id: string
          stripe_customer_id: string
          stripe_payment_intent_id: string
          stripe_price_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          amount_total?: number
          created_at?: string
          currency?: string
          id?: string
          offering_code?: string
          purchased_at?: string
          stripe_checkout_session_id?: string
          stripe_customer_id?: string
          stripe_payment_intent_id?: string
          stripe_price_id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_purchases_offering_code_fkey"
            columns: ["offering_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["plan_code"]
          },
          {
            foreignKeyName: "workspace_purchases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_purchases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "workspace_purchases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          org_id: string
          owner_user_id: string
          plan_code: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          org_id: string
          owner_user_id: string
          plan_code: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          org_id?: string
          owner_user_id?: string
          plan_code?: string
          status?: string
          stripe_customer_id?: string
          stripe_price_id?: string
          stripe_subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "workspace_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["plan_code"]
          },
        ]
      }
    }
    Views: {
      display_group_health: {
        Row: {
          displays_degraded: number | null
          displays_healthy: number | null
          displays_online: number | null
          displays_total: number | null
          group_id: string | null
          health_state: string | null
          last_heartbeat_at: string | null
          live_sessions_touched: number | null
          name: string | null
          org_id: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "display_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "display_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      session_group_health: {
        Row: {
          displays_online: number | null
          displays_total: number | null
          group_id: string | null
          group_state: string | null
          name: string | null
          org_id: string | null
          sessions_live: number | null
          sessions_total: number | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "session_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      session_health_summary: {
        Row: {
          health_state: string | null
          last_heartbeat_at: string | null
          org_id: string | null
          screens_assigned: number | null
          screens_degraded: number | null
          screens_enabled: number | null
          screens_healthy: number | null
          screens_offline: number | null
          screens_online: number | null
          session_id: string | null
          status: string | null
        }
        Relationships: []
      }
      workspace_effective_entitlements: {
        Row: {
          allow_display_groups: boolean | null
          allow_operational_notifications: boolean | null
          allow_resource_access_controls: boolean | null
          allow_session_groups: boolean | null
          allow_session_templates: boolean | null
          automation_tier: string | null
          has_override: boolean | null
          health_retention_days: number | null
          history_retention_days: number | null
          max_asset_uploads_per_month: number | null
          max_boards: number | null
          max_concurrent_sessions: number | null
          max_display_groups: number | null
          max_displays: number | null
          max_displays_per_display_group: number | null
          max_displays_per_session: number | null
          max_displays_per_session_group: number | null
          max_members: number | null
          max_session_groups: number | null
          max_sessions_per_session_group: number | null
          org_id: string | null
          plan_code: string | null
        }
        Relationships: []
      }
      workspace_entitlements: {
        Row: {
          allow_display_groups: boolean | null
          allow_resource_access_controls: boolean | null
          allow_session_groups: boolean | null
          automation_tier: string | null
          max_asset_uploads_per_month: number | null
          max_boards: number | null
          max_concurrent_sessions: number | null
          max_displays: number | null
          max_displays_per_session: number | null
          max_members: number | null
          plan_code: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          allow_display_groups?: boolean | null
          allow_resource_access_controls?: boolean | null
          allow_session_groups?: boolean | null
          automation_tier?: string | null
          max_asset_uploads_per_month?: number | null
          max_boards?: number | null
          max_concurrent_sessions?: number | null
          max_displays?: number | null
          max_displays_per_session?: number | null
          max_members?: number | null
          plan_code?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          allow_display_groups?: boolean | null
          allow_resource_access_controls?: boolean | null
          allow_session_groups?: boolean | null
          automation_tier?: string | null
          max_asset_uploads_per_month?: number | null
          max_boards?: number | null
          max_concurrent_sessions?: number | null
          max_displays?: number | null
          max_displays_per_session?: number | null
          max_members?: number | null
          plan_code?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_entitlements_org_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_entitlements_org_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_entitlements_org_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_memberships: {
        Row: {
          created_at: string | null
          invited_by: string | null
          joined_at: string | null
          role: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace_usage_current"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_usage_current: {
        Row: {
          active_sessions_used: number | null
          asset_uploads_this_month: number | null
          boards_used: number | null
          displays_used: number | null
          members_used: number | null
          org_id: string | null
          quota_month: string | null
        }
        Insert: {
          active_sessions_used?: never
          asset_uploads_this_month?: never
          boards_used?: never
          displays_used?: never
          members_used?: never
          org_id?: string | null
          quota_month?: never
        }
        Update: {
          active_sessions_used?: never
          asset_uploads_this_month?: never
          boards_used?: never
          displays_used?: never
          members_used?: never
          org_id?: string | null
          quota_month?: never
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string | null
          name: string | null
          owner_user_id: string | null
          provisioning_kind: string | null
          slug: string | null
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          name?: string | null
          owner_user_id?: string | null
          provisioning_kind?: string | null
          slug?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          name?: string | null
          owner_user_id?: string | null
          provisioning_kind?: string | null
          slug?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_team_invitation: {
        Args: { raw_token: string }
        Returns: {
          org_id: string
          role: string
        }[]
      }
      asset_job_type_for_kind: {
        Args: { target_kind: string }
        Returns: string
      }
      board_snapshot: { Args: { target_board_id: string }; Returns: Json }
      claim_asset_processing_job: {
        Args: {
          lease_seconds?: number
          target_lease_token_hash: string
          target_worker_id: string
        }
        Returns: Json
      }
      claim_due_automations: {
        Args: { batch_size?: number; lease_seconds?: number; worker_id: string }
        Returns: {
          action_result: Json
          action_type: string | null
          actor_type: string
          attempt: number
          automation_id: string
          claimed_at: string | null
          created_at: string
          error_code: string | null
          error_message_safe: string | null
          finished_at: string | null
          id: string
          lease_expires_at: string | null
          lease_owner: string | null
          org_id: string
          scheduled_for: string
          session_id: string | null
          source: string
          started_at: string | null
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "automation_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claimed_display_session_id: { Args: never; Returns: string }
      complete_asset_processing_job: {
        Args: {
          target_asset_metadata?: Json
          target_job_id: string
          target_lease_token_hash: string
          target_manifest_path?: string
          target_outputs: Json
          target_page_count?: number
          target_worker_id: string
        }
        Returns: Json
      }
      complete_automation_run: {
        Args: {
          target_lease_owner: string
          target_result?: Json
          target_run_id: string
        }
        Returns: {
          action_result: Json
          action_type: string | null
          actor_type: string
          attempt: number
          automation_id: string
          claimed_at: string | null
          created_at: string
          error_code: string | null
          error_message_safe: string | null
          finished_at: string | null
          id: string
          lease_expires_at: string | null
          lease_owner: string | null
          org_id: string
          scheduled_for: string
          session_id: string | null
          source: string
          started_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "automation_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_board_revision: {
        Args: { target_board_id: string; target_label?: string }
        Returns: Json
      }
      create_session_from_template: {
        Args: {
          session_name: string
          target_location_id: string
          target_template_id: string
        }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          board_id: string | null
          config_revision: number
          created_at: string
          created_by: string | null
          description: string | null
          display_mode: string
          failed_at: string | null
          failure_code: string | null
          failure_message_safe: string | null
          fallback_board_id: string | null
          fallback_policy: string
          health_state: string
          id: string
          last_health_at: string | null
          location_id: string
          name: string
          org_id: string
          paused_at: string | null
          paused_by: string | null
          readiness_checked_at: string | null
          readiness_state: string
          recovered_at: string | null
          resumed_at: string | null
          session_type: string
          settings: Json
          shared_layout_id: string | null
          started_at: string | null
          started_by: string | null
          starting_at: string | null
          status: string
          stopped_at: string | null
          stopped_by: string | null
          stopping_at: string | null
          template_id: string | null
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "display_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_team_invitation: {
        Args: {
          expires_in_days?: number
          target_email: string
          target_org_id: string
          target_role?: string
        }
        Returns: {
          expires_at: string
          invitation_id: string
          token: string
        }[]
      }
      duplicate_session: {
        Args: {
          include_displays?: boolean
          new_name: string
          target_session_id: string
        }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          board_id: string | null
          config_revision: number
          created_at: string
          created_by: string | null
          description: string | null
          display_mode: string
          failed_at: string | null
          failure_code: string | null
          failure_message_safe: string | null
          fallback_board_id: string | null
          fallback_policy: string
          health_state: string
          id: string
          last_health_at: string | null
          location_id: string
          name: string
          org_id: string
          paused_at: string | null
          paused_by: string | null
          readiness_checked_at: string | null
          readiness_state: string
          recovered_at: string | null
          resumed_at: string | null
          session_type: string
          settings: Json
          shared_layout_id: string | null
          started_at: string | null
          started_by: string | null
          starting_at: string | null
          status: string
          stopped_at: string | null
          stopped_by: string | null
          stopping_at: string | null
          template_id: string | null
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "display_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enqueue_billing_notification: {
        Args: {
          target_notification_type: string
          target_payload?: Json
          target_send_after?: string
          target_stripe_event_id: string
          target_stripe_subscription_id: string
        }
        Returns: string
      }
      expire_stale_automation_leases: { Args: never; Returns: number }
      fail_asset_processing_job: {
        Args: {
          target_error_code: string
          target_error_message_safe: string
          target_job_id: string
          target_lease_token_hash: string
          target_worker_id: string
        }
        Returns: Json
      }
      fail_automation_run: {
        Args: {
          target_error_code: string
          target_error_message_safe?: string
          target_lease_owner: string
          target_run_id: string
        }
        Returns: {
          action_result: Json
          action_type: string | null
          actor_type: string
          attempt: number
          automation_id: string
          claimed_at: string | null
          created_at: string
          error_code: string | null
          error_message_safe: string | null
          finished_at: string | null
          id: string
          lease_expires_at: string | null
          lease_owner: string | null
          org_id: string
          scheduled_for: string
          session_id: string | null
          source: string
          started_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "automation_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_asset_upload: {
        Args: {
          target_asset_id: string
          target_size_bytes: number
          target_user_id: string
        }
        Returns: Json
      }
      finalize_paid_team_subscription: {
        Args: {
          target_cancel_at_period_end?: boolean
          target_period_end: string
          target_period_start: string
          target_plan_code: string
          target_status: string
          target_stripe_customer_id: string
          target_stripe_price_id: string
          target_stripe_subscription_id: string
          target_team_name: string
          target_team_slug: string
          target_user_id: string
        }
        Returns: string
      }
      finalize_personal_workspace_purchase: {
        Args: {
          target_amount_total: number
          target_currency: string
          target_stripe_checkout_session_id: string
          target_stripe_customer_id: string
          target_stripe_payment_intent_id: string
          target_stripe_price_id: string
          target_user_id: string
        }
        Returns: string
      }
      finalize_team_workspace_subscription: {
        Args: {
          target_cancel_at_period_end?: boolean
          target_period_end: string
          target_period_start: string
          target_status: string
          target_stripe_checkout_session_id: string
          target_stripe_customer_id: string
          target_stripe_price_id: string
          target_stripe_subscription_id: string
          target_user_id: string
        }
        Returns: string
      }
      heartbeat_asset_processing_job: {
        Args: {
          lease_seconds?: number
          target_job_id: string
          target_lease_token_hash: string
          target_worker_id: string
        }
        Returns: boolean
      }
      ingest_display_heartbeat: {
        Args: {
          target_board_id?: string
          target_cached_content_state?: string
          target_config_revision?: number
          target_error_code?: string
          target_error_message_safe?: string
          target_network_quality?: string
          target_orientation?: string
          target_player_version?: string
          target_resolution_height?: number
          target_resolution_width?: number
          target_screen_id: string
          target_session_id?: string
          target_sync_state?: string
        }
        Returns: {
          cached_content_state: string
          connection_state: string
          current_board_id: string | null
          current_config_revision: number | null
          current_session_id: string | null
          health_state: string
          last_error_code: string | null
          last_error_message_safe: string | null
          last_heartbeat_at: string | null
          last_sync_started_at: string | null
          last_sync_success_at: string | null
          network_quality: string | null
          org_id: string
          orientation: string | null
          player_version: string | null
          resolution_height: number | null
          resolution_width: number | null
          screen_id: string
          sync_state: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "display_health"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_resource_access: {
        Args: {
          target_org_id: string
          target_resource_id: string
          target_resource_type: string
        }
        Returns: string
      }
      provision_initial_personal_workspace: {
        Args: { p_display_name?: string; p_user_id: string }
        Returns: string
      }
      provision_paid_team: {
        Args: {
          creator_user_id: string
          selected_plan: string
          team_name: string
          team_slug: string
        }
        Returns: {
          org_id: string
          plan_code: string
          team_slug_result: string
        }[]
      }
      prune_expired_history: {
        Args: never
        Returns: {
          health_events_deleted: number
          session_events_deleted: number
        }[]
      }
      refresh_session_readiness: {
        Args: { target_session_id: string }
        Returns: string
      }
      reschedule_automation: {
        Args: { next_occurrence: string; target_automation_id: string }
        Returns: string
      }
      revoke_team_invitation: {
        Args: { target_invitation_id: string }
        Returns: boolean
      }
      save_board_draft: {
        Args: {
          expected_version: number
          target_board_id: string
          target_snapshot: Json
        }
        Returns: Json
      }
      save_session_as_template: {
        Args: {
          target_session_id: string
          template_description?: string
          template_name: string
        }
        Returns: {
          archived_at: string | null
          board_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_mode: string
          fallback_board_id: string | null
          fallback_policy: string
          id: string
          name: string
          org_id: string
          settings: Json
          shared_layout_id: string | null
          source_session_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "session_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      session_group_command: {
        Args: { command: string; target_group_id: string }
        Returns: {
          message: string
          resulting_status: string
          session_id: string
          session_name: string
          succeeded: boolean
        }[]
      }
      session_readiness: {
        Args: { target_session_id: string }
        Returns: {
          blocking: boolean
          check_key: string
          message: string
          passed: boolean
          resource_id: string
          resource_type: string
          severity: string
        }[]
      }
      session_readiness_summary: {
        Args: { target_session_id: string }
        Returns: {
          blocking_failures: number
          checks_total: number
          is_ready: boolean
          warnings: number
        }[]
      }
      session_transition: {
        Args: {
          failure_code?: string
          failure_message_safe?: string
          target_session_id: string
          target_status: string
        }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          board_id: string | null
          config_revision: number
          created_at: string
          created_by: string | null
          description: string | null
          display_mode: string
          failed_at: string | null
          failure_code: string | null
          failure_message_safe: string | null
          fallback_board_id: string | null
          fallback_policy: string
          health_state: string
          id: string
          last_health_at: string | null
          location_id: string
          name: string
          org_id: string
          paused_at: string | null
          paused_by: string | null
          readiness_checked_at: string | null
          readiness_state: string
          recovered_at: string | null
          resumed_at: string | null
          session_type: string
          settings: Json
          shared_layout_id: string | null
          started_at: string | null
          started_by: string | null
          starting_at: string | null
          status: string
          stopped_at: string | null
          stopped_by: string | null
          stopping_at: string | null
          template_id: string | null
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "display_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_asset_processing_job_outputs: {
        Args: {
          target_job_id: string
          target_lease_token_hash: string
          target_outputs: Json
          target_worker_id: string
        }
        Returns: boolean
      }
      sweep_stale_display_health: {
        Args: { stale_after?: string }
        Returns: number
      }
      sync_paid_team_subscription: {
        Args: {
          target_cancel_at_period_end: boolean
          target_cancelled_at: string
          target_period_end: string
          target_period_start: string
          target_plan_code: string
          target_status: string
          target_stripe_price_id: string
          target_stripe_subscription_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
