import {it,expect,vi,afterEach} from 'vitest';
import {startLiveUpdates} from '../src/domain/live-updates';
afterEach(()=>vi.useRealTimers());
it('refreshes visible waiting tab on timer/focus, refuses overlap and retries safely after failure',async()=>{
 vi.useFakeTimers();const win=Object.assign(new EventTarget(),{setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval});const doc=Object.assign(new EventTarget(),{visibilityState:'visible'});const nav={onLine:true};let blocked=false;let resolve:()=>void=()=>{};
 const refresh=vi.fn().mockImplementationOnce(()=>new Promise<void>(r=>resolve=r)).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);const error=vi.fn();const stop=startLiveUpdates({refresh,blocked:()=>blocked,onError:error,poll:true},{window:win as any,document:doc as any,navigator:nav});
 await vi.advanceTimersByTimeAsync(20000);win.dispatchEvent(new Event('focus'));expect(refresh).toHaveBeenCalledTimes(1);resolve();await Promise.resolve();
 await vi.advanceTimersByTimeAsync(20000);expect(error).toHaveBeenCalledTimes(1);await vi.advanceTimersByTimeAsync(20000);expect(refresh).toHaveBeenCalledTimes(3);
 doc.visibilityState='hidden';await vi.advanceTimersByTimeAsync(20000);expect(refresh).toHaveBeenCalledTimes(3);
 doc.visibilityState='visible';nav.onLine=false;win.dispatchEvent(new Event('focus'));expect(refresh).toHaveBeenCalledTimes(3);
 nav.onLine=true;blocked=true;win.dispatchEvent(new Event('online'));expect(refresh).toHaveBeenCalledTimes(3);
 blocked=false;win.dispatchEvent(new Event('online'));await Promise.resolve();expect(refresh).toHaveBeenCalledTimes(4);stop();await vi.advanceTimersByTimeAsync(40000);win.dispatchEvent(new Event('focus'));expect(refresh).toHaveBeenCalledTimes(4);
});
