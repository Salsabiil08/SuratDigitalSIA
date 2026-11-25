/** Higher numeric level means higher position in the existing SIA structure. */
export function higherReviewer(creatorLevel: number, reviewerLevel: number) {
  return creatorLevel > 0 && reviewerLevel > creatorLevel;
}

/** The SIA role order is explicit; technical administrators are not business reviewers. */
export function roleReviewer(creatorCode:string,reviewerCode:string){
 const rank:Record<string,number>={STF:1,GM:2,SM:3,DIR:4};
 return !!rank[creatorCode] && !!rank[reviewerCode] && rank[reviewerCode]!>rank[creatorCode]!;
}
