type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      contributions: Table<
        {
          id: string
          fund_id: string
          user_id: string
          contributor_name: string
          amount: number
          created_at: string
          receipt_url: string | null
          receipt_verified: boolean
        },
        {
          id?: string
          fund_id: string
          user_id: string
          contributor_name: string
          amount: number
          created_at?: string
          receipt_url?: string | null
          receipt_verified?: boolean
        }
      >
      funds: Table<
        {
          id: string
          group_id: string
          goal_name: string
          target_amount: number
          currency: string | null
        },
        {
          id?: string
          group_id: string
          goal_name: string
          target_amount: number
          currency?: string | null
        }
      >
      group_members: Table<
        {
          group_id: string
          profile_id: string
          role?: string | null
        },
        {
          group_id: string
          profile_id: string
          role?: string | null
        }
      >
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
