import type {SignatureArea} from './workflow';
export function placementFromDrag(page:number,size:{width:number;height:number},start:{x:number;y:number},end:{x:number;y:number},defaultSize:{width:number;height:number}):SignatureArea{
 const clamp=(n:number,max:number)=>Math.max(0,Math.min(max,n));
 const x1=clamp(start.x,size.width),y1=clamp(start.y,size.height),x2=clamp(end.x,size.width),y2=clamp(end.y,size.height);
 const click=Math.abs(x2-x1)<4&&Math.abs(y2-y1)<4;
 const width=Math.min(size.width,click?defaultSize.width:Math.max(12,Math.abs(x2-x1)));
 const height=Math.min(size.height,click?defaultSize.height:Math.max(12,Math.abs(y2-y1)));
 const round=(n:number)=>Math.round(n*100)/100;
 return {page,x:round(Math.min(Math.min(x1,x2),size.width-width)),y:round(Math.min(Math.min(y1,y2),size.height-height)),width:round(width),height:round(height)};
}
