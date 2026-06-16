import type { CSSProperties } from 'react';
import type { BoardCover } from '../types/trello';

export const presetBoardBackgroundsPath = '/trello-backgrounds';

export const boardCovers: BoardCover[] = [
  {
    type: 'image',
    value: `${presetBoardBackgroundsPath}/flash-redcom-training.png`,
  },
  {
    type: 'image',
    value: `${presetBoardBackgroundsPath}/1.png`,
  },
  {
    type: 'image',
    value: `${presetBoardBackgroundsPath}/2.png`,
  },
  {
    type: 'image',
    value: `${presetBoardBackgroundsPath}/3.png`,
  },
  {
    type: 'image',
    value: `${presetBoardBackgroundsPath}/4.png`,
  },
  {
    type: 'image',
    value: `/redcom_portada.png`,
  },
  {
    type: 'image',
    value:
      'linear-gradient(rgba(0, 35, 45, .2), rgba(0, 0, 0, .1)), radial-gradient(circle at 18% 20%, rgba(0, 242, 255, .9) 0 3px, transparent 4px), linear-gradient(135deg, #02111c, #04465d 55%, #00a7c6)',
  },
  {
    type: 'image',
    value:
      'linear-gradient(rgba(0,0,0,.08), rgba(0,0,0,.04)), radial-gradient(circle at 28% 54%, #f2f2f2 0 14px, #c7783d 15px 23px, transparent 24px), radial-gradient(circle at 66% 45%, #866444 0 17px, #4a2a16 18px 26px, transparent 27px), linear-gradient(120deg, #b55d20, #e6b57b 55%, #6b391a)',
  },
  {
    type: 'image',
    value:
      'radial-gradient(circle at 7% 22%, #75a6de 0 7px, transparent 8px), linear-gradient(160deg, #d9a06c 0 18%, #2d526d 19% 33%, #121b25 34% 100%), linear-gradient(135deg, #1f2f46, #070b10)',
  },
  {
    type: 'solid',
    value: '#0887c9',
  },
  {
    type: 'gradient',
    value: 'linear-gradient(135deg, #5f2eea, #00d4ff)',
  },
  {
    type: 'gradient',
    value: 'linear-gradient(135deg, #f97316, #ef4444)',
  },
];

function isImagePath(value: string) {
  return (value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://'))
    && !value.startsWith('linear-gradient')
    && !value.startsWith('radial-gradient');
}

export function getBoardCoverStyle(
  cover?: BoardCover,
  options: { overlay?: boolean; contain?: boolean } = {},
): CSSProperties {
  const fallback = boardCovers[1];
  const selectedCover = cover ?? fallback;
  const value = selectedCover.value || fallback.value;

  if (selectedCover.type === 'solid') {
    return { backgroundColor: value };
  }

  if (selectedCover.type === 'gradient' || !isImagePath(value)) {
    return { background: value };
  }

  const image = `url("${value}")`;
  return {
    backgroundColor: '#0f172a',
    backgroundImage: options.overlay
      ? `linear-gradient(rgba(0,0,0,.34), rgba(0,0,0,.58)), ${image}`
      : image,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: options.contain ? 'contain' : 'cover',
  };
}
