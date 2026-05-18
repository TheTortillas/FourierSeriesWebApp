export type FeedbackCategory = 'bug' | 'suggestion' | 'question' | 'other' | 'rating';

export interface FeedbackRequest {
  category: FeedbackCategory;
  rating?: number;
  message?: string;
  email?: string;
}

export interface FeedbackItem {
  id: string;
  user_id: string | null;
  email: string | null;
  category: FeedbackCategory;
  rating: number | null;
  message: string | null;
  created_at: string;
}

export interface FeedbackListResponse {
  total: number;
  limit: number;
  offset: number;
  data: FeedbackItem[];
}

export interface UnifiedComment {
  source: 'feedback' | 'survey';
  id: string;
  user_id: string | null;
  email: string | null;
  type: string;
  content: string | null;
  created_at: string;
  rating: number | null;
}

export interface UnifiedCommentsResponse {
  total: number;
  limit: number;
  offset: number;
  data: UnifiedComment[];
}
