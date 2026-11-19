export interface Review {
  id: string;
  punctuality: number;
  communication: number;
  quality: number;
  comment: string | null;
  createdAt: string;
}
export interface PublicReview extends Review { rating: number; authorName: string }
export interface ReviewSummary {
  reviewCount: number;
  averageRating: number | null;
  averagePunctuality: number | null;
  averageCommunication: number | null;
  averageQuality: number | null;
  completedWalkCount: number;
}
export interface ReviewsPage {
  sitter: { id: string; displayName: string; city: string; photoUrl: string | null };
  summary: ReviewSummary;
  items: PublicReview[];
  nextCursor: string | null;
}
export interface ReviewInput { punctuality: number; communication: number; quality: number; comment?: string }
