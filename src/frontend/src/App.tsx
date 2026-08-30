import { Route, Routes } from 'react-router-dom';
import { Shell } from '@/components/layout/Shell';
import { Dashboard } from '@/pages/Dashboard';
import { Scrapers } from '@/pages/Scrapers';
import { Builder } from '@/pages/Builder';
import { Runs } from '@/pages/Runs';
import { RunView } from '@/pages/RunView';
import { Data } from '@/pages/Data';
import { Store } from '@/pages/Store';
import { Settings } from '@/pages/Settings';
import { NotFound } from '@/pages/NotFound';

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/scrapers" element={<Scrapers />} />
        <Route path="/scrapers/new" element={<Builder />} />
        <Route path="/scrapers/:id" element={<Builder />} />
        <Route path="/runs" element={<Runs />} />
        <Route path="/runs/:id" element={<RunView />} />
        <Route path="/data" element={<Data />} />
        <Route path="/store" element={<Store />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Shell>
  );
}
