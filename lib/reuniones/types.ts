export type MeetingSource = 'mock' | 'transcript' | 'upload' | 'google_meet' | 'google_drive' | 'youtube';
export type MeetingStatus = 'draft' | 'processing' | 'processed' | 'error';

export type MeetingParticipant = { id: string; name: string; role?: string };
export type MeetingTranscriptSegment = { id: string; startSeconds: number; endSeconds?: number; speaker: string; text: string };
export type MeetingKeyPoint = { id: string; timestampSeconds: number; title: string; description: string };
export type MeetingActionItem = { id: string; responsible: string; action: string; deadline?: string; status: 'pending' | 'in_progress' | 'completed'; timestampSeconds?: number };

export type Meeting = {
  id: string;
  title: string;
  date: string;
  durationMinutes: number;
  branches: string[];
  source: MeetingSource;
  status: MeetingStatus;
  summary: string;
  participants: MeetingParticipant[];
  keyPoints: MeetingKeyPoint[];
  actions: MeetingActionItem[];
  transcript: MeetingTranscriptSegment[];
};

export function formatMeetingTimestamp(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
