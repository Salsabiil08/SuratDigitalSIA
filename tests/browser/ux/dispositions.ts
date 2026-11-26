export async function getDispositionsAction(){return (await fetch('/ux-data'+location.search)).json();}
export async function updateDispositionStatusAction(data:unknown){return (await fetch('/ux-action'+location.search,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)})).json();}
export async function createDispositionAction(){return {success:false,error:'Pembuatan tidak digunakan pada pengujian ini.'};}

export async function updateDispositionAction(){return {success:false,error:'Perubahan tidak digunakan pada fixture ini.'};}
