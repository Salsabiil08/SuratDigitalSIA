import { describe, expect, it } from 'vitest';
import { internalSenderOptions, resolveInternalSender, type OrganizationMember } from '../src/domain/official-sender';

const staff: OrganizationMember = { id: 'staff', role: 'STF', unitId: 'fin' };
const gm: OrganizationMember = { id: 'gm', role: 'GM', unitId: 'fin' };
const otherGm: OrganizationMember = { id: 'other-gm', role: 'GM', unitId: 'other' };
const deputy: OrganizationMember = { id: 'deputy', role: 'GM', unitId: 'fin' };
const sm: OrganizationMember = { id: 'sm', role: 'SM', unitId: 'fin' };
const otherSm: OrganizationMember = { id: 'other-sm', role: 'SM', unitId: 'other' };
const director: OrganizationMember = { id: 'director', role: 'DIR', unitId: 'root' };
const units = [{ id: 'fin', parentId: 'root' }, { id: 'other', parentId: 'root' }, { id: 'root', parentId: null }];

describe('R.05 internal official sender rules', () => {
  it('uses the creator for a peer or subordinate without approval', () => {
    expect(resolveInternalSender(staff, { ...staff, id: 'peer' }, [], units)).toEqual({ senderId: 'staff', approverId: null });
    expect(resolveInternalSender(director, gm, [], units)).toEqual({ senderId: 'director', approverId: null });
    expect(resolveInternalSender(gm, otherGm, [], units)).toEqual({ senderId: 'gm', approverId: null });
  });

  it('uses a related GM for a Staff letter to a GM or SM', () => {
    expect(resolveInternalSender(staff, otherGm, [gm, director], units)).toEqual({ senderId: 'gm', approverId: 'gm' });
    expect(resolveInternalSender(staff, sm, [gm, otherGm, otherSm, director], units)).toEqual({ senderId: 'gm', approverId: 'gm' });
    expect(internalSenderOptions(staff, sm, [otherGm, otherSm, director], units)).toEqual([]);
    expect(internalSenderOptions(staff, sm, [gm, sm], units)).not.toContain(sm);
  });

  it('offers only related GMs and SMs for a Staff letter to the Director', () => {
    const officials = [gm, sm, otherGm, otherSm, director];
    expect(internalSenderOptions(staff, director, officials, units)).toEqual([gm, sm]);
    expect(resolveInternalSender(staff, director, officials, units, 'sm').approverId).toBe('sm');
    expect(() => resolveInternalSender(staff, director, officials, units, 'other-sm')).toThrow();
  });

  it('keeps the recipient-level rule for a creator above Staff', () => {
    expect(internalSenderOptions(gm, otherSm, [staff, gm, sm, director], units)).toEqual([sm]);
  });

  it('blocks self-addressed and directly addressed letters to the only eligible superior', () => {
    expect(internalSenderOptions(gm, gm, [gm], units)).toEqual([]);
    expect(() => resolveInternalSender(staff, gm, [gm, otherGm, director], units)).toThrow('Tidak ada pengirim resmi');
  });

  it('requires selection when multiple officials qualify and rejects a forged choice', () => {
    expect(() => resolveInternalSender(staff, otherGm, [gm, deputy], units)).toThrow('Pilih pengirim resmi');
    expect(resolveInternalSender(staff, otherGm, [gm, deputy], units, 'deputy').approverId).toBe('deputy');
    expect(() => resolveInternalSender(staff, gm, [gm, deputy, otherGm], units, 'other-gm')).toThrow();
  });
});
