"use server";
import {requireUser} from '@/server/auth';
export async function getPendingReviewsAction(){await requireUser();return [];}
export async function decideReviewAction(_step:string,_version:string,_revision:number,_action:'COMMENT'|'PASS'|'REQUEST_REVISION',_note?:string){await requireUser();return {success:false,error:'Pemeriksaan isi dilakukan melalui Persetujuan Surat.'};}
