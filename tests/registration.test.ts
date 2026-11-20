import {describe,it,expect} from 'vitest';
import {registrationInput} from '../src/domain/registration';
function valid(){const f=new FormData();Object.entries({fullName:'Pegawai Baru',email:'NEW@EXAMPLE.TEST',password:'Testing123!',confirmPassword:'Testing123!',unitId:'unit',positionId:'staff'}).forEach(([k,v])=>f.set(k,v));return f;}
describe('Pendaftaran pengguna',()=>{
 it('normalizes email and accepts an additional employee',()=>{expect(registrationInput(valid()).email).toBe('new@example.test');});
 it('rejects password mismatch',()=>{const f=valid();f.set('confirmPassword','different');expect(()=>registrationInput(f)).toThrow();});
 it('rejects missing unit',()=>{const f=valid();f.set('unitId','');expect(()=>registrationInput(f)).toThrow();});
 it('rejects short password',()=>{const f=valid();f.set('password','123');expect(()=>registrationInput(f)).toThrow();});
});
