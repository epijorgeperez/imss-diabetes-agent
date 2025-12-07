# IMSS Diabetes Agent - Frontend

Production-ready Next.js 14 frontend for the IMSS Diabetes Agent with custom SSE streaming, markdown rendering, and chat persistence.

## Features

- **Custom SSE Streaming**: Real-time streaming from Agency Swarm backend
- **Rich Markdown Rendering**: Tables, code blocks with syntax highlighting, images
- **File/Image Handling**: Automatic URL transformation for backend artifacts
- **Chat Persistence**: localStorage-based conversation history
- **Professional UI**: Enterprise AI style with IMSS branding

## Getting Started

### Prerequisites

- Node.js 18+ 
- Backend running on `http://127.0.0.1:8001` (or configure via env)

### Installation

```bash
cd frontend
npm install
```

### Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8001
# Optional: NEXT_PUBLIC_API_TOKEN=your-token-here
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main chat page
│   └── globals.css         # Global styles + IMSS theme
├── components/
│   ├── ui/                # Shadcn UI components
│   ├── chat/              # Chat components
│   │   ├── ChatInterface.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageInput.tsx
│   │   ├── Sidebar.tsx
│   │   └── MarkdownRenderer.tsx
│   └── artifacts/          # File/image components
├── hooks/
│   ├── useAgencyStream.ts # SSE streaming hook
│   ├── useChatId.ts       # Chat ID management
│   └── useChatHistory.ts  # localStorage persistence
├── lib/
│   ├── api-client.ts      # API configuration
│   └── utils.ts           # Utilities
└── types/
    └── chat.ts            # TypeScript interfaces
```

## Key Components

### useAgencyStream

Custom hook that handles SSE streaming from the backend:
- Parses SSE events (`new_agent`, `tool`, `message`, `final_response`)
- Manages streaming state and tool calls
- Handles errors and completion

### MarkdownRenderer

Renders markdown with:
- Syntax-highlighted code blocks (with copy button)
- Tables (via remark-gfm)
- Images (with backend URL transformation)
- Download links (styled as cards)

### ChatInterface

Main chat component that:
- Integrates streaming hook
- Manages message state
- Persists to localStorage
- Shows tool calls and loading states

## Backend Integration

The frontend connects to:
- `POST /imss-diabetes/get_response_stream` - SSE streaming endpoint
- `GET /files/outputs/*` - Static file serving

Ensure CORS is configured on the backend for your frontend domain.

## Styling

Uses Tailwind CSS with IMSS green (`#13322B`) as primary color. Theme configured in `app/globals.css` and `tailwind.config.ts`.

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

Internal IMSS project.

