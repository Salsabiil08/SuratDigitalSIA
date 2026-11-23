'use client';
import {useEffect} from 'react';
import {fieldMessage} from '@/domain/ui-feedback';
export function IndonesianValidation(){
 useEffect(()=>{
  function clear(event:Event){const el=event.target;if(!(el instanceof HTMLInputElement||el instanceof HTMLSelectElement||el instanceof HTMLTextAreaElement))return;el.setCustomValidity('');el.removeAttribute('aria-invalid');const id=el.dataset.validationId;if(id){document.getElementById(id)?.remove();el.setAttribute('aria-describedby',(el.getAttribute('aria-describedby')||'').split(' ').filter(x=>x!==id).join(' '));delete el.dataset.validationId;}}
  function invalid(event:Event){const el=event.target;if(!(el instanceof HTMLInputElement||el instanceof HTMLSelectElement||el instanceof HTMLTextAreaElement))return;const message=fieldMessage(el.validity,el);el.setCustomValidity(message);el.setAttribute('aria-invalid','true');if(el.dataset.validationId){document.getElementById(el.dataset.validationId)?.remove();el.setAttribute('aria-describedby',(el.getAttribute('aria-describedby')||'').split(' ').filter(x=>x!==el.dataset.validationId).join(' '));}const id='isian-'+crypto.randomUUID();const hint=document.createElement('p');hint.id=id;hint.className='text-xs text-red-700 mt-1';hint.textContent=message;el.insertAdjacentElement('afterend',hint);el.dataset.validationId=id;el.setAttribute('aria-describedby',[(el.getAttribute('aria-describedby')||''),id].filter(Boolean).join(' '));}
  document.addEventListener('invalid',invalid,true);document.addEventListener('input',clear,true);document.addEventListener('change',clear,true);
  return()=>{document.removeEventListener('invalid',invalid,true);document.removeEventListener('input',clear,true);document.removeEventListener('change',clear,true);};
 },[]);return null;
}
