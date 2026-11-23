export async function getLetterComments(){return (await fetch('/comment-data')).json();}
export async function postLetterComment(letterId:string,body:string,key:string){return (await fetch('/comment-action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({letterId,body,key})})).json();}
