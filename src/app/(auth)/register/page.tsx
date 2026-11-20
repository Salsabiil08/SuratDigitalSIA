import {registrationOptions} from '@/server/registration';
import {RegisterClient} from './register-client';
export const dynamic='force-dynamic';
export default async function RegisterPage(){return <RegisterClient options={await registrationOptions()}/>;}
