import React from 'react';import {createRoot} from 'react-dom/client';import {ManualNumberForm} from '../../../src/components/letters/manual-number-form';import '../../../src/app/globals.css';
const options:any={user:{id:'maker',unit:{id:'finance'}},financeUnitId:'finance',people:[{id:'sm',name:'SM',title:'Senior Manager',position:'SM',signer:true},{id:'dir',name:'Dirut',title:'Direktur Utama',position:'DIR',signer:true}]};
createRoot(document.getElementById('root')!).render(<main className="p-5"><ManualNumberForm options={options} pending={[]}/></main>);
