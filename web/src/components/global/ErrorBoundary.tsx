import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { EmptyState } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(e: Error) { console.error(e); }
  render() {
    if (this.state.error)
      return <EmptyState icon={<AlertTriangle />} title="משהו השתבש בעמוד הזה" description={this.state.error.message}
        action={<Button variant="primary" onClick={() => { this.setState({ error: null }); }}>נסו שוב</Button>} />;
    return this.props.children;
  }
}
