export type FeedbackCategory = 'bug' | 'suggestion' | 'question' | 'other' | 'rating';

export interface FeedbackRequest {
  category: FeedbackCategory;
  rating?: number;
  message?: string;
  email?: string;
}
