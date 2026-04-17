import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkersPage from './Workers';
import { MemoryRouter } from 'react-router-dom';

const toastMock = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

const workerListMock = vi.fn();
const workerCreateMock = vi.fn();
const workerUpdateMock = vi.fn();
const workerDeleteMock = vi.fn();
vi.mock('@/entities/Worker', () => ({
  Worker: {
    list: workerListMock,
    create: workerCreateMock,
    update: workerUpdateMock,
    delete: workerDeleteMock,
  },
}));

const userMeMock = vi.fn();
const userListMock = vi.fn();
vi.mock('@/entities/User', () => ({
  User: {
    me: userMeMock,
    list: userListMock,
  },
}));

vi.mock('@/entities/Assignment', () => ({ Assignment: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/entities/Project', () => ({ Project: { list: vi.fn().mockResolvedValue([]) } }));

vi.mock('../components/dashboard/GanttChart', () => ({ default: () => <div data-testid="gantt">Gantt</div> }));
vi.mock('../components/workers/WorkerForm', () => ({ default: () => <div data-testid="worker-form">WorkerForm</div> }));
vi.mock('../components/workers/WorkersTable', () => ({
  default: ({ workers }) => (
    <div data-testid="workers-table">
      {workers.map((w) => (
        <div key={w.id}>{`${w.first_name || ''} ${w.last_name || ''}`}</div>
      ))}
    </div>
  ),
}));
vi.mock('../components/workers/WorkerFilters', () => ({ default: () => <div data-testid="worker-filters">WorkerFilters</div> }));

describe('WorkersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workerListMock.mockResolvedValue([{ id: '1', first_name: 'Petr', last_name: 'Hollmann', specializations: [], availability: 'available', seniority: 'senior' }]);
    userMeMock.mockResolvedValue({ id: 'u1', role: 'admin', worker_profile_id: null });
    userListMock.mockResolvedValue([]);
  });

  it('loads worker data and renders the table', async () => {
    render(
      <MemoryRouter>
        <WorkersPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Načítání dat/i)).toBeInTheDocument();
    await waitFor(() => expect(workerListMock).toHaveBeenCalledTimes(1));

    expect(screen.getByTestId('workers-table')).toBeInTheDocument();
    expect(screen.getByTestId('workers-table')).toHaveTextContent('Petr Hollmann');
  });

  it('shows error alert and toast when loading fails', async () => {
    workerListMock.mockRejectedValueOnce(new Error('Test failure'));

    render(
      <MemoryRouter>
        <WorkersPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Nepodařilo se načíst data.');
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });
});
