import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Empty } from '@/components/ui/states';
import { Button } from '@/components/ui/button';

export function NotFound() {
  return (
    <div className="panel">
      <Empty
        icon={<Compass className="h-5 w-5" />}
        title="This page does not exist"
        body="The route you followed is not part of ScrapeForge."
        action={
          <Button asChild={false} variant="secondary">
            <Link to="/">Back to overview</Link>
          </Button>
        }
      />
    </div>
  );
}
