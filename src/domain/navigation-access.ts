export interface NavigationAccess {
  correspondence: boolean;
  billing: boolean;
  review: boolean;
  approvals: boolean;
  signatures: boolean;
  administration: boolean;
}
export function navigationAccess(input: {
  hasAssignment: boolean; isSuperAdmin: boolean; positionCode?: string;
  isOfficialSigner: boolean; isFinance: boolean;
  reviewerAssigned: boolean; approverAssigned: boolean;
}): NavigationAccess {
  const official = ['SM','DIR'].includes(input.positionCode || '');
  return {
    correspondence: input.hasAssignment,
    billing: input.hasAssignment && input.isFinance,
    review: false,
    approvals: input.hasAssignment && (['GM','SM','DIR'].includes(input.positionCode || '') || input.approverAssigned),
    signatures: input.hasAssignment && official && input.isOfficialSigner,
    administration: input.isSuperAdmin,
  };
}
