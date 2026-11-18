import {expect,it} from 'vitest';
import {assertSupabaseTarget,PRODUCTION_SUPABASE_REF} from '../src/domain/deployment-target';
it('preview/staging menolak production walau label environment salah',()=>{const url=`https://${PRODUCTION_SUPABASE_REF}.supabase.co`;expect(()=>assertSupabaseTarget(url,'staging')).toThrow(/production/);expect(()=>assertSupabaseTarget(url,'production','preview')).toThrow(/production/);expect(()=>assertSupabaseTarget(url,'production','production')).not.toThrow();});
it('staging membutuhkan URL valid dan boleh memakai host terpisah',()=>{expect(()=>assertSupabaseTarget('','staging')).toThrow();expect(()=>assertSupabaseTarget('https://isolated.supabase.co','staging','preview')).not.toThrow();});
