/** Higher numeric level means higher position in the existing SIA structure. */
export function higherReviewer(creatorLevel: number, reviewerLevel: number) {
  return creatorLevel > 0 && reviewerLevel > creatorLevel;
}

/** The SIA role order is explicit; technical administrators are not business reviewers. */
export const REVIEWER_ROLE_ORDER:Readonly<Record<string,number>>={STF:1,GM:2,SM:3,DIR:4};
export function roleReviewer(creatorCode:string,reviewerCode:string){
 const creator=REVIEWER_ROLE_ORDER[creatorCode]||0,reviewer=REVIEWER_ROLE_ORDER[reviewerCode]||0;
 return creator>0 && reviewer>creator;
}
