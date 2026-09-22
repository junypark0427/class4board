import type { Post } from './shared';
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
export type Database = {
  public: {
    Tables: {
      posts: Table<Post>;
      admin_members: Table<{user_id:string;display_name:string}>;
      admin_actions: Table<{id:number;post_id:string;actor_id:string|null;actor_name:string;changes:Json;created_at:string}>;
    };
    Views: { [_ in never]: never };
    Functions: {
      submit_post: { Args: {p_category:string;p_title:string;p_content:string;p_teacher_requested:boolean;p_reply_requested:boolean;p_device_hash:string;p_receipt_hash:string|null}; Returns: undefined };
      lookup_result: { Args: {p_receipt_hash:string}; Returns: {status:Post['status'];reply:string;updated_at:string}[] };
      moderate_post: { Args: {p_id:string;p_version:number;p_status:string;p_hidden:boolean;p_admin_note:string;p_reply:string}; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
