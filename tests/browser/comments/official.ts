export async function createOfficialReplyAction(){await fetch('/official-reply',{method:'POST'});return {success:false,error:'Pembuatan surat tidak diperlukan untuk komentar.'};}
