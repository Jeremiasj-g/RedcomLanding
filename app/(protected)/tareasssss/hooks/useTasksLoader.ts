'use client';

import { useEffect, useState } from 'react';
import { fetchMyTasksByRange } from '@/lib/tasks';
import { useTasks } from '../TasksContext';

export function useTasksLoader(userId: string, range: { from: Date; to: Date }) {
  const { setTasks } = useTasks();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchMyTasksByRange(range.from.toISOString(), range.to.toISOString(), userId);
        if (!cancelled) setTasks(data);
      } catch (err) {
        console.error('Error fetching tasks', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, range.from, range.to, setTasks]);

  return { loading };
}
