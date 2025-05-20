# Time Auction - Project Requirements

This document outlines all the components, dependencies, and services required to set up and run the Time Auction project.

## System Requirements

### Development Environment

- **Node.js**: v14.x or higher
- **npm**: v7.x or higher
- **TypeScript**: v4.x or higher

### Hosting Requirements

- **Memory**: At least 512MB RAM
- **Storage**: At least 1GB available disk space
- **Network**: Support for WebSocket connections
- **CPU**: 1+ core recommended for handling concurrent game sessions

## Dependencies

### Frontend Dependencies

#### Core Libraries
- **React**: UI library
- **TypeScript**: Type safety and developer experience
- **Vite**: Build tool and development server

#### UI and Styling
- **TailwindCSS**: Utility-first CSS framework
- **shadcn/ui**: Component library built on Radix UI
- **Lucide React**: Icon library

#### State Management and Data Fetching
- **React Context API**: For application state management
- **TanStack Query**: For data fetching and cache management
- **wouter**: Lightweight routing library

#### Form Handling
- **React Hook Form**: Form state management and validation
- **zod**: Schema validation

#### Real-time Communication
- **WebSockets**: Native browser API for real-time communication

### Backend Dependencies

#### Server Framework
- **Express**: Web server framework
- **TypeScript**: Type safety

#### Real-time Communication
- **ws**: WebSocket library for Node.js

#### Database (Optional)
- **PostgreSQL**: Relational database (optional, in-memory storage is used by default)
- **Drizzle ORM**: TypeScript ORM for database operations
- **@neondatabase/serverless**: Serverless PostgreSQL client

#### Authentication (Optional)
- **passport**: Authentication middleware
- **passport-local**: Local authentication strategy
- **openid-client**: OpenID Connect support for Replit Auth

## Configuration Files

- **package.json**: Project metadata and scripts
- **tsconfig.json**: TypeScript configuration
- **vite.config.ts**: Vite configuration
- **tailwind.config.ts**: TailwindCSS configuration
- **postcss.config.js**: PostCSS configuration
- **drizzle.config.ts**: Drizzle ORM configuration

## Environment Variables

### Required Environment Variables
- **PORT**: Server port (defaults to 5000 if not provided)
- **NODE_ENV**: Environment mode (development/production)

### Optional Environment Variables
- **DATABASE_URL**: PostgreSQL connection string (for database mode)
- **SESSION_SECRET**: Secret for session encryption (required for authentication)
- **REPLIT_DOMAINS**: Comma-separated list of allowed domains (for Replit Auth)
- **REPL_ID**: Replit application ID (for Replit Auth)
- **ISSUER_URL**: OpenID Connect issuer URL (for Replit Auth)

## External Services

The Time Auction game primarily runs as a self-contained application without external service dependencies. However, when deploying to specific platforms, you may need:

### Replit Deployment
When deploying to Replit:
- A Replit account
- Replit's hosting environment

### Custom Server Deployment
When deploying to a custom server:
- A server with Node.js installed
- A domain name (optional)
- SSL certificate (recommended for secure WebSocket connections)

## Development Tools

These tools are recommended but not required for development:

- **VS Code**: Recommended code editor
- **ESLint**: JavaScript/TypeScript linting
- **Prettier**: Code formatting
- **Git**: Version control
- **Chrome DevTools**: For debugging WebSocket connections and React components

## Security Considerations

- Use HTTPS in production environments to secure WebSocket connections
- Set proper CORS headers for API endpoints
- Validate all user inputs on the server-side
- Use environment variables for sensitive configuration
- Implement rate limiting to prevent abuse

## Performance Considerations

- Enable compression for HTTP responses
- Consider implementing connection pooling for database connections
- Optimize WebSocket message payload size
- Consider using a CDN for static assets in production
- Implement proper cleanup for disconnected WebSocket clients

## Testing Environment

- **jest** or **vitest**: JavaScript/TypeScript testing framework
- **testing-library/react**: React component testing
- **supertest**: HTTP assertions for testing API endpoints
- **Mock WebSocket**: Tools for mocking WebSocket connections in tests