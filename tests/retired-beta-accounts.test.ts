import {expect,it} from 'vitest';
import {isRetiredBetaAccount} from '../src/domain/retired-beta-accounts';
const old={id:'573eae2a-5c56-4b35-b6d7-346112227dbf',full_name:'[UJI REV] Direktur',email:'qa.rev18.director@siadocs.test',is_active:false};
it('hides only the identified inactive retired QA account',()=>{
 expect(isRetiredBetaAccount(old)).toBe(true);
 for(const change of [{id:'another'},{is_active:true},{full_name:'Budi Hartono'},{email:'budi.direktur@siadocs.test'}])expect(isRetiredBetaAccount({...old,...change})).toBe(false);
});
