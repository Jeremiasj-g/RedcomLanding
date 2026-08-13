import type { Meeting } from './types';

export const mockMeetings: Meeting[] = [];

export function getMockMeeting(id: string) {
  return mockMeetings.find((meeting) => meeting.id === id) ?? null;
}
