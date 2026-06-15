import type { Board, BoardCover, BoardList, ChatMessage, Workspace, WorkspaceMember } from '../types/trello';

export const workspacesMock: Workspace[] = [
  {
    id: 'ws-corrales',
    name: 'Espacio de trabajo de Corrales José Luis',
    avatar: 'E',
    color: 'orange',
    visibility: 'privado',
    expanded: false,
  },
  {
    id: 'ws-trello',
    name: 'Espacio de trabajo de Trello',
    avatar: 'E',
    color: 'pink',
    visibility: 'privado',
    expanded: false,
  },
  {
    id: 'ws-facultad',
    name: 'Facultad',
    avatar: 'F',
    color: 'red',
    visibility: 'privado',
    expanded: true,
  },
];

export const boardCovers: BoardCover[] = [
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

export const boardsMock: Board[] = [
  {
    id: 'board-ingsoft2',
    workspaceId: 'ws-facultad',
    title: 'IngSoft2',
    cover: boardCovers[0],
    visibility: 'privado',
    favorite: false,
    memberIds: ['member-jeremias', 'member-ruben'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'board-bd1',
    workspaceId: 'ws-facultad',
    title: 'Proyecto Base de Datos 1',
    cover: boardCovers[1],
    visibility: 'privado',
    favorite: false,
    memberIds: ['member-jeremias'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'board-taller2-proyecto',
    workspaceId: 'ws-facultad',
    title: 'Proyecto Taller 2',
    cover: boardCovers[2],
    visibility: 'publico',
    favorite: false,
    memberIds: ['member-jeremias', 'member-santiago'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'board-taller2',
    workspaceId: 'ws-facultad',
    title: 'Taller 2',
    cover: boardCovers[3],
    visibility: 'privado',
    favorite: false,
    memberIds: ['member-jeremias'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const boardListsMock: BoardList[] = [
  {
    id: 'list-ideas',
    boardId: 'board-ingsoft2',
    title: 'Ideas',
    cards: [
      {
        id: 'card-1',
        title: 'Definir entidades principales',
        description: 'Empleado, empresa, beneficio, préstamo y usuario.',
        labels: ['blue'],
        members: ['JG', 'RG'],
        checklists: [
          {
            id: 'checklist-victor',
            title: 'VictorCheck',
            items: [
              { id: 'checkitem-1', title: 'Revisar entidades principales', completed: false },
              { id: 'checkitem-2', title: 'Validar relaciones', completed: false },
            ],
          },
        ],
      },
      {
        id: 'card-2',
        title: 'Armar backlog inicial',
        labels: ['Sprint 1'],
        members: ['JG'],
      },
    ],
  },
  {
    id: 'list-progress',
    boardId: 'board-ingsoft2',
    title: 'En proceso',
    cards: [
      {
        id: 'card-3',
        title: 'Diseñar vista de colaboradores',
        labels: ['Frontend'],
        members: ['SP'],
        dueDate: 'Hoy',
      },
    ],
  },
  {
    id: 'list-done',
    boardId: 'board-ingsoft2',
    title: 'Hecho',
    cards: [
      {
        id: 'card-4',
        title: 'Estructura base React + TS',
        labels: ['Base'],
        members: ['JG'],
      },
    ],
  },
];

export const chatMessagesMock: ChatMessage[] = [
  {
    id: 'msg-1',
    boardId: 'board-ingsoft2',
    senderName: 'Ruben Garay',
    avatarText: 'RG',
    message: 'Subí los cambios del diseño base. Revisen si el flujo de tableros les queda cómodo.',
    sentAt: '09:42',
  },
  {
    id: 'msg-2',
    boardId: 'board-ingsoft2',
    senderName: 'Jeremias Goytia',
    avatarText: 'JG',
    message: 'Perfecto, dejo esta bandeja preparada para reemplazarla por sockets cuando conectemos backend.',
    sentAt: '09:45',
    isCurrentUser: true,
  },
  {
    id: 'msg-3',
    boardId: 'board-ingsoft2',
    senderName: 'Santiago Peralta',
    avatarText: 'SP',
    message: 'También estaría bueno mostrar quién está conectado dentro del tablero.',
    sentAt: '09:51',
  },
];

export const workspaceMembersMock: WorkspaceMember[] = [
  {
    id: 'member-jeremias',
    workspaceId: 'ws-facultad',
    fullName: 'Jeremias Goytia',
    username: 'jeremiasgoytia',
    avatarText: 'JG',
    avatarColor: 'orange',
    boardCount: 4,
    role: 'Administrador',
    lastActivity: 'Jun 2024',
    status: 'member',
    isCurrentUser: true,
  },
  {
    id: 'member-ruben',
    workspaceId: 'ws-facultad',
    fullName: 'Ruben Garay',
    username: 'rubengaray1',
    avatarText: 'RG',
    avatarColor: 'orange',
    boardCount: 6,
    role: 'Administrador',
    lastActivity: 'Jun 2024',
    status: 'member',
  },
  {
    id: 'member-santiago',
    workspaceId: 'ws-facultad',
    fullName: 'Santiago Peralta',
    username: 'santiagoperalta17',
    avatarText: 'SP',
    avatarColor: 'red',
    boardCount: 6,
    role: 'Administrador',
    lastActivity: 'Jun 2024',
    status: 'member',
  },
  {
    id: 'member-laura',
    workspaceId: 'ws-facultad',
    fullName: 'Laura Benítez',
    username: 'laurabntz',
    avatarText: 'LB',
    avatarColor: 'blue',
    boardCount: 1,
    role: 'Miembro',
    lastActivity: 'May 2024',
    status: 'single-board-guest',
  },
  {
    id: 'member-martin',
    workspaceId: 'ws-facultad',
    fullName: 'Martín Fernández',
    username: 'martinfdz',
    avatarText: 'MF',
    avatarColor: 'green',
    boardCount: 2,
    role: 'Miembro',
    lastActivity: 'Abr 2024',
    status: 'multi-board-guest',
  },
  {
    id: 'member-ana',
    workspaceId: 'ws-facultad',
    fullName: 'Ana Medina',
    username: 'anamedina',
    avatarText: 'AM',
    avatarColor: 'purple',
    boardCount: 2,
    role: 'Observador',
    lastActivity: 'Mar 2024',
    status: 'multi-board-guest',
  },
];

export const boardLabelOptions = [
  { id: 'green', name: 'Prioridad baja', color: '#216e4e' },
  { id: 'yellow', name: 'En revisión', color: '#7f5f01' },
  { id: 'orange', name: 'Importante', color: '#a54800' },
  { id: 'red', name: 'Urgente', color: '#ae2e24' },
];
