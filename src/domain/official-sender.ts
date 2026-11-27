export type CorrespondenceRole = 'STF' | 'GM' | 'SM' | 'DIR';

const ranks: Readonly<Record<CorrespondenceRole, number>> = {
  STF: 1, GM: 2, SM: 3, DIR: 4,
};

export interface OrganizationMember {
  id: string;
  role: CorrespondenceRole;
  unitId: string;
  assignmentId?: string;
  supervisorAssignmentId?: string | null;
}

export interface OrganizationUnit {
  id: string;
  parentId: string | null;
}

/** Inputs must come from active assignments and active organizational units. */
export function internalSenderOptions(
  creator: OrganizationMember,
  recipient: OrganizationMember,
  members: readonly OrganizationMember[],
  units: readonly OrganizationUnit[],
): OrganizationMember[] {
  if (creator.id === recipient.id) return [];
  if (ranks[creator.role] >= ranks[recipient.role]) return [creator];

  const parentByUnit = new Map(units.map(unit => [unit.id, unit.parentId]));
  const ancestors = new Set<string>();
  let unitId: string | null = creator.unitId;
  while (unitId && parentByUnit.has(unitId) && !ancestors.has(unitId)) {
    ancestors.add(unitId);
    unitId = parentByUnit.get(unitId) ?? null;
  }

  const supervisors = new Set<string>();
  const byAssignment = new Map(members.map(member => [member.assignmentId, member]));
  let supervisor = creator.supervisorAssignmentId;
  while (supervisor && !supervisors.has(supervisor)) {
    supervisors.add(supervisor);
    supervisor = byAssignment.get(supervisor)?.supervisorAssignmentId;
  }

  const eligibleRoles: readonly CorrespondenceRole[] = creator.role === 'STF'
    ? recipient.role === 'DIR' ? ['GM', 'SM'] : ['GM']
    : [recipient.role];

  return members.filter(member =>
    member.id !== recipient.id &&
    eligibleRoles.includes(member.role) &&
    (ancestors.has(member.unitId) || (!!member.assignmentId && supervisors.has(member.assignmentId))),
  );
}

export function resolveInternalSender(
  creator: OrganizationMember,
  recipient: OrganizationMember,
  members: readonly OrganizationMember[],
  units: readonly OrganizationUnit[],
  selectedId?: string,
) {
  const options = internalSenderOptions(creator, recipient, members, units);
  const sender = selectedId
    ? options.find(member => member.id === selectedId)
    : options.length === 1 ? options[0] : undefined;
  if (!sender) {
    throw new Error(options.length > 1
      ? 'Pilih pengirim resmi yang berwenang.'
      : 'Tidak ada pengirim resmi yang sah untuk penerima ini.');
  }
  return { senderId: sender.id, approverId: sender.id === creator.id ? null : sender.id };
}

export function organizationMember(id: string, role: string, unitId: string, assignmentId?: string, supervisorAssignmentId?: string | null): OrganizationMember | undefined {
  if (role === 'STF' || role === 'GM' || role === 'SM' || role === 'DIR') return { id, role, unitId, assignmentId, supervisorAssignmentId };
}
