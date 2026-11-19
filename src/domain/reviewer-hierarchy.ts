/** Higher numeric level means higher position in the existing SIA structure. */
export function higherReviewer(creatorLevel: number, reviewerLevel: number) {
  return creatorLevel > 0 && reviewerLevel > creatorLevel;
}
