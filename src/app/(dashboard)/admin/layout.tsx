import {getCurrentUser} from '@/server/auth';
import {redirect} from 'next/navigation';
import {AccessDenied} from '@/components/ui/access-denied';
export default async function AdminLayout({children}:{children:React.ReactNode}){
 const user=await getCurrentUser();if(!user)redirect('/login');
 if(!user.isSuperAdmin)return <AccessDenied/>;
 return <>{children}</>;
}
