import { useState } from 'react';
import { API_ORIGIN, AdminApiError, adminLogin } from './adminClient';

interface AdminLoginProps {
  /** Called once a token has been stored and the session is good to go. */
  onAuthenticated: () => void;
}

interface LoginError {
  title: string;
  body?: string;
}

function describe(err: unknown): LoginError {
  if (err instanceof AdminApiError) {
    if (err.status === 401) {
      return { title: 'Incorrect password.', body: 'Check the value of ADMIN_PASSWORD the API was started with.' };
    }
    if (err.status === 503) {
      return {
        title: 'The server has no admin password configured.',
        body: 'ADMIN_PASSWORD is not set on the API. Locally that is a line like ADMIN_PASSWORD=your-password in backend/.env, followed by restarting the API container; on a deployment it is an environment variable on the project, followed by a redeploy.',
      };
    }
    if (err.status === 0) {
      return {
        title: 'Could not reach the server.',
        body: `No response from ${API_ORIGIN}. Check that the backend is running -- locally, that also means VITE_API_URL points at it.`,
      };
    }
    return { title: err.message };
  }
  return { title: 'Something went wrong while signing in.' };
}

export function AdminLogin({ onAuthenticated }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await adminLogin(password);
      setPassword('');
      onAuthenticated();
    } catch (err) {
      setError(describe(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <div className="admin-login-heading">
          <h1 className="admin-login-title">Admin Portal</h1>
          <p className="admin-login-sub">Life is Greater than Numbers</p>
        </div>

        <label className="admin-field">
          <span className="admin-field-label">Password</span>
          <input
            className="admin-input"
            type="password"
            name="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            disabled={submitting}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter the admin password"
          />
        </label>

        {error && (
          <div className="admin-login-error" role="alert">
            <strong>{error.title}</strong>
            {error.body && <span>{error.body}</span>}
          </div>
        )}

        <button className="admin-btn-primary" type="submit" disabled={submitting || !password.trim()}>
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

export default AdminLogin;
