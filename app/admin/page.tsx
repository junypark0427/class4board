import AdminApp from './panel';
import { browserDatabaseConfig } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return <AdminApp databaseConfig={browserDatabaseConfig()}/>;
}
