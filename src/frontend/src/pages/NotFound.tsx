import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Empty } from '@/components/ui/states';

export function NotFound() {
  return (
    <div className="panel mx-auto max-w-[720px]">
      <Empty
        icon={<Compass className="h-5 w-5" />}
        title="This page does not exist"
        body="The route you followed is not part of ScrapeForge."
        action={
          <Link
            to="/"
            className="inline-flex h-9 items-center rounded border border-line bg-raised px-3.5 text-[13.5px] transition-colors hover:border-line-strong hover:bg-sunken"
          >
            Back to overview
          </Link>
        }
      />
    </div>
  );
}
