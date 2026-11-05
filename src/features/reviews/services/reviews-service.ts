import { apiRequest, authenticatedApiRequest } from "@/shared/api/api-client";
import { Review, ReviewInput, ReviewsPage } from "../types/reviews";

export function createReview(bookingId: string, input: ReviewInput, signal?: AbortSignal) {
  return authenticatedApiRequest<{ review: Review }>(`/bookings/${encodeURIComponent(bookingId)}/review`, { method: "POST", body: JSON.stringify(input), signal });
}
export function listSitterReviews(profileId: string, cursor?: string) {
  return apiRequest<ReviewsPage>(`/sitters/${encodeURIComponent(profileId)}/reviews${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
}
